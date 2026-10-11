import { Router, Response } from 'express';
import { dbManager } from './db.ts';
import {
  AuthenticatedRequest,
  generateToken,
  requireAuth,
  requireRoles,
  revokeToken,
} from './auth.ts';
import {
  WorkflowRequest,
  WorkflowTemplate,
  TemplateNomination,
  StaffManagerialDetail,
  User,
} from './types.ts';

const api = Router();

import { testSupabaseConnection, isSupabaseConfigured } from './supabase.ts';

// ==========================================
// 1. Health & Supabase Endpoints
// ==========================================
api.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    service: 'Loopin Institution Workflow Engine',
    supabaseConnected: isSupabaseConfigured(),
    timestamp: new Date().toISOString(),
  });
});

api.get('/supabase/status', async (_req, res) => {
  const status = await testSupabaseConnection();
  res.json({
    configured: isSupabaseConfigured(),
    ...status,
  });
});

api.post('/supabase/sync', requireAuth, requireRoles('super_admin'), async (req: AuthenticatedRequest, res) => {
  const result = await dbManager.syncToSupabase();
  if (result.success) {
    dbManager.logAudit({
      actorId: req.user!.id,
      actorName: req.user!.name,
      actorRole: req.user!.role,
      institutionId: null,
      institutionName: 'Central Organization',
      action: 'SUPABASE_SYNC',
      targetRecord: 'All Supabase tables & snapshot',
      details: 'Super Admin synced all database records to Supabase Cloud.',
    });
    res.json({ success: true, message: 'Database state pushed to Supabase successfully.' });
  } else {
    res.status(500).json({ success: false, error: result.error || 'Failed to sync to Supabase.' });
  }
});

api.post('/supabase/pull', requireAuth, requireRoles('super_admin'), async (req: AuthenticatedRequest, res) => {
  const pulled = await dbManager.pullFromSupabase();
  if (pulled) {
    res.json({ success: true, message: 'Hydrated state from Supabase Cloud successfully.' });
  } else {
    res.status(500).json({ success: false, error: 'Failed to pull from Supabase.' });
  }
});

api.post('/seed/reset', requireAuth, requireRoles('super_admin'), (req: AuthenticatedRequest, res) => {
  const db = dbManager.resetToSeed();
  dbManager.logAudit({
    actorId: req.user!.id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    institutionId: null,
    institutionName: 'Central Organization',
    action: 'DATABASE_SEED_RESET',
    targetRecord: 'All database tables',
    details: 'Database was reset to default reference state by Super Admin.',
  });
  res.json({ success: true, message: 'Database reset to initial seed data successfully.' });
});

// ==========================================
// 2. Authentication
// ==========================================
api.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Please provide both email and password.' });
  }

  const db = dbManager.getDb();
  const user = db.users.find(u => u.email.toLowerCase() === String(email).trim().toLowerCase());

  if (!user || user.passwordHash !== password) {
    return res.status(401).json({ error: 'Invalid email or password. Please check your credentials.' });
  }

  if (user.status !== 'Active') {
    return res.status(403).json({ error: 'This user account is suspended or inactive. Please contact the administrator.' });
  }

  const token = generateToken(user.id);

  dbManager.logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    institutionId: user.institutionId,
    institutionName: user.institutionName,
    action: 'USER_LOGIN',
    targetRecord: user.email,
    details: `User signed in successfully with role: ${user.role}.`,
  });

  const { passwordHash: _, ...safeUser } = user;
  res.json({
    token,
    user: safeUser,
  });
});

api.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  const { passwordHash: _, ...safeUser } = req.user!;
  res.json({ user: safeUser });
});

api.post('/auth/logout', requireAuth, (req: AuthenticatedRequest, res) => {
  const authHeader = req.headers.authorization || (req.headers['x-auth-token'] as string);
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader?.trim();
  if (token) {
    revokeToken(token);
  }

  dbManager.logAudit({
    actorId: req.user!.id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    institutionId: req.user!.institutionId,
    institutionName: req.user!.institutionName,
    action: 'USER_LOGOUT',
    targetRecord: req.user!.email,
    details: 'User logged out and session token was revoked.',
  });

  res.json({ success: true, message: 'Logged out successfully.' });
});

// ==========================================
// 3. Institutions
// ==========================================
api.get('/institutions', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = dbManager.getDb();
  if (req.user!.role === 'super_admin') {
    return res.json(db.institutions);
  }
  // For Admin or Staff, return their assigned institution or all for selection with context
  return res.json(db.institutions);
});

api.post('/institutions', requireAuth, requireRoles('super_admin'), (req: AuthenticatedRequest, res) => {
  const { name, category, city, email, phone, address } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Institution name is required.' });
  }

  const db = dbManager.getDb();
  const id = `inst-${Date.now()}`;
  const newInst = {
    id,
    name: name.trim(),
    category: category || 'Engineering',
    city: city || 'Chennai',
    email: email || `admin@${id}.edu.in`,
    phone: phone || '+91 44 2251 0000',
    address: address || 'Campus Address',
    requestCount: 0,
    status: 'Active' as const,
    createdAt: new Date().toISOString(),
  };

  db.institutions.push(newInst);

  // Initialize a separate organogram for this institution
  db.hierarchies[id] = {
    id: `h-${id}-prin`,
    name: 'Principal / Institutional Head',
    role: 'Institutional Executive · Tier 1',
    tier: 1,
    count: 1,
    children: [
      {
        id: `h-${id}-dean`,
        name: 'Dean Academics',
        role: 'Academic Leadership · Tier 2',
        tier: 2,
        count: 1,
        children: [
          {
            id: `h-${id}-hods`,
            name: 'Department Heads',
            role: 'Department Leadership · Tier 2',
            tier: 2,
            count: 6,
            children: [
              {
                id: `h-${id}-fac`,
                name: 'Faculty & Technical Staff',
                role: 'Local Teams · Tier 3 (Configurable)',
                tier: 3,
                count: 60,
              },
            ],
          },
        ],
      },
      {
        id: `h-${id}-admin`,
        name: 'Administrative Officer',
        role: 'Campus Operations · Tier 2',
        tier: 2,
        count: 1,
        children: [
          {
            id: `h-${id}-ops`,
            name: 'Office & Facilities Staff',
            role: 'Local Support · Tier 4',
            tier: 4,
            count: 18,
          },
        ],
      },
      {
        id: `h-${id}-fin`,
        name: 'Finance Officer',
        role: 'Financial Operations · Tier 2',
        tier: 2,
        count: 1,
      },
    ],
  };

  // Set default approval flow
  db.approvalFlows[id] = [...db.approvalFlows['global']];

  dbManager.save();

  dbManager.logAudit({
    actorId: req.user!.id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    institutionId: id,
    institutionName: newInst.name,
    action: 'INSTITUTION_CREATED',
    targetRecord: newInst.name,
    details: `Added new institution ${newInst.name} (${newInst.category}) to directory.`,
  });

  res.status(201).json(newInst);
});

api.put('/institutions/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const db = dbManager.getDb();
  const inst = db.institutions.find(i => i.id === id);
  if (!inst) {
    return res.status(404).json({ error: 'Institution not found.' });
  }

  // Authorization check: Super Admin or Admin assigned to this institution
  if (req.user!.role !== 'super_admin') {
    if (req.user!.role !== 'admin' || req.user!.institutionId !== id) {
      return res.status(403).json({ error: 'Permission denied: You can only edit your assigned institution records.' });
    }
  }

  const { email, phone, address, name, category, city } = req.body;
  if (email !== undefined) inst.email = email;
  if (phone !== undefined) inst.phone = phone;
  if (address !== undefined) inst.address = address;
  if (req.user!.role === 'super_admin') {
    if (name !== undefined) inst.name = name;
    if (category !== undefined) inst.category = category;
    if (city !== undefined) inst.city = city;
  }

  dbManager.save();

  dbManager.logAudit({
    actorId: req.user!.id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    institutionId: inst.id,
    institutionName: inst.name,
    action: 'INSTITUTION_UPDATED',
    targetRecord: inst.name,
    details: `Updated contact/profile details for ${inst.name}.`,
  });

  res.json(inst);
});

// ==========================================
// 4. Admin Accounts (Super Admin Only)
// ==========================================
api.get('/admins', requireAuth, requireRoles('super_admin'), (_req, res) => {
  const db = dbManager.getDb();
  const adminUsers = db.users.filter(u => u.role === 'admin').map(({ passwordHash: _, ...u }) => u);
  res.json(adminUsers);
});

api.post('/admins', requireAuth, requireRoles('super_admin'), (req: AuthenticatedRequest, res) => {
  const { name, email, institutionId, department } = req.body;
  if (!name || !email || !institutionId) {
    return res.status(400).json({ error: 'Name, email, and institution are required.' });
  }

  const db = dbManager.getDb();
  const cleanEmail = String(email).trim().toLowerCase();
  if (db.users.some(u => u.email.toLowerCase() === cleanEmail)) {
    return res.status(400).json({ error: 'A user account with this email already exists.' });
  }

  const institution = db.institutions.find(i => i.id === institutionId);
  if (!institution) {
    return res.status(400).json({ error: 'Assigned institution does not exist.' });
  }

  const newAdmin: User = {
    id: `usr-admin-${Date.now()}`,
    email: cleanEmail,
    passwordHash: 'admin123', // Standard default password
    name: name.trim(),
    role: 'admin',
    institutionId: institution.id,
    institutionName: institution.name,
    designation: 'Campus Administrator',
    department: department?.trim() || 'Administration',
    status: 'Active',
    createdAt: new Date().toISOString(),
  };

  db.users.push(newAdmin);
  dbManager.save();

  dbManager.logAudit({
    actorId: req.user!.id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    institutionId: institution.id,
    institutionName: institution.name,
    action: 'ADMIN_ACCOUNT_CREATED',
    targetRecord: newAdmin.name,
    details: `Assigned new Campus Admin ${newAdmin.name} (${newAdmin.email}) to ${institution.name}.`,
  });

  const { passwordHash: _, ...safeAdmin } = newAdmin;
  res.status(201).json(safeAdmin);
});

api.patch('/admins/:id/status', requireAuth, requireRoles('super_admin'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const db = dbManager.getDb();
  const target = db.users.find(u => u.id === id && u.role === 'admin');
  if (!target) {
    return res.status(404).json({ error: 'Admin account not found.' });
  }

  target.status = target.status === 'Active' ? 'Suspended' : 'Active';
  dbManager.save();

  dbManager.logAudit({
    actorId: req.user!.id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    institutionId: target.institutionId,
    institutionName: target.institutionName,
    action: 'ADMIN_STATUS_CHANGED',
    targetRecord: target.name,
    details: `Admin status set to ${target.status} for ${target.name}.`,
  });

  const { passwordHash: _, ...safeTarget } = target;
  res.json(safeTarget);
});

api.delete('/admins/:id', requireAuth, requireRoles('super_admin'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const db = dbManager.getDb();
  const index = db.users.findIndex(u => u.id === id && u.role === 'admin');
  if (index === -1) {
    return res.status(404).json({ error: 'Admin account not found.' });
  }

  const removed = db.users.splice(index, 1)[0];
  dbManager.save();

  dbManager.logAudit({
    actorId: req.user!.id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    institutionId: removed.institutionId,
    institutionName: removed.institutionName,
    action: 'ADMIN_ACCOUNT_REMOVED',
    targetRecord: removed.name,
    details: `Removed Admin assignment for ${removed.name} (${removed.institutionName}).`,
  });

  res.json({ success: true, message: 'Admin account removed.' });
});

// ==========================================
// 5. Staff Managerial Details (Admin manages for their campus)
// ==========================================
api.get('/staff', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = dbManager.getDb();
  const targetInstitution = (req.query.institutionId as string) || req.user!.institutionId;

  // Authorization check: Admin can only read staff of their own institution
  if (req.user!.role === 'admin' && req.user!.institutionId !== targetInstitution) {
    return res.status(403).json({ error: 'Access denied: You can only view staff from your assigned institution.' });
  }

  let list = db.staffDetails;
  if (targetInstitution) {
    list = list.filter(s => s.institutionId === targetInstitution);
  }
  res.json(list);
});

api.post('/staff', requireAuth, (req: AuthenticatedRequest, res) => {
  const { name, role, dept, manager, email, institutionId } = req.body;
  const targetInstId = institutionId || req.user!.institutionId;

  if (!name || !role || !dept) {
    return res.status(400).json({ error: 'Name, role, and department are required.' });
  }

  // Authorization check
  if (req.user!.role === 'admin' && req.user!.institutionId !== targetInstId) {
    return res.status(403).json({ error: 'Access denied: You cannot add staff to another institution.' });
  }
  if (req.user!.role === 'staff') {
    return res.status(403).json({ error: 'Permission denied: Staff members cannot modify staff directory.' });
  }

  const db = dbManager.getDb();
  const inst = db.institutions.find(i => i.id === targetInstId);
  const newStaff: StaffManagerialDetail = {
    id: `staff-${Date.now()}`,
    institutionId: targetInstId,
    name: name.trim(),
    role: role.trim(),
    dept: dept.trim(),
    manager: manager?.trim() || 'Not assigned',
    email: email?.trim() || '',
    updatedAt: new Date().toISOString(),
  };

  db.staffDetails.unshift(newStaff);
  dbManager.save();

  dbManager.logAudit({
    actorId: req.user!.id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    institutionId: targetInstId,
    institutionName: inst?.name || null,
    action: 'STAFF_RECORD_CREATED',
    targetRecord: `${newStaff.name} · ${newStaff.role}`,
    details: `Staff member added to ${inst?.name || 'institution'}.`,
  });

  res.status(201).json(newStaff);
});

api.put('/staff/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const db = dbManager.getDb();
  const staff = db.staffDetails.find(s => s.id === id);
  if (!staff) {
    return res.status(404).json({ error: 'Staff record not found.' });
  }

  if (req.user!.role === 'admin' && req.user!.institutionId !== staff.institutionId) {
    return res.status(403).json({ error: 'Access denied: You cannot edit staff of another institution.' });
  }
  if (req.user!.role === 'staff') {
    return res.status(403).json({ error: 'Permission denied: Staff members cannot edit staff directory.' });
  }

  const { name, role, dept, manager, email } = req.body;
  if (name !== undefined) staff.name = name.trim();
  if (role !== undefined) staff.role = role.trim();
  if (dept !== undefined) staff.dept = dept.trim();
  if (manager !== undefined) staff.manager = manager.trim();
  if (email !== undefined) staff.email = email.trim();
  staff.updatedAt = new Date().toISOString();

  dbManager.save();

  dbManager.logAudit({
    actorId: req.user!.id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    institutionId: staff.institutionId,
    institutionName: req.user!.institutionName,
    action: 'STAFF_RECORD_UPDATED',
    targetRecord: `${staff.name} · ${staff.role}`,
    details: `Updated managerial and reporting details.`,
  });

  res.json(staff);
});

api.delete('/staff/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const db = dbManager.getDb();
  const index = db.staffDetails.findIndex(s => s.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Staff record not found.' });
  }

  const staff = db.staffDetails[index];
  if (req.user!.role === 'admin' && req.user!.institutionId !== staff.institutionId) {
    return res.status(403).json({ error: 'Access denied: You cannot delete staff of another institution.' });
  }
  if (req.user!.role === 'staff') {
    return res.status(403).json({ error: 'Permission denied.' });
  }

  db.staffDetails.splice(index, 1);
  dbManager.save();

  dbManager.logAudit({
    actorId: req.user!.id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    institutionId: staff.institutionId,
    institutionName: req.user!.institutionName,
    action: 'STAFF_RECORD_DELETED',
    targetRecord: `${staff.name} · ${staff.role}`,
    details: `Deleted staff member from institutional directory.`,
  });

  res.json({ success: true, message: 'Staff record deleted.' });
});

// ==========================================
// 6. Hierarchy / Organogram
// ==========================================
api.get('/hierarchy/:institutionId', requireAuth, (req: AuthenticatedRequest, res) => {
  const { institutionId } = req.params;
  const db = dbManager.getDb();

  // Scope check: Admin/Staff can only request their institution's organogram
  if (req.user!.role !== 'super_admin' && req.user!.institutionId !== institutionId) {
    return res.status(403).json({ error: 'Access denied: You cannot view organograms for other institutions.' });
  }

  const hierarchy = db.hierarchies[institutionId];
  if (!hierarchy) {
    return res.status(404).json({ error: 'Hierarchy not found for this institution.' });
  }
  res.json(hierarchy);
});

api.put('/hierarchy/:institutionId', requireAuth, requireRoles('super_admin'), (req: AuthenticatedRequest, res) => {
  const { institutionId } = req.params;
  const { tree } = req.body;
  if (!tree) {
    return res.status(400).json({ error: 'Hierarchy tree payload is required.' });
  }

  const db = dbManager.getDb();
  const inst = db.institutions.find(i => i.id === institutionId);
  db.hierarchies[institutionId] = tree;

  const logEntry = {
    id: `hlog-${Date.now()}`,
    institutionId,
    institutionName: inst?.name || institutionId,
    action: 'Hierarchy organogram updated',
    detail: `Super Admin saved reporting hierarchy structure for ${inst?.name || institutionId}.`,
    status: 'Updated' as const,
    actorName: req.user!.name,
    time: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
  };

  db.hierarchyLogs.unshift(logEntry);
  dbManager.save();

  dbManager.logAudit({
    actorId: req.user!.id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    institutionId,
    institutionName: inst?.name || null,
    action: 'HIERARCHY_TREE_SAVED',
    targetRecord: inst?.name || institutionId,
    details: `Updated organizational hierarchy with drag-and-drop reporting lines and tier assignments.`,
  });

  res.json({ success: true, hierarchy: tree });
});

api.post('/hierarchy/:institutionId/request', requireAuth, (req: AuthenticatedRequest, res) => {
  const { institutionId } = req.params;
  const { description } = req.body;
  if (!description || !description.trim()) {
    return res.status(400).json({ error: 'Description is required.' });
  }

  const db = dbManager.getDb();
  const inst = db.institutions.find(i => i.id === institutionId);

  const logEntry = {
    id: `hlog-${Date.now()}`,
    institutionId,
    institutionName: inst?.name || institutionId,
    action: 'Hierarchy change requested',
    detail: `${description.trim()} · Requested by ${req.user!.name} (${req.user!.role})`,
    status: 'Requested' as const,
    actorName: req.user!.name,
    time: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
  };

  db.hierarchyLogs.unshift(logEntry);
  dbManager.save();

  dbManager.logAudit({
    actorId: req.user!.id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    institutionId,
    institutionName: inst?.name || null,
    action: 'HIERARCHY_CHANGE_REQUESTED',
    targetRecord: inst?.name || institutionId,
    details: description.trim(),
  });

  res.json({ success: true, log: logEntry });
});

api.get('/hierarchy-logs/:institutionId', requireAuth, (req: AuthenticatedRequest, res) => {
  const { institutionId } = req.params;
  const db = dbManager.getDb();
  if (req.user!.role !== 'super_admin' && req.user!.institutionId !== institutionId) {
    return res.status(403).json({ error: 'Access denied: Cannot view logs of other institutions.' });
  }

  const logs = db.hierarchyLogs.filter(l => l.institutionId === institutionId);
  res.json(logs);
});

// ==========================================
// 7. Approval Flows
// ==========================================
api.get('/approval-flows', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = dbManager.getDb();
  const instId = (req.query.institutionId as string) || req.user!.institutionId || 'global';
  const flow = db.approvalFlows[instId] || db.approvalFlows['global'];
  res.json(flow);
});

api.put('/approval-flows/:institutionId', requireAuth, requireRoles('super_admin'), (req: AuthenticatedRequest, res) => {
  const { institutionId } = req.params;
  const { steps } = req.body;
  if (!Array.isArray(steps) || !steps.length) {
    return res.status(400).json({ error: 'Steps must be a non-empty array.' });
  }

  const db = dbManager.getDb();
  db.approvalFlows[institutionId] = steps;
  dbManager.save();

  dbManager.logAudit({
    actorId: req.user!.id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    institutionId: institutionId === 'global' ? null : institutionId,
    institutionName: institutionId === 'global' ? 'Global Organization' : null,
    action: 'APPROVAL_FLOW_UPDATED',
    targetRecord: `Approval route: ${institutionId}`,
    details: `Configured ${steps.length} sequential approval stages.`,
  });

  res.json({ success: true, steps });
});

// ==========================================
// 8. Workflow Templates (SUPER ADMIN OWNED ONLY)
// ==========================================
api.get('/templates', (req: AuthenticatedRequest, res) => {
  const db = dbManager.getDb();
  let list = db.templates;

  const authHeader = req.headers.authorization || (req.headers['x-auth-token'] as string);
  if (authHeader) {
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
    const session = db.sessions[token];
    if (session) {
      const user = db.users.find(u => u.id === session.userId);
      if (user) {
        if (user.role !== 'super_admin') {
          const userInstId = user.institutionId;
          list = list.filter(t => {
            if (t.status !== 'Published') return false;
            if (t.eligibleInstitutions === 'all') return true;
            return userInstId && t.eligibleInstitutions.includes(userInstId);
          });
        }
        return res.json(list);
      }
    }
  }

  // Public/guest view: return all published templates
  const published = list.filter(t => t.status === 'Published');
  res.json(published);
});

// Strict check: Only Super Admin can create templates. Admins and Staff cannot!
api.post('/templates', requireAuth, requireRoles('super_admin'), (req: AuthenticatedRequest, res) => {
  const { title, category, code, turnaround, purpose, instructions, eligibleInstitutions, steps, attachments, fields, status } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Template title is required.' });
  }

  const db = dbManager.getDb();
  const newTpl: WorkflowTemplate = {
    id: `tpl-${Date.now()}`,
    title: title.trim(),
    category: category || 'Academic',
    code: code || `PT-${Math.floor(100 + Math.random() * 900)}`,
    turnaround: turnaround || '3–5 working days',
    purpose: purpose?.trim() || 'Institutional workflow application.',
    instructions: instructions?.trim() || '',
    eligibleInstitutions: eligibleInstitutions || 'all',
    steps: Array.isArray(steps) && steps.length ? steps : ['Department HoD', 'Dean Academics', 'Principal'],
    attachments: Array.isArray(attachments) ? attachments : ['Staff ID & Designation', 'Supporting document'],
    fields: Array.isArray(fields) && fields.length ? fields : [
      { name: 'Application justification', type: 'textarea', required: true },
    ],
    status: status === 'Draft' ? 'Draft' : 'Published',
    version: 'V1.0',
    createdBy: req.user!.id,
    createdAt: new Date().toISOString(),
  };

  db.templates.unshift(newTpl);
  dbManager.save();

  dbManager.logAudit({
    actorId: req.user!.id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    institutionId: null,
    institutionName: 'Central Organization',
    action: 'TEMPLATE_CREATED',
    targetRecord: newTpl.title,
    details: `Created new workflow template (${newTpl.status}) with ${newTpl.steps.length} approval stages.`,
  });

  res.status(201).json(newTpl);
});

api.put('/templates/:id', requireAuth, requireRoles('super_admin'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const db = dbManager.getDb();
  const tpl = db.templates.find(t => t.id === id);
  if (!tpl) {
    return res.status(404).json({ error: 'Template not found.' });
  }

  const { title, category, turnaround, purpose, instructions, eligibleInstitutions, steps, attachments, fields, status } = req.body;
  if (title !== undefined) tpl.title = title.trim();
  if (category !== undefined) tpl.category = category;
  if (turnaround !== undefined) tpl.turnaround = turnaround;
  if (purpose !== undefined) tpl.purpose = purpose;
  if (instructions !== undefined) tpl.instructions = instructions;
  if (eligibleInstitutions !== undefined) tpl.eligibleInstitutions = eligibleInstitutions;
  if (steps !== undefined) tpl.steps = steps;
  if (attachments !== undefined) tpl.attachments = attachments;
  if (fields !== undefined) tpl.fields = fields;
  if (status !== undefined) tpl.status = status;

  dbManager.save();

  dbManager.logAudit({
    actorId: req.user!.id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    institutionId: null,
    institutionName: 'Central Organization',
    action: 'TEMPLATE_UPDATED',
    targetRecord: tpl.title,
    details: `Updated template configuration (status: ${tpl.status}).`,
  });

  res.json(tpl);
});

// Template Nominations (Admins submit custom templates, Super Admin reviews)
api.get('/template-nominations', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = dbManager.getDb();
  if (req.user!.role === 'super_admin') {
    return res.json(db.templateNominations);
  }
  // Admin sees nominations from their campus
  const scoped = db.templateNominations.filter(n => n.institutionId === req.user!.institutionId);
  res.json(scoped);
});

api.post('/template-nominations', requireAuth, requireRoles('admin', 'super_admin'), (req: AuthenticatedRequest, res) => {
  const { title, category, uses, steps, fields } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Template title is required.' });
  }

  const db = dbManager.getDb();
  const nomination: TemplateNomination = {
    id: `nom-${Date.now()}`,
    title: title.trim(),
    category: category || 'Academic',
    uses: Number(uses) || 1,
    institution: req.user!.institutionName || 'Sri Sairam Engineering College',
    institutionId: req.user!.institutionId || 'inst-sairam-eng',
    submittedBy: req.user!.name,
    status: 'pending',
    submittedAt: new Date().toISOString(),
    details: {
      steps: Array.isArray(steps) ? steps : String(steps || '').split(/→|,|\n/).map(s => s.trim()).filter(Boolean),
      fields: Array.isArray(fields) ? fields : String(fields || '').split(/,|\n/).map(s => s.trim()).filter(Boolean),
    },
  };

  db.templateNominations.unshift(nomination);
  dbManager.save();

  dbManager.logAudit({
    actorId: req.user!.id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    institutionId: nomination.institutionId,
    institutionName: nomination.institution,
    action: 'TEMPLATE_NOMINATION_SUBMITTED',
    targetRecord: nomination.title,
    details: `Campus Admin submitted custom template for Super Admin shared review.`,
  });

  res.status(201).json(nomination);
});

api.post('/template-nominations/:id/review', requireAuth, requireRoles('super_admin'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { action } = req.body; // 'approved' | 'declined'

  if (action !== 'approved' && action !== 'declined') {
    return res.status(400).json({ error: 'Action must be "approved" or "declined".' });
  }

  const db = dbManager.getDb();
  const nomination = db.templateNominations.find(n => n.id === id);
  if (!nomination) {
    return res.status(404).json({ error: 'Nomination not found.' });
  }

  nomination.status = action;
  nomination.reviewedAt = new Date().toISOString();

  // If approved, create a corresponding published template for shared use!
  if (action === 'approved') {
    const existing = db.templates.find(t => t.title.toLowerCase() === nomination.title.toLowerCase());
    if (!existing) {
      const newTemplate: WorkflowTemplate = {
        id: `tpl-${Date.now()}`,
        title: nomination.title,
        category: nomination.category,
        code: `PT-SHR-${Math.floor(100 + Math.random() * 900)}`,
        turnaround: '4 working days',
        purpose: `Institutional approved template from ${nomination.institution}.`,
        instructions: 'Follow standard campus guidelines.',
        eligibleInstitutions: 'all',
        steps: nomination.details.steps.length ? nomination.details.steps : ['Department HoD', 'Dean Academics', 'Principal'],
        attachments: nomination.details.fields.length ? nomination.details.fields : ['Supporting document'],
        fields: nomination.details.fields.map(f => ({
          name: f,
          type: 'text',
          required: true,
        })),
        status: 'Published',
        version: 'V1.0',
        createdBy: req.user!.id,
        createdAt: new Date().toISOString(),
      };
      db.templates.unshift(newTemplate);
    }
  }

  dbManager.save();

  dbManager.logAudit({
    actorId: req.user!.id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    institutionId: nomination.institutionId,
    institutionName: nomination.institution,
    action: action === 'approved' ? 'TEMPLATE_NOMINATION_APPROVED' : 'TEMPLATE_NOMINATION_DECLINED',
    targetRecord: nomination.title,
    details: `Super Admin ${action} custom template nomination for organization shared library.`,
  });

  res.json({ success: true, nomination });
});

// ==========================================
// 9. Workflow Requests (Scoped by Role & Institution)
// ==========================================
api.get('/requests', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = dbManager.getDb();
  const { status, campusId, query } = req.query;

  let list = db.requests;

  // 1. Institution scope enforcement
  if (req.user!.role === 'admin') {
    // Admin is STRICTLY limited to their assigned institution
    list = list.filter(r => r.institutionId === req.user!.institutionId);
  } else if (req.user!.role === 'staff') {
    // Staff sees requests they submitted OR requests where they are the current approver
    const userId = req.user!.id;
    const userRole = req.user!.designation;
    list = list.filter(r => {
      const isApplicant = r.applicantId === userId;
      const isAssigned = r.institutionId === req.user!.institutionId &&
        (r.currentStageName.toLowerCase().includes(userRole.toLowerCase()) ||
         userRole.toLowerCase().includes('head of department') ||
         userRole.toLowerCase().includes('dean') ||
         userRole.toLowerCase().includes('finance') ||
         userRole.toLowerCase().includes('principal'));
      return isApplicant || isAssigned;
    });
  } else if (req.user!.role === 'super_admin') {
    // Super admin can see all, with optional campus filter
    if (campusId && campusId !== 'all') {
      list = list.filter(r => r.institutionId === campusId);
    }
  }

  // Status filter
  if (status && status !== 'all') {
    list = list.filter(r => r.status.toLowerCase() === String(status).toLowerCase());
  }

  // Search query
  if (query) {
    const q = String(query).toLowerCase();
    list = list.filter(r =>
      r.id.toLowerCase().includes(q) ||
      r.templateTitle.toLowerCase().includes(q) ||
      r.applicantName.toLowerCase().includes(q) ||
      r.institutionName.toLowerCase().includes(q)
    );
  }

  res.json(list);
});

api.get('/requests/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const db = dbManager.getDb();
  const request = db.requests.find(r => r.id === id);
  if (!request) {
    return res.status(404).json({ error: 'Request not found.' });
  }

  // Security check: Admin cannot see request of another institution
  if (req.user!.role === 'admin' && req.user!.institutionId !== request.institutionId) {
    return res.status(403).json({ error: 'Access denied: You cannot view requests from other institutions.' });
  }

  res.json(request);
});

api.post('/requests', requireAuth, (req: AuthenticatedRequest, res) => {
  const { templateId, formData, attachments } = req.body;
  if (!templateId) {
    return res.status(400).json({ error: 'Template ID is required.' });
  }

  const db = dbManager.getDb();
  const template = db.templates.find(t => t.id === templateId);
  if (!template) {
    return res.status(404).json({ error: 'Selected workflow template does not exist.' });
  }

  const user = req.user!;
  const userInstId = user.institutionId || 'inst-sairam-eng';
  const inst = db.institutions.find(i => i.id === userInstId);

  // Check template eligibility
  if (template.eligibleInstitutions !== 'all' && !template.eligibleInstitutions.includes(userInstId)) {
    return res.status(403).json({ error: 'This template is not available for your institution.' });
  }

  const id = `PT-${Math.floor(2100 + Math.random() * 800)}`;
  const stages = [
    {
      stepIndex: 0,
      name: 'Application Submission',
      role: 'Applicant',
      status: 'approved' as const,
      actedBy: user.name,
      actedAt: new Date().toISOString(),
    },
    ...template.steps.map((stepName, i) => ({
      stepIndex: i + 1,
      name: stepName,
      role: stepName,
      assignedRole: stepName,
      status: (i === 0 ? 'in_review' : 'pending') as 'in_review' | 'pending',
    })),
  ];

  const newRequest: WorkflowRequest = {
    id,
    templateId: template.id,
    templateTitle: template.title,
    category: template.category,
    institutionId: userInstId,
    institutionName: inst?.name || 'Sri Sairam Engineering College',
    applicantId: user.id,
    applicantName: user.name,
    applicantRole: user.designation,
    applicantDept: user.department,
    submittedAt: new Date().toISOString(),
    status: 'In review',
    currentStageIndex: 1,
    currentStageName: template.steps[0] || 'Department HoD',
    track: ['Submitted', ...template.steps],
    stages,
    formData: formData || {},
    attachments: attachments || [],
    history: [
      {
        action: 'Request submitted',
        actor: user.name,
        role: user.designation,
        time: new Date().toISOString(),
        remarks: 'Submitted and assigned to ' + (template.steps[0] || 'Reviewer'),
      },
    ],
  };

  db.requests.unshift(newRequest);
  if (inst) inst.requestCount++;
  dbManager.save();

  dbManager.logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    institutionId: userInstId,
    institutionName: inst?.name || null,
    action: 'REQUEST_SUBMITTED',
    targetRecord: `${newRequest.id} · ${newRequest.templateTitle}`,
    details: `Application submitted by ${user.name} and routed to ${newRequest.currentStageName}.`,
  });

  res.status(201).json(newRequest);
});

api.post('/requests/:id/action', requireAuth, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { action, remarks } = req.body; // 'Approved' | 'Clarification requested' | 'Declined' | 'Mark reviewed'

  const db = dbManager.getDb();
  const request = db.requests.find(r => r.id === id);
  if (!request) {
    return res.status(404).json({ error: 'Request not found.' });
  }

  // Institution permission check
  if (req.user!.role === 'admin' && req.user!.institutionId !== request.institutionId) {
    return res.status(403).json({ error: 'Access denied: You cannot act on requests from another institution.' });
  }

  const user = req.user!;
  const now = new Date().toISOString();

  if (action === 'Approved') {
    const currentStage = request.stages[request.currentStageIndex];
    if (currentStage) {
      currentStage.status = 'approved';
      currentStage.actedBy = user.name;
      currentStage.actedAt = now;
      currentStage.remarks = remarks || 'Approved';
    }

    // Advance to next stage or finish
    if (request.currentStageIndex < request.stages.length - 1) {
      request.currentStageIndex++;
      const nextStage = request.stages[request.currentStageIndex];
      nextStage.status = 'in_review';
      request.currentStageName = nextStage.name;
      request.status = 'In review';
    } else {
      request.status = 'Approved';
      request.currentStageName = 'Completed';
    }

    request.history.unshift({
      action: 'Approved & forwarded',
      actor: user.name,
      role: user.designation,
      time: now,
      remarks: remarks || 'Approved to proceed',
    });
  } else if (action === 'Clarification requested') {
    request.status = 'Clarification requested';
    request.history.unshift({
      action: 'Clarification requested',
      actor: user.name,
      role: user.designation,
      time: now,
      remarks: remarks || 'Clarification required from applicant',
    });
  } else if (action === 'Declined') {
    request.status = 'Declined';
    const currentStage = request.stages[request.currentStageIndex];
    if (currentStage) {
      currentStage.status = 'declined';
      currentStage.actedBy = user.name;
      currentStage.actedAt = now;
      currentStage.remarks = remarks || 'Declined';
    }
    request.history.unshift({
      action: 'Declined',
      actor: user.name,
      role: user.designation,
      time: now,
      remarks: remarks || 'Declined as per policy',
    });
  } else if (action === 'Mark reviewed') {
    request.status = 'In review';
    request.history.unshift({
      action: 'Marked reviewed by Campus Admin',
      actor: user.name,
      role: user.designation,
      time: now,
      remarks: remarks || 'Admin verified submission details.',
    });
  }

  dbManager.save();

  dbManager.logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    institutionId: request.institutionId,
    institutionName: request.institutionName,
    action: `REQUEST_${action.toUpperCase().replace(/\s+/g, '_')}`,
    targetRecord: request.id,
    details: `${action} by ${user.name} (${user.designation}). ${remarks ? `Remarks: ${remarks}` : ''}`,
  });

  res.json(request);
});

// Explicit reroute for in-progress requests (Super Admin only, requirement: "preserve their original approval history unless an authorized user explicitly re-routes them")
api.post('/requests/:id/reroute', requireAuth, requireRoles('super_admin'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { newStages, remarks } = req.body;

  const db = dbManager.getDb();
  const request = db.requests.find(r => r.id === id);
  if (!request) {
    return res.status(404).json({ error: 'Request not found.' });
  }

  if (!Array.isArray(newStages) || !newStages.length) {
    return res.status(400).json({ error: 'newStages must be a non-empty array of stage names.' });
  }

  const now = new Date().toISOString();
  request.track = ['Submitted', ...newStages];
  request.currentStageName = newStages[0];
  request.currentStageIndex = 1;
  request.stages = [
    request.stages[0], // Keep original submission
    ...newStages.map((name, i) => ({
      stepIndex: i + 1,
      name,
      role: name,
      assignedRole: name,
      status: (i === 0 ? 'in_review' : 'pending') as 'in_review' | 'pending',
    })),
  ];

  request.history.unshift({
    action: 'Explicitly re-routed by Super Admin',
    actor: req.user!.name,
    role: req.user!.designation,
    time: now,
    remarks: remarks || 'Approval path restructured due to institutional policy update.',
  });

  dbManager.save();

  dbManager.logAudit({
    actorId: req.user!.id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    institutionId: request.institutionId,
    institutionName: request.institutionName,
    action: 'REQUEST_EXPLICIT_REROUTE',
    targetRecord: request.id,
    details: `Re-routed request approval path. Remarks: ${remarks || 'None'}`,
  });

  res.json(request);
});

// ==========================================
// 10. Staff Profile, Drafts, and Out-of-Office Proxy Delegation
// ==========================================
api.put('/profile', requireAuth, (req: AuthenticatedRequest, res) => {
  const { name, department, designation, employeeCode, preferences } = req.body;
  const user = req.user!;
  const db = dbManager.getDb();
  const dbUser = db.users.find(u => u.id === user.id);
  if (!dbUser) return res.status(404).json({ error: 'User not found.' });

  if (name !== undefined) dbUser.name = name.trim();
  if (department !== undefined) dbUser.department = department.trim();
  if (designation !== undefined) dbUser.designation = designation.trim();
  if (employeeCode !== undefined) dbUser.employeeCode = employeeCode.trim();
  if (preferences) dbUser.preferences = { ...dbUser.preferences, ...preferences };

  dbManager.save();

  dbManager.logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    institutionId: user.institutionId,
    institutionName: user.institutionName,
    action: 'PROFILE_UPDATED',
    targetRecord: user.email,
    details: 'User updated personal profile & notification settings.',
  });

  const { passwordHash: _, ...safeUser } = dbUser;
  res.json(safeUser);
});

api.put('/profile/delegation', requireAuth, (req: AuthenticatedRequest, res) => {
  const { enabled, proxyUserId, proxyUserName, startDate, endDate } = req.body;
  const user = req.user!;
  const db = dbManager.getDb();
  const dbUser = db.users.find(u => u.id === user.id);
  if (!dbUser) return res.status(404).json({ error: 'User not found.' });

  dbUser.delegation = {
    enabled: Boolean(enabled),
    proxyUserId: proxyUserId || undefined,
    proxyUserName: proxyUserName || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  };

  dbManager.save();

  dbManager.logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    institutionId: user.institutionId,
    institutionName: user.institutionName,
    action: enabled ? 'PROXY_DELEGATION_ENABLED' : 'PROXY_DELEGATION_DISABLED',
    targetRecord: user.name,
    details: enabled
      ? `Proxy forwarding assigned to ${proxyUserName || 'Peer'} (${startDate} to ${endDate}).`
      : 'Out-of-office delegation disabled.',
  });

  res.json({ success: true, delegation: dbUser.delegation });
});

api.get('/drafts', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = dbManager.getDb();
  const userDrafts = db.drafts.filter(d => d.userId === req.user!.id);
  res.json(userDrafts);
});

api.post('/drafts', requireAuth, (req: AuthenticatedRequest, res) => {
  const { templateId, title, category, values } = req.body;
  const db = dbManager.getDb();
  const id = req.body.id || `draft-${Date.now()}`;

  const existingIndex = db.drafts.findIndex(d => d.id === id && d.userId === req.user!.id);
  const draftItem = {
    id,
    userId: req.user!.id,
    templateId,
    title: title || 'Draft Application',
    category: category || 'General',
    values: values || {},
    savedAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    db.drafts[existingIndex] = draftItem;
  } else {
    db.drafts.unshift(draftItem);
  }

  dbManager.save();
  res.json(draftItem);
});

api.delete('/drafts/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const db = dbManager.getDb();
  db.drafts = db.drafts.filter(d => !(d.id === id && d.userId === req.user!.id));
  dbManager.save();
  res.json({ success: true });
});

// ==========================================
// 11. Audit Logs (Append-Only, Scoped & Read-Only)
// ==========================================
api.get('/audit-logs', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = dbManager.getDb();
  let list = db.auditLogs;

  if (req.user!.role === 'admin') {
    // Admin sees only their institution's events (Strictly View-Only)
    list = list.filter(l => l.institutionId === req.user!.institutionId);
  } else if (req.user!.role === 'staff') {
    // Staff sees events related to their user
    list = list.filter(l => l.actorId === req.user!.id);
  }

  res.json(list.slice(0, 100));
});

// ==========================================
// 12. Organization Analytics
// ==========================================
api.get('/analytics', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = dbManager.getDb();
  const user = req.user!;

  const requests = user.role === 'admin'
    ? db.requests.filter(r => r.institutionId === user.institutionId)
    : db.requests;

  const total = requests.length;
  const pending = requests.filter(r => r.status === 'Pending').length;
  const inReview = requests.filter(r => r.status === 'In review').length;
  const approved = requests.filter(r => r.status === 'Approved').length;
  const declined = requests.filter(r => r.status === 'Declined').length;

  const campusBreakdown = db.institutions.map(inst => ({
    id: inst.id,
    name: inst.name,
    requests: db.requests.filter(r => r.institutionId === inst.id).length,
  }));

  const stageBreakdown = [
    { stage: 'Department HoD', count: requests.filter(r => r.currentStageName.includes('HoD') || r.currentStageName.includes('Department')).length },
    { stage: 'Dean Review', count: requests.filter(r => r.currentStageName.includes('Dean')).length },
    { stage: 'Finance Officer', count: requests.filter(r => r.currentStageName.includes('Finance')).length },
    { stage: 'Principal Approval', count: requests.filter(r => r.currentStageName.includes('Principal')).length },
  ];

  res.json({
    total,
    pending,
    inReview,
    approved,
    declined,
    campusBreakdown,
    stageBreakdown,
    institutionCount: db.institutions.length,
    activeTemplateCount: db.templates.filter(t => t.status === 'Published').length,
  });
});

export default api;
