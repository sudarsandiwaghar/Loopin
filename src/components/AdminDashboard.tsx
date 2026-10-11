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

  const [activeNav, setActiveNav] = useState('overview');
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [requests, setRequests] = useState<WorkflowRequest[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [staff, setStaff] = useState<StaffManagerialDetail[]>([]);
  const [activityLog, setActivityLog] = useState<AuditLogEntry[]>([]);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

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

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-[#3F4A5A] flex font-sans">
      {/* AUTHENTIC SIDE PANEL (Matches admin.html) */}
      <aside className="w-52 shrink-0 bg-[#eef3ff] border-r border-[#e0e7f2] p-4 flex flex-col sticky top-0 h-screen shadow-xs z-30">
        <div>
          {/* Brand */}
          <div className="flex items-center gap-2.5 pb-4 border-b border-[#e7ebf2]">
            <div className="w-8 h-8 rounded-lg bg-[#123B6D] text-white flex items-center justify-center font-bold text-lg font-serif">
              P
            </div>
            <div>
              <b className="text-lg font-bold text-[#123B6D] tracking-tight">PaperTrail</b>
            </div>
          </div>

          <div className="py-2.5 text-[9px] font-bold tracking-wider text-[#64748b] uppercase truncate">
            {institution?.name || 'CAMPUS ADMINISTRATION'}
          </div>
          <div className="text-[9px] uppercase font-bold tracking-widest text-[#8894a5] px-1 py-1">
            Campus administration
          </div>

          {/* Navigation Links Specified in admin.html */}
          <nav className="flex flex-col gap-1 mt-1 text-xs">
            <button
              onClick={() => scrollToSection('overview')}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md font-medium text-left transition-colors ${
                activeNav === 'overview'
                  ? 'bg-[#123B6D] text-white font-bold'
                  : 'text-[#48586e] hover:bg-white/80'
              }`}
            >
              <span className="w-4 text-center">▦</span>
              <span>Overview</span>
            </button>

            <button
              onClick={() => scrollToSection('requests')}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md font-medium text-left transition-colors ${
                activeNav === 'requests'
                  ? 'bg-[#123B6D] text-white font-bold'
                  : 'text-[#48586e] hover:bg-white/80'
              }`}
            >
              <span className="w-4 text-center">▤</span>
              <span>Requests</span>
            </button>

            <button
              onClick={() => onNavigateToTemplates ? onNavigateToTemplates() : scrollToSection('templates')}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md font-medium text-left transition-colors ${
                activeNav === 'templates'
                  ? 'bg-[#123B6D] text-white font-bold'
                  : 'text-[#48586e] hover:bg-white/80'
              }`}
            >
              <span className="w-4 text-center">▧</span>
              <span>Request Templates</span>
            </button>

            <button
              onClick={() => scrollToSection('staff')}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md font-medium text-left transition-colors ${
                activeNav === 'staff'
                  ? 'bg-[#123B6D] text-white font-bold'
                  : 'text-[#48586e] hover:bg-white/80'
              }`}
            >
              <span className="w-4 text-center">♙</span>
              <span>Staff directory</span>
            </button>

            <button
              onClick={() => scrollToSection('campus')}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md font-medium text-left transition-colors ${
                activeNav === 'campus'
                  ? 'bg-[#123B6D] text-white font-bold'
                  : 'text-[#48586e] hover:bg-white/80'
              }`}
            >
              <span className="w-4 text-center">⌂</span>
              <span>Institution records</span>
            </button>

            <button
              onClick={() => scrollToSection('activity')}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md font-medium text-left transition-colors ${
                activeNav === 'activity'
                  ? 'bg-[#123B6D] text-white font-bold'
                  : 'text-[#48586e] hover:bg-white/80'
              }`}
            >
              <span className="w-4 text-center">◷</span>
              <span>Activity log</span>
            </button>

            <button
              onClick={() => scrollToSection('reports')}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md font-medium text-left transition-colors ${
                activeNav === 'reports'
                  ? 'bg-[#123B6D] text-white font-bold'
                  : 'text-[#48586e] hover:bg-white/80'
              }`}
            >
              <span className="w-4 text-center">◷</span>
              <span>Reports</span>
            </button>
          </nav>
        </div>

        {/* Profile Footer */}
        <div className="mt-auto border-t border-[#e0e7f2] pt-3 text-xs">
          <div className="font-bold text-[#3F4A5A] truncate">Campus Admin</div>
          <small className="block text-[#64748b] text-[10px] truncate">{institution?.name || 'Engineering College'}</small>
          <div className="flex items-center justify-end mt-2 pt-2 border-t border-slate-200">
            <button
              onClick={onLogout}
              className="text-[10px] text-rose-600 hover:underline flex items-center gap-1"
            >
              <LogOut size={11} /> Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Header (Matches admin.html topbar) */}
        <header className="h-14 bg-white/95 backdrop-blur border-b border-[#e3e8f0] px-6 flex items-center justify-between sticky top-0 z-20">
          <span className="text-xs text-[#64748b]">
            PaperTrail &nbsp;›&nbsp; <b className="text-[#123B6D]">Campus dashboard</b>
          </span>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#f0f4fa] border border-[#e4e9f1] rounded text-[10px] font-semibold text-[#405672]">
              ▦ &nbsp;{institution?.name}
            </span>

            <button
              onClick={() => {
                setStatusFilter('Pending');
                scrollToSection('requests');
                showToast('Showing requests awaiting campus action.');
              }}
              className="flex items-center gap-1 px-2.5 py-1 bg-white border border-[#e1e7ef] rounded text-[11px] font-bold text-[#123B6D]"
            >
              <span>♧</span>
              <span>{newRequestsCount}</span>
            </button>

            {/* Role Switch */}
            <div className="flex items-center bg-[#f1f4fa] border border-[#e4e9f1] rounded-md p-0.5 text-[11px]">
              <button
                onClick={() => onFastSwitch('super_admin')}
                className="px-2 py-0.5 rounded text-[#64748b] hover:text-slate-900"
              >
                Super Admin
              </button>
              <button
                onClick={() => onFastSwitch('admin')}
                className="px-2 py-0.5 rounded bg-white text-[#123B6D] font-bold shadow-xs"
              >
                Admin
              </button>
              <button
                onClick={() => onFastSwitch('staff')}
                className="px-2 py-0.5 rounded text-[#64748b] hover:text-slate-900"
              >
                Staff
              </button>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="p-6 max-w-[1450px] mx-auto w-full space-y-6">
          {/* Welcome Banner */}
          <div id="overview" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase font-bold text-[#123B6D] tracking-wider">
                {institution?.name}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#123B6D] tracking-tight">
                Good morning, Campus Admin
              </h1>
              <p className="text-xs text-[#64748b] mt-0.5">
                Review requests, manage campus workflows and keep approvals moving.
              </p>
            </div>

            <div className="relative w-64">
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search requests, staff, or records…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-1.5 border border-[#e1e7ef] bg-[#f7f9fc] rounded focus:outline-none focus:ring-1 focus:ring-[#123B6D]"
              />
            </div>
          </div>

          {/* Request Alert Banner */}
          <div className="p-3.5 bg-[#edf3ff] border border-[#dce7f8] rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <span className="w-6 h-6 rounded bg-[#dce8f9] text-[#123B6D] flex items-center justify-center font-bold text-xs shrink-0">
                ♧
              </span>
              <div>
                <b className="text-xs text-[#173f6b]">
                  {newRequestsCount > 0
                    ? `${newRequestsCount} staff requests are waiting for review`
                    : 'All campus requests have been reviewed'}
                </b>
                <p className="text-[10px] text-[#5c6e83] mt-0.5">
                  {newRequestsCount > 0
                    ? `${newRequestsCount} requests were submitted to ${institution?.name}. Open a request to review details and status.`
                    : `No pending submissions at this campus.`}
                </p>
              </div>
            </div>

            {newRequestsCount > 0 && (
              <button
                onClick={() => {
                  setStatusFilter('Pending');
                  scrollToSection('requests');
                }}
                className="px-3 py-1 bg-[#123B6D] text-white rounded text-xs font-semibold hover:bg-[#0e2d50] shrink-0"
              >
                Review requests →
              </button>
            )}
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 bg-white rounded border border-[#e2e7f0] shadow-xs">
              <div className="flex justify-between text-xs text-[#64748b]">
                <span>Requests received</span>
                <span className="text-[#123B6D]">▤</span>
              </div>
              <strong className="block text-2xl font-bold text-[#123B6D] mt-1.5">
                {institution?.requestCount || requests.length}
              </strong>
              <small className="text-[10px] text-[#39755d]">All time · this campus</small>
            </div>

            <div className="p-3.5 bg-white rounded border border-[#e2e7f0] shadow-xs">
              <div className="flex justify-between text-xs text-[#64748b]">
                <span>Needs your attention</span>
                <span className="text-amber-600">◷</span>
              </div>
              <strong className="block text-2xl font-bold text-[#123B6D] mt-1.5">
                {pendingRequests.length}
              </strong>
              <small className="text-[10px] text-[#98702e]">Pending campus review</small>
            </div>

            <div className="p-3.5 bg-white rounded border border-[#e2e8f0] shadow-xs">
              <div className="flex justify-between text-xs text-[#64748b]">
                <span>In progress</span>
                <span className="text-[#123B6D]">↗</span>
              </div>
              <strong className="block text-2xl font-bold text-[#123B6D] mt-1.5">
                {requests.filter(r => r.status === 'In review').length}
              </strong>
              <small className="text-[10px] text-[#64748b]">Moving through approval</small>
            </div>

            <div
              onClick={() => onNavigateToTemplates && onNavigateToTemplates()}
              className="p-3.5 bg-white rounded border border-[#e2e8f0] shadow-xs cursor-pointer hover:border-[#123B6D] hover:shadow-md transition-all group"
            >
              <div className="flex justify-between text-xs text-[#64748b]">
                <span className="group-hover:text-[#123B6D] font-medium">Active templates</span>
                <span className="text-[#123B6D]">▧</span>
              </div>
              <strong className="block text-2xl font-bold text-[#123B6D] mt-1.5 group-hover:text-[#0e2d50]">
                {templates.length}
              </strong>
              <div className="flex items-center justify-between text-[10px] text-[#39755d] mt-0.5">
                <span>Available for your campus</span>
                <span className="text-[#123B6D] font-semibold">View All →</span>
              </div>
            </div>
          </div>

          {/* Campus Requests Section */}
          <div id="requests" className="bg-white border border-[#e2e7f0] rounded p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#123B6D]">Campus requests</h2>
                <p className="text-[11px] text-[#64748b]">Recent submissions for your institution</p>
              </div>
              <button
                onClick={() => {
                  setStatusFilter('Pending');
                  showToast('Showing requests awaiting campus action.');
                }}
                className="text-xs text-[#123B6D] font-semibold hover:underline"
              >
                View queue →
              </button>
            </div>

            {/* Filter Bar */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search applicant or request ID…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 text-xs px-2.5 py-1.5 border border-[#dfe5ef] rounded bg-white"
              />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 border border-[#dfe5ef] rounded bg-white"
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="in review">In review</option>
                <option value="approved">Approved</option>
              </select>
            </div>

            {/* Requests Table */}
            <div className="overflow-x-auto border border-[#edf0f5] rounded">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[#6c7b8e] uppercase text-[9px] border-b border-[#dfe5ef]">
                    <th className="py-2 px-3">Request</th>
                    <th className="py-2 px-3">Applicant</th>
                    <th className="py-2 px-3">Submitted</th>
                    <th className="py-2 px-3">Current stage</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf0f5]">
                  {filteredRequests.length > 0 ? (
                    filteredRequests.map(req => (
                      <tr
                        key={req.id}
                        onClick={() => {
                          setSelectedRequest(req);
                          setIsReviewModalOpen(true);
                        }}
                        className="cursor-pointer hover:bg-[#f7f9fc] transition-colors"
                      >
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-[#123B6D]">{req.id}</span>
                          <div className="text-[#3F4A5A]">{req.templateTitle}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-800">{req.applicantName}</div>
                          <div className="text-[10px] text-slate-400">{req.applicantRole}</div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {new Date(req.submittedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-700">{req.currentStageName}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              req.status === 'Approved'
                                ? 'bg-[#edf6f0] text-[#39755d]'
                                : req.status === 'In review'
                                ? 'bg-[#e9eef5] text-[#123B6D]'
                                : 'bg-[#faf3e4] text-[#8b692e]'
                            }`}
                          >
                            {req.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-slate-400">
                        No requests found for this campus.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Campus Templates Section */}
          <div id="templates" className="bg-white border border-[#e2e8f0] rounded p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#123B6D]">Campus templates</h2>
                <p className="text-[11px] text-[#64748b]">Available to your institution</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {templates.map(tpl => (
                <div key={tpl.id} className="p-3 bg-white border border-[#dfe5ef] rounded flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-[#e9eef5] text-[#123B6D] flex items-center justify-center font-bold text-xs shrink-0">
                    ▧
                  </div>
                  <div className="flex-1 min-w-0">
                    <b className="block text-xs text-slate-900 truncate">{tpl.title}</b>
                    <small className="block text-[10px] text-[#64748b]">{tpl.category} · Form {tpl.code}</small>
                  </div>
                  <span className="text-[9px] font-bold text-[#39755d] bg-[#edf6f0] px-1.5 py-0.5 rounded">
                    Published
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2">
              <button
                onClick={() => setIsNominateModalOpen(true)}
                className="px-3 py-2 bg-white border border-[#b8c9e0] hover:bg-[#edf3ff] text-[#123B6D] text-xs font-semibold rounded transition-colors"
              >
                ↗ Submit custom template for group approval
              </button>
              <p className="text-[10px] text-[#64748b] mt-1.5">
                Submit workflows used often at your campus that are not already in the shared library. Super Admin reviews usage, fields, and approval steps before adding them.
              </p>
            </div>
          </div>

          {/* Staff Managerial Details Directory */}
          <div id="staff" className="bg-white border border-[#e2e8f0] rounded p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#123B6D]">Staff managerial details</h2>
                <p className="text-[11px] text-[#64748b]">Maintain reporting roles and contact details for this institution</p>
              </div>
              <button
                onClick={() => openStaffModal()}
                className="px-3 py-1.5 bg-[#123B6D] hover:bg-[#0e2d50] text-white rounded text-xs font-semibold"
              >
                ＋ Add staff member
              </button>
            </div>

            <div className="overflow-x-auto border border-[#edf0f5] rounded">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[#6c7b8e] uppercase text-[9px] border-b border-[#dfe5ef]">
                    <th className="py-2 px-3">Staff member</th>
                    <th className="py-2 px-3">Designation / role</th>
                    <th className="py-2 px-3">Department</th>
                    <th className="py-2 px-3">Reports to</th>
                    <th className="py-2 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf0f5]">
                  {filteredStaff.map(member => (
                    <tr key={member.id} className="hover:bg-[#f7f9fc]">
                      <td className="py-2 px-3">
                        <b>{member.name}</b>
                        <small className="block text-[10px] text-[#7b899b]">{member.email}</small>
                      </td>
                      <td className="py-2 px-3">{member.role}</td>
                      <td className="py-2 px-3">{member.dept}</td>
                      <td className="py-2 px-3">{member.manager || 'Not assigned'}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openStaffModal(member)}
                            className="px-2 py-0.5 bg-[#edf3ff] text-[#123B6D] rounded text-[11px] font-semibold"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteStaff(member.id, member.name)}
                            className="px-2 py-0.5 bg-[#fbeded] text-[#a24650] rounded text-[11px] font-semibold"
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

            <div className="p-2.5 bg-[#faf9fb] border border-[#dfe5ef] rounded text-[11px] text-[#665e69]">
              Directory scope: {institution?.name} only. Institution-wide access is managed by the Super Admin.
            </div>
          </div>

          {/* Grid: Campus Institution Records + Activity Log */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Institution Records */}
            <div id="campus" className="bg-white border border-[#e2e8f0] rounded p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-[#123B6D]">Your campus</h2>
                  <p className="text-[11px] text-[#64748b]">Institution profile and contact records</p>
                </div>
                <button
                  onClick={() => setIsEditingRecords(!isEditingRecords)}
                  className="text-xs text-[#123B6D] font-semibold hover:underline"
                >
                  {isEditingRecords ? 'Cancel' : 'Edit records'}
                </button>
              </div>

              <div className="p-3 bg-[#f7f9fc] border border-[#e1e7ef] rounded flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-[#e9eef5] text-[#123B6D] flex items-center justify-center font-bold text-xs">
                    ⌂
                  </div>
                  <div>
                    <b className="text-xs text-[#123B6D]">{institution?.name}</b>
                    <small className="block text-[10px] text-slate-500">{institution?.category} · {institution?.city}</small>
                  </div>
                </div>
                <span className="text-xs font-bold text-[#123B6D]">{institution?.requestCount} <small className="text-slate-400 font-normal">requests</small></span>
              </div>

              <form onSubmit={handleSaveRecords} className="space-y-3 text-xs pt-1">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Institution email</label>
                  <input
                    type="email"
                    disabled={!isEditingRecords}
                    value={recordEmail}
                    onChange={e => setRecordEmail(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Office phone</label>
                  <input
                    type="text"
                    disabled={!isEditingRecords}
                    value={recordPhone}
                    onChange={e => setRecordPhone(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Campus address</label>
                  <input
                    type="text"
                    disabled={!isEditingRecords}
                    value={recordAddress}
                    onChange={e => setRecordAddress(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded bg-white"
                  />
                </div>

                {isEditingRecords && (
                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-[#123B6D] text-white text-xs font-bold rounded"
                    >
                      Save institution records
                    </button>
                  </div>
                )}
              </form>

              <div className="p-2.5 bg-[#faf9fb] border border-[#dfe5ef] rounded text-[11px] text-[#665e69]">
                This Admin account can maintain records for {institution?.name} only. Group-wide institution records are managed by the Super Admin.
              </div>
            </div>

            {/* Institution Activity Log (Strictly Read-Only) */}
            <div id="activity" className="bg-white border border-[#e2e8f0] rounded p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-[#123B6D]">Institution activity log</h2>
                  <p className="text-[11px] text-[#64748b]">Read-only record of activity for this campus</p>
                </div>
                <span className="text-[9px] font-bold text-[#64748b] bg-[#f1f4f8] px-2 py-0.5 rounded">
                  READ ONLY
                </span>
              </div>

              <div className="space-y-2.5 max-h-[310px] overflow-y-auto text-xs">
                {activityLog.length > 0 ? (
                  activityLog.map(item => (
                    <div key={item.id} className="flex gap-2.5 items-start border-b border-[#edf0f5] pb-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#315f91] mt-1.5 shrink-0"></span>
                      <div>
                        <b>{item.action}</b>
                        <small className="block text-[#718096] text-[10px] mt-0.5">
                          {item.details} · {new Date(item.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                        </small>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    No activity has been recorded yet.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Campus Reports Section */}
          <div id="reports" className="bg-white border border-[#e2e8f0] rounded p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#123B6D]">Campus requests by status</h2>
                <p className="text-[11px] text-[#64748b]">Request distribution for {institution?.name} · {institution?.requestCount || requests.length} total requests</p>
              </div>
              <span className="text-[9px] font-bold text-[#64748b] bg-[#f1f4f8] px-2 py-0.5 rounded">
                CAMPUS REPORT
              </span>
            </div>

            <div className="space-y-2 text-xs pt-1">
              <div className="flex items-center gap-3">
                <span className="w-24 text-slate-600">Needs review</span>
                <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-[#315f91] h-full w-[24%]"></div>
                </div>
                <b>{pendingRequests.length}</b>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-24 text-slate-600">In progress</span>
                <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-[#315f91] h-full w-[42%]"></div>
                </div>
                <b>{requests.filter(r => r.status === 'In review').length}</b>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-24 text-slate-600">Completed</span>
                <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-[#315f91] h-full w-[100%]"></div>
                </div>
                <b>{requests.filter(r => r.status === 'Approved').length + 580}</b>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              Illustrative dashboard data · Request totals are scoped strictly to this institution.
            </p>
          </div>
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
