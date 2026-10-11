import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api.ts';
import { useToast } from './Toast.tsx';
import { User, WorkflowTemplate, Institution, TemplateNomination } from '../../server/types.ts';
import { WorkflowTemplateBuilderModal } from './WorkflowTemplateBuilderModal.tsx';
import {
  ArrowLeft,
  Search,
  Filter,
  FileText,
  Clock,
  Layers,
  CheckCircle2,
  Building,
  Plus,
  Eye,
  Send,
  Sparkles,
  ChevronRight,
  Shield,
  HelpCircle,
  Tag,
  Share2,
  Calendar,
  UserCheck,
  Check,
  X,
  ExternalLink,
  BookOpen,
  SlidersHorizontal,
} from 'lucide-react';

interface Props {
  currentUser: User | null;
  onBack: () => void;
  onFastSwitch?: (role: 'super_admin' | 'admin' | 'staff') => void;
  onApplyTemplate?: (template: WorkflowTemplate) => void;
  onLogout?: () => void;
}

export const TemplatesLandingPage: React.FC<Props> = ({
  currentUser,
  onBack,
  onFastSwitch,
  onApplyTemplate,
  onLogout,
}) => {
  const { showToast } = useToast();
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [nominations, setNominations] = useState<TemplateNomination[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedSla, setSelectedSla] = useState<string>('All');
  const [institutionFilter, setInstitutionFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'standards' | 'nominations'>('all');

  // Modals & Drawers
  const [inspectTemplate, setInspectTemplate] = useState<WorkflowTemplate | null>(null);
  const [isTemplateBuilderOpen, setIsTemplateBuilderOpen] = useState(false);
  const [isNominateModalOpen, setIsNominateModalOpen] = useState(false);
  const [nominateTitle, setNominateTitle] = useState('');
  const [nominateCategory, setNominateCategory] = useState('Academic');
  const [nominateSteps, setNominateSteps] = useState('HOD, Dean, Principal');
  const [nominateFields, setNominateFields] = useState('Applicant Name, Employee ID, Purpose, Amount/Dates');

  // Standard Templates from specification
  const standardCatalog = [
    {
      id: 'std-resignation',
      title: 'Resignation Request',
      category: 'People & HR',
      turnaround: '5–10 working days',
      code: 'HR-RES-01',
      purpose: 'Formal resignation submission with notice period tracking and asset handover clearance routing.',
      fields: [
        { name: 'Employee details & designation', type: 'text' as const, required: true },
        { name: 'Proposed last working day', type: 'date' as const, required: true },
        { name: 'Notice period duration', type: 'text' as const, required: true },
        { name: 'Primary reason for leaving', type: 'textarea' as const, required: true },
        { name: 'Handover & Knowledge transfer plan', type: 'textarea' as const, required: true },
      ],
      steps: ['Reporting Manager / HOD', 'Campus HR & Administrative Officer', 'Principal / CEO Final Sign-off'],
    },
    {
      id: 'std-od',
      title: 'On-Duty (OD) Request',
      category: 'Academic & Exams',
      turnaround: '2–3 working days',
      code: 'ACM-OD-01',
      purpose: 'Official deputation for attending university valuation, symposiums, external audits, and seminars.',
      fields: [
        { name: 'Faculty Name & Department', type: 'text' as const, required: true },
        { name: 'Purpose of OD & Event Title', type: 'text' as const, required: true },
        { name: 'Destination Institution / Organization', type: 'text' as const, required: true },
        { name: 'Start Date & End Date', type: 'date' as const, required: true },
        { name: 'Class Alternation / Coverage Details', type: 'textarea' as const, required: true },
      ],
      steps: ['Head of Department (HOD)', 'Dean Academics', 'Principal Approval'],
    },
    {
      id: 'std-leave',
      title: 'Casual & Medical Leave Request',
      category: 'People & HR',
      turnaround: '1–2 working days',
      code: 'HR-LV-02',
      purpose: 'Application for scheduled casual leave, sick leave, or compensatory off with work coverage.',
      fields: [
        { name: 'Leave Type (Casual / Sick / Earned)', type: 'select' as const, required: true, options: ['Casual Leave', 'Sick Leave', 'Compensatory Off', 'Maternity/Paternity'] },
        { name: 'From Date & To Date', type: 'date' as const, required: true },
        { name: 'Number of Working Days', type: 'number' as const, required: true },
        { name: 'Reason for Leave', type: 'textarea' as const, required: true },
        { name: 'Substitute Faculty / Staff Coverage', type: 'text' as const, required: true },
      ],
      steps: ['Reporting Manager / HOD', 'Campus HR Section'],
    },
    {
      id: 'std-event',
      title: 'Event & Conference Organization',
      category: 'Academic & Exams',
      turnaround: '5–7 working days',
      code: 'ACM-EVT-03',
      purpose: 'Pre-approval for hosting national symposiums, hackathons, guest lectures, and cultural events.',
      fields: [
        { name: 'Event Name & Department', type: 'text' as const, required: true },
        { name: 'Target Audience & Expected Attendees', type: 'number' as const, required: true },
        { name: 'Proposed Date, Venue & Duration', type: 'text' as const, required: true },
        { name: 'Total Estimated Budget (INR)', type: 'number' as const, required: true },
        { name: 'Funding Source / Sponsorship details', type: 'textarea' as const, required: true },
      ],
      steps: ['HOD / Organizing Convener', 'Dean Student Affairs & Academics', 'Finance Officer Budget Audit', 'Principal Sanction'],
    },
    {
      id: 'std-procurement',
      title: 'Purchase & Lab Equipment Procurement',
      category: 'Finance & Accounts',
      turnaround: '7–10 working days',
      code: 'FIN-PRC-01',
      purpose: 'Requisition for laboratory instruments, computer software licenses, classroom projectors, and consumables.',
      fields: [
        { name: 'Department & Lab Name', type: 'text' as const, required: true },
        { name: 'Item Specification & Quantity', type: 'textarea' as const, required: true },
        { name: 'Business / Curriculum Justification', type: 'textarea' as const, required: true },
        { name: 'Estimated Cost including Taxes', type: 'number' as const, required: true },
        { name: 'Vendor Quotation (Minimum 3 required)', type: 'text' as const, required: true },
      ],
      steps: ['HOD / Lab In-Charge', 'Purchase Committee Technical Review', 'Finance Officer Clearance', 'Group Executive Trustee / CEO'],
    },
    {
      id: 'std-reimbursement',
      title: 'Expense Reimbursement Claim',
      category: 'Finance & Accounts',
      turnaround: '3–5 working days',
      code: 'FIN-RMB-02',
      purpose: 'Claim reimbursement for approved travel, book allowances, research publications, and official hospitality.',
      fields: [
        { name: 'Expense Category', type: 'select' as const, required: true, options: ['Travel & Conveyance', 'Research Publication Fee', 'Books & Journals', 'Official Hospitality'] },
        { name: 'Date of Expenditure', type: 'date' as const, required: true },
        { name: 'Total Claim Amount (INR)', type: 'number' as const, required: true },
        { name: 'Original Bill / Receipt Numbers', type: 'text' as const, required: true },
      ],
      steps: ['Department HOD Recommendation', 'Finance & Accounts Audit', 'Principal / Treasurer Final Disbursement'],
    },
  ];

  // Fetch data
  const loadData = async () => {
    try {
      setIsLoading(true);
      const [tpls, insts, noms] = await Promise.all([
        api.getTemplates(),
        api.getInstitutions().catch(() => []),
        api.getNominations ? api.getNominations().catch(() => []) : Promise.resolve([]),
      ]);
      setTemplates(tpls);
      setInstitutions(insts);
      setNominations(noms as TemplateNomination[]);
    } catch (err: any) {
      console.error('Failed to load templates catalog:', err);
      showToast(err.message || 'Error loading templates.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    templates.forEach(t => {
      if (t.category) set.add(t.category);
    });
    standardCatalog.forEach(s => set.add(s.category));
    return ['All', ...Array.from(set)];
  }, [templates]);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      // Search
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        (t.purpose && t.purpose.toLowerCase().includes(q)) ||
        (t.category && t.category.toLowerCase().includes(q));

      // Category
      const matchCategory = selectedCategory === 'All' || t.category === selectedCategory;

      // SLA
      const matchSla =
        selectedSla === 'All' ||
        (selectedSla === 'Fast' && (t.turnaround?.includes('1') || t.turnaround?.includes('2') || t.turnaround?.includes('3'))) ||
        (selectedSla === 'Standard' && (t.turnaround?.includes('4') || t.turnaround?.includes('5') || t.turnaround?.includes('7')));

      // Institution Scope
      const matchInst =
        institutionFilter === 'all' ||
        t.eligibleInstitutions === 'all' ||
        (Array.isArray(t.eligibleInstitutions) && t.eligibleInstitutions.includes(institutionFilter));

      return matchSearch && matchCategory && matchSla && matchInst;
    });
  }, [templates, searchQuery, selectedCategory, selectedSla, institutionFilter]);

  // Quick Adopt Standard Template into Live System
  const handleAdoptStandard = async (std: typeof standardCatalog[0]) => {
    try {
      const newTpl = await api.createTemplate({
        title: std.title,
        category: std.category,
        code: std.code,
        turnaround: std.turnaround,
        purpose: std.purpose,
        instructions: 'Please provide all verified supporting bills and compliance information.',
        eligibleInstitutions: 'all',
        steps: std.steps,
        attachments: ['Proof of Approval / Document', 'Supporting Bills or Form Annexure'],
        fields: std.fields,
        status: 'Published',
        version: '1.0',
      });
      setTemplates(prev => [newTpl, ...prev]);
      showToast(`Adopted "${std.title}" into Active Institutional Templates!`);
    } catch (err: any) {
      showToast(err.message || 'Failed to adopt template.');
    }
  };

  // Submit Nomination
  const handleSubmitNomination = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nominateTitle.trim()) {
      showToast('Please enter a template title.');
      return;
    }
    try {
      const stepsArr = nominateSteps.split(',').map(s => s.trim()).filter(Boolean);
      const fieldsArr = nominateFields.split(',').map(f => f.trim()).filter(Boolean);
      await api.createNomination({
        title: nominateTitle,
        category: nominateCategory,
        details: {
          steps: stepsArr,
          fields: fieldsArr,
        },
      });
      showToast('Template proposal submitted for Super Admin review!');
      setIsNominateModalOpen(false);
      setNominateTitle('');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to submit template nomination.');
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#1b2635] flex flex-col font-sans">
      {/* 1. TOP HEADER & BREADCRUMBS */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#e2e8f0] px-4 sm:px-8 py-3.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-[#123b6d] hover:text-white text-slate-700 text-xs font-semibold transition-all border border-slate-200 hover:border-[#123b6d] shadow-2xs"
              title="Return to your dashboard"
            >
              <ArrowLeft size={14} />
              <span>Back to Dashboard</span>
            </button>

            <div className="h-4 w-px bg-slate-200 hidden sm:block"></div>

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#123b6d] text-white flex items-center justify-center font-serif font-bold text-sm shadow-xs">
                L
              </div>
              <div>
                <span className="font-bold text-sm text-[#123b6d]">Loopin</span>
                <span className="text-slate-400 mx-1.5 text-xs">/</span>
                <span className="text-xs font-semibold text-slate-700">Request Templates Directory</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Role Switcher */}
            {onFastSwitch && (
              <div className="hidden md:flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px]">
                <span className="text-[10px] uppercase font-bold text-slate-400 px-2 tracking-wider">
                  Role:
                </span>
                <button
                  type="button"
                  onClick={() => onFastSwitch('super_admin')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                    currentUser?.role === 'super_admin'
                      ? 'bg-white text-[#123b6d] shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Super Admin
                </button>
                <button
                  type="button"
                  onClick={() => onFastSwitch('admin')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                    currentUser?.role === 'admin'
                      ? 'bg-white text-[#123b6d] shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => onFastSwitch('staff')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                    currentUser?.role === 'staff'
                      ? 'bg-white text-[#123b6d] shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Staff
                </button>
              </div>
            )}

            {currentUser && (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <div className="w-7 h-7 rounded-full bg-[#eef4ff] text-[#123b6d] flex items-center justify-center text-xs font-bold border border-[#d8e5f8]">
                  {currentUser.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                </div>
                <div className="hidden lg:block text-left">
                  <div className="text-xs font-bold text-slate-800 leading-tight">{currentUser.name}</div>
                  <div className="text-[10px] text-slate-400 capitalize">{currentUser.role.replace('_', ' ')}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. HERO SHOWCASE SECTION */}
      <section className="bg-gradient-to-b from-[#123b6d] via-[#103561] to-[#0c294d] text-white pt-10 pb-12 px-4 sm:px-8 relative overflow-hidden">
        {/* Subtle decorative background circles */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-sky-400/10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="max-w-7xl mx-auto relative z-10 space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-sky-200 text-xs font-semibold backdrop-blur-sm">
                <Sparkles size={13} className="text-sky-300" />
                <span>Loopin Institutional Request Governance & SLA Engine</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
                Workflow & Request Templates Directory
              </h1>
              <p className="text-white/80 text-sm sm:text-base leading-relaxed">
                Explore standardized multi-tier approval routes, mandatory form fields, turnaround service level agreements (SLAs), and campus eligibility criteria across Sri Sairam Group institutions.
              </p>
            </div>

            {/* Quick Metrics Bar */}
            <div className="flex items-center gap-3 bg-white/10 border border-white/15 rounded-xl p-3 backdrop-blur-md shrink-0">
              <div className="text-center px-3 border-r border-white/15">
                <div className="text-2xl font-extrabold text-white">{templates.length}</div>
                <div className="text-[10px] text-white/70 uppercase font-semibold">Active Forms</div>
              </div>
              <div className="text-center px-3 border-r border-white/15">
                <div className="text-2xl font-extrabold text-sky-300">100%</div>
                <div className="text-[10px] text-white/70 uppercase font-semibold">Digital Trail</div>
              </div>
              <div className="text-center px-3">
                <div className="text-2xl font-extrabold text-emerald-300">2–5d</div>
                <div className="text-[10px] text-white/70 uppercase font-semibold">Avg. SLA</div>
              </div>
            </div>
          </div>

          {/* Search Bar in Hero */}
          <div className="pt-2">
            <div className="relative max-w-2xl bg-white rounded-xl shadow-lg p-1.5 flex items-center border border-white/20">
              <Search size={18} className="text-slate-400 ml-3 shrink-0" />
              <input
                type="text"
                placeholder="Search templates by title, code (e.g. ACM-01), category, purpose..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full text-slate-800 text-sm px-3 py-2 bg-transparent focus:outline-none placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md"
                >
                  <X size={16} />
                </button>
              )}
              <div className="pr-2 hidden sm:block">
                <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded">
                  {filteredTemplates.length} matches
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. NAVIGATION TABS & ACTION TOOLBAR */}
      <section className="bg-white border-b border-[#e2e8f0] px-4 sm:px-8 py-3 sticky top-[57px] z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Main Tab Switcher */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-2 ${
                activeTab === 'all'
                  ? 'bg-[#123b6d] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileText size={14} />
              <span>All Active Templates ({templates.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('standards')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-2 ${
                activeTab === 'standards'
                  ? 'bg-[#123b6d] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Layers size={14} />
              <span>Standard Specification Catalog ({standardCatalog.length})</span>
            </button>

            {currentUser?.role === 'super_admin' && (
              <button
                onClick={() => setActiveTab('nominations')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-2 ${
                  activeTab === 'nominations'
                    ? 'bg-[#123b6d] text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Send size={14} />
                <span>Campus Proposals & Nominations ({nominations.length})</span>
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {currentUser?.role === 'super_admin' && (
              <button
                onClick={() => setIsTemplateBuilderOpen(true)}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <Plus size={14} />
                <span>Create New Template</span>
              </button>
            )}

            {currentUser?.role === 'admin' && (
              <button
                onClick={() => setIsNominateModalOpen(true)}
                className="px-3.5 py-1.5 bg-[#123b6d] hover:bg-[#0e2d50] text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <Send size={14} />
                <span>Propose Custom Workflow</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 4. MAIN CONTENT AREA */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 w-full flex-1 space-y-6">
        {/* Category Pills & Filters */}
        {activeTab === 'all' && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Category Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-slate-400 mr-1 uppercase tracking-wider">
                  Category:
                </span>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                      selectedCategory === cat
                        ? 'bg-[#123b6d] text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* SLA & Campus Filter Dropdowns */}
              <div className="flex items-center gap-2.5 shrink-0 text-xs">
                <div className="flex items-center gap-1.5">
                  <Clock size={13} className="text-slate-400" />
                  <select
                    value={selectedSla}
                    onChange={e => setSelectedSla(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 text-slate-700 font-medium focus:outline-none"
                  >
                    <option value="All">All Turnarounds</option>
                    <option value="Fast">Fast (1–3 Days)</option>
                    <option value="Standard">Standard (4–7 Days)</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <Building size={13} className="text-slate-400" />
                  <select
                    value={institutionFilter}
                    onChange={e => setInstitutionFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 text-slate-700 font-medium focus:outline-none"
                  >
                    <option value="all">All Campuses</option>
                    {institutions.map(i => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: ALL ACTIVE TEMPLATES */}
        {activeTab === 'all' && (
          <div>
            {isLoading ? (
              <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-3">
                <div className="w-8 h-8 border-3 border-[#123b6d]/30 border-t-[#123b6d] rounded-full animate-spin"></div>
                <span className="text-xs font-semibold">Loading template catalog...</span>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4">
                <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                  <FileText size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">No templates match your filters</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                    Try adjusting your search query, selecting "All Categories", or exploring the Standard Specification Catalog.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('All');
                    setSelectedSla('All');
                    setInstitutionFilter('all');
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTemplates.map(tpl => {
                  const isEligible =
                    !currentUser?.institutionId ||
                    tpl.eligibleInstitutions === 'all' ||
                    (Array.isArray(tpl.eligibleInstitutions) && tpl.eligibleInstitutions.includes(currentUser.institutionId));

                  return (
                    <div
                      key={tpl.id}
                      className="bg-white border border-slate-200 rounded-xl hover:border-[#123b6d]/50 hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                    >
                      {/* Card Header & Badges */}
                      <div className="p-5 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2.5 py-0.5 bg-blue-50 text-[#123b6d] border border-blue-200 rounded-md font-mono text-[10px] font-bold">
                            {tpl.code || 'TPL'}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                            <Clock size={11} className="text-slate-400" />
                            {tpl.turnaround || '3–5 days'}
                          </span>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                            {tpl.category || 'General'}
                          </div>
                          <h3 className="text-base font-bold text-slate-900 group-hover:text-[#123b6d] transition-colors mt-0.5">
                            {tpl.title}
                          </h3>
                          <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                            {tpl.purpose || 'Official institutional workflow for multi-campus review and audit.'}
                          </p>
                        </div>

                        {/* Sequential Approval Flow Path */}
                        <div className="pt-2 border-t border-slate-100 space-y-1.5">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                            <span>Sequential Approval Chain:</span>
                            <span className="text-[#123b6d]">{tpl.steps?.length || 0} Stages</span>
                          </div>
                          <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
                            {tpl.steps && tpl.steps.length > 0 ? (
                              tpl.steps.map((st, idx) => (
                                <React.Fragment key={idx}>
                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-medium shrink-0 border border-slate-200">
                                    {idx + 1}. {st}
                                  </span>
                                  {idx < tpl.steps.length - 1 && (
                                    <span className="text-slate-300 shrink-0">→</span>
                                  )}
                                </React.Fragment>
                              ))
                            ) : (
                              <span className="text-slate-400 text-xs italic">Standard HOD → Principal routing</span>
                            )}
                          </div>
                        </div>

                        {/* Metadata Pills */}
                        <div className="flex items-center gap-2 pt-1 text-[10px] text-slate-500">
                          <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                            {tpl.fields?.length || 0} Form Fields
                          </span>
                          <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                            {tpl.attachments?.length || 0} Attachments
                          </span>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                        <button
                          onClick={() => setInspectTemplate(tpl)}
                          className="flex-1 py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Eye size={13} className="text-slate-400" />
                          <span>View Details</span>
                        </button>

                        {/* If user is staff and eligible, allow starting request */}
                        {currentUser?.role === 'staff' && onApplyTemplate && (
                          <button
                            onClick={() => onApplyTemplate(tpl)}
                            disabled={!isEligible}
                            className={`flex-1 py-2 px-3 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                              isEligible
                                ? 'bg-[#123b6d] hover:bg-[#0e2d50]'
                                : 'bg-slate-300 cursor-not-allowed text-slate-500'
                            }`}
                          >
                            <span>Apply Now →</span>
                          </button>
                        )}

                        {currentUser?.role === 'super_admin' && (
                          <button
                            onClick={() => setInspectTemplate(tpl)}
                            className="py-2 px-3 bg-[#123b6d] hover:bg-[#0e2d50] text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1"
                          >
                            <span>Configure</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: STANDARD SPECIFICATION CATALOG */}
        {activeTab === 'standards' && (
          <div className="space-y-6">
            <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-[#123b6d] text-base flex items-center gap-2">
                  <Layers size={18} />
                  Reference Templates from Loopin Specification
                </h3>
                <p className="text-xs text-slate-600 mt-1 max-w-2xl">
                  These represent standard pre-configured academic, administrative, and financial request workflows designed for college campuses. Super Admins can adopt any standard template into the active system with a single click.
                </p>
              </div>

              {currentUser?.role === 'super_admin' && (
                <div className="text-xs font-semibold text-[#123b6d] bg-white px-3 py-1.5 rounded-lg border border-blue-200 shrink-0">
                  ⚡ 1-Click Group Adoption Enabled
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {standardCatalog.map(std => {
                const isAlreadyAdopted = templates.some(
                  t => t.title.toLowerCase() === std.title.toLowerCase() || t.code === std.code
                );

                return (
                  <div
                    key={std.id}
                    className="p-6 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {std.code}
                        </span>
                        <span className="text-xs text-slate-500 font-semibold bg-slate-100 px-2.5 py-0.5 rounded-full">
                          ⏱ {std.turnaround}
                        </span>
                      </div>

                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-400">{std.category}</div>
                        <h4 className="text-lg font-bold text-slate-900 mt-0.5">{std.title}</h4>
                        <p className="text-xs text-slate-600 mt-1">{std.purpose}</p>
                      </div>

                      {/* Steps chain */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-100">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Approval Pipeline:
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap text-xs">
                          {std.steps.map((step, idx) => (
                            <React.Fragment key={idx}>
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-medium border border-slate-200">
                                {idx + 1}. {step}
                              </span>
                              {idx < std.steps.length - 1 && <span className="text-slate-300">→</span>}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>

                      {/* Required fields */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-100">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Form Fields ({std.fields.length}):
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {std.fields.map((f, i) => (
                            <span key={i} className="text-[11px] bg-slate-50 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                              {f.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2">
                      {isAlreadyAdopted ? (
                        <div className="w-full py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold flex items-center justify-center gap-2">
                          <CheckCircle2 size={15} />
                          <span>Active in Group Library</span>
                        </div>
                      ) : currentUser?.role === 'super_admin' ? (
                        <button
                          onClick={() => handleAdoptStandard(std)}
                          className="w-full py-2 bg-[#123b6d] hover:bg-[#0e2d50] text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Plus size={14} />
                          <span>Adopt into Live Library</span>
                        </button>
                      ) : (
                        <div className="text-[11px] text-slate-400 italic text-center">
                          Standard reference template
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: CAMPUS PROPOSALS & NOMINATIONS */}
        {activeTab === 'nominations' && currentUser?.role === 'super_admin' && (
          <div className="space-y-6">
            <div className="p-5 bg-purple-50 border border-purple-200 rounded-xl">
              <h3 className="font-bold text-purple-900 text-base">Campus Admin Custom Workflow Nominations</h3>
              <p className="text-xs text-purple-700 mt-1">
                Campus administrators submit frequently used institutional workflows for organization-wide review. Once approved, they appear across all eligible institutions.
              </p>
            </div>

            {nominations.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400 space-y-2">
                <CheckCircle2 size={32} className="mx-auto text-emerald-500" />
                <div className="font-bold text-slate-700 text-sm">No Pending Proposals</div>
                <p className="text-xs text-slate-400">All submitted campus nominations have been reviewed.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {nominations.map(nom => (
                  <div key={nom.id} className="p-5 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded">
                        {nom.institution || 'Campus Proposal'}
                      </span>
                      <span className="text-slate-400 text-[10px]">Submitted: {nom.submittedAt?.split('T')[0]}</span>
                    </div>

                    <h4 className="font-bold text-sm text-slate-900">{nom.title}</h4>

                    <div className="text-xs space-y-1 text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200">
                      <div><b>Proposed Steps:</b> {nom.details?.steps?.join(' → ') || 'Standard route'}</div>
                      <div><b>Fields:</b> {nom.details?.fields?.join(', ') || 'Custom fields'}</div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={async () => {
                          try {
                            await api.reviewNomination(nom.id, 'approved');
                            showToast(`Approved "${nom.title}"!`);
                            loadData();
                          } catch (err: any) {
                            showToast(err.message || 'Error reviewing nomination.');
                          }
                        }}
                        className="flex-1 py-1.5 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700"
                      >
                        Approve & Publish
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await api.reviewNomination(nom.id, 'declined');
                            showToast(`Declined "${nom.title}".`);
                            loadData();
                          } catch (err: any) {
                            showToast(err.message || 'Error reviewing nomination.');
                          }
                        }}
                        className="py-1.5 px-3 bg-slate-200 text-slate-700 rounded text-xs font-bold hover:bg-slate-300"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* 5. MODAL: TEMPLATE INSPECTION / PREVIEW DRAWER */}
      {inspectTemplate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-start justify-between bg-slate-50 rounded-t-2xl">
              <div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono font-bold text-[#123b6d] bg-blue-100 px-2 py-0.5 rounded">
                    {inspectTemplate.code || 'FORM'}
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="font-semibold text-slate-600">{inspectTemplate.category}</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    SLA: {inspectTemplate.turnaround}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mt-1">{inspectTemplate.title}</h3>
              </div>
              <button
                onClick={() => setInspectTemplate(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 flex-1 text-xs text-slate-700">
              {/* Purpose & Instructions */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 text-sm">Purpose & Policy Instructions</h4>
                <p className="p-3 bg-slate-50 border border-slate-200 rounded-lg leading-relaxed text-slate-600">
                  {inspectTemplate.purpose}
                </p>
                {inspectTemplate.instructions && (
                  <p className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg leading-relaxed text-amber-900">
                    <b>Compliance Notice:</b> {inspectTemplate.instructions}
                  </p>
                )}
              </div>

              {/* Approval Stages */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 text-sm">Sequential Approval Route</h4>
                <div className="space-y-2">
                  {inspectTemplate.steps && inspectTemplate.steps.length > 0 ? (
                    inspectTemplate.steps.map((st, i) => (
                      <div
                        key={i}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-[#123b6d] text-white flex items-center justify-center font-bold text-xs">
                            {i + 1}
                          </span>
                          <div>
                            <b className="text-slate-800 text-xs">{st}</b>
                            <span className="block text-[10px] text-slate-400">
                              Requires mandatory digital sign-off and remarks
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          Stage {i + 1}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-400 italic">No stages configured.</div>
                  )}
                </div>
              </div>

              {/* Form Fields Preview */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 text-sm">Form Fields Checklist ({inspectTemplate.fields?.length || 0})</h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                      <tr>
                        <th className="p-2.5">Field Name</th>
                        <th className="p-2.5">Input Type</th>
                        <th className="p-2.5">Requirement</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {inspectTemplate.fields?.map((f, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 font-medium text-slate-800">{f.name}</td>
                          <td className="p-2.5 text-slate-500 capitalize">{f.type}</td>
                          <td className="p-2.5">
                            {f.required ? (
                              <span className="text-rose-600 font-bold text-[10px]">Mandatory</span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">Optional</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Required Attachments */}
              {inspectTemplate.attachments && inspectTemplate.attachments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900 text-sm">Mandatory Supporting Documents</h4>
                  <ul className="list-disc pl-5 space-y-1 text-slate-600">
                    {inspectTemplate.attachments.map((att, i) => (
                      <li key={i}>{att}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 rounded-b-2xl">
              <button
                onClick={() => setInspectTemplate(null)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg font-semibold text-xs"
              >
                Close Preview
              </button>

              {currentUser?.role === 'staff' && onApplyTemplate && (
                <button
                  onClick={() => {
                    const t = inspectTemplate;
                    setInspectTemplate(null);
                    onApplyTemplate(t);
                  }}
                  className="px-5 py-2 bg-[#123b6d] hover:bg-[#0e2d50] text-white rounded-lg font-bold text-xs"
                >
                  Start Application with this Form →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL: PROPOSE CUSTOM WORKFLOW (CAMPUS ADMIN) */}
      {isNominateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-base text-[#123b6d]">Propose Workflow Template</h3>
              <button onClick={() => setIsNominateModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitNomination} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Template / Workflow Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Special Lab Consumables Emergency Grant"
                  value={nominateTitle}
                  onChange={e => setNominateTitle(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#123b6d]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Category</label>
                <select
                  value={nominateCategory}
                  onChange={e => setNominateCategory(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none"
                >
                  <option value="Academic">Academic</option>
                  <option value="Finance">Finance</option>
                  <option value="People & HR">People & HR</option>
                  <option value="Infrastructure">Infrastructure</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Proposed Approval Stages (comma separated)</label>
                <input
                  type="text"
                  value={nominateSteps}
                  onChange={e => setNominateSteps(e.target.value)}
                  placeholder="e.g. HOD, Dean, Principal"
                  className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Required Form Fields (comma separated)</label>
                <textarea
                  rows={2}
                  value={nominateFields}
                  onChange={e => setNominateFields(e.target.value)}
                  placeholder="e.g. Project Name, Budget, Vendor, Reason"
                  className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNominateModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#123b6d] text-white rounded-lg font-bold hover:bg-[#0e2d50]"
                >
                  Submit for Super Admin Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL: CREATE WORKFLOW TEMPLATE (SUPER ADMIN) */}
      <WorkflowTemplateBuilderModal
        isOpen={isTemplateBuilderOpen}
        onClose={() => setIsTemplateBuilderOpen(false)}
        institutions={institutions}
        onTemplateCreated={newTpl => {
          setTemplates(prev => [newTpl, ...prev]);
          setIsTemplateBuilderOpen(false);
        }}
      />
    </div>
  );
};
