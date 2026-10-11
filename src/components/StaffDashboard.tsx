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
    if (typeof window !== 'undefined' && window.location.hash === '#templates') return 'templates';
    return 'home';
  });
  const [templateView, setTemplateView] = useState<'cards' | 'catalog'>('cards');

  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash === '#templates') {
        setActiveTab('templates');
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
              onClick={() => { setActiveTab('home'); window.location.hash = ''; }}
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
              onClick={() => { setActiveTab('templates'); window.location.hash = '#templates'; }}
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
              onClick={() => { setActiveTab('applications'); window.location.hash = ''; }}
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
              onClick={() => { setActiveTab('inbox'); window.location.hash = ''; }}
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
              onClick={() => { setActiveTab('settings'); window.location.hash = ''; }}
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
            <div className="space-y-6">
              {/* Welcome Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-[#2b5e98]">
                    {currentUser.institutionName} · Staff workspace
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-[#1d2f45] tracking-tight mt-0.5">
                    Good morning, {currentUser.name.split(' ')[1] || currentUser.name}
                  </h1>
                  <p className="text-xs text-[#748196] mt-0.5">
                    Keep track of your requests, assigned reviews, and campus updates.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsCircularModalOpen(true)}
                    className="px-3 py-1.5 bg-white border border-[#e2e8f0] text-slate-700 rounded text-xs font-semibold hover:bg-slate-50"
                  >
                    ▤ Campus circulars
                  </button>
                  <button
                    onClick={() => setActiveTab('applications')}
                    className="px-3.5 py-1.5 bg-[#123b6d] text-white rounded text-xs font-semibold hover:bg-[#0d2c50] shadow-xs"
                  >
                    ＋ New application
                  </button>
                </div>
              </div>

              {/* Notice Banner */}
              {inboxTasks.length > 0 && (
                <div className="p-3 bg-[#eef5ff] border border-[#d9e5f3] rounded flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded bg-[#dce9fb] text-[#123b6d] flex items-center justify-center font-bold text-xs shrink-0">
                      ◷
                    </span>
                    <div>
                      <b className="text-xs text-[#1d2f45]">You have {inboxTasks.length} approval tasks that need attention</b>
                      <p className="text-[10px] text-[#647891] mt-0.5">Review the request details in your approvals inbox.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('inbox')}
                    className="px-3 py-1 bg-[#eaf1fb] text-[#123b6d] border border-[#d7e4f5] rounded text-xs font-semibold hover:bg-[#dce9fb] shrink-0"
                  >
                    Open inbox →
                  </button>
                </div>
              )}

              {/* Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 bg-white rounded border border-[#e2e8f0] shadow-xs">
                  <div className="flex justify-between text-xs text-[#748196]">
                    <span>Active requests</span>
                    <span className="text-[#123b6d]">▤</span>
                  </div>
                  <strong className="block text-2xl font-bold text-[#213b5c] mt-1.5">{activeCount}</strong>
                  <small className="text-[10px] text-[#748196]">Across your current applications</small>
                </div>

                <div className="p-3.5 bg-white rounded border border-[#e2e8f0] shadow-xs">
                  <div className="flex justify-between text-xs text-[#748196]">
                    <span>Pending sign-offs</span>
                    <span className="text-amber-600">✍</span>
                  </div>
                  <strong className="block text-2xl font-bold text-[#213b5c] mt-1.5">{inboxTasks.length}</strong>
                  <small className="text-[10px] text-amber-700">Assigned to your role</small>
                </div>

                <div className="p-3.5 bg-white rounded border border-[#e2e8f0] shadow-xs">
                  <div className="flex justify-between text-xs text-[#748196]">
                    <span>Approved applications</span>
                    <span className="text-emerald-600">✓</span>
                  </div>
                  <strong className="block text-2xl font-bold text-[#213b5c] mt-1.5">{approvedCount}</strong>
                  <small className="text-[10px] text-emerald-700">This academic year</small>
                </div>

                <div className="p-3.5 bg-white rounded border border-[#e2e8f0] shadow-xs">
                  <div className="flex justify-between text-xs text-[#748196]">
                    <span>Average turnaround</span>
                    <span className="text-[#123b6d]">◷</span>
                  </div>
                  <strong className="block text-2xl font-bold text-[#213b5c] mt-1.5">4.2 <span className="text-sm font-normal text-slate-400">days</span></strong>
                  <small className="text-[10px] text-[#748196]">For your submitted requests</small>
                </div>
              </div>

              {/* Grid: My Requests + Side Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 space-y-6">
                  {/* My Requests Card */}
                  <div className="bg-white border border-[#e2e8f0] rounded p-5 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-base font-bold text-[#26384f]">My requests</h2>
                        <p className="text-[11px] text-[#748196]">Follow your submitted applications through the campus approval route</p>
                      </div>
                      <button
                        onClick={() => onNavigateToTemplates ? onNavigateToTemplates() : setActiveTab('applications')}
                        className="text-xs text-[#123b6d] font-semibold hover:underline"
                      >
                        Browse templates →
                      </button>
                    </div>

                    <div className="space-y-4">
                      {myRequests.length > 0 ? (
                        myRequests.map(req => (
                          <div key={req.id} className="p-4 rounded border border-slate-200 bg-white space-y-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="text-xs font-bold text-[#2e4057]">{req.templateTitle}</div>
                                <div className="text-[10px] text-[#748196]">
                                  {req.id} · Submitted {new Date(req.submittedAt).toLocaleDateString()} · {req.category}
                                </div>
                              </div>
                              <span
                                className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                  req.status === 'Approved'
                                    ? 'bg-[#e9f5ef] text-[#247853]'
                                    : req.status === 'In review'
                                    ? 'bg-[#edf3fc] text-[#2b5e98]'
                                    : 'bg-[#fff4dc] text-[#9a6b16]'
                                }`}
                              >
                                {req.status}
                              </span>
                            </div>

                            {/* Sequential Pipeline */}
                            <div className="flex items-center justify-between text-center relative py-1 before:absolute before:top-2 before:left-3 before:right-3 before:h-0.5 before:bg-slate-200">
                              {req.track.map((step, idx) => {
                                const isDone = idx < req.currentStageIndex;
                                const isCurrent = idx === req.currentStageIndex;
                                return (
                                  <div key={idx} className="flex-1 flex flex-col items-center relative z-10">
                                    <div
                                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${
                                        isDone
                                          ? 'bg-[#247853] text-white'
                                          : isCurrent
                                          ? 'bg-[#123b6d] text-white ring-2 ring-[#e5eef9]'
                                          : 'bg-slate-200 text-slate-500'
                                      }`}
                                    >
                                      {isDone ? '✓' : idx + 1}
                                    </div>
                                    <div className="text-[8px] text-slate-500 mt-1 truncate max-w-[65px]">{step}</div>
                                  </div>
                                );
                              })}
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                              <small className="text-[#748196]">
                                {req.status === 'Approved' ? 'Completed' : `Current authority: ${req.currentStageName}`}
                              </small>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setDetailRequest(req)}
                                  className="px-2.5 py-1 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded text-[11px] font-semibold"
                                >
                                  Details & audit
                                </button>
                                {req.status === 'Approved' && (
                                  <button
                                    onClick={() => downloadReceipt(req)}
                                    className="px-2.5 py-1 text-[#123b6d] bg-[#eaf1fb] hover:bg-[#dce8f8] rounded text-[11px] font-semibold flex items-center gap-1"
                                  >
                                    <Download size={11} /> Download receipt
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-slate-400 text-xs">
                          No applications yet. Browse available templates to get started.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Saved Drafts Card */}
                  <div className="bg-white border border-[#e2e8f0] rounded p-5 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-base font-bold text-[#26384f]">Saved drafts</h2>
                        <p className="text-[11px] text-[#748196]">Continue applications you have not submitted</p>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {drafts.length} drafts
                      </span>
                    </div>

                    <div className="space-y-2">
                      {drafts.length > 0 ? (
                        drafts.map(d => {
                          const tpl = templates.find(t => t.id === d.templateId);
                          return (
                            <div key={d.id} className="p-3 bg-slate-50 border rounded flex justify-between items-center text-xs">
                              <div>
                                <b>{d.title}</b>
                                <small className="block text-slate-400 text-[10px]">Saved {new Date(d.savedAt).toLocaleDateString()} · {d.category}</small>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => { if (tpl) openApplyModal(tpl, d); }}
                                  className="px-2.5 py-1 bg-[#123b6d] text-white rounded text-[11px] font-semibold"
                                >
                                  Continue
                                </button>
                                <button
                                  onClick={() => handleDeleteDraft(d.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-6 text-slate-400 text-xs">
                          No saved drafts. Start an application and choose Save as draft.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Inbox tasks + Updates */}
                <div className="lg:col-span-4 space-y-6">
                  <div className="bg-white border border-[#e2e8f0] rounded p-5 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-base font-bold text-[#26384f]">Approvals inbox</h2>
                        <p className="text-[11px] text-[#748196]">Tasks assigned to your roles</p>
                      </div>
                      <button
                        onClick={() => setActiveTab('inbox')}
                        className="text-xs text-[#123b6d] font-semibold hover:underline"
                      >
                        View all →
                      </button>
                    </div>

                    <div className="space-y-2">
                      {inboxTasks.length > 0 ? (
                        inboxTasks.slice(0, 3).map(task => (
                          <div key={task.id} className="p-3 bg-[#f8fafc] border rounded flex justify-between items-center text-xs">
                            <div>
                              <b>{task.templateTitle}</b>
                              <small className="block text-slate-400 text-[10px]">{task.applicantName} · {task.currentStageName}</small>
                            </div>
                            <button
                              onClick={() => { setSelectedTask(task); setIsTaskModalOpen(true); }}
                              className="px-2.5 py-1 bg-[#eaf1fb] text-[#123b6d] border border-[#d7e4f5] rounded text-[11px] font-semibold hover:bg-[#dce9fb]"
                            >
                              Review
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6 text-slate-400 text-xs">
                          You are all caught up!
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white border border-[#e2e8f0] rounded p-5 shadow-xs space-y-3 text-xs">
                    <h2 className="text-base font-bold text-[#26384f]">Institution updates</h2>
                    <div className="space-y-2 divide-y divide-slate-100">
                      <div className="pt-2">
                        <b>Research travel claim checklist</b>
                        <small className="block text-slate-500 text-[10px]">Finance Office · Attach original receipts</small>
                      </div>
                      <div className="pt-2">
                        <b>Conference OD documentation</b>
                        <small className="block text-slate-500 text-[10px]">R&D Council · Circular PT-AC-024</small>
                      </div>
                      <div className="pt-2">
                        <b>Need help with an application?</b>
                        <small className="block text-slate-500 text-[10px]">Staff Help Desk · helpdesk@sairam.edu.in</small>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: DEDICATED REQUEST TEMPLATES DIRECTORY LANDING PAGE */}
          {activeTab === 'templates' && (
            <div className="space-y-6 animate-fade-in">
              {/* Directory Hero Banner */}
              <div className="bg-[#123B6D] text-white rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-md">
                <div className="relative z-10 max-w-3xl space-y-3">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-xs text-[11px] font-semibold text-white/90 border border-white/20">
                    <span>⚙</span> Loopin Institutional Request Governance & SLA Engine
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                    Workflow & Request Templates Directory
                  </h1>
                  <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
                    Explore standardized multi-tier approval routes, mandatory form fields, turnaround service level agreements (SLAs), and campus eligibility criteria across Sri Sairam Group institutions.
                  </p>
                </div>

                {/* SLA Badges */}
                <div className="mt-6 pt-6 border-t border-white/15 grid grid-cols-3 gap-3 sm:gap-6 max-w-md">
                  <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 text-center border border-white/15">
                    <div className="text-xl sm:text-2xl font-black text-white">{templates.length || 6}</div>
                    <div className="text-[10px] uppercase font-bold text-white/70 tracking-wider mt-0.5">Active Forms</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 text-center border border-white/15">
                    <div className="text-xl sm:text-2xl font-black text-white">100%</div>
                    <div className="text-[10px] uppercase font-bold text-white/70 tracking-wider mt-0.5">Digital Trail</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 text-center border border-white/15">
                    <div className="text-xl sm:text-2xl font-black text-white">2–5d</div>
                    <div className="text-[10px] uppercase font-bold text-white/70 tracking-wider mt-0.5">Avg. SLA</div>
                  </div>
                </div>
              </div>

              {/* View Switcher & Search Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center bg-white border border-[#E5E7EB] rounded-xl p-1 shadow-xs">
                  <button
                    onClick={() => setTemplateView('cards')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      templateView === 'cards'
                        ? 'bg-[#123B6D] text-white shadow-xs'
                        : 'text-[#3F4A5A] hover:text-[#123B6D]'
                    }`}
                  >
                    All Active Templates ({templates.length})
                  </button>
                  <button
                    onClick={() => setTemplateView('catalog')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      templateView === 'catalog'
                        ? 'bg-[#123B6D] text-white shadow-xs'
                        : 'text-[#3F4A5A] hover:text-[#123B6D]'
                    }`}
                  >
                    Standard Specification Catalog (6)
                  </button>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search templates by code, title, category..."
                    value={globalSearch}
                    onChange={e => setGlobalSearch(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2 border border-[#E5E7EB] bg-white text-[#3F4A5A] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#123B6D]/30"
                  />
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[10px] uppercase font-bold text-[#3F4A5A]/70 mr-1">Category:</span>
                {['All', 'Faculty & Leave', 'Research & Grants', 'Finance & Accounts', 'Events & Infrastructure', 'Clearance & NOC', 'Academic & Exams', 'People & HR'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                      categoryFilter === cat
                        ? 'bg-[#123B6D] text-white shadow-xs'
                        : 'bg-white border border-[#E5E7EB] text-[#3F4A5A] hover:border-[#123B6D] hover:text-[#123B6D]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* View 1: Card Grid */}
              {templateView === 'cards' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {templates
                    .filter(t => categoryFilter === 'All' || t.category === categoryFilter || (categoryFilter === 'Finance & Accounts' && t.category === 'Finance'))
                    .filter(t => {
                      if (!globalSearch.trim()) return true;
                      const q = globalSearch.toLowerCase();
                      return (
                        t.title.toLowerCase().includes(q) ||
                        t.code.toLowerCase().includes(q) ||
                        t.category.toLowerCase().includes(q) ||
                        t.purpose.toLowerCase().includes(q)
                      );
                    })
                    .map(tpl => (
                      <div
                        key={tpl.id}
                        className="bg-white rounded-2xl border border-[#E5E7EB] hover:border-[#123B6D] hover:shadow-lg transition-all p-5 flex flex-col justify-between space-y-4 group"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="px-2 py-0.5 rounded-md bg-[#123B6D]/10 text-[#123B6D] text-[10px] font-bold tracking-wide">
                              Form {tpl.code}
                            </span>
                            <span className="text-[10px] font-medium text-[#3F4A5A] flex items-center gap-1 bg-[#F3F4F6] px-2 py-0.5 rounded-md">
                              <Clock size={11} className="text-[#123B6D]" /> {tpl.turnaround}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] uppercase font-bold text-[#3F4A5A]/60 tracking-wider">
                              {tpl.category}
                            </span>
                            <h3 className="text-base font-bold text-[#123B6D] group-hover:text-[#0e2f57] transition-colors leading-snug mt-0.5">
                              {tpl.title}
                            </h3>
                          </div>

                          <p className="text-xs text-[#3F4A5A] line-clamp-3 leading-relaxed">
                            {tpl.purpose}
                          </p>

                          {/* Approval Stages Preview */}
                          <div className="bg-[#F3F4F6] rounded-xl p-3 space-y-1.5 border border-[#E5E7EB]">
                            <div className="text-[9px] uppercase font-bold text-[#3F4A5A]/70 tracking-wider">
                              Multi-Tier Approval Route:
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-[#3F4A5A]">
                              {tpl.steps.map((st, sidx) => (
                                <span key={sidx} className="flex items-center gap-1">
                                  <span className="font-semibold text-[#123B6D]">{sidx + 1}. {st}</span>
                                  {sidx < tpl.steps.length - 1 && <span className="text-slate-400">→</span>}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-[10px] text-[#3F4A5A]/80">
                            <span>📋 {tpl.fields.length} Required Fields</span>
                            <span>·</span>
                            <span>📎 {tpl.attachments.length} Attachments</span>
                          </div>
                        </div>

                        <button
                          onClick={() => openApplyModal(tpl)}
                          className="w-full py-2.5 bg-[#123B6D] hover:bg-[#0e2f57] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <span>Apply with this Template</span>
                          <span>→</span>
                        </button>
                      </div>
                    ))}
                </div>
              )}

              {/* View 2: Specification Catalog Table */}
              {templateView === 'catalog' && (
                <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-xs overflow-hidden">
                  <div className="p-4 bg-[#F3F4F6] border-b border-[#E5E7EB] flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-[#123B6D]">Standard Institutional Specification Catalog</h3>
                      <p className="text-[11px] text-[#3F4A5A]">Mandatory fields and sequential approval chains per Loopin specification.</p>
                    </div>
                    <span className="text-xs font-bold text-[#123B6D] bg-white px-2.5 py-1 rounded-lg border border-[#E5E7EB]">
                      6 Standard Templates
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[#3F4A5A] uppercase text-[9px] font-bold border-b border-[#E5E7EB]">
                          <th className="py-3 px-4">Template & Code</th>
                          <th className="py-3 px-4">Category</th>
                          <th className="py-3 px-4">SLA Turnaround</th>
                          <th className="py-3 px-4">Mandatory Fields</th>
                          <th className="py-3 px-4">Sequential Approval Route</th>
                          <th className="py-3 px-4">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E7EB]">
                        {templates.map(tpl => (
                          <tr key={tpl.id} className="hover:bg-[#F3F4F6]/60 transition-colors">
                            <td className="py-3 px-4">
                              <span className="font-bold text-[#123B6D] block">{tpl.title}</span>
                              <span className="text-[10px] text-[#3F4A5A]/70 font-mono">Form {tpl.code}</span>
                            </td>
                            <td className="py-3 px-4 font-medium text-[#3F4A5A]">
                              {tpl.category}
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center gap-1 font-semibold text-[#123B6D] bg-[#F3F4F6] px-2 py-0.5 rounded-md text-[10px]">
                                <Clock size={11} /> {tpl.turnaround}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-[#3F4A5A] max-w-xs">
                              <div className="text-[11px] truncate">
                                {tpl.fields.map(f => f.name).join(', ')}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-[#3F4A5A] max-w-sm">
                              <div className="text-[11px]">
                                {tpl.steps.join(' → ')}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <button
                                onClick={() => openApplyModal(tpl)}
                                className="px-3 py-1.5 bg-[#123B6D] hover:bg-[#0e2f57] text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs whitespace-nowrap"
                              >
                                Apply →
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: NEW APPLICATION */}
          {activeTab === 'applications' && (
            <div className="space-y-6">
              <div>
                <div className="text-[9px] uppercase font-bold tracking-widest text-[#2b5e98]">
                  Institution-approved forms
                </div>
                <h1 className="text-2xl font-bold text-[#1d2f45] tracking-tight mt-0.5">New application</h1>
                <p className="text-xs text-[#748196]">
                  Browse available templates and submit a request using your campus approval flow.
                </p>
              </div>

              {/* Category Chips */}
              <div className="flex flex-wrap gap-2">
                {['All', 'Faculty & Leave', 'Research & Grants', 'Events & Infrastructure', 'Clearance & NOC'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      categoryFilter === cat
                        ? 'bg-[#123b6d] text-white'
                        : 'bg-white border text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Template Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTemplates.map(tpl => (
                  <div key={tpl.id} className="p-4 bg-white border rounded shadow-xs flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                        <span className="font-bold text-[#123b6d] bg-[#eaf1fb] px-1.5 py-0.5 rounded">Form {tpl.code}</span>
                        <span>{tpl.turnaround}</span>
                      </div>
                      <h3 className="font-bold text-xs text-slate-900">{tpl.title}</h3>
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{tpl.purpose}</p>
                    </div>

                    <button
                      onClick={() => openApplyModal(tpl)}
                      className="w-full py-2 bg-[#123b6d] hover:bg-[#0d2c50] text-white text-xs font-semibold rounded"
                    >
                      Apply with this Template →
                    </button>
                  </div>
                ))}
              </div>

              <p className="text-[10px] text-slate-400">
                Templates and approval routes are configured for your institution by the Super Admin. Staff can submit applications but cannot create or edit templates.
              </p>
            </div>
          )}

          {/* TAB 3: APPROVALS INBOX */}
          {activeTab === 'inbox' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-[9px] uppercase font-bold tracking-widest text-[#2b5e98]">
                    Assigned responsibilities
                  </div>
                  <h1 className="text-2xl font-bold text-[#1d2f45] tracking-tight mt-0.5">Approvals inbox</h1>
                  <p className="text-xs text-[#748196]">Only tasks assigned to your role ({currentUser.designation}) appear here.</p>
                </div>
                <button
                  onClick={() => setShowSignedHistory(!showSignedHistory)}
                  className="px-3 py-1.5 bg-white border rounded text-xs text-slate-700 hover:bg-slate-50"
                >
                  {showSignedHistory ? 'Hide signed history' : 'View signed history'}
                </button>
              </div>

              <div className="bg-white border rounded p-5 shadow-xs space-y-4">
                <h2 className="text-base font-bold text-[#26384f]">Tasks needing action ({inboxTasks.length})</h2>

                <div className="overflow-x-auto border rounded">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 uppercase text-[9px] border-b">
                        <th className="py-2.5 px-3">Request</th>
                        <th className="py-2.5 px-3">Applicant</th>
                        <th className="py-2.5 px-3">Assigned role</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {inboxTasks.length > 0 ? (
                        inboxTasks.map(t => (
                          <tr key={t.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-[#123b6d]">{t.id}</span>
                              <div>{t.templateTitle}</div>
                            </td>
                            <td className="py-2.5 px-3">
                              <b>{t.applicantName}</b>
                              <small className="block text-slate-400 text-[10px]">{t.applicantDept}</small>
                            </td>
                            <td className="py-2.5 px-3">{t.currentStageName}</td>
                            <td className="py-2.5 px-3">
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                                Pending action
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <button
                                onClick={() => { setSelectedTask(t); setIsTaskModalOpen(true); }}
                                className="px-3 py-1 bg-[#123b6d] text-white rounded text-xs font-semibold"
                              >
                                Review
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="text-center py-6 text-slate-400">
                            No open tasks are assigned to you.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {showSignedHistory && (
                <div className="bg-white border rounded p-4 text-xs space-y-2">
                  <h3 className="font-bold text-slate-800">Signed request history</h3>
                  {requests.filter(r => r.stages.some(s => s.actedBy === currentUser.name)).map(r => (
                    <div key={r.id} className="p-2 bg-slate-50 border rounded flex justify-between">
                      <div><b>{r.id}</b> · {r.templateTitle} · Applicant: {r.applicantName}</div>
                      <span className="font-bold text-emerald-700">{r.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SETTINGS / PROFILE */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div>
                <div className="text-[9px] uppercase font-bold tracking-widest text-[#2b5e98]">
                  Your account and preferences
                </div>
                <h1 className="text-2xl font-bold text-[#1d2f45] tracking-tight mt-0.5">Settings / Profile</h1>
                <p className="text-xs text-[#748196]">
                  Manage your staff profile, notifications, and permitted proxy delegation.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Staff Profile Card */}
                <div className="bg-white border rounded p-5 shadow-xs space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-base font-bold text-slate-800">Staff profile</h2>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">Verified</span>
                  </div>

                  <form onSubmit={handleSaveProfile} className="space-y-3 text-xs">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Full name</label>
                      <input
                        type="text"
                        value={profileName}
                        onChange={e => setProfileName(e.target.value)}
                        className="w-full px-3 py-1.5 border rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Employee code</label>
                      <input
                        type="text"
                        value={profileCode}
                        onChange={e => setProfileCode(e.target.value)}
                        className="w-full px-3 py-1.5 border rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Designation</label>
                      <input
                        type="text"
                        value={profileRole}
                        onChange={e => setProfileRole(e.target.value)}
                        className="w-full px-3 py-1.5 border rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Department</label>
                      <input
                        type="text"
                        value={profileDept}
                        onChange={e => setProfileDept(e.target.value)}
                        className="w-full px-3 py-1.5 border rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Institutional email</label>
                      <input
                        type="email"
                        disabled
                        value={currentUser.email}
                        className="w-full px-3 py-1.5 border rounded bg-slate-100 text-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Institution</label>
                      <input
                        type="text"
                        disabled
                        value={currentUser.institutionName || 'Sri Sairam Engineering College'}
                        className="w-full px-3 py-1.5 border rounded bg-slate-100 text-slate-400"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-[#123b6d] text-white text-xs font-bold rounded"
                    >
                      Save profile
                    </button>
                  </form>
                </div>

                {/* Proxy & Notifications */}
                <div className="space-y-6">
                  {/* Out of Office & Proxy */}
                  <div className="bg-white border rounded p-5 shadow-xs space-y-4 text-xs">
                    <h2 className="text-base font-bold text-slate-800">Out-of-office & proxy</h2>
                    <form onSubmit={handleSaveDelegation} className="space-y-3">
                      <div className="flex justify-between items-center p-2.5 bg-slate-50 border rounded">
                        <div>
                          <b>Enable approval forwarding</b>
                          <small className="block text-slate-500 text-[10px]">Forward approvals during an absence</small>
                        </div>
                        <input
                          type="checkbox"
                          checked={proxyEnabled}
                          onChange={e => setProxyEnabled(e.target.checked)}
                          className="w-4 h-4 accent-[#123b6d]"
                        />
                      </div>

                      {proxyEnabled && (
                        <div className="space-y-3 pt-1">
                          <div>
                            <label className="block font-semibold mb-1">Eligible proxy approver</label>
                            <select
                              value={proxyName}
                              onChange={e => setProxyName(e.target.value)}
                              className="w-full px-3 py-1.5 border rounded bg-white"
                            >
                              <option value="">Choose an eligible staff member</option>
                              <option value="Dr. S. Rajendran · Dean Academics">Dr. S. Rajendran · Dean Academics</option>
                              <option value="Dr. K. Meenakshi · Head of Department">Dr. K. Meenakshi · Head of Department</option>
                              <option value="R. Prakash · Administrative Officer">R. Prakash · Administrative Officer</option>
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block font-semibold mb-1">Delegation starts</label>
                              <input
                                type="date"
                                value={proxyStartDate}
                                onChange={e => setProxyStartDate(e.target.value)}
                                className="w-full px-2 py-1.5 border rounded"
                              />
                            </div>
                            <div>
                              <label className="block font-semibold mb-1">Delegation ends</label>
                              <input
                                type="date"
                                value={proxyEndDate}
                                onChange={e => setProxyEndDate(e.target.value)}
                                className="w-full px-2 py-1.5 border rounded"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-[#123b6d] text-white text-xs font-bold rounded"
                      >
                        Save delegation period
                      </button>
                    </form>
                  </div>

                  {/* Notification Preferences */}
                  <div className="bg-white border rounded p-5 shadow-xs space-y-3 text-xs">
                    <h2 className="text-base font-bold text-slate-800">Notification preferences</h2>
                    <div className="space-y-2">
                      <label className="flex justify-between items-center p-2 rounded hover:bg-slate-50 cursor-pointer">
                        <span>Requests awaiting my action</span>
                        <input
                          type="checkbox"
                          checked={notifyAssigned}
                          onChange={e => setNotifyAssigned(e.target.checked)}
                          className="accent-[#123b6d]"
                        />
                      </label>
                      <label className="flex justify-between items-center p-2 rounded hover:bg-slate-50 cursor-pointer">
                        <span>Daily pending-work summary</span>
                        <input
                          type="checkbox"
                          checked={notifyDaily}
                          onChange={e => setNotifyDaily(e.target.checked)}
                          className="accent-[#123b6d]"
                        />
                      </label>
                      <label className="flex justify-between items-center p-2 rounded hover:bg-slate-50 cursor-pointer">
                        <span>Urgent institutional escalations</span>
                        <input
                          type="checkbox"
                          checked={notifyUrgent}
                          onChange={e => setNotifyUrgent(e.target.checked)}
                          className="accent-[#123b6d]"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Dynamic Application Modal */}
      {isApplyModalOpen && selectedTemplate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitApplication}
            className="bg-white rounded shadow-2xl border w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4"
          >
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">{selectedTemplate.title}</h3>
                <small className="text-slate-500">{selectedTemplate.category} · Form {selectedTemplate.code}</small>
              </div>
              <button type="button" onClick={() => setIsApplyModalOpen(false)}>
                <XCircle size={18} className="text-slate-400" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded border text-xs space-y-1">
              <b>Approval path:</b>
              <div className="text-[#123b6d]">{selectedTemplate.steps.join(' → ')}</div>
            </div>

            <div className="space-y-3 text-xs">
              {selectedTemplate.fields.map((f, i) => (
                <div key={i}>
                  <label className="block font-semibold mb-1">{f.name}</label>
                  {f.type === 'textarea' ? (
                    <textarea
                      required={f.required}
                      rows={2}
                      value={formData[f.name] || ''}
                      onChange={e => setFormData({ ...formData, [f.name]: e.target.value })}
                      className="w-full px-3 py-1.5 border rounded"
                    />
                  ) : (
                    <input
                      type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
                      required={f.required}
                      value={formData[f.name] || ''}
                      onChange={e => setFormData({ ...formData, [f.name]: e.target.value })}
                      className="w-full px-3 py-1.5 border rounded"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-3 border-t">
              <button
                type="button"
                onClick={handleSaveDraft}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded"
              >
                Save as draft
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsApplyModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-[#123b6d] text-white text-xs font-bold rounded"
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
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded shadow-xl border w-full max-w-lg p-6 space-y-4">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">{selectedTask.templateTitle}</h3>
                <small className="text-slate-500">{selectedTask.id} · {selectedTask.applicantName}</small>
              </div>
              <button onClick={() => setIsTaskModalOpen(false)}>
                <XCircle size={18} className="text-slate-400" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded border text-xs space-y-1">
              <div><b>Current review stage:</b> {selectedTask.currentStageName}</div>
              <div><b>Department:</b> {selectedTask.applicantDept}</div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Remarks or clarification note</label>
              <textarea
                rows={2}
                value={taskRemark}
                onChange={e => setTaskRemark(e.target.value)}
                placeholder="Add note for applicant or next approver..."
                className="w-full text-xs px-3 py-1.5 border rounded"
              />
            </div>

            <div className="flex justify-between pt-3 border-t">
              <button
                type="button"
                onClick={() => handleTaskAction('Declined')}
                className="px-3 py-1.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded font-semibold"
              >
                Decline
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleTaskAction('Clarification requested')}
                  className="px-3 py-1.5 text-xs bg-slate-100 text-slate-700 rounded font-semibold"
                >
                  Request clarification
                </button>
                <button
                  type="button"
                  onClick={() => handleTaskAction('Approved')}
                  className="px-4 py-1.5 bg-[#123b6d] text-white text-xs font-bold rounded"
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
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded shadow-xl border w-full max-w-lg p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">{detailRequest.id} · Details</h3>
                <small className="text-slate-500">{detailRequest.templateTitle}</small>
              </div>
              <button onClick={() => setDetailRequest(null)}>
                <XCircle size={18} className="text-slate-400" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded border text-xs space-y-1">
              <div><b>Status:</b> {detailRequest.status}</div>
              <div><b>Current stage:</b> {detailRequest.currentStageName}</div>
              <div><b>Submitted:</b> {new Date(detailRequest.submittedAt).toLocaleString()}</div>
            </div>

            <div className="space-y-1 text-xs">
              <b>Approval track:</b>
              <div className="space-y-1">
                {detailRequest.track.map((t, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <span className={`w-4 h-4 rounded-full text-[8px] flex items-center justify-center font-bold ${
                      i < detailRequest.currentStageIndex ? 'bg-emerald-500 text-white' : 'bg-slate-200'
                    }`}>
                      {i < detailRequest.currentStageIndex ? '✓' : i + 1}
                    </span>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button
                type="button"
                onClick={() => setDetailRequest(null)}
                className="px-4 py-1.5 bg-slate-100 text-slate-700 text-xs rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Circulars Modal */}
      {isCircularModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded shadow-xl border p-6 w-full max-w-md space-y-4">
            <h3 className="font-bold text-base text-slate-900">Campus circulars</h3>
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 border rounded">
                <b>Research travel claim checklist</b>
                <p className="text-slate-500 mt-1">Attach original tickets and proof of presentation.</p>
              </div>
              <div className="p-3 bg-slate-50 border rounded">
                <b>Conference OD documentation</b>
                <p className="text-slate-500 mt-1">R&D Council · Circular PT-AC-024 · Effective this semester.</p>
              </div>
              <div className="p-3 bg-slate-50 border rounded">
                <b>Staff Help Desk</b>
                <p className="text-slate-500 mt-1">helpdesk@sairam.edu.in · Ext. 224</p>
              </div>
            </div>
            <div className="flex justify-end pt-2 border-t">
              <button
                type="button"
                onClick={() => setIsCircularModalOpen(false)}
                className="px-4 py-1.5 text-xs bg-slate-100 text-slate-700 rounded"
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
