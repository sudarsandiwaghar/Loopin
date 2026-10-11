import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import { useToast } from './Toast.tsx';
import {
  User,
  WorkflowTemplate,
  WorkflowRequest,
  SavedDraft,
} from '../../server/types.ts';
import {
  FileText,
  Clock,
  CheckCircle2,
  Calendar,
  Plus,
  Send,
  Save,
  Trash2,
  Paperclip,
  Check,
  AlertCircle,
  XCircle,
  Search,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  Building,
  Bell,
  Download,
  LogOut,
} from 'lucide-react';

interface Props {
  currentUser: User;
  onLogout: () => void;
  onFastSwitch: (role: 'super_admin' | 'admin' | 'staff') => void;
  onNavigateToTemplates?: () => void;
}

export const StaffDashboard: React.FC<Props> = ({
  currentUser,
  onLogout,
  onFastSwitch,
  onNavigateToTemplates,
}) => {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'home' | 'templates' | 'applications' | 'inbox' | 'settings'>(() => {
    if (typeof window !== 'undefined') {
      const h = window.location.hash.replace('#', '');
      if (['home', 'templates', 'applications', 'inbox', 'settings'].includes(h)) {
        return h as any;
      }
    }
    return 'home';
  });

  const navigateToTab = (tab: 'home' | 'templates' | 'applications' | 'inbox' | 'settings') => {
    setActiveTab(tab);
    window.location.hash = `#${tab}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const handleHash = () => {
      const h = window.location.hash.replace('#', '');
      if (['home', 'templates', 'applications', 'inbox', 'settings'].includes(h)) {
        setActiveTab(h as any);
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const [requests, setRequests] = useState<WorkflowRequest[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [drafts, setDrafts] = useState<SavedDraft[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [globalSearch, setGlobalSearch] = useState('');

  // Application Modal state
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedTemplateIds, setExpandedTemplateIds] = useState<Record<string, boolean>>({});

  const toggleExpandTemplate = (id: string) => {
    setExpandedTemplateIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Task Review Modal state
  const [selectedTask, setSelectedTask] = useState<WorkflowRequest | null>(null);
  const [taskRemark, setTaskRemark] = useState('');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [showSignedHistory, setShowSignedHistory] = useState(false);

  // Request Details Modal
  const [detailRequest, setDetailRequest] = useState<WorkflowRequest | null>(null);

  // Circulars Modal
  const [isCircularModalOpen, setIsCircularModalOpen] = useState(false);

  // Profile Form state
  const [profileName, setProfileName] = useState(currentUser.name);
  const [profileRole, setProfileRole] = useState(currentUser.designation);
  const [profileDept, setProfileDept] = useState(currentUser.department);
  const [profileCode, setProfileCode] = useState(currentUser.employeeCode || 'STAFF-20418');

  // Preferences
  const [notifyAssigned, setNotifyAssigned] = useState(currentUser.preferences?.notifyAssigned ?? true);
  const [notifyDaily, setNotifyDaily] = useState(currentUser.preferences?.notifyDaily ?? true);
  const [notifyUrgent, setNotifyUrgent] = useState(currentUser.preferences?.notifyUrgent ?? true);

  // Delegation
  const [proxyEnabled, setProxyEnabled] = useState(currentUser.delegation?.enabled ?? false);
  const [proxyName, setProxyName] = useState(currentUser.delegation?.proxyUserName ?? '');
  const [proxyStartDate, setProxyStartDate] = useState(currentUser.delegation?.startDate ?? '');
  const [proxyEndDate, setProxyEndDate] = useState(currentUser.delegation?.endDate ?? '');

  const loadData = async () => {
    try {
      const [reqs, tpls, userDrafts] = await Promise.all([
        api.getRequests(),
        api.getTemplates(),
        api.getDrafts(),
      ]);
      setRequests(reqs);
      setTemplates(tpls);
      setDrafts(userDrafts);
    } catch (err: any) {
      showToast(err.message || 'Error loading staff portal data.');
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  // Derived queries
  const myRequests = requests.filter(r => r.applicantId === currentUser.id);

  const inboxTasks = requests.filter(r => {
    if (r.applicantId === currentUser.id && r.status === 'In review') return false;
    const userRole = currentUser.designation.toLowerCase();
    const stageName = r.currentStageName.toLowerCase();
    return (
      (r.status === 'In review' || r.status === 'Pending') &&
      (stageName.includes(userRole) ||
       userRole.includes('assistant professor') ||
       userRole.includes('hod') ||
       userRole.includes('head of department') ||
       userRole.includes('dean'))
    );
  });

  const activeCount = myRequests.filter(r => r.status === 'Pending' || r.status === 'In review').length;
  const approvedCount = 8 + myRequests.filter(r => r.status === 'Approved').length;

  const filteredTemplates = templates.filter(
    t => categoryFilter === 'All' || t.category === categoryFilter
  );

  const openApplyModal = (template: WorkflowTemplate, draft?: SavedDraft) => {
    setSelectedTemplate(template);
    if (draft) {
      setActiveDraftId(draft.id);
      setFormData(draft.values || {});
    } else {
      setActiveDraftId(null);
      const initial: Record<string, any> = {};
      template.fields.forEach(f => {
        initial[f.name] = '';
      });
      setFormData(initial);
    }
    setIsApplyModalOpen(true);
  };

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) return;

    try {
      setIsSubmitting(true);
      const newReq = await api.submitRequest({
        templateId: selectedTemplate.id,
        formData,
        attachments: selectedTemplate.attachments,
      });

      if (activeDraftId) {
        await api.deleteDraft(activeDraftId);
        setDrafts(prev => prev.filter(d => d.id !== activeDraftId));
      }

      setRequests(prev => [newReq, ...prev]);
      setIsApplyModalOpen(false);
      showToast(`${newReq.id} submitted and routed to ${newReq.currentStageName}!`);
      setActiveTab('home');
    } catch (err: any) {
      showToast(err.message || 'Failed to submit application.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedTemplate) return;

    try {
      const draft = await api.saveDraft({
        id: activeDraftId || undefined,
        templateId: selectedTemplate.id,
        title: selectedTemplate.title,
        category: selectedTemplate.category,
        values: formData,
      });

      setDrafts(prev => {
        const idx = prev.findIndex(d => d.id === draft.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = draft;
          return copy;
        }
        return [draft, ...prev];
      });

      setIsApplyModalOpen(false);
      showToast('Application saved as a draft.');
    } catch (err: any) {
      showToast(err.message || 'Failed to save draft.');
    }
  };

  const handleDeleteDraft = async (id: string) => {
    try {
      await api.deleteDraft(id);
      setDrafts(prev => prev.filter(d => d.id !== id));
      showToast('Saved draft removed.');
    } catch (err: any) {
      showToast(err.message || 'Failed to remove draft.');
    }
  };

  const handleTaskAction = async (action: 'Approved' | 'Clarification requested' | 'Declined') => {
    if (!selectedTask) return;

    try {
      const updated = await api.actionRequest(selectedTask.id, action, taskRemark);
      setRequests(prev => prev.map(r => (r.id === updated.id ? updated : r)));
      setIsTaskModalOpen(false);
      setTaskRemark('');
      showToast(
        action === 'Approved'
          ? 'Approved and passed forward to next authority!'
          : action === 'Declined'
          ? 'Request declined and recorded.'
          : 'Clarification request sent to applicant.'
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to act on task.');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateProfile({
        name: profileName,
        designation: profileRole,
        department: profileDept,
        employeeCode: profileCode,
        preferences: {
          notifyAssigned,
          notifyDaily,
          notifyUrgent,
          channel: 'Email and in-app',
        },
      });
      showToast('Profile and preferences updated.');
    } catch (err: any) {
      showToast(err.message || 'Failed to save profile.');
    }
  };

  const handleSaveDelegation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (proxyEnabled && !proxyName) {
      showToast('Please choose an eligible proxy approver first.');
      return;
    }
    if (proxyStartDate && proxyEndDate && proxyEndDate < proxyStartDate) {
      showToast('Delegation end date must be after its start date.');
      return;
    }

    try {
      await api.updateDelegation({
        enabled: proxyEnabled,
        proxyUserName: proxyName,
        startDate: proxyStartDate,
        endDate: proxyEndDate,
      });
      showToast(proxyEnabled ? 'Proxy delegation saved and recorded in audit log!' : 'Delegation disabled.');
    } catch (err: any) {
      showToast(err.message || 'Failed to update proxy delegation.');
    }
  };

  const downloadReceipt = (req: WorkflowRequest) => {
    const text = `LOOPIN OFFICIAL APPLICATION RECEIPT
==============================================
Request ID:       ${req.id}
Workflow Form:    ${req.templateTitle}
Applicant:        ${req.applicantName}
Department:       ${req.applicantDept}
Institution:      ${req.institutionName}
Submitted On:     ${new Date(req.submittedAt).toLocaleDateString()}
Status:           ${req.status}
Final Authority:  ${req.currentStageName}

APPROVAL ROUTE AUDIT:
${req.track.map((t, i) => `  Step ${i + 1}: ${t}`).join('\n')}

==============================================
Certified by Loopin Workflow Engine (ISO 9001:2015)`;

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${req.id}_Approval_Receipt.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Receipt downloaded for ${req.id}`);
  };

  const tabLabels: Record<string, string> = {
    home: 'Dashboard / My Requests',
    templates: 'Request Templates Directory',
    applications: 'New application',
    inbox: 'Approvals inbox',
    settings: 'Settings / Profile',
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-[#3F4A5A] flex font-sans">
      {/* AUTHENTIC SIDE PANEL (Persistent Left Navigation) */}
      <aside className="w-56 shrink-0 bg-[#F3F4F6] border-r border-[#E5E7EB] p-4 flex flex-col sticky top-0 h-screen shadow-xs z-30">
        <div>
          {/* Brand */}
          <div className="flex items-center gap-2.5 pb-4 border-b border-[#E5E7EB]">
            <div className="w-9 h-9 rounded-lg bg-[#123B6D] text-white flex items-center justify-center font-bold text-xl shadow-xs">
              L
            </div>
            <div>
              <strong className="text-xl font-bold text-[#123B6D] tracking-tight">Loopin</strong>
            </div>
          </div>

          {/* Active Workspace */}
          <div className="my-3.5 p-2.5 bg-white border border-[#E5E7EB] rounded-lg shadow-xs">
            <small className="block text-[9px] uppercase tracking-wider text-[#3F4A5A]/70 font-semibold">
              Active institution
            </small>
            <b className="text-[10px] text-[#123B6D] block truncate font-bold">
              {currentUser.institutionName || 'Sri Sairam Engineering College'}
            </b>
          </div>

          <div className="text-[9px] uppercase font-bold tracking-widest text-[#3F4A5A]/80 px-1 py-1">
            Staff workspace
          </div>

          {/* Navigation Links — Dedicated Landing Page per tab */}
          <nav className="flex flex-col gap-1 mt-1 text-xs">
            <button
              onClick={() => navigateToTab('home')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-left transition-colors cursor-pointer ${
                activeTab === 'home'
                  ? 'bg-[#123B6D] text-white font-bold shadow-xs'
                  : 'text-[#3F4A5A] hover:bg-white/80 hover:text-[#123B6D]'
              }`}
            >
              <span className="w-4 text-center">▦</span>
              <span>Dashboard / My Requests</span>
            </button>

            <button
              onClick={() => navigateToTab('templates')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-left transition-colors cursor-pointer ${
                activeTab === 'templates'
                  ? 'bg-[#123B6D] text-white font-bold shadow-xs'
                  : 'text-[#3F4A5A] hover:bg-white/80 hover:text-[#123B6D]'
              }`}
            >
              <span className="w-4 text-center">▧</span>
              <span>Request Templates</span>
            </button>

            <button
              onClick={() => navigateToTab('applications')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-left transition-colors cursor-pointer ${
                activeTab === 'applications'
                  ? 'bg-[#123B6D] text-white font-bold shadow-xs'
                  : 'text-[#3F4A5A] hover:bg-white/80 hover:text-[#123B6D]'
              }`}
            >
              <span className="w-4 text-center">＋</span>
              <span>New application</span>
            </button>

            <button
              onClick={() => navigateToTab('inbox')}
              className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium text-left transition-colors cursor-pointer ${
                activeTab === 'inbox'
                  ? 'bg-[#123B6D] text-white font-bold shadow-xs'
                  : 'text-[#3F4A5A] hover:bg-white/80 hover:text-[#123B6D]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-4 text-center">▤</span>
                <span>Approvals inbox</span>
              </div>
              {inboxTasks.length > 0 && (
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                  activeTab === 'inbox' ? 'bg-white text-[#123B6D]' : 'bg-[#123B6D] text-white'
                }`}>
                  {inboxTasks.length}
                </span>
              )}
            </button>

            <button
              onClick={() => navigateToTab('settings')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-left transition-colors cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-[#123B6D] text-white font-bold shadow-xs'
                  : 'text-[#3F4A5A] hover:bg-white/80 hover:text-[#123B6D]'
              }`}
            >
              <span className="w-4 flex items-center justify-center">
                <svg
                  className="w-3.5 h-3.5 stroke-current"
                  viewBox="0 0 24 24"
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
              </span>
              <span>Settings / Profile</span>
            </button>
          </nav>
        </div>

        {/* Profile Footer in Sidebar */}
        <div className="mt-auto border-t border-[#E5E7EB] pt-3 text-xs flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#123B6D]/10 text-[#123B6D] flex items-center justify-center font-bold text-xs shrink-0 border border-[#123B6D]/20">
            {currentUser.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
          </div>
          <div className="min-w-0 flex-1">
            <b className="block text-[11px] text-[#123B6D] truncate">{currentUser.name}</b>
            <small className="block text-[9px] text-[#3F4A5A] truncate">{currentUser.designation}</small>
          </div>
          <button
            onClick={onLogout}
            title="Sign out"
            className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
          >
            <LogOut size={13} />
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Header */}
        <header className="h-14 bg-white border-b border-[#E5E7EB] px-6 flex items-center justify-between sticky top-0 z-20">
          <span className="text-xs text-[#3F4A5A]">
            Staff Portal &nbsp;›&nbsp; <b className="text-[#123B6D]">{tabLabels[activeTab]}</b>
          </span>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F3F4F6] border border-[#E5E7EB] rounded-md text-[10px] text-[#3F4A5A] font-medium">
              ▦ &nbsp;{currentUser.institutionName}
            </span>

            <div className="relative hidden md:block w-48">
              <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search portal..."
                value={globalSearch}
                onChange={e => setGlobalSearch(e.target.value)}
                className="w-full text-xs pl-7 pr-2.5 py-1.5 border border-[#E5E7EB] bg-[#F3F4F6] text-[#3F4A5A] rounded-md focus:outline-none focus:ring-1 focus:ring-[#123B6D]"
              />
            </div>

            <button
              onClick={() => { setActiveTab('inbox'); window.location.hash = ''; }}
              className="flex items-center gap-1 px-2.5 py-1 bg-white border border-[#E5E7EB] rounded-md text-xs font-semibold text-[#123B6D] cursor-pointer hover:bg-[#F3F4F6]"
            >
              <span>♧</span>
              {inboxTasks.length > 0 && (
                <span className="w-3.5 h-3.5 rounded-full bg-[#123B6D] text-white text-[8px] flex items-center justify-center font-bold">
                  {inboxTasks.length}
                </span>
              )}
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
                className="px-2.5 py-1 rounded text-[#3F4A5A] hover:text-[#123B6D] font-medium transition-colors cursor-pointer"
              >
                Admin
              </button>
              <button
                onClick={() => onFastSwitch('staff')}
                className="px-2.5 py-1 rounded bg-[#123B6D] text-white font-bold shadow-xs cursor-pointer"
              >
                Staff
              </button>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="p-6 max-w-[1450px] mx-auto w-full space-y-6">
          {/* TAB 1: DASHBOARD / MY REQUESTS */}
          {activeTab === 'home' && (
            <div className="space-y-6 animate-fade-in">
              {/* Executive Welcome Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-xs">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#123B6D]">
                    {currentUser.institutionName || 'Sri Sairam Engineering College'} · Staff Workspace
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-[#123B6D] tracking-tight mt-1">
                    Good morning, {currentUser.name.split(' ')[1] || currentUser.name}
                  </h1>
                  <p className="text-xs text-[#3F4A5A] mt-1">
                    Manage institutional applications, track stage approvals, and access campus workflow templates.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <button
                    onClick={() => setIsCircularModalOpen(true)}
                    className="px-3.5 py-2 bg-white border border-[#E5E7EB] text-[#123B6D] hover:bg-[#F3F4F6] rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    ▤ Campus circulars
                  </button>
                  <button
                    onClick={() => navigateToTab('applications')}
                    className="px-4 py-2 bg-[#123B6D] hover:bg-[#0e2f57] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    ＋ New application
                  </button>
                  <button
                    onClick={() => navigateToTab('inbox')}
                    className="px-3.5 py-2 bg-[#F3F4F6] border border-[#E5E7EB] text-[#123B6D] hover:bg-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    Approvals inbox {inboxTasks.length > 0 && `(${inboxTasks.length})`}
                  </button>
                </div>
              </div>

              {/* Action Banner for Pending Reviews */}
              {inboxTasks.length > 0 && (
                <div className="p-4 bg-[#F3F4F6] border border-[#E5E7EB] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-lg bg-[#123B6D] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                      ◷
                    </span>
                    <div>
                      <b className="text-xs text-[#123B6D]">
                        You have {inboxTasks.length} approval task{inboxTasks.length > 1 ? 's' : ''} assigned to your role ({currentUser.designation})
                      </b>
                      <p className="text-[11px] text-[#3F4A5A] mt-0.5">
                        Please review and sign off pending applications in your approvals inbox.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigateToTab('inbox')}
                    className="px-4 py-2 bg-[#123B6D] text-white rounded-lg text-xs font-semibold hover:bg-[#0e2f57] shrink-0 cursor-pointer shadow-xs transition-colors"
                  >
                    Open inbox →
                  </button>
                </div>
              )}

              {/* Main Workspace Grid: My Requests + Sidebar Panels */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 space-y-6">
                  {/* My Requests Card */}
                  <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E7EB]/60 pb-3">
                      <div>
                        <h2 className="text-base font-bold text-[#123B6D]">My requests</h2>
                        <p className="text-xs text-[#3F4A5A]">
                          Track submitted applications across institutional verification stages
                        </p>
                      </div>
                      <button
                        onClick={() => navigateToTab('templates')}
                        className="text-xs text-[#123B6D] font-semibold hover:underline cursor-pointer"
                      >
                        Browse templates →
                      </button>
                    </div>

                    <div className="space-y-4 pt-1">
                      {myRequests.length > 0 ? (
                        myRequests.map(req => (
                          <div
                            key={req.id}
                            className="p-5 rounded-xl border border-[#E5E7EB] bg-white space-y-3.5 hover:border-[#123B6D]/40 transition-colors shadow-xs"
                          >
                            <div className="flex justify-between items-start gap-3">
                              <div>
                                <div className="text-sm font-bold text-[#123B6D]">{req.templateTitle}</div>
                                <div className="text-[11px] text-[#3F4A5A] mt-0.5">
                                  <span className="font-semibold text-[#123B6D]">{req.id}</span> · Submitted {new Date(req.submittedAt).toLocaleDateString()} · {req.category}
                                </div>
                              </div>
                              <span
                                className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                                  req.status === 'Approved'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : req.status === 'In review'
                                    ? 'bg-[#123B6D]/10 text-[#123B6D] border-[#123B6D]/20'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}
                              >
                                {req.status}
                              </span>
                            </div>

                            {/* Sequential Pipeline Progress */}
                            <div className="flex items-center justify-between text-center relative py-2 before:absolute before:top-4 before:left-3 before:right-3 before:h-0.5 before:bg-[#E5E7EB]">
                              {req.track.map((step, idx) => {
                                const isDone = idx < req.currentStageIndex;
                                const isCurrent = idx === req.currentStageIndex;
                                return (
                                  <div key={idx} className="flex-1 flex flex-col items-center relative z-10">
                                    <div
                                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-all ${
                                        isDone
                                          ? 'bg-emerald-600 text-white'
                                          : isCurrent
                                          ? 'bg-[#123B6D] text-white ring-2 ring-[#123B6D]/20 shadow-xs'
                                          : 'bg-[#F3F4F6] text-slate-400 border border-[#E5E7EB]'
                                      }`}
                                    >
                                      {isDone ? '✓' : idx + 1}
                                    </div>
                                    <div className="text-[9px] text-[#3F4A5A] mt-1.5 truncate max-w-[80px]" title={step}>
                                      {step}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-[#E5E7EB] text-xs">
                              <span className="text-[#3F4A5A] text-[11px]">
                                {req.status === 'Approved' ? (
                                  <b className="text-emerald-700">✓ Fully Approved & Certified</b>
                                ) : (
                                  <>Current authority: <b className="text-[#123B6D]">{req.currentStageName}</b></>
                                )}
                              </span>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setDetailRequest(req)}
                                  className="px-3 py-1.5 text-[#3F4A5A] bg-[#F3F4F6] hover:bg-[#E5E7EB] rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                                >
                                  Details & audit
                                </button>
                                {req.status === 'Approved' && (
                                  <button
                                    onClick={() => downloadReceipt(req)}
                                    className="px-3 py-1.5 text-white bg-[#123B6D] hover:bg-[#0e2f57] rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                                  >
                                    <Download size={12} /> Download receipt
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-10 text-[#3F4A5A] text-xs bg-[#F3F4F6]/50 rounded-xl border border-dashed border-[#E5E7EB]">
                          No applications submitted yet. Browse available templates to submit your first request.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Saved Drafts Card */}
                  <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-[#E5E7EB]/60 pb-3">
                      <div>
                        <h2 className="text-base font-bold text-[#123B6D]">Saved drafts</h2>
                        <p className="text-xs text-[#3F4A5A]">Continue applications you have started and saved</p>
                      </div>
                      <span className="text-xs font-bold text-[#123B6D] bg-[#F3F4F6] border border-[#E5E7EB] px-2.5 py-1 rounded-full">
                        {drafts.length} drafts
                      </span>
                    </div>

                    <div className="space-y-2.5 pt-1">
                      {drafts.length > 0 ? (
                        drafts.map(d => {
                          const tpl = templates.find(t => t.id === d.templateId);
                          return (
                            <div
                              key={d.id}
                              className="p-3.5 bg-[#F3F4F6] border border-[#E5E7EB] rounded-xl flex justify-between items-center text-xs hover:border-[#123B6D]/30 transition-colors"
                            >
                              <div>
                                <b className="text-sm text-[#123B6D]">{d.title}</b>
                                <small className="block text-[#3F4A5A] text-[11px] mt-0.5">
                                  Saved {new Date(d.savedAt).toLocaleDateString()} · {d.category}
                                </small>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => { if (tpl) openApplyModal(tpl, d); }}
                                  className="px-3 py-1.5 bg-[#123B6D] text-white rounded-lg text-xs font-semibold hover:bg-[#0e2f57] cursor-pointer shadow-xs transition-colors"
                                >
                                  Continue
                                </button>
                                <button
                                  onClick={() => handleDeleteDraft(d.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded cursor-pointer transition-colors"
                                  title="Delete draft"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-8 text-[#3F4A5A] text-xs bg-[#F3F4F6]/50 rounded-xl border border-dashed border-[#E5E7EB]">
                          No saved drafts. Start an application and choose Save as draft.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column: Approvals Inbox Quick Panel + Campus Updates */}
                <div className="lg:col-span-4 space-y-6">
                  {/* Approvals Inbox Quick Review */}
                  <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-[#E5E7EB]/60 pb-3">
                      <div>
                        <h2 className="text-base font-bold text-[#123B6D]">Approvals inbox</h2>
                        <p className="text-xs text-[#3F4A5A]">Tasks assigned to your role</p>
                      </div>
                      <button
                        onClick={() => navigateToTab('inbox')}
                        className="text-xs text-[#123B6D] font-semibold hover:underline cursor-pointer"
                      >
                        View all →
                      </button>
                    </div>

                    <div className="space-y-2.5 pt-1">
                      {inboxTasks.length > 0 ? (
                        inboxTasks.slice(0, 3).map(task => (
                          <div
                            key={task.id}
                            className="p-3.5 bg-[#F3F4F6] border border-[#E5E7EB] rounded-xl flex justify-between items-center text-xs"
                          >
                            <div>
                              <b className="text-xs text-[#123B6D]">{task.templateTitle}</b>
                              <small className="block text-[#3F4A5A] text-[10px] mt-0.5">
                                {task.applicantName} · {task.currentStageName}
                              </small>
                            </div>
                            <button
                              onClick={() => { setSelectedTask(task); setIsTaskModalOpen(true); }}
                              className="px-3 py-1.5 bg-[#123B6D] text-white rounded-lg text-xs font-semibold hover:bg-[#0e2f57] cursor-pointer shadow-xs transition-colors shrink-0"
                            >
                              Review
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6 text-[#3F4A5A] text-xs bg-[#F3F4F6]/50 rounded-xl border border-dashed border-[#E5E7EB]">
                          You are all caught up! No open tasks are assigned to you.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Institution Updates & Guidelines */}
                  <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-xs space-y-4 text-xs">
                    <h2 className="text-base font-bold text-[#123B6D] border-b border-[#E5E7EB]/60 pb-3">
                      Institution updates
                    </h2>
                    <div className="space-y-3 divide-y divide-[#E5E7EB]">
                      <div className="pt-1">
                        <b className="text-[#123B6D]">Research travel claim checklist</b>
                        <small className="block text-[#3F4A5A] text-[11px] mt-0.5">
                          Finance Office · Attach original receipts and attendance certificates
                        </small>
                      </div>
                      <div className="pt-3">
                        <b className="text-[#123B6D]">Conference OD documentation</b>
                        <small className="block text-[#3F4A5A] text-[11px] mt-0.5">
                          R&D Council · Circular PT-AC-024 · Effective this semester
                        </small>
                      </div>
                      <div className="pt-3">
                        <b className="text-[#123B6D]">Staff Help Desk & Assistance</b>
                        <small className="block text-[#3F4A5A] text-[11px] mt-0.5">
                          helpdesk@sairam.edu.in · Ext. 224
                        </small>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsCircularModalOpen(true)}
                      className="w-full py-2 bg-[#F3F4F6] text-[#123B6D] border border-[#E5E7EB] hover:bg-[#E5E7EB] rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      View all campus circulars →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DEDICATED REQUEST TEMPLATES DIRECTORY LANDING PAGE */}
          {activeTab === 'templates' && (
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-xs space-y-6 animate-fade-in">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E7EB]/60 pb-5">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl sm:text-2xl font-bold text-[#123B6D] tracking-tight">
                      Request Templates Directory
                    </h2>
                    <span className="text-xs font-semibold text-[#123B6D] bg-[#F3F4F6] px-2.5 py-0.5 rounded-full border border-[#E5E7EB]">
                      {templates.length} available
                    </span>
                  </div>
                  <p className="text-xs text-[#3F4A5A] mt-1">
                    Standardized campus workflow forms and sequential approval routes for your institution
                  </p>
                </div>

                {/* Search Bar */}
                <div className="relative w-full sm:w-72">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search templates by code or title..."
                    value={globalSearch}
                    onChange={e => setGlobalSearch(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2 border border-[#E5E7EB] bg-white text-[#3F4A5A] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#123B6D]/30"
                  />
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[10px] uppercase font-bold text-[#3F4A5A]/70 mr-1">Category:</span>
                {['All', 'Faculty & Leave', 'Research & Grants', 'Finance & Accounts', 'Events & Infrastructure', 'Clearance & NOC', 'People & HR'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                      categoryFilter === cat
                        ? 'bg-[#123B6D] text-white shadow-xs'
                        : 'bg-white border border-[#E5E7EB] text-[#3F4A5A] hover:border-[#123B6D] hover:text-[#123B6D]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Templates Catalog */}
              <div className="space-y-4 pt-1">
                <div>
                  <h3 className="font-bold text-sm text-[#123B6D]">
                    Authorized Campus Request Templates
                  </h3>
                  <p className="text-xs text-[#3F4A5A] mt-0.5">
                    Select any template below to view approval track requirements or start an application.
                  </p>
                </div>

                <div className="space-y-3.5">
                  {templates
                    .filter(t => categoryFilter === 'All' || t.category === categoryFilter || (categoryFilter === 'Finance & Accounts' && t.category === 'Finance'))
                    .filter(t => {
                      if (!globalSearch.trim()) return true;
                      const q = globalSearch.toLowerCase();
                      return (
                        t.title.toLowerCase().includes(q) ||
                        t.code.toLowerCase().includes(q) ||
                        t.category.toLowerCase().includes(q)
                      );
                    })
                    .map(tpl => (
                      <div
                        key={tpl.id}
                        className="p-5 bg-white border border-[#E5E7EB] rounded-xl shadow-xs space-y-3.5 hover:border-[#123B6D]/40 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[#123B6D] bg-[#123B6D]/10 px-2.5 py-0.5 rounded text-[11px]">
                                Form {tpl.code}
                              </span>
                              <span className="text-slate-500 text-xs font-medium">{tpl.turnaround}</span>
                              <span className="text-[#3F4A5A] text-xs font-medium">· {tpl.category}</span>
                            </div>
                            <h4 className="font-bold text-base text-[#123B6D]">{tpl.title}</h4>
                          </div>
                          <button
                            onClick={() => openApplyModal(tpl)}
                            className="px-4 py-2 border border-[#123B6D] bg-white text-[#123B6D] hover:bg-[#F3F4F6] text-xs font-semibold rounded-lg shadow-xs transition-colors shrink-0 cursor-pointer"
                          >
                            Apply with this template
                          </button>
                        </div>

                        <div className="border-t border-[#E5E7EB] pt-2.5">
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
                            <div className="mt-3 p-4 bg-[#F3F4F6] border border-[#E5E7EB] rounded-xl text-xs text-[#3F4A5A] space-y-2 animate-fade-in">
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

          {/* TAB 3: NEW APPLICATION */}
          {activeTab === 'applications' && (
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-xs space-y-6 animate-fade-in">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E7EB]/60 pb-5">
                <div>
                  <div className="text-[10px] uppercase font-bold tracking-widest text-[#123B6D]">
                    Institution-Approved Forms · Quick Submission
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[#123B6D] tracking-tight mt-1">
                    New Application
                  </h1>
                  <p className="text-xs text-[#3F4A5A] mt-1">
                    Select an authorized template to initiate an official request routed through your campus administration.
                  </p>
                </div>

                {/* Search Bar */}
                <div className="relative w-full sm:w-72">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search forms by name or code..."
                    value={globalSearch}
                    onChange={e => setGlobalSearch(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2 border border-[#E5E7EB] bg-white text-[#3F4A5A] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#123B6D]/30"
                  />
                </div>
              </div>

              {/* Category Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[10px] uppercase font-bold text-[#3F4A5A]/70 mr-1">Filter:</span>
                {['All', 'Faculty & Leave', 'Research & Grants', 'Finance & Accounts', 'Events & Infrastructure', 'Clearance & NOC', 'People & HR'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                      categoryFilter === cat
                        ? 'bg-[#123B6D] text-white shadow-xs'
                        : 'bg-white border border-[#E5E7EB] text-[#3F4A5A] hover:border-[#123B6D] hover:text-[#123B6D]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* 3-Column Template Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-1">
                {templates
                  .filter(t => categoryFilter === 'All' || t.category === categoryFilter || (categoryFilter === 'Finance & Accounts' && t.category === 'Finance'))
                  .filter(t => {
                    if (!globalSearch.trim()) return true;
                    const q = globalSearch.toLowerCase();
                    return (
                      t.title.toLowerCase().includes(q) ||
                      t.code.toLowerCase().includes(q) ||
                      t.category.toLowerCase().includes(q)
                    );
                  })
                  .map(tpl => (
                    <div
                      key={tpl.id}
                      className="p-5 bg-white border border-[#E5E7EB] rounded-xl shadow-xs flex flex-col justify-between space-y-4 hover:border-[#123B6D] hover:shadow-md transition-all group"
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-[#123B6D] bg-[#123B6D]/10 px-2.5 py-0.5 rounded text-[11px]">
                            Form {tpl.code}
                          </span>
                          <span className="text-slate-500 text-[11px] font-medium">{tpl.turnaround}</span>
                        </div>
                        <h3 className="font-bold text-base text-[#123B6D] group-hover:text-[#0d2c50] transition-colors">
                          {tpl.title}
                        </h3>
                        <div className="pt-2.5 border-t border-[#E5E7EB]/60">
                          <span className="text-[10px] uppercase font-bold text-[#3F4A5A]/70 block mb-1">
                            Approval Flow:
                          </span>
                          <div className="text-xs text-[#3F4A5A] truncate font-medium" title={tpl.steps.join(' → ')}>
                            {tpl.steps.join(' → ')}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => openApplyModal(tpl)}
                        className="w-full py-2.5 bg-[#123B6D] hover:bg-[#0e2f57] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span>Apply with this Template</span>
                        <span>→</span>
                      </button>
                    </div>
                  ))}
              </div>

              {/* Informational Footer */}
              <div className="p-4 bg-[#F3F4F6] border border-[#E5E7EB] rounded-xl text-xs text-[#3F4A5A] flex flex-col sm:flex-row items-center justify-between gap-3">
                <span>
                  All applications submitted through Loopin are cryptographically timestamped and sequentially routed through your campus administration according to the verified organogram.
                </span>
                <button
                  onClick={() => navigateToTab('templates')}
                  className="text-xs text-[#123B6D] font-bold hover:underline shrink-0 cursor-pointer"
                >
                  View full template details &rarr;
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: APPROVALS INBOX */}
          {activeTab === 'inbox' && (
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-xs space-y-6 animate-fade-in">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E7EB]/60 pb-5">
                <div>
                  <div className="text-[10px] uppercase font-bold tracking-widest text-[#123B6D]">
                    Assigned Responsibilities · Role Sign-Off
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[#123B6D] tracking-tight mt-1">
                    Approvals Inbox
                  </h1>
                  <p className="text-xs text-[#3F4A5A] mt-1">
                    Requests currently awaiting your evaluation and formal sign-off as <b className="text-[#123B6D]">{currentUser.designation}</b> ({currentUser.department}).
                  </p>
                </div>
                <button
                  onClick={() => setShowSignedHistory(!showSignedHistory)}
                  className="px-3.5 py-2 bg-white border border-[#E5E7EB] rounded-lg text-xs font-semibold text-[#123B6D] hover:bg-[#F3F4F6] shadow-xs cursor-pointer transition-colors shrink-0"
                >
                  {showSignedHistory ? 'Hide signed history' : 'View signed history'}
                </button>
              </div>

              {/* Tasks Needing Action */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-[#123B6D]">
                    Tasks needing action ({inboxTasks.length})
                  </h2>
                  <span className="text-xs text-[#3F4A5A]">
                    {inboxTasks.length > 0 ? `${inboxTasks.length} pending task(s)` : 'All tasks cleared'}
                  </span>
                </div>

                <div className="overflow-x-auto border border-[#E5E7EB] rounded-xl shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#F3F4F6] text-[#3F4A5A] uppercase text-[10px] font-bold border-b border-[#E5E7EB]">
                        <th className="py-3 px-4">Request & Code</th>
                        <th className="py-3 px-4">Applicant</th>
                        <th className="py-3 px-4">Current Authority Stage</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB] bg-white">
                      {inboxTasks.length > 0 ? (
                        inboxTasks.map(t => (
                          <tr key={t.id} className="hover:bg-[#F3F4F6]/50 transition-colors">
                            <td className="py-3 px-4">
                              <span className="font-bold text-[#123B6D]">{t.id}</span>
                              <div className="font-semibold text-slate-800 mt-0.5">{t.templateTitle}</div>
                            </td>
                            <td className="py-3 px-4">
                              <b className="text-[#123B6D]">{t.applicantName}</b>
                              <small className="block text-[#3F4A5A] text-[11px] mt-0.5">{t.applicantDept}</small>
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-medium text-[#3F4A5A]">{t.currentStageName}</span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                Pending action
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => { setSelectedTask(t); setIsTaskModalOpen(true); }}
                                className="px-3.5 py-1.5 bg-[#123B6D] text-white rounded-lg text-xs font-semibold hover:bg-[#0e2f57] cursor-pointer shadow-xs transition-colors"
                              >
                                Review & Sign
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="text-center py-10 text-[#3F4A5A] text-xs">
                            You are all caught up! No pending approvals are currently assigned to your role.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Signed History Panel */}
              {showSignedHistory && (
                <div className="bg-[#F3F4F6] border border-[#E5E7EB] rounded-xl p-5 text-xs space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
                    <h3 className="font-bold text-[#123B6D]">Signed Request History</h3>
                    <span className="text-[10px] text-[#3F4A5A]">Archived institutional sign-offs</span>
                  </div>
                  {requests.filter(r => r.stages.some(s => s.actedBy === currentUser.name)).length > 0 ? (
                    <div className="space-y-2">
                      {requests.filter(r => r.stages.some(s => s.actedBy === currentUser.name)).map(r => (
                        <div key={r.id} className="p-3 bg-white border border-[#E5E7EB] rounded-lg flex justify-between items-center">
                          <div>
                            <span className="font-bold text-[#123B6D]">{r.id}</span> · {r.templateTitle} · <span className="text-[#3F4A5A]">Applicant: {r.applicantName}</span>
                          </div>
                          <span className={`font-bold text-[10px] px-2 py-0.5 rounded-full border ${
                            r.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}>
                            {r.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-[#3F4A5A]">
                      No previous sign-offs recorded in this session.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: SETTINGS / PROFILE */}
          {activeTab === 'settings' && (
            <div className="space-y-6 animate-fade-in">
              {/* Header */}
              <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-xs">
                <div className="text-[10px] uppercase font-bold tracking-widest text-[#123B6D]">
                  Account Credentials & Institutional Authority
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-[#123B6D] tracking-tight mt-1">
                  Settings / Profile
                </h1>
                <p className="text-xs text-[#3F4A5A] mt-1">
                  Manage verified staff employment details, digital sign-off authority, proxy approver delegation, and notification preferences.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Staff Profile Card */}
                <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-xs space-y-5">
                  <div className="flex justify-between items-center border-b border-[#E5E7EB]/60 pb-3">
                    <div>
                      <h2 className="text-base font-bold text-[#123B6D]">Staff Profile</h2>
                      <p className="text-xs text-[#3F4A5A]">Verified employment credentials</p>
                    </div>
                    <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ✓ Verified · Active Staff
                    </span>
                  </div>

                  <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
                    <div>
                      <label className="block text-[#3F4A5A] font-semibold mb-1">Full name</label>
                      <input
                        type="text"
                        value={profileName}
                        onChange={e => setProfileName(e.target.value)}
                        className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg bg-white text-[#3F4A5A] focus:outline-none focus:ring-2 focus:ring-[#123B6D]/30"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[#3F4A5A] font-semibold mb-1">Employee code</label>
                        <input
                          type="text"
                          value={profileCode}
                          onChange={e => setProfileCode(e.target.value)}
                          className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg bg-white text-[#3F4A5A] focus:outline-none focus:ring-2 focus:ring-[#123B6D]/30"
                        />
                      </div>
                      <div>
                        <label className="block text-[#3F4A5A] font-semibold mb-1">Designation</label>
                        <input
                          type="text"
                          value={profileRole}
                          onChange={e => setProfileRole(e.target.value)}
                          className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg bg-white text-[#3F4A5A] focus:outline-none focus:ring-2 focus:ring-[#123B6D]/30"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[#3F4A5A] font-semibold mb-1">Department</label>
                      <input
                        type="text"
                        value={profileDept}
                        onChange={e => setProfileDept(e.target.value)}
                        className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg bg-white text-[#3F4A5A] focus:outline-none focus:ring-2 focus:ring-[#123B6D]/30"
                      />
                    </div>
                    <div>
                      <label className="block text-[#3F4A5A] font-semibold mb-1">Institutional email</label>
                      <input
                        type="email"
                        disabled
                        value={currentUser.email}
                        className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg bg-[#F3F4F6] text-slate-500 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-[#3F4A5A] font-semibold mb-1">Institution</label>
                      <input
                        type="text"
                        disabled
                        value={currentUser.institutionName || 'Sri Sairam Engineering College'}
                        className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg bg-[#F3F4F6] text-slate-500 cursor-not-allowed"
                      />
                    </div>

                    {/* Official Digital Sign-off Seal Preview */}
                    <div className="p-4 bg-[#F3F4F6] border border-[#123B6D]/30 rounded-xl space-y-1.5 text-center font-mono text-[11px] text-[#123B6D]">
                      <div className="font-bold tracking-wider">OFFICIAL DIGITAL APPROVAL SEAL</div>
                      <div className="text-[10px] text-[#3F4A5A]">
                        SIGNATORY: {profileName.toUpperCase()} · {profileCode}
                      </div>
                      <div className="text-[10px] text-[#3F4A5A]">
                        ROLE: {profileRole.toUpperCase()} · {profileDept.toUpperCase()}
                      </div>
                      <div className="text-[10px] text-[#3F4A5A]">
                        INSTITUTION: {(currentUser.institutionName || 'Sri Sairam Engineering College').toUpperCase()}
                      </div>
                      <div className="text-[9px] text-emerald-700 font-bold mt-1">
                        ✓ CRYPTOGRAPHIC AUDIT KEY: SHA-256 VERIFIED
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-[#123B6D] text-white text-xs font-bold rounded-lg hover:bg-[#0e2f57] cursor-pointer shadow-xs transition-colors"
                    >
                      Save Profile & Stamp
                    </button>
                  </form>
                </div>

                {/* Proxy Delegation & Notifications */}
                <div className="space-y-6">
                  {/* Out of Office & Proxy */}
                  <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-xs space-y-4 text-xs">
                    <div className="border-b border-[#E5E7EB]/60 pb-3">
                      <h2 className="text-base font-bold text-[#123B6D]">Out-of-office & proxy</h2>
                      <p className="text-xs text-[#3F4A5A] mt-0.5">
                        Forward approval responsibilities during scheduled leave or off-campus duty
                      </p>
                    </div>

                    <form onSubmit={handleSaveDelegation} className="space-y-3.5">
                      <div className="flex justify-between items-center p-3 bg-[#F3F4F6] border border-[#E5E7EB] rounded-xl">
                        <div>
                          <b className="text-[#123B6D]">Enable approval forwarding</b>
                          <small className="block text-[#3F4A5A] text-[10px] mt-0.5">
                            Automatically forward inbox approvals to designated colleague
                          </small>
                        </div>
                        <input
                          type="checkbox"
                          checked={proxyEnabled}
                          onChange={e => setProxyEnabled(e.target.checked)}
                          className="w-4 h-4 accent-[#123B6D] cursor-pointer"
                        />
                      </div>

                      {proxyEnabled && (
                        <div className="space-y-3 pt-1 animate-fade-in">
                          <div>
                            <label className="block font-semibold text-[#3F4A5A] mb-1">
                              Eligible proxy approver
                            </label>
                            <select
                              value={proxyName}
                              onChange={e => setProxyName(e.target.value)}
                              className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg bg-white text-[#3F4A5A] focus:outline-none focus:ring-2 focus:ring-[#123B6D]/30"
                            >
                              <option value="">Choose an eligible staff member</option>
                              <option value="Dr. S. Rajendran · Dean Academics">Dr. S. Rajendran · Dean Academics</option>
                              <option value="Dr. K. Meenakshi · Head of Department">Dr. K. Meenakshi · Head of Department</option>
                              <option value="R. Prakash · Administrative Officer">R. Prakash · Administrative Officer</option>
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block font-semibold text-[#3F4A5A] mb-1">Delegation starts</label>
                              <input
                                type="date"
                                value={proxyStartDate}
                                onChange={e => setProxyStartDate(e.target.value)}
                                className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg bg-white text-[#3F4A5A] focus:outline-none focus:ring-2 focus:ring-[#123B6D]/30"
                              />
                            </div>
                            <div>
                              <label className="block font-semibold text-[#3F4A5A] mb-1">Delegation ends</label>
                              <input
                                type="date"
                                value={proxyEndDate}
                                onChange={e => setProxyEndDate(e.target.value)}
                                className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg bg-white text-[#3F4A5A] focus:outline-none focus:ring-2 focus:ring-[#123B6D]/30"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <button
                        type="submit"
                        className="px-4 py-2 bg-[#123B6D] text-white text-xs font-bold rounded-lg hover:bg-[#0e2f57] cursor-pointer shadow-xs transition-colors"
                      >
                        Save delegation period
                      </button>
                    </form>
                  </div>

                  {/* Notification Preferences */}
                  <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-xs space-y-4 text-xs">
                    <div className="border-b border-[#E5E7EB]/60 pb-3">
                      <h2 className="text-base font-bold text-[#123B6D]">Notification preferences</h2>
                      <p className="text-xs text-[#3F4A5A] mt-0.5">
                        Configure institutional alerts and digests
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="flex justify-between items-center p-2.5 rounded-lg hover:bg-[#F3F4F6] cursor-pointer transition-colors">
                        <span className="text-[#3F4A5A] font-medium">Requests awaiting my action</span>
                        <input
                          type="checkbox"
                          checked={notifyAssigned}
                          onChange={e => setNotifyAssigned(e.target.checked)}
                          className="accent-[#123B6D] cursor-pointer w-4 h-4"
                        />
                      </label>
                      <label className="flex justify-between items-center p-2.5 rounded-lg hover:bg-[#F3F4F6] cursor-pointer transition-colors">
                        <span className="text-[#3F4A5A] font-medium">Daily pending-work summary</span>
                        <input
                          type="checkbox"
                          checked={notifyDaily}
                          onChange={e => setNotifyDaily(e.target.checked)}
                          className="accent-[#123B6D] cursor-pointer w-4 h-4"
                        />
                      </label>
                      <label className="flex justify-between items-center p-2.5 rounded-lg hover:bg-[#F3F4F6] cursor-pointer transition-colors">
                        <span className="text-[#3F4A5A] font-medium">Urgent institutional escalations</span>
                        <input
                          type="checkbox"
                          checked={notifyUrgent}
                          onChange={e => setNotifyUrgent(e.target.checked)}
                          className="accent-[#123B6D] cursor-pointer w-4 h-4"
                        />
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={() => showToast('Notification preferences saved.')}
                      className="px-4 py-2 bg-[#F3F4F6] text-[#123B6D] border border-[#E5E7EB] hover:bg-[#E5E7EB] text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-xs"
                    >
                      Save alert preferences
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Dynamic Application Modal */}
      {isApplyModalOpen && selectedTemplate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <form
            onSubmit={handleSubmitApplication}
            className="bg-white rounded-xl shadow-2xl border border-[#E5E7EB] w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4"
          >
            <div className="flex justify-between items-start border-b border-[#E5E7EB] pb-3">
              <div>
                <h3 className="font-bold text-base text-[#123B6D]">{selectedTemplate.title}</h3>
                <small className="text-[#3F4A5A]">{selectedTemplate.category} · Form {selectedTemplate.code}</small>
              </div>
              <button type="button" onClick={() => setIsApplyModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <XCircle size={18} />
              </button>
            </div>

            <div className="p-3.5 bg-[#F3F4F6] rounded-xl border border-[#E5E7EB] text-xs space-y-1">
              <b className="text-[#123B6D]">Approval path:</b>
              <div className="text-[#3F4A5A] font-medium">{selectedTemplate.steps.join(' → ')}</div>
            </div>

            <div className="space-y-3.5 text-xs">
              {selectedTemplate.fields.map((f, i) => (
                <div key={i}>
                  <label className="block font-semibold text-[#3F4A5A] mb-1">{f.name}</label>
                  {f.type === 'textarea' ? (
                    <textarea
                      required={f.required}
                      rows={2}
                      value={formData[f.name] || ''}
                      onChange={e => setFormData({ ...formData, [f.name]: e.target.value })}
                      className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-xs bg-white text-[#3F4A5A] focus:outline-none focus:ring-2 focus:ring-[#123B6D]/30"
                    />
                  ) : (
                    <input
                      type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
                      required={f.required}
                      value={formData[f.name] || ''}
                      onChange={e => setFormData({ ...formData, [f.name]: e.target.value })}
                      className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-xs bg-white text-[#3F4A5A] focus:outline-none focus:ring-2 focus:ring-[#123B6D]/30"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-[#E5E7EB]">
              <button
                type="button"
                onClick={handleSaveDraft}
                className="px-3.5 py-2 bg-[#F3F4F6] text-[#123B6D] border border-[#E5E7EB] hover:bg-[#E5E7EB] text-xs font-semibold rounded-lg cursor-pointer transition-colors shadow-xs"
              >
                Save as draft
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsApplyModalOpen(false)}
                  className="px-3.5 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#123B6D] text-white text-xs font-bold rounded-lg hover:bg-[#0e2f57] cursor-pointer shadow-xs transition-colors"
                >
                  Submit application
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Task Review Modal */}
      {isTaskModalOpen && selectedTask && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-[#E5E7EB] w-full max-w-lg p-6 space-y-4">
            <div className="flex justify-between items-start border-b border-[#E5E7EB] pb-3">
              <div>
                <h3 className="font-bold text-base text-[#123B6D]">{selectedTask.templateTitle}</h3>
                <small className="text-[#3F4A5A]">{selectedTask.id} · {selectedTask.applicantName}</small>
              </div>
              <button onClick={() => setIsTaskModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <XCircle size={18} />
              </button>
            </div>

            <div className="p-3.5 bg-[#F3F4F6] rounded-xl border border-[#E5E7EB] text-xs space-y-1">
              <div><b className="text-[#123B6D]">Current review stage:</b> {selectedTask.currentStageName}</div>
              <div><b className="text-[#123B6D]">Department:</b> {selectedTask.applicantDept}</div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#3F4A5A] mb-1">Remarks or clarification note</label>
              <textarea
                rows={2}
                value={taskRemark}
                onChange={e => setTaskRemark(e.target.value)}
                placeholder="Add note for applicant or next approver..."
                className="w-full text-xs px-3 py-2 border border-[#E5E7EB] rounded-lg bg-white text-[#3F4A5A] focus:outline-none focus:ring-2 focus:ring-[#123B6D]/30"
              />
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-[#E5E7EB]">
              <button
                type="button"
                onClick={() => handleTaskAction('Declined')}
                className="px-3.5 py-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg font-semibold hover:bg-rose-100 cursor-pointer transition-colors"
              >
                Decline
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleTaskAction('Clarification requested')}
                  className="px-3.5 py-2 text-xs bg-[#F3F4F6] text-[#3F4A5A] border border-[#E5E7EB] hover:bg-[#E5E7EB] rounded-lg font-semibold cursor-pointer transition-colors"
                >
                  Request clarification
                </button>
                <button
                  type="button"
                  onClick={() => handleTaskAction('Approved')}
                  className="px-4 py-2 bg-[#123B6D] text-white text-xs font-bold rounded-lg hover:bg-[#0e2f57] cursor-pointer shadow-xs transition-colors"
                >
                  Approve & pass on
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Request Details Modal */}
      {detailRequest && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-[#E5E7EB] w-full max-w-lg p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-[#E5E7EB] pb-3">
              <div>
                <h3 className="font-bold text-base text-[#123B6D]">{detailRequest.id} · Details</h3>
                <small className="text-[#3F4A5A]">{detailRequest.templateTitle}</small>
              </div>
              <button onClick={() => setDetailRequest(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <XCircle size={18} />
              </button>
            </div>

            <div className="p-3.5 bg-[#F3F4F6] rounded-xl border border-[#E5E7EB] text-xs space-y-1">
              <div><b className="text-[#123B6D]">Status:</b> {detailRequest.status}</div>
              <div><b className="text-[#123B6D]">Current stage:</b> {detailRequest.currentStageName}</div>
              <div><b className="text-[#123B6D]">Submitted:</b> {new Date(detailRequest.submittedAt).toLocaleString()}</div>
            </div>

            <div className="space-y-2 text-xs">
              <b className="text-[#123B6D]">Approval track:</b>
              <div className="space-y-1.5">
                {detailRequest.track.map((t, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <span className={`w-5 h-5 rounded-full text-[9px] flex items-center justify-center font-bold ${
                      i < detailRequest.currentStageIndex ? 'bg-emerald-600 text-white' : 'bg-[#F3F4F6] border border-[#E5E7EB] text-slate-500'
                    }`}>
                      {i < detailRequest.currentStageIndex ? '✓' : i + 1}
                    </span>
                    <span className="text-[#3F4A5A] font-medium">{t}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-[#E5E7EB]">
              <button
                type="button"
                onClick={() => setDetailRequest(null)}
                className="px-4 py-2 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#123B6D] text-xs font-semibold rounded-lg border border-[#E5E7EB] cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Circulars Modal */}
      {isCircularModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-[#E5E7EB] p-6 w-full max-w-md space-y-4">
            <div className="flex justify-between items-center border-b border-[#E5E7EB] pb-3">
              <h3 className="font-bold text-base text-[#123B6D]">Campus circulars</h3>
              <button onClick={() => setIsCircularModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <XCircle size={18} />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div className="p-3.5 bg-[#F3F4F6] border border-[#E5E7EB] rounded-xl space-y-1">
                <b className="text-[#123B6D]">Research travel claim checklist</b>
                <p className="text-[#3F4A5A]">Attach original tickets, attendance certificate, and payment vouchers.</p>
              </div>
              <div className="p-3.5 bg-[#F3F4F6] border border-[#E5E7EB] rounded-xl space-y-1">
                <b className="text-[#123B6D]">Conference OD documentation</b>
                <p className="text-[#3F4A5A]">R&D Council · Circular PT-AC-024 · Effective this semester.</p>
              </div>
              <div className="p-3.5 bg-[#F3F4F6] border border-[#E5E7EB] rounded-xl space-y-1">
                <b className="text-[#123B6D]">Staff Help Desk</b>
                <p className="text-[#3F4A5A]">helpdesk@sairam.edu.in · Ext. 224</p>
              </div>
            </div>
            <div className="flex justify-end pt-3 border-t border-[#E5E7EB]">
              <button
                type="button"
                onClick={() => setIsCircularModalOpen(false)}
                className="px-4 py-2 text-xs bg-[#123B6D] text-white font-semibold rounded-lg hover:bg-[#0e2f57] cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
