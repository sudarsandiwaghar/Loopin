import {
  User,
  Institution,
  StaffManagerialDetail,
  HierarchyNode,
  HierarchyChangeLog,
  ApprovalStepConfig,
  WorkflowTemplate,
  TemplateNomination,
  WorkflowRequest,
  AuditLogEntry,
  SavedDraft,
} from '../../server/types.ts';

const TOKEN_KEY = 'loopin_auth_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Ignore storage quota or incognito access errors
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export const api = {
  // Health & Supabase
  checkHealth: () => request<{ status: string; supabaseConnected: boolean; timestamp: string }>('/health'),
  getSupabaseStatus: () => request<{ configured: boolean; connected: boolean; url?: string; message: string }>('/supabase/status'),
  syncSupabase: () => request<{ success: boolean; message: string }>('/supabase/sync', { method: 'POST' }),
  pullSupabase: () => request<{ success: boolean; message: string }>('/supabase/pull', { method: 'POST' }),
  resetSeed: () => request<{ success: boolean; message: string }>('/seed/reset', { method: 'POST' }),

  // Auth
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  getMe: () => request<{ user: User }>('/auth/me'),
  logout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST' }),

  // Institutions
  getInstitutions: () => request<Institution[]>('/institutions'),
  createInstitution: (data: Partial<Institution>) =>
    request<Institution>('/institutions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateInstitution: (id: string, data: Partial<Institution>) =>
    request<Institution>(`/institutions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Admins
  getAdmins: () => request<User[]>('/admins'),
  createAdmin: (data: { name: string; email: string; institutionId: string; department?: string }) =>
    request<User>('/admins', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  toggleAdminStatus: (id: string) =>
    request<User>(`/admins/${id}/status`, {
      method: 'PATCH',
    }),
  deleteAdmin: (id: string) =>
    request<{ success: boolean }>(`/admins/${id}`, {
      method: 'DELETE',
    }),

  // Staff
  getStaff: (institutionId?: string) =>
    request<StaffManagerialDetail[]>(`/staff${institutionId ? `?institutionId=${institutionId}` : ''}`),
  createStaff: (data: Partial<StaffManagerialDetail>) =>
    request<StaffManagerialDetail>('/staff', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateStaff: (id: string, data: Partial<StaffManagerialDetail>) =>
    request<StaffManagerialDetail>(`/staff/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteStaff: (id: string) =>
    request<{ success: boolean }>(`/staff/${id}`, {
      method: 'DELETE',
    }),

  // Hierarchy
  getHierarchy: (institutionId: string) =>
    request<HierarchyNode>(`/hierarchy/${institutionId}`),
  updateHierarchy: (institutionId: string, tree: HierarchyNode) =>
    request<{ success: boolean; hierarchy: HierarchyNode }>(`/hierarchy/${institutionId}`, {
      method: 'PUT',
      body: JSON.stringify({ tree }),
    }),
  requestHierarchyChange: (institutionId: string, description: string) =>
    request<{ success: boolean; log: HierarchyChangeLog }>(`/hierarchy/${institutionId}/request`, {
      method: 'POST',
      body: JSON.stringify({ description }),
    }),
  getHierarchyLogs: (institutionId: string) =>
    request<HierarchyChangeLog[]>(`/hierarchy-logs/${institutionId}`),

  // Approval Flows
  getApprovalFlow: (institutionId?: string) =>
    request<ApprovalStepConfig[]>(`/approval-flows${institutionId ? `?institutionId=${institutionId}` : ''}`),
  updateApprovalFlow: (institutionId: string, steps: ApprovalStepConfig[]) =>
    request<{ success: boolean; steps: ApprovalStepConfig[] }>(`/approval-flows/${institutionId}`, {
      method: 'PUT',
      body: JSON.stringify({ steps }),
    }),

  // Templates
  getTemplates: () => request<WorkflowTemplate[]>('/templates'),
  createTemplate: (data: Partial<WorkflowTemplate>) =>
    request<WorkflowTemplate>('/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateTemplate: (id: string, data: Partial<WorkflowTemplate>) =>
    request<WorkflowTemplate>(`/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Template Nominations
  getNominations: () => request<TemplateNomination[]>('/template-nominations'),
  createNomination: (data: Partial<TemplateNomination>) =>
    request<TemplateNomination>('/template-nominations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  reviewNomination: (id: string, action: 'approved' | 'declined') =>
    request<{ success: boolean; nomination: TemplateNomination }>(`/template-nominations/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),

  // Requests
  getRequests: (params?: { status?: string; campusId?: string; query?: string }) => {
    const search = new URLSearchParams();
    if (params?.status) search.set('status', params.status);
    if (params?.campusId) search.set('campusId', params.campusId);
    if (params?.query) search.set('query', params.query);
    const qs = search.toString();
    return request<WorkflowRequest[]>(`/requests${qs ? `?${qs}` : ''}`);
  },
  getRequestById: (id: string) => request<WorkflowRequest>(`/requests/${id}`),
  submitRequest: (data: { templateId: string; formData: Record<string, any>; attachments?: string[] }) =>
    request<WorkflowRequest>('/requests', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  actionRequest: (id: string, action: string, remarks?: string) =>
    request<WorkflowRequest>(`/requests/${id}/action`, {
      method: 'POST',
      body: JSON.stringify({ action, remarks }),
    }),
  rerouteRequest: (id: string, newStages: string[], remarks?: string) =>
    request<WorkflowRequest>(`/requests/${id}/reroute`, {
      method: 'POST',
      body: JSON.stringify({ newStages, remarks }),
    }),

  // Profile & Proxy Delegation
  updateProfile: (data: Partial<User>) =>
    request<User>('/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  updateDelegation: (data: { enabled: boolean; proxyUserId?: string; proxyUserName?: string; startDate?: string; endDate?: string }) =>
    request<{ success: boolean; delegation: any }>('/profile/delegation', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Drafts
  getDrafts: () => request<SavedDraft[]>('/drafts'),
  saveDraft: (data: Partial<SavedDraft>) =>
    request<SavedDraft>('/drafts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteDraft: (id: string) =>
    request<{ success: boolean }>(`/drafts/${id}`, {
      method: 'DELETE',
    }),

  // Audit Logs
  getAuditLogs: () => request<AuditLogEntry[]>('/audit-logs'),

  // Analytics
  getAnalytics: () => request<{
    total: number;
    pending: number;
    inReview: number;
    approved: number;
    declined: number;
    campusBreakdown: Array<{ id: string; name: string; requests: number }>;
    stageBreakdown: Array<{ stage: string; count: number }>;
    institutionCount: number;
    activeTemplateCount: number;
  }>('/analytics'),
};
