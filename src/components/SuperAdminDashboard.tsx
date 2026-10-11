import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import { useToast } from './Toast.tsx';
import {
  User,
  Institution,
  WorkflowTemplate,
  TemplateNomination,
  WorkflowRequest,
  HierarchyNode,
  HierarchyChangeLog,
  ApprovalStepConfig,
  AuditLogEntry,
} from '../../server/types.ts';
import { WorkflowTemplateBuilderModal } from './WorkflowTemplateBuilderModal.tsx';
import {
  Building2,
  Users,
  FileCheck,
  Clock,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  Trash2,
  GitBranch,
  ArrowRight,
  LogOut,
  RotateCcw,
} from 'lucide-react';

interface Props {
  currentUser: User;
  onLogout: () => void;
  onFastSwitch: (role: 'super_admin' | 'admin' | 'staff') => void;
  onResetDatabase: () => void;
  onNavigateToTemplates?: () => void;
}

export const SuperAdminDashboard: React.FC<Props> = ({
  currentUser,
  onLogout,
  onFastSwitch,
  onResetDatabase,
  onNavigateToTemplates,
}) => {
  const { showToast } = useToast();

  const validNavs = ['overview', 'requests', 'templates', 'promotions', 'hierarchy', 'approval-route', 'schools', 'admins', 'reports'];

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

  // Data states
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [requests, setRequests] = useState<WorkflowRequest[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [nominations, setNominations] = useState<TemplateNomination[]>([]);
  const [admins, setAdmins] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [selectedCampusId, setSelectedCampusId] = useState<string>('inst-sairam-eng');
  const [hierarchyTree, setHierarchyTree] = useState<HierarchyNode | null>(null);
  const [hierarchyLogs, setHierarchyLogs] = useState<HierarchyChangeLog[]>([]);
  const [selectedOrgNode, setSelectedOrgNode] = useState<HierarchyNode | null>(null);
  const [approvalFlow, setApprovalFlow] = useState<ApprovalStepConfig[]>([]);
  const [routeSelectedIndex, setRouteSelectedIndex] = useState<number>(1);

  // Modals & form states
  const [isTemplateBuilderOpen, setIsTemplateBuilderOpen] = useState(false);
  const [isAddSchoolOpen, setIsAddSchoolOpen] = useState(false);
  const [isAddAdminOpen, setIsAddAdminOpen] = useState(false);
  const [isRequestDetailOpen, setIsRequestDetailOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<WorkflowRequest | null>(null);
  const [isRerouteOpen, setIsRerouteOpen] = useState(false);
  const [rerouteStagesText, setRerouteStagesText] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [campusFilter, setCampusFilter] = useState('all');
  const [expandedTemplateIds, setExpandedTemplateIds] = useState<Record<string, boolean>>({});

  const toggleExpandTemplate = (id: string) => {
    setExpandedTemplateIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // New Institution form
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolCategory, setNewSchoolCategory] = useState('Engineering');
  const [newSchoolCity, setNewSchoolCity] = useState('');

  // New Admin form
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminCampusId, setNewAdminCampusId] = useState('');
  const [newAdminDept, setNewAdminDept] = useState('Campus Administration');

  // Standard Templates from Loopin_Request_Templates specification
  const standardTemplates = [
    {
      id: 'std-resignation',
      title: 'Resignation Request',
      category: 'People & HR',
      fields: ['Employee details', 'Proposed last working day', 'Notice period', 'Reason', 'Handover plan'],
      steps: ['Reporting manager or HOD', 'HR / office staff', 'Authorized final approver'],
    },
    {
      id: 'std-od',
      title: 'On-Duty (OD) Request',
      category: 'Academic',
      fields: ['Employee details', 'Purpose and event', 'Destination', 'Start and end date', 'Coverage plan'],
      steps: ['Reporting manager or HOD', 'Relevant office / accounts if required', 'Configured final approver'],
    },
    {
      id: 'std-leave',
      title: 'Leave Request',
      category: 'People & HR',
      fields: ['Employee details', 'Leave type', 'Start and end date', 'Working days', 'Reason', 'Coverage plan'],
      steps: ['Reporting manager or HOD', 'HR / office staff if required'],
    },
    {
      id: 'std-event',
      title: 'Event Organization Request',
      category: 'Academic',
      fields: ['Event name and purpose', 'Audience and organizer', 'Date, venue and attendance', 'Budget and funding source'],
      steps: ['HOD or reporting manager', 'Facilities / accounts if needed', 'Configured final approver'],
    },
    {
      id: 'std-procurement',
      title: 'Purchase or Procurement Request',
      category: 'Finance',
      fields: ['Requester and department', 'Item, quantity and specifications', 'Business purpose', 'Estimated cost', 'Quotations'],
      steps: ['HOD or manager', 'Procurement / accounts', 'Authorized budget approver'],
    },
    {
      id: 'std-reimbursement',
      title: 'Reimbursement Claim',
      category: 'Finance',
      fields: ['Employee details', 'Expense purpose and category', 'Expense dates', 'Amount and currency', 'Receipts'],
      steps: ['Manager or HOD', 'Accounts / finance', 'Authorized finance approver'],
    },
  ];

  // Fetch initial data
  const loadData = async () => {
    try {
      const [insts, reqs, tpls, noms, admUsers, flow, logs] = await Promise.all([
        api.getInstitutions(),
        api.getRequests(),
        api.getTemplates(),
        api.getNominations(),
        api.getAdmins(),
        api.getApprovalFlow(),
        api.getAuditLogs(),
      ]);

      setInstitutions(insts);
      setRequests(reqs);
      setTemplates(tpls);
      setNominations(noms);
      setAdmins(admUsers);
      setApprovalFlow(flow);
      setAuditLogs(logs);

      if (insts.length > 0 && !selectedCampusId) {
        setSelectedCampusId(insts[0].id);
      }
    } catch (err: any) {
      showToast(`Error loading data: ${err.message}`);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fetch hierarchy when campus changes
  useEffect(() => {
    if (!selectedCampusId) return;
    api.getHierarchy(selectedCampusId)
      .then(tree => {
        setHierarchyTree(tree);
        setSelectedOrgNode(tree);
      })
      .catch(err => {
        console.error('Failed to load hierarchy for campus', err);
      });

    api.getHierarchyLogs(selectedCampusId)
      .then(setHierarchyLogs)
      .catch(console.error);
  }, [selectedCampusId]);

  const countPeople = (node: HierarchyNode | null): number => {
    if (!node) return 0;
    return (node.count || 0) + (node.children || []).reduce((sum, c) => sum + countPeople(c), 0);
  };

  const navigateToSection = (sectionId: string) => {
    setActiveNav(sectionId);
    window.location.hash = `#${sectionId}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const scrollToSection = navigateToSection;

  // Add Institution
  const handleAddSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchoolName.trim()) return;

    try {
      const newInst = await api.createInstitution({
        name: newSchoolName.trim(),
        category: newSchoolCategory,
        city: newSchoolCity.trim() || 'Chennai',
      });
      setInstitutions(prev => [...prev, newInst]);
      setIsAddSchoolOpen(false);
      setNewSchoolName('');
      setNewSchoolCity('');
      showToast(`Added ${newInst.name} to directory!`);
    } catch (err: any) {
      showToast(err.message || 'Failed to add institution.');
    }
  };

  // Add Campus Admin
  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminName || !newAdminEmail || !newAdminCampusId) {
      showToast('Please fill all required admin fields.');
      return;
    }

    try {
      const newAdmin = await api.createAdmin({
        name: newAdminName.trim(),
        email: newAdminEmail.trim(),
        institutionId: newAdminCampusId,
        department: newAdminDept.trim(),
      });
      setAdmins(prev => [...prev, newAdmin]);
      setIsAddAdminOpen(false);
      setNewAdminName('');
      setNewAdminEmail('');
      showToast(`Admin ${newAdmin.name} assigned!`);
    } catch (err: any) {
      showToast(err.message || 'Failed to assign admin.');
    }
  };

  const toggleAdminStatus = async (id: string) => {
    try {
      const updated = await api.toggleAdminStatus(id);
      setAdmins(prev => prev.map(a => (a.id === id ? updated : a)));
      showToast(`Admin ${updated.name} is now ${updated.status}.`);
    } catch (err: any) {
      showToast(err.message || 'Failed to update admin.');
    }
  };

  const removeAdmin = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name} as Campus Admin?`)) return;
    try {
      await api.deleteAdmin(id);
      setAdmins(prev => prev.filter(a => a.id !== id));
      showToast(`Admin ${name} removed.`);
    } catch (err: any) {
      showToast(err.message || 'Failed to remove admin.');
    }
  };

  const reviewNomination = async (id: string, action: 'approved' | 'declined') => {
    try {
      const res = await api.reviewNomination(id, action);
      setNominations(prev => prev.map(n => (n.id === id ? res.nomination : n)));
      if (action === 'approved') {
        const freshTpls = await api.getTemplates();
        setTemplates(freshTpls);
      }
      showToast(`Custom template ${action} for group library!`);
    } catch (err: any) {
      showToast(err.message || 'Failed to review template.');
    }
  };

  const approveStandardTemplate = async (std: typeof standardTemplates[0]) => {
    try {
      const newTpl = await api.createTemplate({
        title: std.title,
        category: std.category,
        code: `PT-STD-${Math.floor(100 + Math.random() * 900)}`,
        turnaround: '3–5 working days',
        purpose: `Standard institution template for ${std.title}.`,
        eligibleInstitutions: 'all',
        steps: std.steps,
        attachments: ['Supporting document', 'Staff identification'],
        fields: std.fields.map(f => ({ name: f, type: 'text', required: true })),
        status: 'Published',
      });
      setTemplates(prev => [newTpl, ...prev]);
      showToast(`Added ${std.title} to General templates!`);
    } catch (err: any) {
      showToast(err.message || 'Failed to add standard template.');
    }
  };

  // Hierarchy Node Handlers
  const findNode = (targetName: string, node: HierarchyNode | null = hierarchyTree): HierarchyNode | null => {
    if (!node) return null;
    if (node.name.toLowerCase() === targetName.toLowerCase()) return node;
    for (const child of node.children || []) {
      const found = findNode(targetName, child);
      if (found) return found;
    }
    return null;
  };

  const findParentNode = (target: HierarchyNode, node: HierarchyNode | null = hierarchyTree): HierarchyNode | null => {
    if (!node) return null;
    for (const child of node.children || []) {
      if (child.id === target.id || child.name === target.name) return node;
      const found = findParentNode(target, child);
      if (found) return found;
    }
    return null;
  };

  const containsNode = (root: HierarchyNode, target: HierarchyNode): boolean => {
    if (root.id === target.id || root.name === target.name) return true;
    return (root.children || []).some(child => containsNode(child, target));
  };

  const handleAddMember = () => {
    if (!hierarchyTree) return;
    const parent = selectedOrgNode || hierarchyTree;
    const name = prompt(`Add new member or team reporting to ${parent.name}:`);
    if (!name || !name.trim()) return;

    const role = prompt('Role / Designation description:', 'Institutional Role') || 'Institutional Role';
    const count = parseInt(prompt('Number of people in this role:', '1') || '1', 10);
    const tier = Math.min(parent.tier + 1, 4);

    const newNode: HierarchyNode = {
      id: `h-node-${Date.now()}`,
      name: name.trim(),
      role: role.trim(),
      count: isNaN(count) ? 1 : count,
      tier,
      children: [],
    };

    parent.children = parent.children || [];
    parent.children.push(newNode);

    setHierarchyTree({ ...hierarchyTree });
    showToast(`${name.trim()} added under ${parent.name}! Remember to save organogram.`);
  };

  const handleEditMember = () => {
    if (!selectedOrgNode || !hierarchyTree) {
      showToast('Select a role on the organogram first.');
      return;
    }
    const name = prompt('Member or team name:', selectedOrgNode.name);
    if (!name || !name.trim()) return;
    const role = prompt('Role description:', selectedOrgNode.role);
    if (role === null) return;
    const count = parseInt(prompt('Number of people in this role:', String(selectedOrgNode.count)) || '1', 10);

    selectedOrgNode.name = name.trim();
    selectedOrgNode.role = role.trim();
    selectedOrgNode.count = isNaN(count) ? selectedOrgNode.count : count;

    setHierarchyTree({ ...hierarchyTree });
    showToast('Updated member details! Click Save Organogram to persist.');
  };

  const handleRemoveMember = () => {
    if (!selectedOrgNode || !hierarchyTree || selectedOrgNode.id === hierarchyTree.id) {
      showToast('Select a non-root member to remove.');
      return;
    }
    const parent = findParentNode(selectedOrgNode);
    if (!parent) return;

    if (!confirm(`Remove ${selectedOrgNode.name} from the reporting hierarchy?`)) return;

    parent.children = (parent.children || []).filter(c => c.id !== selectedOrgNode.id && c.name !== selectedOrgNode.name);
    setSelectedOrgNode(parent);
    setHierarchyTree({ ...hierarchyTree });
    showToast(`${selectedOrgNode.name} removed. Click Save Organogram to persist.`);
  };

  const handleSaveOrganogram = async () => {
    if (!hierarchyTree || !selectedCampusId) return;
    try {
      await api.updateHierarchy(selectedCampusId, hierarchyTree);
      const freshLogs = await api.getHierarchyLogs(selectedCampusId);
      setHierarchyLogs(freshLogs);
      showToast(`Organogram saved for ${institutions.find(i => i.id === selectedCampusId)?.name || 'campus'}!`);
    } catch (err: any) {
      showToast(err.message || 'Failed to save organogram.');
    }
  };

  // Drag and drop reporting lines
  const [draggedNodeName, setDraggedNodeName] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, nodeName: string) => {
    setDraggedNodeName(nodeName);
    e.dataTransfer.setData('text/plain', nodeName);
  };

  const handleDrop = (e: React.DragEvent, targetNodeName: string) => {
    e.preventDefault();
    if (!draggedNodeName || !hierarchyTree) return;

    const movingNode = findNode(draggedNodeName);
    const targetParent = findNode(targetNodeName);

    if (!movingNode || !targetParent || movingNode === hierarchyTree || movingNode === targetParent || containsNode(movingNode, targetParent)) {
      showToast('Invalid reporting line assignment.');
      return;
    }

    const previousParent = findParentNode(movingNode);
    if (!previousParent) return;

    previousParent.children = (previousParent.children || []).filter(c => c.name !== movingNode.name);
    targetParent.children = targetParent.children || [];
    movingNode.tier = Math.min(targetParent.tier + 1, 4);
    targetParent.children.push(movingNode);

    setHierarchyTree({ ...hierarchyTree });
    setSelectedOrgNode(movingNode);
    showToast(`${movingNode.name} now reports to ${targetParent.name}! Click Save Organogram to persist.`);
    setDraggedNodeName(null);
  };

  const handleSaveApprovalFlow = async () => {
    try {
      await api.updateApprovalFlow('global', approvalFlow);
      showToast('Group-wide approval flow saved!');
    } catch (err: any) {
      showToast(err.message || 'Failed to save approval flow.');
    }
  };

  const moveRouteStep = (direction: 'up' | 'down') => {
    const target = direction === 'up' ? routeSelectedIndex - 1 : routeSelectedIndex + 1;
    if (target <= 0 || target >= approvalFlow.length) return;
    const copy = [...approvalFlow];
    const temp = copy[routeSelectedIndex];
    copy[routeSelectedIndex] = copy[target];
    copy[target] = temp;
    setApprovalFlow(copy);
    setRouteSelectedIndex(target);
  };

  const addRouteStep = () => {
    const name = prompt('Enter new approval stage authority (e.g. Dean Student Affairs, Audit Officer):');
    if (!name || !name.trim()) return;
    const newStep: ApprovalStepConfig = {
      id: `step-${Date.now()}`,
      name: name.trim(),
      role: 'Group Approval Stage',
    };
    const copy = [...approvalFlow];
    copy.splice(routeSelectedIndex + 1, 0, newStep);
    setApprovalFlow(copy);
    setRouteSelectedIndex(routeSelectedIndex + 1);
  };

  const removeRouteStep = () => {
    if (routeSelectedIndex <= 0 || routeSelectedIndex >= approvalFlow.length) return;
    if (approvalFlow[routeSelectedIndex].locked) {
      showToast('The initial entry step cannot be removed.');
      return;
    }
    const copy = approvalFlow.filter((_, i) => i !== routeSelectedIndex);
    setApprovalFlow(copy);
    setRouteSelectedIndex(Math.max(1, routeSelectedIndex - 1));
  };

  const handleReroute = async () => {
    if (!selectedRequest) return;
    const stages = rerouteStagesText.split(/→|,|\n/).map(s => s.trim()).filter(Boolean);
    if (!stages.length) {
      showToast('Please enter at least one approval stage.');
      return;
    }

    try {
      const updated = await api.rerouteRequest(selectedRequest.id, stages, 'Super Admin restructured approval route.');
      setSelectedRequest(updated);
      setRequests(prev => prev.map(r => (r.id === updated.id ? updated : r)));
      setIsRerouteOpen(false);
      showToast(`Request ${selectedRequest.id} successfully re-routed!`);
    } catch (err: any) {
      showToast(err.message || 'Failed to re-route request.');
    }
  };

  const filteredRequests = requests.filter(r => {
    const matchQuery =
      searchQuery === '' ||
      r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.templateTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.applicantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.institutionName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchStatus = statusFilter === 'all' || r.status.toLowerCase() === statusFilter.toLowerCase();
    const matchCampus = campusFilter === 'all' || r.institutionId === campusFilter;

    return matchQuery && matchStatus && matchCampus;
  });

  const renderTreeNode = (node: HierarchyNode) => {
    const isSelected = selectedOrgNode?.name === node.name;
    const tierBadge =
      node.tier === 1
        ? 'Tier 1 Executive'
        : node.tier === 2
        ? 'Tier 2 Leadership'
        : node.tier === 3
        ? 'Tier 3 Department / Ops'
        : 'Tier 4 Support / Specialist';

    return (
      <li key={node.id || node.name} className="flex flex-col items-center">
        <div
          draggable={node.tier > 1}
          onDragStart={e => handleDragStart(e, node.name)}
          onDragOver={e => e.preventDefault()}
          onDrop={e => handleDrop(e, node.name)}
          onClick={() => setSelectedOrgNode(node)}
          className={`cursor-pointer px-3.5 py-2.5 rounded-lg border text-center transition-all min-w-[140px] max-w-[180px] shadow-xs relative ${
            isSelected
              ? 'ring-2 ring-[#123b6d] bg-white border-[#123b6d]'
              : node.tier === 1
              ? 'bg-[#123b6d] text-white border-[#123b6d]'
              : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="font-bold text-[11px] leading-tight truncate">
            {node.name}
          </div>
          <div
            className={`text-[9px] mt-0.5 truncate ${
              node.tier === 1 && !isSelected ? 'text-white/80' : 'text-slate-500'
            }`}
          >
            {node.role}
          </div>

          <div className="flex items-center justify-center gap-1.5 mt-2">
            <span
              className={`text-[8px] font-semibold px-1.5 py-0.2 rounded ${
                node.tier === 1 && !isSelected
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {tierBadge}
            </span>
            <span
              className={`text-[8px] font-bold px-1.5 py-0.2 rounded ${
                node.tier === 1 && !isSelected
                  ? 'bg-white text-[#123b6d]'
                  : 'bg-[#edf3ff] text-[#123b6d]'
              }`}
            >
              {node.count} people
            </span>
          </div>
        </div>

        {node.children && node.children.length > 0 && (
          <ul className="flex justify-center gap-4 pt-6 relative before:absolute before:top-0 before:left-1/2 before:w-px before:h-6 before:bg-slate-300">
            {node.children.map(child => renderTreeNode(child))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-[#3F4A5A] flex font-sans">
      {/* AUTHENTIC SIDE PANEL (Matches super-admin.html) */}
      <aside className="w-56 shrink-0 bg-[#F3F4F6] border-r border-[#E5E7EB] p-4 flex flex-col sticky top-0 h-screen shadow-xs z-30">
        <div>
          {/* Brand */}
          <div className="flex items-center gap-2.5 pb-4 border-b border-[#E5E7EB]">
            <div className="w-8 h-8 rounded-lg bg-[#123B6D] text-white flex items-center justify-center font-serif font-bold text-lg shadow-xs">
              P
            </div>
            <div>
              <b className="text-lg font-bold text-[#123B6D] tracking-tight">PaperTrail</b>
            </div>
          </div>

          <div className="py-2.5 text-[9px] font-bold tracking-wider text-[#3F4A5A]/80 uppercase">
            GLOBAL ADMINISTRATION
          </div>
          <div className="text-[9px] uppercase font-bold tracking-widest text-[#3F4A5A]/60 px-1 py-1">
            Platform
          </div>

          {/* Navigation Options Specified in HTML */}
          <nav className="flex flex-col gap-1 mt-1 text-xs">
            <button
              onClick={() => navigateToSection('overview')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-left transition-colors ${
                activeNav === 'overview'
                  ? 'bg-[#123B6D] text-white font-bold shadow-xs'
                  : 'text-[#3F4A5A] hover:bg-white/80'
              }`}
            >
              <span className="w-4 text-center">▦</span>
              <span>Overview</span>
            </button>

            <button
              onClick={() => navigateToSection('requests')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-left transition-colors ${
                activeNav === 'requests'
                  ? 'bg-[#123B6D] text-white font-bold shadow-xs'
                  : 'text-[#3F4A5A] hover:bg-white/80'
              }`}
            >
              <span className="w-4 text-center">▤</span>
              <span>All requests</span>
            </button>

            <button
              onClick={() => navigateToSection('templates')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-left transition-colors ${
                activeNav === 'templates'
                  ? 'bg-[#123B6D] text-white font-bold shadow-xs'
                  : 'text-[#3F4A5A] hover:bg-white/80'
              }`}
            >
              <span className="w-4 text-center">▧</span>
              <span>Request Templates</span>
            </button>

            <button
              onClick={() => navigateToSection('promotions')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-left transition-colors ${
                activeNav === 'promotions'
                  ? 'bg-[#123B6D] text-white font-bold shadow-xs'
                  : 'text-[#3F4A5A] hover:bg-white/80'
              }`}
            >
              <span className="w-4 text-center">✓</span>
              <span>Template approvals</span>
            </button>

            <button
              onClick={() => navigateToSection('hierarchy')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-left transition-colors ${
                activeNav === 'hierarchy'
                  ? 'bg-[#123B6D] text-white font-bold shadow-xs'
                  : 'text-[#3F4A5A] hover:bg-white/80'
              }`}
            >
              <span className="w-4 text-center">⇣</span>
              <span>Organogram</span>
            </button>

            <button
              onClick={() => navigateToSection('approval-route')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-left transition-colors ${
                activeNav === 'approval-route'
                  ? 'bg-[#123B6D] text-white font-bold shadow-xs'
                  : 'text-[#3F4A5A] hover:bg-white/80'
              }`}
            >
              <span className="w-4 flex items-center justify-center">
                <svg
                  className="w-3.5 h-3.5 stroke-current"
                  viewBox="0 0 24 24"
                  fill="none"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="7" y1="17" x2="17" y2="7"></line>
                  <polyline points="7 7 17 7 17 17"></polyline>
                </svg>
              </span>
              <span>Approval flow</span>
            </button>

            <button
              onClick={() => navigateToSection('schools')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-left transition-colors ${
                activeNav === 'schools'
                  ? 'bg-[#123B6D] text-white font-bold shadow-xs'
                  : 'text-[#3F4A5A] hover:bg-white/80'
              }`}
            >
              <span className="w-4 text-center">⌂</span>
              <span>Colleges & schools</span>
            </button>

            <button
              onClick={() => navigateToSection('admins')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-left transition-colors ${
                activeNav === 'admins'
                  ? 'bg-[#123B6D] text-white font-bold shadow-xs'
                  : 'text-[#3F4A5A] hover:bg-white/80'
              }`}
            >
              <span className="w-4 text-center">♙</span>
              <span>Admin accounts</span>
            </button>

            <button
              onClick={() => navigateToSection('reports')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-left transition-colors ${
                activeNav === 'reports'
                  ? 'bg-[#123B6D] text-white font-bold shadow-xs'
                  : 'text-[#3F4A5A] hover:bg-white/80'
              }`}
            >
              <span className="w-4 text-center">◷</span>
              <span>Reports</span>
            </button>
          </nav>
        </div>

        {/* Profile Footer in Sidebar */}
        <div className="mt-auto border-t border-[#E5E7EB] pt-3 text-xs">
          <div className="font-bold text-[#123B6D] truncate">{currentUser.name}</div>
          <small className="block text-[#3F4A5A]/80 text-[10px]">Organization-wide access</small>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#E5E7EB]">
            <button
              onClick={onResetDatabase}
              title="Reset Database to Seed"
              className="text-[10px] text-amber-700 hover:underline flex items-center gap-1 font-medium cursor-pointer"
            >
              <RotateCcw size={11} /> Reset DB
            </button>
            <button
              onClick={onLogout}
              className="text-[10px] text-rose-600 hover:underline flex items-center gap-1 font-medium cursor-pointer"
            >
              <LogOut size={11} /> Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Header */}
        <header className="h-14 bg-white/95 backdrop-blur border-b border-[#E5E7EB] px-6 flex items-center justify-between sticky top-0 z-20">
          <span className="text-xs text-[#3F4A5A]">
            PaperTrail &nbsp;›&nbsp; Super Admin dashboard &nbsp;›&nbsp;{' '}
            <b className="text-[#123B6D]">
              {activeNav === 'overview' && 'Overview'}
              {activeNav === 'requests' && 'All requests'}
              {activeNav === 'templates' && 'Request Templates'}
              {activeNav === 'promotions' && 'Template approvals'}
              {activeNav === 'hierarchy' && 'Organogram'}
              {activeNav === 'approval-route' && 'Approval flow'}
              {activeNav === 'schools' && 'Colleges & schools'}
              {activeNav === 'admins' && 'Admin accounts'}
              {activeNav === 'reports' && 'Reports'}
            </b>
          </span>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-[#F3F4F6] border border-[#E5E7EB] rounded-lg p-0.5 text-[11px]">
              <button
                onClick={() => onFastSwitch('super_admin')}
                className="px-2.5 py-1 rounded-md bg-[#123B6D] text-white font-bold shadow-xs"
              >
                Super Admin
              </button>
              <button
                onClick={() => onFastSwitch('admin')}
                className="px-2.5 py-1 rounded-md text-[#3F4A5A] hover:text-[#123B6D] font-medium transition-colors"
              >
                Admin
              </button>
              <button
                onClick={() => onFastSwitch('staff')}
                className="px-2.5 py-1 rounded-md text-[#3F4A5A] hover:text-[#123B6D] font-medium transition-colors"
              >
                Staff
              </button>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="p-6 max-w-[1450px] mx-auto w-full">
          {/* Overview Landing Page */}
          {activeNav === 'overview' && (
            <div className="space-y-6 animate-fade-in">
              <div id="overview" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase font-bold text-[#123B6D] tracking-wider">
                    Organization overview
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-[#123B6D] tracking-tight">
                    Good morning, Super Admin
                  </h1>
                  <p className="text-xs text-[#3F4A5A] mt-0.5">
                    Central governance for requests, workflow templates, approval routes, and all multi-campus institutions.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsAddSchoolOpen(true)}
                    className="px-3.5 py-2 bg-[#123B6D] hover:bg-[#0e2f57] text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus size={15} />
                    Add Institution
                  </button>
                  <button
                    onClick={() => setIsTemplateBuilderOpen(true)}
                    className="px-3.5 py-2 bg-white border border-[#E5E7EB] text-[#123B6D] hover:bg-[#F3F4F6] rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus size={15} />
                    Create Template
                  </button>
                </div>
              </div>

              {/* Metrics Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div
                  onClick={() => navigateToSection('requests')}
                  className="p-4 bg-white rounded-xl border border-[#E5E7EB] shadow-xs cursor-pointer hover:border-[#123B6D] hover:shadow-md transition-all group"
                >
                  <div className="flex items-center justify-between text-xs text-[#3F4A5A]">
                    <span className="group-hover:text-[#123B6D] font-medium">Total Requests</span>
                    <FileCheck size={16} className="text-[#123B6D]" />
                  </div>
                  <div className="text-2xl font-bold text-[#123B6D] mt-2">
                    {requests.length.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-emerald-600 mt-0.5 flex items-center justify-between">
                    <span>↑ 12% organization-wide</span>
                    <span className="text-[#123B6D] font-semibold text-[10px]">View All →</span>
                  </div>
                </div>

                <div
                  onClick={() => navigateToSection('requests')}
                  className="p-4 bg-white rounded-xl border border-[#E5E7EB] shadow-xs cursor-pointer hover:border-[#123B6D] hover:shadow-md transition-all group"
                >
                  <div className="flex items-center justify-between text-xs text-[#3F4A5A]">
                    <span className="group-hover:text-[#123B6D] font-medium">Awaiting Action</span>
                    <Clock size={16} className="text-amber-600" />
                  </div>
                  <div className="text-2xl font-bold text-amber-700 mt-2">
                    {requests.filter(r => r.status === 'Pending' || r.status === 'In review').length}
                  </div>
                  <div className="text-[10px] text-amber-700 mt-0.5 flex items-center justify-between">
                    <span>Active campus queues</span>
                    <span className="text-[#123B6D] font-semibold text-[10px]">Review →</span>
                  </div>
                </div>

                <div
                  onClick={() => navigateToSection('templates')}
                  className="p-4 bg-white rounded-xl border border-[#E5E7EB] shadow-xs cursor-pointer hover:border-[#123B6D] hover:shadow-md transition-all group"
                >
                  <div className="flex items-center justify-between text-xs text-[#3F4A5A]">
                    <span className="group-hover:text-[#123B6D] font-medium">Request Templates</span>
                    <GitBranch size={16} className="text-[#123B6D]" />
                  </div>
                  <div className="text-2xl font-bold text-[#123B6D] mt-2">
                    {templates.filter(t => t.status === 'Published').length}
                  </div>
                  <div className="text-[10px] text-[#3F4A5A] mt-0.5 flex items-center justify-between">
                    <span>Standardized workflows</span>
                    <span className="text-[#123B6D] font-semibold text-[10px]">Open Directory →</span>
                  </div>
                </div>

                <div
                  onClick={() => navigateToSection('schools')}
                  className="p-4 bg-white rounded-xl border border-[#E5E7EB] shadow-xs cursor-pointer hover:border-[#123B6D] hover:shadow-md transition-all group"
                >
                  <div className="flex items-center justify-between text-xs text-[#3F4A5A]">
                    <span className="group-hover:text-[#123B6D] font-medium">Institutions</span>
                    <Building2 size={16} className="text-[#123B6D]" />
                  </div>
                  <div className="text-2xl font-bold text-[#123B6D] mt-2">
                    {institutions.length}
                  </div>
                  <div className="text-[10px] text-[#3F4A5A] mt-0.5 flex items-center justify-between">
                    <span>Connected campuses</span>
                    <span className="text-[#123B6D] font-semibold text-[10px]">Manage →</span>
                  </div>
                </div>
              </div>

              {/* Module Quick Jump Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div
                  onClick={() => navigateToSection('templates')}
                  className="p-4 bg-white rounded-xl border border-[#E5E7EB] hover:border-[#123B6D] cursor-pointer transition-all shadow-xs"
                >
                  <div className="flex items-center gap-2 font-bold text-sm text-[#123B6D]">
                    <span className="text-base">▧</span>
                    Request Templates Directory
                  </div>
                  <p className="text-xs text-[#3F4A5A] mt-1">
                    Manage all group-approved templates, SLA turnarounds, and 4-tier approval pipelines.
                  </p>
                  <span className="text-[11px] font-semibold text-[#123B6D] mt-2 inline-block">
                    View Landing Page &rarr;
                  </span>
                </div>

                <div
                  onClick={() => navigateToSection('hierarchy')}
                  className="p-4 bg-white rounded-xl border border-[#E5E7EB] hover:border-[#123B6D] cursor-pointer transition-all shadow-xs"
                >
                  <div className="flex items-center gap-2 font-bold text-sm text-[#123B6D]">
                    <span className="text-base">⇣</span>
                    Multi-Tier Organograms
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Visual reporting lines for CEO, Principals, Deans, HoDs, and academic staff across campuses.
                  </p>
                  <span className="text-[11px] font-semibold text-[#123B6D] mt-2 inline-block">
                    View Landing Page &rarr;
                  </span>
                </div>

                <div
                  onClick={() => navigateToSection('reports')}
                  className="p-4 bg-white rounded-xl border border-[#E5E7EB] hover:border-[#123B6D] cursor-pointer transition-all shadow-xs"
                >
                  <div className="flex items-center gap-2 font-bold text-sm text-[#123B6D]">
                    <span className="text-base">◷</span>
                    Audit Trail & Reports
                  </div>
                  <p className="text-xs text-[#3F4A5A] mt-1">
                    Immutable append-only event logs tracking every approval, delegation, and configuration update.
                  </p>
                  <span className="text-[11px] font-semibold text-[#123B6D] mt-2 inline-block">
                    View Landing Page &rarr;
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* All Requests Landing Page */}
          {activeNav === 'requests' && (
            <div id="requests" className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-xs space-y-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-[#123B6D]">All requests</h2>
                  <p className="text-xs text-[#3F4A5A]">Organization-wide submissions and real-time approval status</p>
                </div>
                <span className="text-[11px] font-semibold text-[#3F4A5A] bg-[#F3F4F6] px-2.5 py-1 rounded-md border border-[#E5E7EB]">
                  Showing {filteredRequests.length} requests
                </span>
              </div>

            {/* Filters Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search request, applicant, ID..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#173f6b]"
                />
              </div>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none"
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="in review">In review</option>
                <option value="approved">Approved</option>
                <option value="declined">Declined</option>
              </select>
              <select
                value={campusFilter}
                onChange={e => setCampusFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none"
              >
                <option value="all">All colleges</option>
                {institutions.map(inst => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Requests Table */}
            <div className="overflow-x-auto border border-slate-100 rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <th className="py-2.5 px-3">Request</th>
                    <th className="py-2.5 px-3">Applicant</th>
                    <th className="py-2.5 px-3">College</th>
                    <th className="py-2.5 px-3">Submitted</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRequests.length > 0 ? (
                    filteredRequests.map(req => (
                      <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-[#173f6b]">{req.id}</span>
                          <div className="font-medium text-slate-800">{req.templateTitle}</div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{req.applicantName}</td>
                        <td className="py-2.5 px-3 text-slate-500 truncate max-w-[140px]">{req.institutionName}</td>
                        <td className="py-2.5 px-3 text-slate-500">{new Date(req.submittedAt).toLocaleDateString()}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              req.status === 'Approved'
                                ? 'bg-emerald-50 text-emerald-700'
                                : req.status === 'In review'
                                ? 'bg-blue-50 text-[#173f6b]'
                                : req.status === 'Declined'
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <button
                            onClick={() => {
                              setSelectedRequest(req);
                              setIsRequestDetailOpen(true);
                            }}
                            className="text-[#173f6b] hover:underline font-semibold text-[11px]"
                          >
                            View details →
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-400">
                        No matching requests found across institutions.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          )}

          {/* Request Templates Landing Page */}
          {activeNav === 'templates' && (
            <div id="templates" className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-xs space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl sm:text-2xl font-bold text-[#123B6D] tracking-tight">
                      Admin template requests
                    </h2>
                    <span className="text-xs font-semibold text-[#123B6D] bg-[#F3F4F6] px-2.5 py-0.5 rounded-full border border-[#E5E7EB]">
                      {nominations.filter(n => n.status === 'pending').length} pending
                    </span>
                  </div>
                  <p className="text-xs text-[#3F4A5A] mt-0.5">
                    Frequently used custom workflows awaiting Super Admin review
                  </p>
                </div>
                <button
                  onClick={() => setIsTemplateBuilderOpen(true)}
                  className="px-4 py-2 bg-[#123B6D] hover:bg-[#0e2f57] text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <Plus size={15} />
                  Create New Template
                </button>
              </div>

              {/* Standard Templates from Loopin_Request_Templates */}
              <div className="space-y-4 pt-1">
                <div>
                  <h3 className="font-bold text-sm text-[#123B6D]">
                    Standard templates from Loopin_Request_Templates
                  </h3>
                  <p className="text-xs text-[#3F4A5A] mt-0.5">
                    Review these supplied request formats and add the ones your institutions should share. Custom templates submitted by Admins appear in the review queue below.
                  </p>
                </div>

                <div className="space-y-3">
                  {standardTemplates.map(std => {
                    const added = templates.some(t => t.title.toLowerCase() === std.title.toLowerCase());
                    return (
                      <div key={std.id} className="p-4 sm:p-5 bg-white border border-[#E5E7EB] rounded-xl shadow-xs space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <h4 className="font-bold text-sm sm:text-base text-[#123B6D]">{std.title}</h4>
                            <div className="text-xs text-[#3F4A5A]/80 mt-0.5">
                              {std.category} · Standard request template
                            </div>
                          </div>
                          <button
                            onClick={() => approveStandardTemplate(std)}
                            disabled={added}
                            className={`px-4 py-2 border rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0 ${
                              added
                                ? 'bg-[#F3F4F6] text-[#3F4A5A]/60 border-[#E5E7EB] cursor-not-allowed'
                                : 'bg-white border-[#E5E7EB] text-[#123B6D] hover:bg-[#F3F4F6]'
                            }`}
                          >
                            {added ? 'Added to General' : 'Approve & add to General'}
                          </button>
                        </div>

                        <div className="border-t border-[#E5E7EB] pt-2">
                          <button
                            type="button"
                            onClick={() => toggleExpandTemplate(std.id)}
                            className="text-xs text-[#123B6D] hover:underline flex items-center gap-1 font-medium cursor-pointer"
                          >
                            <span>{expandedTemplateIds[std.id] ? '▼' : '▶'}</span>
                            <span>
                              {expandedTemplateIds[std.id]
                                ? 'Hide request fields and suggested approval route'
                                : 'View request fields and suggested approval route'}
                            </span>
                          </button>

                          {expandedTemplateIds[std.id] && (
                            <div className="mt-2.5 p-3 bg-[#F3F4F6] border border-[#E5E7EB] rounded-lg text-xs text-[#3F4A5A] space-y-1.5 animate-fade-in">
                              <div>
                                <span className="font-bold text-[#123B6D]">Mandatory Fields: </span>
                                <span>{std.fields.join(', ')}</span>
                              </div>
                              <div>
                                <span className="font-bold text-[#123B6D]">Suggested Approval Route: </span>
                                <span>{std.steps.join(' → ')}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Custom Templates submitted by Admins Review Queue */}
              <div className="space-y-4 pt-4 border-t border-[#E5E7EB]">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-[#123B6D]">
                    Custom Templates Submitted by Campus Admins
                  </h3>
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    {nominations.filter(n => n.status === 'pending').length} Custom Pending
                  </span>
                </div>

                <div className="space-y-3">
                  {nominations.length > 0 ? (
                    nominations.map(nom => (
                      <div key={nom.id} className="p-4 sm:p-5 bg-white border border-[#E5E7EB] rounded-xl shadow-xs space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-sm sm:text-base text-[#123B6D]">{nom.title}</h4>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 uppercase">
                                {nom.status}
                              </span>
                            </div>
                            <div className="text-xs text-[#3F4A5A]/80 mt-0.5">
                              {nom.category} · {nom.institution} · Custom template
                            </div>
                          </div>

                          {nom.status === 'pending' ? (
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => reviewNomination(nom.id, 'declined')}
                                className="px-3 py-1.5 text-xs text-rose-600 border border-rose-200 hover:bg-rose-50 rounded-lg font-semibold transition-colors cursor-pointer"
                              >
                                Decline
                              </button>
                              <button
                                onClick={() => reviewNomination(nom.id, 'approved')}
                                className="px-4 py-2 border border-[#E5E7EB] bg-white text-[#123B6D] hover:bg-[#F3F4F6] text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                              >
                                Approve & add to General
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-[#3F4A5A]/60 px-3 py-1 bg-[#F3F4F6] rounded-lg">
                              {nom.status === 'approved' ? 'Approved & Added' : 'Declined'}
                            </span>
                          )}
                        </div>

                        <div className="border-t border-[#E5E7EB] pt-2">
                          <button
                            type="button"
                            onClick={() => toggleExpandTemplate(nom.id)}
                            className="text-xs text-[#123B6D] hover:underline flex items-center gap-1 font-medium cursor-pointer"
                          >
                            <span>{expandedTemplateIds[nom.id] ? '▼' : '▶'}</span>
                            <span>
                              {expandedTemplateIds[nom.id]
                                ? 'Hide request fields and suggested approval route'
                                : 'View request fields and suggested approval route'}
                            </span>
                          </button>

                          {expandedTemplateIds[nom.id] && (
                            <div className="mt-2.5 p-3 bg-[#F3F4F6] border border-[#E5E7EB] rounded-lg text-xs text-[#3F4A5A] space-y-1.5 animate-fade-in">
                              <div>
                                <span className="font-bold text-[#123B6D]">Mandatory Fields: </span>
                                <span>{nom.details.fields.join(', ')}</span>
                              </div>
                              <div>
                                <span className="font-bold text-[#123B6D]">Suggested Approval Route: </span>
                                <span>{nom.details.steps.join(' → ')}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-slate-400 text-xs bg-[#F3F4F6] rounded-xl border border-[#E5E7EB]">
                      No custom templates are waiting for group approval.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Template Approvals Landing Page */}
          {activeNav === 'promotions' && (
            <div id="promotions" className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-xs space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl sm:text-2xl font-bold text-[#123B6D] tracking-tight">
                      Admin template requests
                    </h2>
                    <span className="text-xs font-semibold text-[#123B6D] bg-[#F3F4F6] px-2.5 py-0.5 rounded-full border border-[#E5E7EB]">
                      {nominations.filter(n => n.status === 'pending').length} pending
                    </span>
                  </div>
                  <p className="text-xs text-[#3F4A5A] mt-0.5">
                    Frequently used custom workflows awaiting Super Admin review
                  </p>
                </div>
              </div>

              {/* Standard Templates from Loopin_Request_Templates */}
              <div className="space-y-4 pt-1">
                <div>
                  <h3 className="font-bold text-sm text-[#123B6D]">
                    Standard templates from Loopin_Request_Templates
                  </h3>
                  <p className="text-xs text-[#3F4A5A] mt-0.5">
                    Review these supplied request formats and add the ones your institutions should share. Custom templates submitted by Admins appear in the review queue below.
                  </p>
                </div>

                <div className="space-y-3">
                  {standardTemplates.map(std => {
                    const added = templates.some(t => t.title.toLowerCase() === std.title.toLowerCase());
                    return (
                      <div key={std.id} className="p-4 sm:p-5 bg-white border border-[#E5E7EB] rounded-xl shadow-xs space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <h4 className="font-bold text-sm sm:text-base text-[#123B6D]">{std.title}</h4>
                            <div className="text-xs text-[#3F4A5A]/80 mt-0.5">
                              {std.category} · Standard request template
                            </div>
                          </div>
                          <button
                            onClick={() => approveStandardTemplate(std)}
                            disabled={added}
                            className={`px-4 py-2 border rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0 ${
                              added
                                ? 'bg-[#F3F4F6] text-[#3F4A5A]/60 border-[#E5E7EB] cursor-not-allowed'
                                : 'bg-white border-[#E5E7EB] text-[#123B6D] hover:bg-[#F3F4F6]'
                            }`}
                          >
                            {added ? 'Added to General' : 'Approve & add to General'}
                          </button>
                        </div>

                        <div className="border-t border-[#E5E7EB] pt-2">
                          <button
                            type="button"
                            onClick={() => toggleExpandTemplate(std.id)}
                            className="text-xs text-[#123B6D] hover:underline flex items-center gap-1 font-medium cursor-pointer"
                          >
                            <span>{expandedTemplateIds[std.id] ? '▼' : '▶'}</span>
                            <span>
                              {expandedTemplateIds[std.id]
                                ? 'Hide request fields and suggested approval route'
                                : 'View request fields and suggested approval route'}
                            </span>
                          </button>

                          {expandedTemplateIds[std.id] && (
                            <div className="mt-2.5 p-3 bg-[#F3F4F6] border border-[#E5E7EB] rounded-lg text-xs text-[#3F4A5A] space-y-1.5 animate-fade-in">
                              <div>
                                <span className="font-bold text-[#123B6D]">Mandatory Fields: </span>
                                <span>{std.fields.join(', ')}</span>
                              </div>
                              <div>
                                <span className="font-bold text-[#123B6D]">Suggested Approval Route: </span>
                                <span>{std.steps.join(' → ')}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Custom Templates submitted by Admins Review Queue */}
              <div className="space-y-4 pt-4 border-t border-[#E5E7EB]">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-[#123B6D]">
                    Custom Templates Submitted by Campus Admins
                  </h3>
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    {nominations.filter(n => n.status === 'pending').length} Custom Pending
                  </span>
                </div>

                <div className="space-y-3">
                  {nominations.length > 0 ? (
                    nominations.map(nom => (
                      <div key={nom.id} className="p-4 sm:p-5 bg-white border border-[#E5E7EB] rounded-xl shadow-xs space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-sm sm:text-base text-[#123B6D]">{nom.title}</h4>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 uppercase">
                                {nom.status}
                              </span>
                            </div>
                            <div className="text-xs text-[#3F4A5A]/80 mt-0.5">
                              {nom.category} · {nom.institution} · Custom template
                            </div>
                          </div>

                          {nom.status === 'pending' ? (
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => reviewNomination(nom.id, 'declined')}
                                className="px-3 py-1.5 text-xs text-rose-600 border border-rose-200 hover:bg-rose-50 rounded-lg font-semibold transition-colors cursor-pointer"
                              >
                                Decline
                              </button>
                              <button
                                onClick={() => reviewNomination(nom.id, 'approved')}
                                className="px-4 py-2 border border-[#E5E7EB] bg-white text-[#123B6D] hover:bg-[#F3F4F6] text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                              >
                                Approve & add to General
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-[#3F4A5A]/60 px-3 py-1 bg-[#F3F4F6] rounded-lg">
                              {nom.status === 'approved' ? 'Approved & Added' : 'Declined'}
                            </span>
                          )}
                        </div>

                        <div className="border-t border-[#E5E7EB] pt-2">
                          <button
                            type="button"
                            onClick={() => toggleExpandTemplate(nom.id)}
                            className="text-xs text-[#123B6D] hover:underline flex items-center gap-1 font-medium cursor-pointer"
                          >
                            <span>{expandedTemplateIds[nom.id] ? '▼' : '▶'}</span>
                            <span>
                              {expandedTemplateIds[nom.id]
                                ? 'Hide request fields and suggested approval route'
                                : 'View request fields and suggested approval route'}
                            </span>
                          </button>

                          {expandedTemplateIds[nom.id] && (
                            <div className="mt-2.5 p-3 bg-[#F3F4F6] border border-[#E5E7EB] rounded-lg text-xs text-[#3F4A5A] space-y-1.5 animate-fade-in">
                              <div>
                                <span className="font-bold text-[#123B6D]">Mandatory Fields: </span>
                                <span>{nom.details.fields.join(', ')}</span>
                              </div>
                              <div>
                                <span className="font-bold text-[#123B6D]">Suggested Approval Route: </span>
                                <span>{nom.details.steps.join(' → ')}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-slate-400 text-xs bg-[#F3F4F6] rounded-xl border border-[#E5E7EB]">
                      No custom templates are waiting for group approval.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Organogram Landing Page */}
          {activeNav === 'hierarchy' && (
            <div id="hierarchy" className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-xs space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#1b2635]">College administration organogram</h2>
                <p className="text-xs text-slate-500">
                  Separate reporting hierarchy per institution · Drag roles to reassign reporting lines.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Institution:</span>
                <select
                  value={selectedCampusId}
                  onChange={e => setSelectedCampusId(e.target.value)}
                  className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg font-medium bg-white"
                >
                  {institutions.map(inst => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600">
              <div className="flex items-center gap-3 text-[11px]">
                <span className="font-semibold text-slate-800">Tiers:</span>
                <span><b>Tier 1:</b> CEO & Principal</span>
                <span>·</span>
                <span><b>Tier 2:</b> Leadership & Deans</span>
                <span>·</span>
                <span><b>Tier 3:</b> Department Leads (Configurable)</span>
                <span>·</span>
                <span><b>Tier 4:</b> Local Staff</span>
              </div>
              <div className="text-[11px] font-bold text-[#173f6b]">
                Total Personnel: {countPeople(hierarchyTree)} people
              </div>
            </div>

            <div className="p-8 bg-gradient-to-b from-white to-slate-50/50 rounded-xl border border-slate-200 overflow-x-auto min-h-[300px] flex justify-center">
              {hierarchyTree ? (
                <ul className="flex justify-center">
                  {renderTreeNode(hierarchyTree)}
                </ul>
              ) : (
                <div className="text-center py-16 text-slate-400 text-xs">Loading organogram...</div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <div className="text-xs text-slate-600">
                {selectedOrgNode ? (
                  <span>Selected: <b className="text-[#173f6b]">{selectedOrgNode.name}</b> ({selectedOrgNode.role})</span>
                ) : (
                  <span>Select any role above to edit or add reporting members.</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleAddMember}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  + Add Member
                </button>
                <button
                  onClick={handleEditMember}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Edit Member
                </button>
                <button
                  onClick={handleRemoveMember}
                  className="px-3 py-1.5 bg-white border border-rose-200 text-rose-700 rounded-lg text-xs font-semibold"
                >
                  Remove
                </button>
                <button
                  onClick={handleSaveOrganogram}
                  className="px-4 py-1.5 bg-[#173f6b] hover:bg-[#0e2d50] text-white rounded-lg text-xs font-bold shadow-xs"
                >
                  Save Organogram
                </button>
              </div>
            </div>
          </div>
          )}

          {/* Approval Flow Landing Page */}
          {activeNav === 'approval-route' && (
            <div id="approval-route" className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-xs space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#1b2635]">Group-wide approval flow</h2>
                <p className="text-xs text-slate-500">
                  Super Admin controls the sequential approval path for conference OD leave and institutional requests
                </p>
              </div>
              <button
                onClick={handleSaveApprovalFlow}
                className="px-4 py-1.5 bg-[#173f6b] text-white rounded-lg text-xs font-bold"
              >
                Save Group-Wide Flow
              </button>
            </div>

            <div className="p-4 bg-[#f8fafc] rounded-xl border border-slate-200 flex items-center gap-2 overflow-x-auto">
              {approvalFlow.map((step, idx) => (
                <React.Fragment key={step.id || idx}>
                  <div
                    onClick={() => setRouteSelectedIndex(idx)}
                    className={`cursor-pointer px-4 py-2.5 rounded-lg border text-xs shrink-0 transition-all ${
                      routeSelectedIndex === idx
                        ? 'bg-white border-[#173f6b] ring-2 ring-[#173f6b]/20 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-[9px] font-bold text-slate-400">
                      STEP 0{idx + 1} {step.locked && '· ENTRY'}
                    </div>
                    <div className="font-bold text-[#173f6b] mt-0.5">{step.name}</div>
                    <div className="text-[10px] text-slate-500">{step.role}</div>
                  </div>
                  {idx < approvalFlow.length - 1 && (
                    <span className="text-slate-400 font-bold shrink-0">→</span>
                  )}
                </React.Fragment>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={addRouteStep}
                className="px-3 py-1.5 bg-white border border-slate-200 text-xs font-semibold rounded-lg"
              >
                + Add Approver
              </button>
              <button
                onClick={() => moveRouteStep('up')}
                disabled={routeSelectedIndex <= 1}
                className="px-3 py-1.5 bg-white border border-slate-200 text-xs font-semibold rounded-lg disabled:opacity-40"
              >
                Move Up
              </button>
              <button
                onClick={() => moveRouteStep('down')}
                disabled={routeSelectedIndex < 1 || routeSelectedIndex >= approvalFlow.length - 1}
                className="px-3 py-1.5 bg-white border border-slate-200 text-xs font-semibold rounded-lg disabled:opacity-40"
              >
                Move Down
              </button>
              <button
                onClick={removeRouteStep}
                disabled={routeSelectedIndex <= 0}
                className="px-3 py-1.5 bg-white border border-rose-200 text-rose-600 text-xs font-semibold rounded-lg disabled:opacity-40"
              >
                Remove Stage
              </button>
            </div>
          </div>
          )}

          {/* Colleges & Schools Directory Landing Page */}
          {activeNav === 'schools' && (
            <div id="schools" className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-xs space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#1b2635]">Colleges & schools ({institutions.length})</h2>
                <p className="text-xs text-slate-500">Active institutional entities</p>
              </div>
              <button
                onClick={() => setIsAddSchoolOpen(true)}
                className="text-xs font-semibold text-[#173f6b] hover:underline"
              >
                + Add College
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {institutions.map(inst => (
                <div
                  key={inst.id}
                  onClick={() => {
                    setSelectedCampusId(inst.id);
                    scrollToSection('hierarchy');
                    showToast(`Switched organogram to ${inst.name}`);
                  }}
                  className={`p-3.5 rounded-lg border cursor-pointer flex items-center justify-between transition-all ${
                    selectedCampusId === inst.id
                      ? 'bg-[#edf3ff] border-[#b8c9e0] shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#edf3ff] text-[#173f6b] flex items-center justify-center font-bold text-xs">
                      ⌂
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-[#1b2635]">{inst.name}</h3>
                      <p className="text-[10px] text-slate-500">{inst.category} · {inst.city}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-[#173f6b]">{inst.requestCount}</div>
                    <div className="text-[9px] text-slate-400">requests</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}

          {/* Institution Admin Accounts Landing Page */}
          {activeNav === 'admins' && (
            <div id="admins" className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-xs space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#1b2635]">Institution Admin accounts</h2>
                <p className="text-xs text-slate-500">Assign and manage access for each campus administrator</p>
              </div>
              <button
                onClick={() => {
                  setNewAdminCampusId(institutions[0]?.id || '');
                  setIsAddAdminOpen(true);
                }}
                className="px-3 py-1.5 bg-[#173f6b] text-white text-xs font-semibold rounded-lg"
              >
                + Add Admin
              </button>
            </div>

            <div className="space-y-2.5">
              {admins.map(adm => (
                <div key={adm.id} className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-bold text-slate-900">{adm.name}</div>
                    <div className="text-[10px] text-slate-500">{adm.email} · {adm.department}</div>
                    <div className="text-[10px] text-[#173f6b] font-medium mt-0.5">
                      Assigned to: {adm.institutionName || 'Campus'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleAdminStatus(adm.id)}
                      className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        adm.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {adm.status === 'Active' ? 'Active' : 'Suspended'}
                    </button>
                    <button
                      onClick={() => removeAdmin(adm.id, adm.name)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}

          {/* Reports & Analytics Landing Page */}
          {activeNav === 'reports' && (
            <div id="reports" className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-xs space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#1b2635]">Request analytics</h2>
                <p className="text-xs text-slate-500">
                  Organization-wide volume, status, and approval-stage distribution · illustrative demo data
                </p>
              </div>
              <span className="text-xs font-bold text-[#173f6b] bg-[#edf3ff] px-2.5 py-1 rounded-full">
                {requests.length} total requests
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              <div className="p-4 rounded-xl border border-slate-200 bg-[#fafcff] space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-800">Request Submissions</span>
                  <span className="text-[10px] text-emerald-600 font-bold">↑ 12%</span>
                </div>
                <div className="h-28 pt-2">
                  <svg viewBox="0 0 300 90" className="w-full h-full overflow-visible">
                    <path
                      d="M10 70 Q60 45, 110 58 T200 30 T290 15 L290 90 L10 90 Z"
                      fill="#173f6b20"
                    />
                    <path
                      d="M10 70 Q60 45, 110 58 T200 30 T290 15"
                      fill="none"
                      stroke="#173f6b"
                      strokeWidth="2.5"
                    />
                  </svg>
                </div>
                <div className="flex justify-between text-[9px] text-slate-400">
                  <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-[#fafcff] space-y-2 flex flex-col justify-between">
                <div className="text-xs font-bold text-slate-800">Request Status</div>
                <div className="flex items-center justify-center gap-4 py-2">
                  <div
                    className="w-20 h-20 rounded-full relative flex items-center justify-center"
                    style={{
                      background: 'conic-gradient(#173f6b 0% 75%, #4d79ab 75% 85%, #94a3b8 85% 100%)',
                    }}
                  >
                    <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center text-xs font-bold text-[#173f6b]">
                      {requests.length}
                    </div>
                  </div>
                  <div className="space-y-1 text-[10px] text-slate-600">
                    <div><span className="inline-block w-2 h-2 rounded bg-[#173f6b] mr-1"></span>Approved ({requests.filter(r => r.status === 'Approved').length})</div>
                    <div><span className="inline-block w-2 h-2 rounded bg-[#4d79ab] mr-1"></span>In review ({requests.filter(r => r.status === 'In review').length})</div>
                    <div><span className="inline-block w-2 h-2 rounded bg-slate-400 mr-1"></span>Pending ({requests.filter(r => r.status === 'Pending').length})</div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-[#fafcff] space-y-2">
                <div className="text-xs font-bold text-slate-800">Requests by Approval Stage</div>
                <div className="space-y-2 pt-1 text-xs">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span>Department HoD</span><b>42</b>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-[#173f6b] h-full w-[78%]"></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span>Dean Review</span><b>27</b>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-[#4d79ab] h-full w-[55%]"></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span>Finance</span><b>11</b>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-amber-600 h-full w-[37%]"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}
        </main>
      </div>

      {/* Template Builder Modal */}
      <WorkflowTemplateBuilderModal
        isOpen={isTemplateBuilderOpen}
        onClose={() => setIsTemplateBuilderOpen(false)}
        institutions={institutions}
        onTemplateCreated={newTpl => setTemplates(prev => [newTpl, ...prev])}
      />

      {/* Add School Modal */}
      {isAddSchoolOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={handleAddSchool} className="bg-white rounded-xl shadow-xl border p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Add Institution</h2>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">College or School Name</label>
              <input
                type="text"
                required
                value={newSchoolName}
                onChange={e => setNewSchoolName(e.target.value)}
                placeholder="Institution name"
                className="w-full text-xs px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={newSchoolCategory}
                onChange={e => setNewSchoolCategory(e.target.value)}
                className="w-full text-xs px-3 py-2 border rounded-lg bg-white"
              >
                <option>Engineering</option>
                <option>Technology</option>
                <option>Medical</option>
                <option>Arts & Science</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Campus Location</label>
              <input
                type="text"
                value={newSchoolCity}
                onChange={e => setNewSchoolCity(e.target.value)}
                placeholder="City"
                className="w-full text-xs px-3 py-2 border rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddSchoolOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs bg-[#173f6b] text-white font-bold rounded"
              >
                Add to Directory
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Admin Modal */}
      {isAddAdminOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={handleAddAdmin} className="bg-white rounded-xl shadow-xl border p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Add Campus Admin</h2>
            <p className="text-xs text-slate-500">
              Give an Admin access to one institution. Admins can manage staff and review requests only within that campus.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={newAdminName}
                onChange={e => setNewAdminName(e.target.value)}
                placeholder="Admin name"
                className="w-full text-xs px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Institutional Email</label>
              <input
                type="email"
                required
                value={newAdminEmail}
                onChange={e => setNewAdminEmail(e.target.value)}
                placeholder="name@institution.edu"
                className="w-full text-xs px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Institution</label>
              <select
                required
                value={newAdminCampusId}
                onChange={e => setNewAdminCampusId(e.target.value)}
                className="w-full text-xs px-3 py-2 border rounded-lg bg-white"
              >
                {institutions.map(inst => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddAdminOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs bg-[#173f6b] text-white font-bold rounded"
              >
                Save Admin Assignment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Request Detail & Reroute Modal */}
      {isRequestDetailOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-start justify-between border-b pb-3">
              <div>
                <span className="text-[10px] font-bold text-[#173f6b] uppercase tracking-wider">
                  {selectedRequest.id} · {selectedRequest.institutionName}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {selectedRequest.templateTitle}
                </h3>
                <p className="text-xs text-slate-500">
                  Applicant: {selectedRequest.applicantName} ({selectedRequest.applicantRole})
                </p>
              </div>
              <button onClick={() => setIsRequestDetailOpen(false)} className="text-slate-400 hover:text-slate-700">
                <XCircle size={18} />
              </button>
            </div>

            <div className="p-3 bg-slate-50 border rounded-lg text-xs space-y-2">
              <div className="font-semibold text-slate-800">Sequential Approval Track:</div>
              <div className="flex flex-wrap items-center gap-2">
                {selectedRequest.track.map((step, idx) => (
                  <span
                    key={idx}
                    className={`px-2 py-1 rounded text-[11px] font-medium ${
                      idx < selectedRequest.currentStageIndex
                        ? 'bg-emerald-100 text-emerald-800 font-bold'
                        : idx === selectedRequest.currentStageIndex
                        ? 'bg-[#173f6b] text-white font-bold'
                        : 'bg-white border text-slate-600'
                    }`}
                  >
                    {idx < selectedRequest.currentStageIndex ? '✓ ' : ''}{step}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="font-bold text-slate-800">Submitted Form Fields:</div>
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border">
                {Object.entries(selectedRequest.formData).map(([k, v]) => (
                  <div key={k} className="col-span-2 sm:col-span-1">
                    <span className="text-slate-400 block text-[10px]">{k}</span>
                    <span className="font-medium text-slate-800">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <button
                type="button"
                onClick={() => {
                  setRerouteStagesText(selectedRequest.track.slice(1).join(' → '));
                  setIsRerouteOpen(true);
                }}
                className="px-3 py-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 font-semibold"
              >
                Explicit Re-Route Path (Super Admin)
              </button>
              <button
                type="button"
                onClick={() => setIsRequestDetailOpen(false)}
                className="px-4 py-1.5 text-xs bg-slate-100 text-slate-700 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Explicit Reroute Modal */}
      {isRerouteOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border p-6 w-full max-w-md space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Explicitly Re-Route Request {selectedRequest.id}
            </h3>
            <p className="text-xs text-slate-500">
              Hierarchy changes do not silently rewrite existing requests. Enter the updated sequential stages to re-route this application.
            </p>
            <div>
              <textarea
                rows={3}
                value={rerouteStagesText}
                onChange={e => setRerouteStagesText(e.target.value)}
                className="w-full text-xs px-3 py-2 border rounded-lg"
                placeholder="Department HoD → Dean Academics → Finance Officer → Principal"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsRerouteOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReroute}
                className="px-4 py-1.5 text-xs bg-[#173f6b] text-white font-bold rounded"
              >
                Apply Re-Route
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
