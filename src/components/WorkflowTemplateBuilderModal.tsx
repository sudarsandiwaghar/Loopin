import React, { useState } from 'react';
import { api } from '../services/api.ts';
import { useToast } from './Toast.tsx';
import { Institution, WorkflowTemplate } from '../../server/types.ts';
import { X, Plus, MoveUp, MoveDown, Trash2, Edit2, CheckCircle2, ShieldCheck } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  institutions: Institution[];
  onTemplateCreated: (template: WorkflowTemplate) => void;
}

export const WorkflowTemplateBuilderModal: React.FC<Props> = ({
  isOpen,
  onClose,
  institutions,
  onTemplateCreated,
}) => {
  const { showToast } = useToast();
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [title, setTitle] = useState('International Conference On-Duty (OD) Leave & Travel Grant');
  const [category, setCategory] = useState('Faculty & Leave');
  const [turnaround, setTurnaround] = useState('5–7 working days');
  const [purpose, setPurpose] = useState(
    'Request on-duty leave and eligible travel grant support for presenting an accepted research paper at an international conference.'
  );
  const [instructions, setInstructions] = useState(
    'Applicants must present proof of paper acceptance, ID card, and grant approval before travel. Reimbursement claims must adhere to institutional finance norms.'
  );
  const [selectedCampuses, setSelectedCampuses] = useState<string[]>(institutions.map(i => i.id));

  const [steps, setSteps] = useState<string[]>([
    'Department HoD',
    'Dean Academics & Research',
    'Finance Officer',
    'Principal',
  ]);

  const [fields, setFields] = useState<Array<{ name: string; type: 'text' | 'date' | 'number' | 'textarea' | 'select'; required: boolean }>>([
    { name: 'Conference name', type: 'text', required: true },
    { name: 'Country / city', type: 'text', required: true },
    { name: 'Travel start date', type: 'date', required: true },
    { name: 'Travel end date', type: 'date', required: true },
    { name: 'Grant requested', type: 'number', required: true },
    { name: 'Purpose and expected outcomes', type: 'textarea', required: true },
  ]);

  const [attachments, setAttachments] = useState<string[]>([
    'Staff ID & Designation',
    'Proof of Acceptance',
    'Research Abstract / Resume',
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // Calculate readiness score
  let score = 50;
  if (title.trim()) score += 15;
  if (steps.length >= 2) score += 15;
  if (fields.length >= 2) score += 10;
  if (attachments.length >= 1) score += 10;
  const readiness = Math.min(100, score);

  const toggleCampus = (id: string) => {
    setSelectedCampuses(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const addStep = () => {
    const name = prompt('Enter new approval step name (e.g. Dean Student Affairs, Estate Officer)');
    if (name && name.trim()) {
      setSteps(prev => [...prev, name.trim()]);
      showToast(`Added step: ${name.trim()}`);
    }
  };

  const removeStep = (index: number) => {
    if (steps.length <= 1) {
      showToast('At least one approval step is required.');
      return;
    }
    setSteps(prev => prev.filter((_, i) => i !== index));
    showToast('Approval step removed.');
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= steps.length) return;
    const copy = [...steps];
    const temp = copy[index];
    copy[index] = copy[target];
    copy[target] = temp;
    setSteps(copy);
  };

  const editStep = (index: number) => {
    const current = steps[index];
    const updated = prompt('Edit approval step title:', current);
    if (updated && updated.trim()) {
      const copy = [...steps];
      copy[index] = updated.trim();
      setSteps(copy);
    }
  };

  const addField = () => {
    const name = prompt('Enter new field label (e.g. Estimated expenditure, Destination city)');
    if (name && name.trim()) {
      setFields(prev => [...prev, { name: name.trim(), type: 'text', required: true }]);
      showToast(`Field added: ${name.trim()}`);
    }
  };

  const removeField = (index: number) => {
    setFields(prev => prev.filter((_, i) => i !== index));
  };

  const addAttachment = () => {
    const name = prompt('Enter required attachment title (e.g. Quotation letter, Event brochure)');
    if (name && name.trim()) {
      setAttachments(prev => [...prev, name.trim()]);
      showToast(`Attachment required: ${name.trim()}`);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (status: 'Published' | 'Draft') => {
    if (!title.trim()) {
      showToast('Please enter a workflow title.');
      return;
    }
    if (selectedCampuses.length === 0) {
      showToast('Please select at least one eligible campus.');
      return;
    }

    try {
      setIsSubmitting(true);
      const newTemplate = await api.createTemplate({
        title: title.trim(),
        category,
        code: `PT-${Math.floor(100 + Math.random() * 900)}`,
        turnaround,
        purpose,
        instructions,
        eligibleInstitutions: selectedCampuses.length === institutions.length ? 'all' : selectedCampuses,
        steps,
        attachments,
        fields,
        status,
      });

      showToast(`Workflow template ${status === 'Published' ? 'published & activated' : 'saved as draft'}!`);
      onTemplateCreated(newTemplate);
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to save workflow template.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#14243b]/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-[#dfe5ef] w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between bg-white sticky top-0 z-10">
          <div>
            <div className="text-[10px] uppercase font-bold text-[#173f6b] tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#173f6b]"></span>
              Academic Operations / Super Admin Workflow Builder
            </div>
            <h2 className="text-xl font-semibold text-[#1b2635] mt-0.5">
              Create New Workflow Template
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-[#e2e8f0]">
          {/* Main Builder Form (2 Cols) */}
          <div className="lg:col-span-2 p-6 space-y-6">
            {/* Stepper */}
            <div className="flex items-center gap-2 p-2 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setActiveStep(1)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors ${
                  activeStep === 1
                    ? 'bg-white text-[#173f6b] shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  activeStep === 1 ? 'bg-[#173f6b] text-white' : 'bg-slate-200 text-slate-600'
                }`}>1</span>
                General information
              </button>
              <span className="h-px bg-slate-200 flex-1"></span>
              <button
                type="button"
                onClick={() => setActiveStep(2)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors ${
                  activeStep === 2
                    ? 'bg-white text-[#173f6b] shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  activeStep === 2 ? 'bg-[#173f6b] text-white' : 'bg-slate-200 text-slate-600'
                }`}>2</span>
                Approval chain
              </button>
              <span className="h-px bg-slate-200 flex-1"></span>
              <button
                type="button"
                onClick={() => setActiveStep(3)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors ${
                  activeStep === 3
                    ? 'bg-white text-[#173f6b] shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  activeStep === 3 ? 'bg-[#173f6b] text-white' : 'bg-slate-200 text-slate-600'
                }`}>3</span>
                Attachments & Fields
              </button>
            </div>

            {/* Step 1: General Info */}
            {activeStep === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Workflow Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-[#dedbe2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#173f6b]/20 focus:border-[#173f6b]"
                    placeholder="e.g. International Conference On-Duty Leave & Travel Grant"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Category
                    </label>
                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-[#dedbe2] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#173f6b]/20"
                    >
                      <option>Faculty & Leave</option>
                      <option>Research & Grants</option>
                      <option>Events & Infrastructure</option>
                      <option>Clearance & NOC</option>
                      <option>Finance</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Estimated Turnaround
                    </label>
                    <input
                      type="text"
                      value={turnaround}
                      onChange={e => setTurnaround(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-[#dedbe2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#173f6b]/20"
                      placeholder="e.g. 5–7 working days"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Workflow Purpose & Scope
                  </label>
                  <textarea
                    rows={2}
                    value={purpose}
                    onChange={e => setPurpose(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-[#dedbe2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#173f6b]/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Applicant Instructions & Compliance Notes
                  </label>
                  <textarea
                    rows={2}
                    value={instructions}
                    onChange={e => setInstructions(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-[#dedbe2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#173f6b]/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    Eligible Campus Entities (Super Admin Scoping)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {institutions.map(inst => (
                      <label
                        key={inst.id}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                          selectedCampuses.includes(inst.id)
                            ? 'bg-[#edf3ff] border-[#b8c9e0] text-[#173f6b] font-medium'
                            : 'bg-white border-[#e2e8f0] text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedCampuses.includes(inst.id)}
                          onChange={() => toggleCampus(inst.id)}
                          className="accent-[#173f6b]"
                        />
                        <span>{inst.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Approval Chain */}
            {activeStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800">
                      Sequential Approval Chain ({steps.length} Steps)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Requests will flow in strict order through these authority levels.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addStep}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#173f6b] bg-[#edf3ff] hover:bg-[#dce8f9] rounded-lg transition-colors"
                  >
                    <Plus size={14} />
                    Add Step
                  </button>
                </div>

                <div className="space-y-2 relative before:absolute before:left-5 before:top-4 before:bottom-4 before:w-0.5 before:bg-[#e2e8f0]">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500 relative z-10">
                    <span className="w-5 h-5 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                      0
                    </span>
                    <span className="font-semibold text-slate-700">Faculty / Staff Applicant</span>
                    <span className="text-[10px] text-slate-400">· Application Initiation (Entry)</span>
                  </div>

                  {steps.map((step, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-3 p-3 bg-white rounded-lg border border-[#e2e8f0] shadow-sm hover:border-[#b8c9e0] transition-colors relative z-10"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-[#edf3ff] text-[#173f6b] flex items-center justify-center font-bold text-xs">
                          {idx + 1}
                        </span>
                        <div>
                          <span className="text-xs font-bold text-[#1b2635] block">
                            {step}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Approval Authority #{idx + 1}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveStep(idx, 'up')}
                          disabled={idx === 0}
                          title="Move step up"
                          className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
                        >
                          <MoveUp size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveStep(idx, 'down')}
                          disabled={idx === steps.length - 1}
                          title="Move step down"
                          className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
                        >
                          <MoveDown size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => editStep(idx)}
                          title="Edit step name"
                          className="p-1 rounded text-slate-400 hover:text-slate-700"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeStep(idx)}
                          title="Remove step"
                          className="p-1 rounded text-rose-400 hover:text-rose-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Required Attachments & Form Fields */}
            {activeStep === 3 && (
              <div className="space-y-6">
                {/* Form Fields */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800">
                        Dynamic Form Fields ({fields.length})
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Fields applicants must complete during submission.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addField}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#173f6b] bg-[#edf3ff] hover:bg-[#dce8f9] rounded-lg transition-colors"
                    >
                      <Plus size={14} />
                      Add Field
                    </button>
                  </div>

                  <div className="space-y-2">
                    {fields.map((f, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2.5 bg-white border border-[#e2e8f0] rounded-lg text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">{f.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">[{f.type}]</span>
                          {f.required && (
                            <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">
                              Required
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeField(i)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Required Attachments */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800">
                        Required Supporting Attachments ({attachments.length})
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Documents that must be uploaded with the application.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addAttachment}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#173f6b] bg-[#edf3ff] hover:bg-[#dce8f9] rounded-lg transition-colors"
                    >
                      <Plus size={14} />
                      Add Attachment
                    </button>
                  </div>

                  <div className="space-y-2">
                    {attachments.map((att, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2.5 bg-white border border-[#e2e8f0] rounded-lg text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">▧</span>
                          <span className="font-medium text-slate-800">{att}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAttachment(i)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-[11px] text-amber-800 flex items-start gap-2">
                  <ShieldCheck size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <b>Finance & Academic Compliance Check:</b> All template configurations defined by Super Admin enforce audit logging and are immediately made available to authorized institutions.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar: Summary & Readiness Card */}
          <div className="p-6 bg-[#fafcff] flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Template Overview</span>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold">
                    Super Admin Owned
                  </span>
                </div>

                <div className="text-sm font-semibold text-[#173f6b] leading-snug">
                  {title || 'Untitled Workflow'}
                </div>

                <div className="text-xs divide-y divide-slate-100 space-y-2 pt-1">
                  <div className="flex justify-between pt-2">
                    <span className="text-slate-400">Category</span>
                    <span className="font-medium text-slate-700">{category}</span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-slate-400">Turnaround</span>
                    <span className="font-medium text-slate-700">{turnaround}</span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-slate-400">Approval Steps</span>
                    <span className="font-medium text-slate-700">{steps.length} sequential</span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-slate-400">Eligible Campuses</span>
                    <span className="font-medium text-slate-700">
                      {selectedCampuses.length === institutions.length
                        ? 'All Campuses'
                        : `${selectedCampuses.length} Campuses`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Readiness Card */}
              <div className="bg-[#173f6b] text-white rounded-xl p-4 space-y-2 shadow-md">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/80">Template Readiness</span>
                  <span className="font-bold text-lg">{readiness}%</span>
                </div>
                <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-400 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${readiness}%` }}
                  ></div>
                </div>
                <div className="text-[10px] text-white/70">
                  {readiness === 100
                    ? 'All parameters validated for immediate deployment.'
                    : 'Complete title, steps, and attachments for 100% readiness.'}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="space-y-2 pt-4">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSave('Published')}
                className="w-full py-2.5 px-4 bg-[#173f6b] hover:bg-[#0e2d50] text-white rounded-lg text-xs font-semibold shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CheckCircle2 size={15} />
                Publish & Activate Template
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSave('Draft')}
                className="w-full py-2 px-4 bg-white border border-[#e2e8f0] hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              >
                Save as Draft
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
