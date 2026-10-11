export type UserRole = 'super_admin' | 'admin' | 'staff';

export interface Institution {
  id: string;
  name: string;
  category: string;
  city: string;
  email: string;
  phone: string;
  address: string;
  requestCount: number;
  status: 'Active' | 'Inactive';
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  passwordHash: string; // Plain/SHA representation for demo/persistent verification
  name: string;
  role: UserRole;
  institutionId: string | null; // null for super_admin
  institutionName: string | null;
  designation: string;
  department: string;
  employeeCode?: string;
  manager?: string;
  status: 'Active' | 'Suspended';
  delegation?: {
    enabled: boolean;
    proxyUserId?: string;
    proxyUserName?: string;
    startDate?: string;
    endDate?: string;
  };
  preferences?: {
    notifyAssigned: boolean;
    notifyDaily: boolean;
    notifyUrgent: boolean;
    channel: 'Email and in-app' | 'In-app only' | 'Email only';
  };
  createdAt: string;
}

export interface StaffManagerialDetail {
  id: string;
  institutionId: string;
  name: string;
  role: string;
  dept: string;
  manager: string;
  email: string;
  updatedAt: string;
}

export interface HierarchyNode {
  id: string;
  name: string;
  role: string;
  count: number;
  tier: number; // Tier 1: CEO/Principal, Tier 2: Leadership/Officers/Managers, Tier 3: Local/External configurable, Tier 4: local specialists
  children?: HierarchyNode[];
}

export interface HierarchyChangeLog {
  id: string;
  institutionId: string;
  institutionName: string;
  action: string;
  detail: string;
  status: 'Updated' | 'Requested' | 'Approved';
  actorName: string;
  time: string;
}

export interface ApprovalStepConfig {
  id: string;
  name: string;
  role: string;
  locked?: boolean;
}

export interface WorkflowTemplate {
  id: string;
  title: string;
  category: string;
  code: string;
  turnaround: string;
  purpose: string;
  instructions?: string;
  eligibleInstitutions: string[] | 'all';
  steps: string[];
  attachments: string[];
  fields: Array<{
    name: string;
    type: 'text' | 'date' | 'number' | 'textarea' | 'select';
    required: boolean;
    options?: string[];
  }>;
  status: 'Published' | 'Draft';
  version: string;
  createdBy: string;
  createdAt: string;
}

export interface TemplateNomination {
  id: string;
  title: string;
  category: string;
  uses: number;
  institution: string;
  institutionId: string;
  submittedBy: string;
  status: 'pending' | 'approved' | 'declined';
  submittedAt: string;
  reviewedAt?: string;
  details: {
    steps: string[];
    fields: string[];
  };
}

export interface RequestStageStatus {
  stepIndex: number;
  name: string;
  role: string;
  assignedRole?: string;
  status: 'pending' | 'in_review' | 'approved' | 'declined' | 'clarification';
  actedBy?: string;
  actedAt?: string;
  remarks?: string;
}

export interface WorkflowRequest {
  id: string;
  templateId: string;
  templateTitle: string;
  category: string;
  institutionId: string;
  institutionName: string;
  applicantId: string;
  applicantName: string;
  applicantRole: string;
  applicantDept: string;
  submittedAt: string;
  status: 'Pending' | 'In review' | 'Approved' | 'Declined' | 'Clarification requested';
  currentStageIndex: number;
  currentStageName: string;
  track: string[];
  stages: RequestStageStatus[];
  formData: Record<string, any>;
  attachments: string[];
  history: Array<{
    action: string;
    actor: string;
    role: string;
    time: string;
    remarks?: string;
  }>;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  institutionId: string | null;
  institutionName: string | null;
  action: string;
  targetRecord: string;
  details: string;
  timestamp: string;
}

export interface SavedDraft {
  id: string;
  userId: string;
  templateId: string;
  title: string;
  category: string;
  values: Record<string, any>;
  savedAt: string;
}
