import { getSupabaseClient, isSupabaseConfigured } from './supabase.ts';
import { DatabaseSchema, getDefaultSeedData } from './db.ts';
import { WorkflowRequest } from './types.ts';

export { isSupabaseConfigured };

/**
 * Pushes the full in-memory or local database state to Supabase.
 * Uses both relational table upserts and unified snapshot persistence for maximum durability on serverless / Vercel.
 */
export async function pushDatabaseToSupabase(db: DatabaseSchema): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase is not configured.' };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase client unavailable.' };
  }

  try {
    // 1. Persist the full database state snapshot in loopin_app_state (atomic on serverless platforms like Vercel)
    try {
      await client
        .from('loopin_app_state')
        .upsert({
          key: 'current_db_snapshot',
          value: db,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });
    } catch (stateErr: any) {
      console.warn('[Supabase Sync] Warning while saving snapshot to loopin_app_state:', stateErr?.message);
    }

    // 2. Sync core tables where available
    // Institutions
    if (db.institutions?.length > 0) {
      try {
        const institutionsPayload = db.institutions.map(inst => ({
          id: inst.id,
          name: inst.name,
          category: inst.category,
          city: inst.city,
          email: inst.email,
          phone: inst.phone,
          address: inst.address,
          request_count: inst.requestCount,
          status: inst.status,
          created_at: inst.createdAt,
        }));
        await client.from('loopin_institutions').upsert(institutionsPayload, { onConflict: 'id' });
      } catch (err: any) {
        console.warn('[Supabase Sync] Notice for loopin_institutions sync:', err?.message);
      }
    }

    // Users
    if (db.users?.length > 0) {
      try {
        const usersPayload = db.users.map(u => ({
          id: u.id,
          email: u.email,
          password_hash: u.passwordHash,
          name: u.name,
          role: u.role,
          institution_id: u.institutionId,
          institution_name: u.institutionName,
          designation: u.designation,
          department: u.department,
          employee_code: u.employeeCode,
          manager: u.manager,
          status: u.status,
          delegation: u.delegation,
          preferences: u.preferences,
          created_at: u.createdAt,
        }));
        await client.from('loopin_users').upsert(usersPayload, { onConflict: 'id' });
      } catch (err: any) {
        console.warn('[Supabase Sync] Notice for loopin_users sync:', err?.message);
      }
    }

    // Templates
    if (db.templates?.length > 0) {
      try {
        const templatesPayload = db.templates.map(t => ({
          id: t.id,
          title: t.title,
          category: t.category,
          code: t.code,
          turnaround: t.turnaround,
          purpose: t.purpose,
          instructions: t.instructions,
          eligible_institutions: t.eligibleInstitutions,
          steps: t.steps,
          attachments: t.attachments,
          fields: t.fields,
          status: t.status,
          version: t.version,
          created_by: t.createdBy,
          created_at: t.createdAt,
        }));
        await client.from('loopin_templates').upsert(templatesPayload, { onConflict: 'id' });
      } catch (err: any) {
        console.warn('[Supabase Sync] Notice for loopin_templates sync:', err?.message);
      }
    }

    // Requests
    if (db.requests?.length > 0) {
      try {
        const requestsPayload = db.requests.map(r => ({
          id: r.id,
          template_id: r.templateId,
          template_title: r.templateTitle,
          category: r.category,
          institution_id: r.institutionId,
          institution_name: r.institutionName,
          applicant_id: r.applicantId,
          applicant_name: r.applicantName,
          applicant_role: r.applicantRole,
          applicant_dept: r.applicantDept,
          submitted_at: r.submittedAt,
          status: r.status,
          current_stage_index: r.currentStageIndex,
          current_stage_name: r.currentStageName,
          track: r.track,
          stages: r.stages,
          form_data: r.formData,
          attachments: r.attachments,
          history: r.history,
        }));
        await client.from('loopin_requests').upsert(requestsPayload, { onConflict: 'id' });
      } catch (err: any) {
        console.warn('[Supabase Sync] Notice for loopin_requests sync:', err?.message);
      }
    }

    // Hierarchies
    if (db.hierarchies && Object.keys(db.hierarchies).length > 0) {
      try {
        const hierPayload = Object.entries(db.hierarchies).map(([instId, tree]) => ({
          institution_id: instId,
          tree,
          updated_at: new Date().toISOString(),
        }));
        await client.from('loopin_hierarchies').upsert(hierPayload, { onConflict: 'institution_id' });
      } catch (err: any) {
        console.warn('[Supabase Sync] Notice for loopin_hierarchies sync:', err?.message);
      }
    }

    // Approval Flows
    if (db.approvalFlows && Object.keys(db.approvalFlows).length > 0) {
      try {
        const flowsPayload = Object.entries(db.approvalFlows).map(([instId, steps]) => ({
          institution_id: instId,
          steps,
          updated_at: new Date().toISOString(),
        }));
        await client.from('loopin_approval_flows').upsert(flowsPayload, { onConflict: 'institution_id' });
      } catch (err: any) {
        console.warn('[Supabase Sync] Notice for loopin_approval_flows sync:', err?.message);
      }
    }

    console.log('[Supabase Sync] Successfully persisted state to Supabase.');
    return { success: true };
  } catch (err: any) {
    console.error('[Supabase Sync] Error persisting state to Supabase:', err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Loads database state from Supabase if available.
 */
export async function pullDatabaseFromSupabase(): Promise<DatabaseSchema | null> {
  if (!isSupabaseConfigured()) return null;
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    // 1. Try fetching the full snapshot from loopin_app_state first
    const { data: snapshotData } = await client
      .from('loopin_app_state')
      .select('value')
      .eq('key', 'current_db_snapshot')
      .maybeSingle();

    if (snapshotData && snapshotData.value) {
      const defaults = getDefaultSeedData();
      const val = snapshotData.value as Partial<DatabaseSchema>;
      console.log('[Supabase Sync] Restored state from Supabase snapshot.');
      return {
        ...defaults,
        ...val,
        hierarchies: { ...defaults.hierarchies, ...(val.hierarchies || {}) },
        approvalFlows: { ...defaults.approvalFlows, ...(val.approvalFlows || {}) },
        sessions: val.sessions || {},
      };
    }

    // 2. If table snapshot is not yet created, check if individual tables exist
    const { data: instData } = await client.from('loopin_institutions').select('*').limit(50);
    const { data: userData } = await client.from('loopin_users').select('*').limit(100);
    const { data: reqData } = await client.from('loopin_requests').select('*').limit(100);

    if ((instData && instData.length > 0) || (userData && userData.length > 0)) {
      const defaults = getDefaultSeedData();
      console.log(`[Supabase Sync] Hydrated from individual Supabase tables (${instData?.length || 0} institutions, ${userData?.length || 0} users).`);

      const requests: WorkflowRequest[] = reqData && reqData.length > 0 ? reqData.map((r: any) => ({
        id: r.id,
        templateId: r.template_id,
        templateTitle: r.template_title,
        category: r.category,
        institutionId: r.institution_id,
        institutionName: r.institution_name,
        applicantId: r.applicant_id,
        applicantName: r.applicant_name,
        applicantRole: r.applicant_role,
        applicantDept: r.applicant_dept,
        submittedAt: r.submitted_at,
        status: r.status,
        currentStageIndex: r.current_stage_index,
        currentStageName: r.current_stage_name,
        track: r.track || [],
        stages: r.stages || [],
        formData: r.form_data || {},
        attachments: r.attachments || [],
        history: r.history || [],
      })) : defaults.requests;

      return {
        ...defaults,
        institutions: instData && instData.length > 0 ? instData.map((i: any) => ({
          id: i.id,
          name: i.name,
          category: i.category,
          city: i.city,
          email: i.email,
          phone: i.phone,
          address: i.address,
          requestCount: i.request_count || 0,
          status: i.status || 'Active',
          createdAt: i.created_at,
        })) : defaults.institutions,
        users: userData && userData.length > 0 ? userData.map((u: any) => ({
          id: u.id,
          email: u.email,
          passwordHash: u.password_hash,
          name: u.name,
          role: u.role,
          institutionId: u.institution_id,
          institutionName: u.institution_name,
          designation: u.designation,
          department: u.department,
          employeeCode: u.employee_code,
          manager: u.manager,
          status: u.status,
          delegation: u.delegation,
          preferences: u.preferences,
          createdAt: u.created_at,
        })) : defaults.users,
        requests,
      };
    }
  } catch (err) {
    console.warn('[Supabase Sync] Could not load state from Supabase tables (falling back to disk/seed):', err);
  }

  return null;
}
