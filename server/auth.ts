import { Request, Response, NextFunction } from 'express';
import { dbManager } from './db.ts';
import { User, UserRole } from './types.ts';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export function generateToken(userId: string): string {
  const db = dbManager.getDb();
  const token = `lp_tok_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  db.sessions[token] = {
    userId,
    createdAt: now.toISOString(),
    expiresAt,
  };
  dbManager.save();
  return token;
}

export function revokeToken(token: string) {
  const db = dbManager.getDb();
  if (db.sessions[token]) {
    delete db.sessions[token];
    dbManager.save();
  }
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || (req.headers['x-auth-token'] as string);
  if (!authHeader) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
  const db = dbManager.getDb();
  const session = db.sessions[token];

  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }

  if (new Date(session.expiresAt) < new Date()) {
    delete db.sessions[token];
    dbManager.save();
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }

  const user = db.users.find(u => u.id === session.userId);
  if (!user) {
    return res.status(401).json({ error: 'User account not found.' });
  }

  if (user.status !== 'Active') {
    return res.status(403).json({ error: 'Your account is currently suspended or inactive. Contact the Super Admin.' });
  }

  req.user = user;
  next();
}

export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Permission denied. This action requires role: ${allowedRoles.join(' or ')}.`,
      });
    }
    next();
  };
}

export function enforceInstitutionScope(req: AuthenticatedRequest, targetInstitutionId: string | null | undefined): boolean {
  if (!req.user) return false;
  // Super Admin can access all institutions
  if (req.user.role === 'super_admin') return true;
  // For Admin or Staff, must match their assigned institution
  if (!targetInstitutionId || req.user.institutionId !== targetInstitutionId) {
    return false;
  }
  return true;
}
