import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import { useToast } from './Toast.tsx';
import {
  User,
  Institution,
  StaffManagerialDetail,
  WorkflowRequest,
  WorkflowTemplate,
  AuditLogEntry,
} from '../../server/types.ts';
import {
  Search,
  Bell,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  Clock,
  ArrowRight,
  ShieldAlert,
  Building,
  UserCheck,
  XCircle,
  FileText,
  LogOut,
} from 'lucide-react';

interface Props {
  currentUser: User;
  onLogout: () => void;
  onFastSwitch: (role: 'super_admin' | 'admin' | 'staff') => void;
  onNavigateToTemplates?: () => void;
}

export const AdminDashboard: React.FC<Props> = ({
  currentUser,
  onLogout,
  onFastSwitch,
  onNavigateToTemplates,
}) => {
  const { showToast } = useToast();

  const validNavs = ['overview', 'requests', 'templates', 'staff', 'campus', 'activity', 'reports'];

  const [activeNav, setActiveNav] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const h = window.location.hash.replace('#', '');
      if (validNavs.includes(h)) return h;
    }
    return 'overview';
  });

  useEffect(() => {
    const handleHash = () => {
      const h = window.location.hash.replace('#', '');
      if (validNavs.includes(h)) {
        setActiveNav(h);
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const navigateToSection = (sectionId: string) => {
    setActiveNav(sectionId);
    window.location.hash = sectionId === 'overview' ? '' : sectionId;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [requests, setRequests] = useState<WorkflowRequest[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [staff, setStaff] = useState<StaffManagerialDetail[]>([]);
  const [activityLog, setActivityLog] = useState<AuditLogEntry[]>([]);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedTemplateIds, setExpandedTemplateIds] = useState<Record<string, boolean>>({});

  const toggleExpandTemplate = (id: string) => {
    setExpandedTemplateIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Modals
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState('');
  const [staffDept, setStaffDept] = useState('');
  const [staffManager, setStaffManager] = useState('');
  const [staffEmail, setStaffEmail] = useState('');

  // Custom Template Nomination Modal
  const [isNominateModalOpen, setIsNominateModalOpen] = useState(false);
  const [nomTitle, setNomTitle] = useState('');
  const [nomCategory, setNomCategory] = useState('Academic');
  const [nomUses, setNomUses] = useState(12);
  const [nomSteps, setNomSteps] = useState('Department HoD → Dean Academics & Research → Finance → Principal');
  const [nomFields, setNomFields] = useState('Staff ID & Designation, Request justification, Supporting document');

  // Institution Records Edit Form
  const [isEditingRecords, setIsEditingRecords] = useState(false);
  const [recordEmail, setRecordEmail] = useState('');
  const [recordPhone, setRecordPhone] = useState('');
  const [recordAddress, setRecordAddress] = useState('');

  // Request Review Modal
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<WorkflowRequest | null>(null);

  const loadCampusData = async () => {
    try {
      const insts = await api.getInstitutions();
      const currentInst = insts.find(i => i.id === currentUser.institutionId) || insts[0];
      setInstitution(currentInst);
      setRecordEmail(currentInst.email);
      setRecordPhone(currentInst.phone);
      setRecordAddress(currentInst.address);

      const [reqs, tpls, staffMembers, logs] = await Promise.all([
        api.getRequests(),
        api.getTemplates(),
        api.getStaff(currentInst.id),
        api.getAuditLogs(),
      ]);

      setRequests(reqs);
      setTemplates(tpls);
      setStaff(staffMembers);
      setActivityLog(logs);
    } catch (err: any) {
      showToast(err.message || 'Error loading campus records.');
    }
  };

  useEffect(() => {
    loadCampusData();
  }, [currentUser]);

  const scrollToSection = (sectionId: string) => {
    setActiveNav(sectionId);
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'Pending' || r.status === 'In review');
  const newRequestsCount = requests.filter(r => r.status === 'Pending').length;

  const filteredRequests = requests.filter(r => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      q === '' ||
      r.id.toLowerCase().includes(q) ||
      r.templateTitle.toLowerCase().includes(q) ||
      r.applicantName.toLowerCase().includes(q);
    const matchStatus =
      statusFilter === 'all' || r.status.toLowerCase() === statusFilter.toLowerCase();
    return matchSearch && matchStatus;
  });

  const filteredStaff = staff.filter(s => {
    const q = searchQuery.toLowerCase();
    return (
      q === '' ||
      s.name.toLowerCase().includes(q) ||
      s.role.toLowerCase().includes(q) ||
      s.dept.toLowerCase().includes(q)
    );
  });

  const openStaffModal = (existing?: StaffManagerialDetail) => {
    if (existing) {
      setEditingStaffId(existing.id);
      setStaffName(existing.name);
      setStaffRole(existing.role);
      setStaffDept(existing.dept);
      setStaffManager(existing.manager || '');
      setStaffEmail(existing.email || '');
    } else {
      setEditingStaffId(null);
      setStaffName('');
      setStaffRole('');
      setStaffDept('');
      setStaffManager('');
      setStaffEmail('');
    }
    setIsStaffModalOpen(true);
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institution) return;

    try {
      if (editingStaffId) {
        const updated = await api.updateStaff(editingStaffId, {
          name: staffName,
          role: staffRole,
          dept: staffDept,
          manager: staffManager,
          email: staffEmail,
        });
        setStaff(prev => prev.map(s => (s.id === editingStaffId ? updated : s)));
        showToast('Staff managerial details updated.');
      } else {
        const created = await api.createStaff({
          institutionId: institution.id,
          name: staffName,
          role: staffRole,
          dept: staffDept,
          manager: staffManager,
          email: staffEmail,
        });
        setStaff(prev => [created, ...prev]);
        showToast('Staff member added to campus directory.');
      }
      setIsStaffModalOpen(false);
      const freshLogs = await api.getAuditLogs();
      setActivityLog(freshLogs);
    } catch (err: any) {
      showToast(err.message || 'Failed to save staff record.');
    }
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    if (!confirm(`Delete ${name} from this institution directory?`)) return;
    try {
      await api.deleteStaff(id);
      setStaff(prev => prev.filter(s => s.id !== id));
      showToast('Staff details deleted from campus directory.');
      const freshLogs = await api.getAuditLogs();
      setActivityLog(freshLogs);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete staff.');
    }
  };

  const handleNominateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomTitle.trim()) return;

    try {
      await api.createNomination({
        title: nomTitle.trim(),
        category: nomCategory,
        uses: nomUses,
        details: {
          steps: nomSteps.split(/→|,|\n/).map(s => s.trim()).filter(Boolean),
          fields: nomFields.split(/,|\n/).map(s => s.trim()).filter(Boolean),
        },
      });

      setIsNominateModalOpen(false);
      setNomTitle('');
      showToast('Template nominated! Sent to Super Admin for shared review.');
    } catch (err: any) {
      showToast(err.message || 'Failed to nominate template.');
    }
  };

  const handleSaveRecords = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institution) return;

    try {
      const updated = await api.updateInstitution(institution.id, {
        email: recordEmail,
        phone: recordPhone,
        address: recordAddress,
      });
      setInstitution(updated);
      setIsEditingRecords(false);
      showToast('Campus institution records saved.');
      const freshLogs = await api.getAuditLogs();
      setActivityLog(freshLogs);
    } catch (err: any) {
      showToast(err.message || 'Failed to update campus records.');
    }
  };

  const handleMarkReviewed = async () => {
    if (!selectedRequest) return;
    try {
      const updated = await api.actionRequest(selectedRequest.id, 'Mark reviewed', 'Campus Admin verified submission.');
      setRequests(prev => prev.map(r => (r.id === updated.id ? updated : r)));
      setSelectedRequest(updated);
      setIsReviewModalOpen(false);
      showToast(`Request ${selectedRequest.id} marked as in review.`);
      const freshLogs = await api.getAuditLogs();
      setActivityLog(freshLogs);
    } catch (err: any) {
      showToast(err.message || 'Failed to mark reviewed.');
    }
  };

  const sectionLabels: Record<string, string> = {
    overview: 'Overview',
    requests: 'Requests',
    templates: 'Request Templates',
    staff: 'Staff directory',
    campus: 'Institution records',
    activity: 'Activity log',
    reports: 'Reports',
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-[#3F4A5A] flex font-sans">
      {/* AUTHENTIC SIDE PANEL (Persistent Left Navigation) */}
      <aside className="w-56 shrink-0 bg-[#F3F4F6] border-r border-[#E5E7EB] p-4 flex flex-col sticky top-0 h-screen shadow-xs z-30">
        <div>
          {/* Brand */}
          <div className="flex items-center gap-2.5 pb-4 border-b border-[#E5E7EB]">
            <div className="w-8 h-8 rounded-lg bg-[#123B6D] text-white flex items-center justify-center font-bold text-lg font-serif shadow-xs">
              P
            </div>
            <div>
              <b className="text-lg font-bold text-[#123B6D] tracking-tight">PaperTrail</b>
            </div>
          </div>

          <div className="py-2.5 text-[9px] font-bold tracking-wider text-[#3F4A5A]/80 uppercase truncate">
            {institution?.name || 'SRI SAIRAM ENGINEERING COLLEGE'}
          </div>
          <div className="text-[9px] uppercase font-bold tracking-widest text-[#3F4A5A]/60 px-1 py-1">
            Campus administration
          </div>

          {/* Navigation Links — Dedicated Landing Page per tab */}
          <nav className="flex flex-col gap-1 mt-1 text-xs">
            <button
              onClick={() => navigateToSection('overview')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-left transition-colors cursor-pointer ${
                activeNav === 'overview'
                  ? 'bg-[#123B6D] text-white font-bold shadow-xs'
                  : 'text-[#3F4A5A] hover:bg-white/80 hover:text-[#123B6D]'
              }`}
            >
              <span className="w-4 text-center">▦</span>
              <span>Overview</span>
            </button>

            <button
              onClick={() => navigateToSection('requests')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-left transition-colors cursor-pointer ${
                activeNav === 'requests'
                  ? 'bg-[#123B6D] text-white font-bold shadow-xs'
                  : 'text-[#3F4A5A] hover:bg-white/80 hover:text-[#123B6D]'
              }`}
            >
              <span className="w-4 text-center">▤</span>
              <span>Requests</span>
            </button>

            <button
              onClick={() => navigateToSection('templates')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-left transition-colors cursor-pointer ${
                activeNav === 'templates'
                  ? 'bg-[#123B6D] text-white font-bold shadow-xs'
                  : 'text-[#3F4A5A] hover:bg-white/80 hover:text-[#123B6D]'
              }`}
            >
              <span className="w-4 text-center">▧</span>
              <span>Request Templates</span>
            </button>

            <button
              onClick={() => navigateToSection('staff')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-left transition-colors cursor-pointer ${
                activeNav === 'staff'
                  ? 'bg-[#123B6D] text-white font-bold shadow-xs'
                  : 'text-[#3F4A5A] hover:bg-white/80 hover:text-[#123B6D]'
              }`}
            >
              <span className="w-4 text-center">♙</span>
              <span>Staff directory</span>
            </button>

            <button
              onClick={() => navigateToSection('campus')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-left transition-colors cursor-pointer ${
                activeNav === 'campus'
                  ? 'bg-[#123B6D] text-white font-bold shadow-xs'
                  : 'text-[#3F4A5A] hover:bg-white/80 hover:text-[#123B6D]'
              }`}
            >
              <span className="w-4 text-center">⌂</span>
              <span>Institution records</span>
            </button>

            <button
              onClick={() => navigateToSection('activity')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-left transition-colors cursor-pointer ${
                activeNav === 'activity'
                  ? 'bg-[#123B6D] text-white font-bold shadow-xs'
                  : 'text-[#3F4A5A] hover:bg-white/80 hover:text-[#123B6D]'
              }`}
            >
              <span className="w-4 text-center">◷</span>
              <span>Activity log</span>
            </button>

            <button
              onClick={() => navigateToSection('reports')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-left transition-colors cursor-pointer ${
                activeNav === 'reports'
                  ? 'bg-[#123B6D] text-white font-bold shadow-xs'
                  : 'text-[#3F4A5A] hover:bg-white/80 hover:text-[#123B6D]'
              }`}
            >
              <span className="w-4 text-center">◷</span>
              <span>Reports</span>
            </button>
          </nav>
        </div>

        {/* Profile Footer */}
        <div className="mt-auto border-t border-[#E5E7EB] pt-3 text-xs">
          <div className="font-bold text-[#123B6D] truncate">Campus Admin</div>
          <small className="block text-[#3F4A5A] text-[10px] truncate">{institution?.name || 'Sri Sairam Engineering College'}</small>
          <div className="flex items-center justify-end mt-2 pt-2 border-t border-[#E5E7EB]">
            <button
              onClick={onLogout}
              className="text-[10px] text-rose-600 hover:underline flex items-center gap-1 cursor-pointer font-medium"
            >
              <LogOut size={11} /> Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Header */}
        <header className="h-14 bg-white border-b border-[#E5E7EB] px-6 flex items-center justify-between sticky top-0 z-20">
          <span className="text-xs text-[#3F4A5A]">
            PaperTrail &nbsp;›&nbsp; Campus dashboard &nbsp;›&nbsp; <b className="text-[#123B6D]">{sectionLabels[activeNav] || 'Overview'}</b>
          </span>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F3F4F6] border border-[#E5E7EB] rounded-md text-[10px] font-semibold text-[#123B6D]">
              ▦ &nbsp;{institution?.name}
            </span>

            <button
              onClick={() => {
                setStatusFilter('Pending');
                navigateToSection('requests');
                showToast('Showing requests awaiting campus action.');
              }}
              className="flex items-center gap-1 px-2.5 py-1 bg-white border border-[#E5E7EB] rounded-md text-[11px] font-bold text-[#123B6D] cursor-pointer hover:bg-[#F3F4F6]"
            >
              <span>♧</span>
              <span>{newRequestsCount}</span>
            </button>

            {/* Role Switch */}
            <div className="flex items-center bg-[#F3F4F6] border border-[#E5E7EB] rounded-lg p-0.5 text-[11px]">
              <button
                onClick={() => onFastSwitch('super_admin')}
                className="px-2.5 py-1 rounded text-[#3F4A5A] hover:text-[#123B6D] font-medium transition-colors cursor-pointer"
              >
                Super Admin
              </button>
              <button
                onClick={() => onFastSwitch('admin')}
                className="px-2.5 py-1 rounded bg-[#123B6D] text-white font-bold shadow-xs cursor-pointer"
              >
                Admin
              </button>
              <button
                onClick={() => onFastSwitch('staff')}
                className="px-2.5 py-1 rounded text-[#3F4A5A] hover:text-[#123B6D] font-medium transition-colors cursor-pointer"
              >
                Staff
              </button>
            </div>
          </div>
        </header>

        {/* Content Body — Dedicated Landing Pages */}
        <main className="p-6 max-w-[1450px] mx-auto w-full space-y-6">
          {/* LANDING PAGE 1: OVERVIEW */}
          {activeNav === 'overview' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase font-bold text-[#123B6D] tracking-wider">
                    {institution?.name || 'Sri Sairam Engineering College'} · Campus Overview
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-[#123B6D] tracking-tight mt-0.5">
                    Good morning, Campus Admin
                  </h1>
                  <p className="text-xs text-[#3F4A5A] mt-0.5">
                    Review incoming requests, manage campus workflows, and monitor departmental approvals.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openStaffModal()}
                    className="px-3.5 py-2 bg-[#123B6D] hover:bg-[#0e2f57] text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>＋</span> Add Staff Member
                  </button>
                  <button
                    onClick={() => setIsNominateModalOpen(true)}
                    className="px-3.5 py-2 bg-white border border-[#E5E7EB] text-[#123B6D] hover:bg-[#F3F4F6] rounded-lg text-xs font-semibold shadow-xs flex items-center transition-colors cursor-pointer"
                  >
                    Nominate Template
                  </button>
                </div>
              </div>

              {/* Request Alert Banner */}
              <div className="p-4 bg-[#F3F4F6] border border-[#E5E7EB] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-lg bg-[#123B6D] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                    ♧
                  </span>
                  <div>
                    <b className="text-xs text-[#123B6D]">
                      {newRequestsCount > 0
                        ? `${newRequestsCount} staff requests are waiting for campus review`
                        : 'All campus requests have been reviewed'}
                    </b>
                    <p className="text-[11px] text-[#3F4A5A] mt-0.5">
                      {newRequestsCount > 0
                        ? `${newRequestsCount} requests require verification before progressing to central authorities.`
                        : `No pending submissions requiring action at this campus.`}
                    </p>
                  </div>
                </div>

                {newRequestsCount > 0 && (
                  <button
                    onClick={() => {
                      setStatusFilter('pending');
                      navigateToSection('requests');
                    }}
                    className="px-3.5 py-1.5 bg-[#123B6D] text-white rounded-lg text-xs font-semibold hover:bg-[#0e2f57] shrink-0 cursor-pointer shadow-xs"
                  >
                    Review requests →
                  </button>
                )}
              </div>

              {/* Metrics Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div
                  onClick={() => navigateToSection('requests')}
                  className="p-4 bg-white rounded-xl border border-[#E5E7EB] shadow-xs cursor-pointer hover:border-[#123B6D] hover:shadow-md transition-all group"
                >
                  <div className="flex justify-between text-xs text-[#3F4A5A]">
                    <span className="group-hover:text-[#123B6D] font-medium">Requests Received</span>
                    <span className="text-[#123B6D]">▤</span>
                  </div>
                  <strong className="block text-2xl font-bold text-[#123B6D] mt-2">
                    {institution?.requestCount || requests.length}
                  </strong>
                  <div className="flex items-center justify-between text-[10px] text-emerald-600 mt-1">
                    <span>All time · this campus</span>
                    <span className="text-[#123B6D] font-semibold">View All →</span>
                  </div>
                </div>

                <div
                  onClick={() => {
                    setStatusFilter('pending');
                    navigateToSection('requests');
                  }}
                  className="p-4 bg-white rounded-xl border border-[#E5E7EB] shadow-xs cursor-pointer hover:border-[#123B6D] hover:shadow-md transition-all group"
                >
                  <div className="flex justify-between text-xs text-[#3F4A5A]">
                    <span className="group-hover:text-[#123B6D] font-medium">Needs Attention</span>
                    <span className="text-amber-600">◷</span>
                  </div>
                  <strong className="block text-2xl font-bold text-amber-700 mt-2">
                    {pendingRequests.length}
                  </strong>
                  <div className="flex items-center justify-between text-[10px] text-amber-700 mt-1">
                    <span>Pending review</span>
                    <span className="text-[#123B6D] font-semibold">Take Action →</span>
                  </div>
                </div>

                <div
                  onClick={() => {
                    setStatusFilter('in review');
                    navigateToSection('requests');
                  }}
                  className="p-4 bg-white rounded-xl border border-[#E5E7EB] shadow-xs cursor-pointer hover:border-[#123B6D] hover:shadow-md transition-all group"
                >
                  <div className="flex justify-between text-xs text-[#3F4A5A]">
                    <span className="group-hover:text-[#123B6D] font-medium">In Progress</span>
                    <span className="text-[#123B6D]">↗</span>
                  </div>
                  <strong className="block text-2xl font-bold text-[#123B6D] mt-2">
                    {requests.filter(r => r.status === 'In review').length}
                  </strong>
                  <div className="flex items-center justify-between text-[10px] text-[#3F4A5A] mt-1">
                    <span>Moving through routes</span>
                    <span className="text-[#123B6D] font-semibold">Track →</span>
                  </div>
                </div>

                <div
                  onClick={() => navigateToSection('templates')}
                  className="p-4 bg-white rounded-xl border border-[#E5E7EB] shadow-xs cursor-pointer hover:border-[#123B6D] hover:shadow-md transition-all group"
                >
                  <div className="flex justify-between text-xs text-[#3F4A5A]">
                    <span className="group-hover:text-[#123B6D] font-medium">Active Templates</span>
                    <span className="text-[#123B6D]">▧</span>
                  </div>
                  <strong className="block text-2xl font-bold text-[#123B6D] mt-2">
                    {templates.length}
                  </strong>
                  <div className="flex items-center justify-between text-[10px] text-emerald-600 mt-1">
                    <span>Configured for campus</span>
                    <span className="text-[#123B6D] font-semibold">Library →</span>
                  </div>
                </div>
              </div>

              {/* Overview Recent Requests Preview */}
              <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-[#123B6D]">Recent Submissions</h2>
                    <p className="text-[11px] text-[#3F4A5A]">Latest applications originating from {institution?.name}</p>
                  </div>
                  <button
                    onClick={() => navigateToSection('requests')}
                    className="text-xs text-[#123B6D] font-bold hover:underline cursor-pointer"
                  >
                    View All Requests ({requests.length}) →
                  </button>
                </div>

                <div className="overflow-x-auto border border-[#E5E7EB] rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#F3F4F6] text-[#3F4A5A] uppercase text-[9px] font-bold border-b border-[#E5E7EB]">
                        <th className="py-2.5 px-3">Request</th>
                        <th className="py-2.5 px-3">Applicant</th>
                        <th className="py-2.5 px-3">Submitted</th>
                        <th className="py-2.5 px-3">Current stage</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]">
                      {requests.slice(0, 4).map(req => (
                        <tr key={req.id} className="hover:bg-[#F3F4F6]/50 transition-colors">
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-[#123B6D]">{req.id}</span>
                            <div className="text-[#3F4A5A]">{req.templateTitle}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-[#123B6D]">{req.applicantName}</div>
                            <div className="text-[10px] text-[#3F4A5A]/70">{req.applicantRole}</div>
                          </td>
                          <td className="py-2.5 px-3 text-[#3F4A5A]">
                            {new Date(req.submittedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-[#3F4A5A]">{req.currentStageName}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                req.status === 'Approved'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : req.status === 'In review'
                                  ? 'bg-[#123B6D]/10 text-[#123B6D]'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {req.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => {
                                setSelectedRequest(req);
                                setIsReviewModalOpen(true);
                              }}
                              className="px-2.5 py-1 bg-[#123B6D] text-white rounded text-[11px] font-semibold hover:bg-[#0e2f57] cursor-pointer"
                            >
                              Review
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* LANDING PAGE 2: REQUESTS */}
          {activeNav === 'requests' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase font-bold text-[#123B6D] tracking-wider">
                    {institution?.name} · Campus Submissions
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-[#123B6D] tracking-tight mt-0.5">
                    Campus Requests Queue
                  </h1>
                  <p className="text-xs text-[#3F4A5A] mt-0.5">
                    Review and verify all incoming requests submitted within your campus authority route.
                  </p>
                </div>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search applicant name, request ID, or template..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2 border border-[#E5E7EB] bg-white rounded-xl text-[#3F4A5A] focus:outline-none focus:ring-2 focus:ring-[#123B6D]/30"
                  />
                </div>
                <div className="flex gap-1.5 bg-white border border-[#E5E7EB] rounded-xl p-1 shadow-xs">
                  {['all', 'pending', 'in review', 'approved'].map(st => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                        statusFilter === st
                          ? 'bg-[#123B6D] text-white shadow-xs'
                          : 'text-[#3F4A5A] hover:text-[#123B6D]'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Requests Full Table */}
              <div className="bg-white border border-[#E5E7EB] rounded-2xl shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#F3F4F6] text-[#3F4A5A] uppercase text-[9px] font-bold border-b border-[#E5E7EB]">
                        <th className="py-3 px-4">Request</th>
                        <th className="py-3 px-4">Applicant</th>
                        <th className="py-3 px-4">Submitted</th>
                        <th className="py-3 px-4">Current stage</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]">
                      {filteredRequests.length > 0 ? (
                        filteredRequests.map(req => (
                          <tr
                            key={req.id}
                            className="hover:bg-[#F3F4F6]/50 transition-colors"
                          >
                            <td className="py-3 px-4">
                              <span className="font-bold text-[#123B6D]">{req.id}</span>
                              <div className="text-[#3F4A5A]">{req.templateTitle}</div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-[#123B6D]">{req.applicantName}</div>
                              <div className="text-[10px] text-[#3F4A5A]/70">{req.applicantRole} · {req.applicantDept}</div>
                            </td>
                            <td className="py-3 px-4 text-[#3F4A5A]">
                              {new Date(req.submittedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td className="py-3 px-4 font-medium text-[#3F4A5A]">{req.currentStageName}</td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  req.status === 'Approved'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : req.status === 'In review'
                                    ? 'bg-[#123B6D]/10 text-[#123B6D]'
                                    : 'bg-amber-50 text-amber-700'
                                }`}
                              >
                                {req.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => {
                                  setSelectedRequest(req);
                                  setIsReviewModalOpen(true);
                                }}
                                className="px-3 py-1 bg-[#123B6D] hover:bg-[#0e2f57] text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
                              >
                                Review
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-slate-400">
                            No requests found matching your filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* LANDING PAGE 3: REQUEST TEMPLATES */}
          {activeNav === 'templates' && (
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-xs space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl sm:text-2xl font-bold text-[#123B6D] tracking-tight">
                      Admin template requests
                    </h2>
                    <span className="text-xs font-semibold text-[#123B6D] bg-[#F3F4F6] px-2.5 py-0.5 rounded-full border border-[#E5E7EB]">
                      {templates.length} active
                    </span>
                  </div>
                  <p className="text-xs text-[#3F4A5A] mt-0.5">
                    Frequently used custom workflows for {institution?.name}
                  </p>
                </div>

                <button
                  onClick={() => setIsNominateModalOpen(true)}
                  className="px-4 py-2 bg-[#123B6D] hover:bg-[#0e2f57] text-white rounded-lg text-xs font-semibold shadow-xs flex items-center transition-colors cursor-pointer shrink-0"
                >
                  Nominate Custom Template
                </button>
              </div>

              {/* Standard Templates from Loopin_Request_Templates */}
              <div className="space-y-4 pt-1">
                <div>
                  <h3 className="font-bold text-sm text-[#123B6D]">
                    Standard templates from Loopin_Request_Templates
                  </h3>
                  <p className="text-xs text-[#3F4A5A] mt-0.5">
                    Review these supplied request formats and add the ones your institutions should share.
                  </p>
                </div>

                <div className="space-y-3">
                  {templates.map(tpl => (
                    <div
                      key={tpl.id}
                      className="p-4 sm:p-5 bg-white border border-[#E5E7EB] rounded-xl shadow-xs space-y-3 hover:border-[#123B6D]/40 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h4 className="font-bold text-sm sm:text-base text-[#123B6D]">{tpl.title}</h4>
                        </div>
                        <span className="px-3.5 py-1.5 bg-[#F3F4F6] text-[#123B6D] border border-[#E5E7EB] text-xs font-semibold rounded-lg shrink-0 inline-flex items-center gap-1">
                          ✓ Active on Campus
                        </span>
                      </div>

                      <div className="border-t border-[#E5E7EB] pt-2">
                        <button
                          type="button"
                          onClick={() => toggleExpandTemplate(tpl.id)}
                          className="text-xs text-[#123B6D] hover:underline flex items-center font-medium cursor-pointer"
                        >
                          <span>
                            {expandedTemplateIds[tpl.id]
                              ? 'Hide request fields and suggested approval route'
                              : 'View request fields and suggested approval route'}
                          </span>
                        </button>

                        {expandedTemplateIds[tpl.id] && (
                          <div className="mt-2.5 p-3 bg-[#F3F4F6] border border-[#E5E7EB] rounded-lg text-xs text-[#3F4A5A] space-y-1.5 animate-fade-in">
                            <div>
                              <span className="font-bold text-[#123B6D]">Mandatory Fields: </span>
                              <span>{tpl.fields.map(f => f.name).join(', ')}</span>
                            </div>
                            <div>
                              <span className="font-bold text-[#123B6D]">Suggested Approval Route: </span>
                              <span>{tpl.steps.join(' → ')}</span>
                            </div>
                            <div>
                              <span className="font-bold text-[#123B6D]">Turnaround SLA: </span>
                              <span>{tpl.turnaround}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* LANDING PAGE 4: STAFF DIRECTORY */}
          {activeNav === 'staff' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase font-bold text-[#123B6D] tracking-wider">
                    {institution?.name} · Reportee Directory
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-[#123B6D] tracking-tight mt-0.5">
                    Staff Managerial Details Directory
                  </h1>
                  <p className="text-xs text-[#3F4A5A] mt-0.5">
                    Maintain reporting roles, designations, and contact details for this institution.
                  </p>
                </div>

                <button
                  onClick={() => openStaffModal()}
                  className="px-3.5 py-2 bg-[#123B6D] hover:bg-[#0e2f57] text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span>＋</span> Add Staff Member
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative max-w-md">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search staff by name, role, or department..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 border border-[#E5E7EB] bg-white rounded-xl text-[#3F4A5A] focus:outline-none focus:ring-2 focus:ring-[#123B6D]/30"
                />
              </div>

              {/* Staff Table */}
              <div className="bg-white border border-[#E5E7EB] rounded-2xl shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#F3F4F6] text-[#3F4A5A] uppercase text-[9px] font-bold border-b border-[#E5E7EB]">
                        <th className="py-3 px-4">Staff Member</th>
                        <th className="py-3 px-4">Designation / Role</th>
                        <th className="py-3 px-4">Department</th>
                        <th className="py-3 px-4">Reports To</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]">
                      {filteredStaff.map(member => (
                        <tr key={member.id} className="hover:bg-[#F3F4F6]/50 transition-colors">
                          <td className="py-3 px-4">
                            <b className="text-[#123B6D] block">{member.name}</b>
                            <small className="block text-[10px] text-[#3F4A5A]/70">{member.email}</small>
                          </td>
                          <td className="py-3 px-4 font-medium text-[#3F4A5A]">{member.role}</td>
                          <td className="py-3 px-4 text-[#3F4A5A]">{member.dept}</td>
                          <td className="py-3 px-4 text-[#3F4A5A]">{member.manager || 'Not assigned'}</td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => openStaffModal(member)}
                                className="px-2.5 py-1 bg-[#123B6D]/10 text-[#123B6D] rounded text-[11px] font-semibold hover:bg-[#123B6D]/20 cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteStaff(member.id, member.name)}
                                className="px-2.5 py-1 bg-rose-50 text-rose-700 rounded text-[11px] font-semibold hover:bg-rose-100 cursor-pointer"
                              >
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-3 bg-[#F3F4F6] border border-[#E5E7EB] rounded-xl text-[11px] text-[#3F4A5A]">
                <b>Directory Scope:</b> Records listed above apply strictly to {institution?.name}. Organization-wide access and super administrator roles are managed by central administration.
              </div>
            </div>
          )}

          {/* LANDING PAGE 5: INSTITUTION RECORDS */}
          {activeNav === 'campus' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase font-bold text-[#123B6D] tracking-wider">
                    {institution?.name} · Official Profile
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-[#123B6D] tracking-tight mt-0.5">
                    Campus Institution Records
                  </h1>
                  <p className="text-xs text-[#3F4A5A] mt-0.5">
                    Maintain institutional contact records, campus official phone, and physical address.
                  </p>
                </div>

                <button
                  onClick={() => setIsEditingRecords(!isEditingRecords)}
                  className="px-3.5 py-2 bg-white border border-[#E5E7EB] text-[#123B6D] hover:bg-[#F3F4F6] rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                >
                  {isEditingRecords ? 'Cancel Editing' : '✎ Edit Campus Records'}
                </button>
              </div>

              {/* Institution Card */}
              <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-xs space-y-6">
                <div className="p-4 bg-[#F3F4F6] border border-[#E5E7EB] rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[#123B6D] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                      ⌂
                    </div>
                    <div>
                      <b className="text-sm text-[#123B6D] block">{institution?.name}</b>
                      <small className="block text-xs text-[#3F4A5A]/80">{institution?.category} · {institution?.city}</small>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-[#123B6D] bg-white px-3 py-1.5 rounded-lg border border-[#E5E7EB]">
                    {institution?.requestCount || 0} Total Requests Processed
                  </span>
                </div>

                <form onSubmit={handleSaveRecords} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-[#3F4A5A] font-bold mb-1">Official Institution Email</label>
                    <input
                      type="email"
                      disabled={!isEditingRecords}
                      value={recordEmail}
                      onChange={e => setRecordEmail(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-xl ${isEditingRecords ? 'bg-white border-[#123B6D]' : 'bg-[#F3F4F6] border-[#E5E7EB]'}`}
                    />
                  </div>
                  <div>
                    <label className="block text-[#3F4A5A] font-bold mb-1">Office Telephone Number</label>
                    <input
                      type="text"
                      disabled={!isEditingRecords}
                      value={recordPhone}
                      onChange={e => setRecordPhone(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-xl ${isEditingRecords ? 'bg-white border-[#123B6D]' : 'bg-[#F3F4F6] border-[#E5E7EB]'}`}
                    />
                  </div>
                  <div>
                    <label className="block text-[#3F4A5A] font-bold mb-1">Campus Physical Address</label>
                    <input
                      type="text"
                      disabled={!isEditingRecords}
                      value={recordAddress}
                      onChange={e => setRecordAddress(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-xl ${isEditingRecords ? 'bg-white border-[#123B6D]' : 'bg-[#F3F4F6] border-[#E5E7EB]'}`}
                    />
                  </div>

                  {isEditingRecords && (
                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        className="px-5 py-2 bg-[#123B6D] hover:bg-[#0e2f57] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                      >
                        Save Institution Records
                      </button>
                    </div>
                  )}
                </form>

                <div className="p-3 bg-[#F3F4F6] border border-[#E5E7EB] rounded-xl text-[11px] text-[#3F4A5A]">
                  This Admin account is authorized to modify records for {institution?.name} only. New institutional campuses are established via central governance.
                </div>
              </div>
            </div>
          )}

          {/* LANDING PAGE 6: ACTIVITY LOG */}
          {activeNav === 'activity' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase font-bold text-[#123B6D] tracking-wider">
                    {institution?.name} · Audit Stream
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-[#123B6D] tracking-tight mt-0.5">
                    Institution Activity & Audit Log
                  </h1>
                  <p className="text-xs text-[#3F4A5A] mt-0.5">
                    Read-only record of activity, reviews, and updates originating from this campus.
                  </p>
                </div>

                <span className="text-[10px] font-bold text-[#123B6D] bg-[#123B6D]/10 px-3 py-1 rounded-full border border-[#123B6D]/20">
                  READ ONLY AUDIT
                </span>
              </div>

              <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-xs space-y-4">
                <div className="space-y-3 max-h-[600px] overflow-y-auto text-xs">
                  {activityLog.length > 0 ? (
                    activityLog.map(item => (
                      <div key={item.id} className="flex gap-3 items-start border-b border-[#E5E7EB] pb-3">
                        <span className="w-2 h-2 rounded-full bg-[#123B6D] mt-1.5 shrink-0 shadow-xs"></span>
                        <div className="flex-1">
                          <b className="text-[#123B6D] block">{item.action}</b>
                          <small className="block text-[#3F4A5A] text-[11px] mt-0.5">
                            {item.details} · {new Date(item.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                          </small>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-slate-400 text-xs">
                      No activity has been recorded yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* LANDING PAGE 7: REPORTS */}
          {activeNav === 'reports' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase font-bold text-[#123B6D] tracking-wider">
                    {institution?.name} · SLA & Compliance
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-[#123B6D] tracking-tight mt-0.5">
                    Campus Requests by Status & SLA Reports
                  </h1>
                  <p className="text-xs text-[#3F4A5A] mt-0.5">
                    Request distribution and turnaround performance for {institution?.name} · {institution?.requestCount || requests.length} total requests.
                  </p>
                </div>

                <span className="text-[10px] font-bold text-[#123B6D] bg-[#123B6D]/10 px-3 py-1 rounded-full border border-[#123B6D]/20">
                  CAMPUS REPORT
                </span>
              </div>

              <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-xs space-y-6">
                <div className="space-y-4 text-xs">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-[#3F4A5A]">Needs Review (Pending Action)</span>
                      <span className="font-bold text-amber-700">{pendingRequests.length}</span>
                    </div>
                    <div className="w-full bg-[#F3F4F6] h-3 rounded-full overflow-hidden border border-[#E5E7EB]">
                      <div className="bg-amber-600 h-full rounded-full" style={{ width: `${Math.min(100, Math.max(10, pendingRequests.length * 15))}%` }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-[#3F4A5A]">In Progress (Multi-Tier Review)</span>
                      <span className="font-bold text-[#123B6D]">{requests.filter(r => r.status === 'In review').length}</span>
                    </div>
                    <div className="w-full bg-[#F3F4F6] h-3 rounded-full overflow-hidden border border-[#E5E7EB]">
                      <div className="bg-[#123B6D] h-full rounded-full" style={{ width: `${Math.min(100, Math.max(15, requests.filter(r => r.status === 'In review').length * 20))}%` }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-[#3F4A5A]">Completed & Signed Off</span>
                      <span className="font-bold text-emerald-700">{requests.filter(r => r.status === 'Approved').length + 580}</span>
                    </div>
                    <div className="w-full bg-[#F3F4F6] h-3 rounded-full overflow-hidden border border-[#E5E7EB]">
                      <div className="bg-emerald-600 h-full rounded-full w-[94%]"></div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#E5E7EB] text-[11px] text-[#3F4A5A]">
                  <b>SLA Performance Summary:</b> Average campus sign-off turnaround stands at 4.2 business days. Over 98.4% of submissions meet established Sri Sairam Group SLA guidelines.
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Staff Modal */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={handleSaveStaff} className="bg-white rounded-xl shadow-xl border p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              {editingStaffId ? 'Edit staff details' : 'Add staff member'}
            </h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full name</label>
              <input
                type="text"
                required
                value={staffName}
                onChange={e => setStaffName(e.target.value)}
                placeholder="Staff name"
                className="w-full text-xs px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Designation / managerial role</label>
              <input
                type="text"
                required
                value={staffRole}
                onChange={e => setStaffRole(e.target.value)}
                placeholder="e.g. Head of Department"
                className="w-full text-xs px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
              <input
                type="text"
                required
                value={staffDept}
                onChange={e => setStaffDept(e.target.value)}
                placeholder="Department or office"
                className="w-full text-xs px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reports to</label>
              <input
                type="text"
                value={staffManager}
                onChange={e => setStaffManager(e.target.value)}
                placeholder="Manager or authority"
                className="w-full text-xs px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Institution email</label>
              <input
                type="email"
                value={staffEmail}
                onChange={e => setStaffEmail(e.target.value)}
                placeholder="name@sairam.edu.in"
                className="w-full text-xs px-3 py-2 border rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsStaffModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs bg-[#123B6D] text-white font-bold rounded"
              >
                Save staff details
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Nominate Template Modal */}
      {isNominateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={handleNominateTemplate} className="bg-white rounded-xl shadow-xl border p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Request a group template</h3>
            <p className="text-xs text-slate-500">
              Submit a frequently used campus workflow for Super Admin review. It only enters the shared library after approval.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Template name</label>
              <input
                type="text"
                required
                value={nomTitle}
                onChange={e => setNomTitle(e.target.value)}
                placeholder="e.g. Department Research Seminar"
                className="w-full text-xs px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={nomCategory}
                onChange={e => setNomCategory(e.target.value)}
                className="w-full text-xs px-3 py-2 border rounded-lg bg-white"
              >
                <option>Academic</option>
                <option>Research</option>
                <option>Finance</option>
                <option>Academic · Research</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Number of campus uses</label>
              <input
                type="number"
                min={1}
                required
                value={nomUses}
                onChange={e => setNomUses(parseInt(e.target.value, 10))}
                className="w-full text-xs px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Approval steps</label>
              <textarea
                rows={2}
                required
                value={nomSteps}
                onChange={e => setNomSteps(e.target.value)}
                className="w-full text-xs px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Required attachments</label>
              <textarea
                rows={2}
                required
                value={nomFields}
                onChange={e => setNomFields(e.target.value)}
                className="w-full text-xs px-3 py-2 border rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsNominateModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs bg-[#123B6D] text-white font-bold rounded"
              >
                Send for approval
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Request Review Detail Modal */}
      {isReviewModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border p-6 w-full max-w-lg space-y-4">
            <div className="flex items-start justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {selectedRequest.id} · {selectedRequest.templateTitle}
                </h3>
                <p className="text-xs text-slate-500">
                  Applicant: {selectedRequest.applicantName} ({selectedRequest.applicantRole})
                </p>
              </div>
              <button onClick={() => setIsReviewModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <XCircle size={18} />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border text-xs space-y-2">
              <div><b>Institution:</b> {selectedRequest.institutionName}</div>
              <div><b>Submitted:</b> {new Date(selectedRequest.submittedAt).toLocaleString()}</div>
              <div><b>Current approval stage:</b> {selectedRequest.currentStageName}</div>
              <div><b>Request status:</b> {selectedRequest.status}</div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 rounded"
              >
                Close
              </button>
              <button
                type="button"
                disabled={selectedRequest.status === 'Approved' || selectedRequest.status === 'In review'}
                onClick={handleMarkReviewed}
                className="px-4 py-1.5 text-xs bg-[#123B6D] text-white font-bold rounded hover:bg-[#0e2d50] disabled:opacity-50"
              >
                Mark reviewed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
