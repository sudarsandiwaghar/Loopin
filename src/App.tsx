import React, { useState, useEffect } from 'react';
import { api, getStoredToken, setStoredToken } from './services/api.ts';
import { ToastProvider, useToast } from './components/Toast.tsx';
import { Navbar } from './components/Navbar.tsx';
import { LandingPage } from './components/LandingPage.tsx';
import { SuperAdminDashboard } from './components/SuperAdminDashboard.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { StaffDashboard } from './components/StaffDashboard.tsx';
import { User } from '../server/types.ts';
import { HelpCircle, Database, Shield, Server, Terminal, CheckCircle2, X } from 'lucide-react';

function AppContent() {
  const { showToast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isArchitectureGuideOpen, setIsArchitectureGuideOpen] = useState(false);

  // Check stored session on mount
  useEffect(() => {
    const token = getStoredToken();
    if (token) {
      api.getMe()
        .then(res => {
          setUser(res.user);
        })
        .catch(err => {
          console.warn('[Auth] Stored session invalid, resetting token:', err);
          setStoredToken(null);
        })
        .finally(() => {
          setIsInitializing(false);
        });
    } else {
      setIsInitializing(false);
    }
  }, []);

  const handleLoginSuccess = (authenticatedUser: User, token: string) => {
    setStoredToken(token);
    setUser(authenticatedUser);
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (err) {
      console.warn('Logout error', err);
    } finally {
      setStoredToken(null);
      setUser(null);
      showToast('Signed out of Loopin.');
    }
  };

  // Fast switch for evaluators and reviewers: calls actual backend authentication!
  const handleFastSwitch = async (targetRole: 'super_admin' | 'admin' | 'staff') => {
    const credentials = {
      super_admin: { email: 'superadmin@sairam.group', pass: 'admin123' },
      admin: { email: 'admin@sairam.edu.in', pass: 'admin123' },
      staff: { email: 'senthil.nathan@sairam.edu.in', pass: 'staff123' },
    };

    try {
      const { email, pass } = credentials[targetRole];
      const res = await api.login(email, pass);
      setStoredToken(res.token);
      setUser(res.user);
      showToast(`Switched session to ${res.user.name} (${targetRole.replace('_', ' ').toUpperCase()})`);
    } catch (err: any) {
      showToast(err.message || 'Failed to switch role.');
    }
  };

  const handleResetDatabase = async () => {
    if (!confirm('Reset database to clean initial seed data? All sample records will be restored.')) return;
    try {
      const res = await api.resetSeed();
      showToast(res.message);
      // Refresh current user
      const me = await api.getMe();
      setUser(me.user);
    } catch (err: any) {
      showToast(err.message || 'Failed to reset database.');
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#f5f7fc] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-3 border-[#123b6d]/30 border-t-[#123b6d] rounded-full animate-spin"></div>
          <div className="text-xs font-semibold text-slate-500">Connecting to Loopin Workflow Engine...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7fc] text-[#1b2635] flex flex-col font-sans">
      {!user ? (
        <LandingPage onLoginSuccess={handleLoginSuccess} />
      ) : (
        <main className="flex-1">
          {user.role === 'super_admin' && (
            <SuperAdminDashboard
              currentUser={user}
              onLogout={handleLogout}
              onFastSwitch={handleFastSwitch}
              onResetDatabase={handleResetDatabase}
            />
          )}
          {user.role === 'admin' && (
            <AdminDashboard
              currentUser={user}
              onLogout={handleLogout}
              onFastSwitch={handleFastSwitch}
            />
          )}
          {user.role === 'staff' && (
            <StaffDashboard
              currentUser={user}
              onLogout={handleLogout}
              onFastSwitch={handleFastSwitch}
            />
          )}
        </main>
      )}

      {/* Floating System Architecture & Setup Guide Button */}
      <button
        onClick={() => setIsArchitectureGuideOpen(true)}
        className="fixed bottom-4 right-4 z-40 px-3 py-2 bg-white/95 hover:bg-white text-slate-700 border border-slate-200 rounded-full shadow-lg text-xs font-semibold flex items-center gap-1.5 transition-all hover:shadow-xl backdrop-blur-sm"
      >
        <HelpCircle size={15} className="text-[#123b6d]" />
        <span>Setup & Architecture Guide</span>
      </button>

      {/* Architecture & Deployment Guide Modal */}
      {isArchitectureGuideOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[88vh] overflow-y-auto p-6 sm:p-8 space-y-6">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="text-[10px] uppercase font-bold text-[#123b6d] tracking-wider flex items-center gap-1.5">
                  <Shield size={13} />
                  Production Implementation & Setup Guide
                </div>
                <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                  Loopin Backend Architecture & Secure Deployment
                </h2>
              </div>
              <button
                onClick={() => setIsArchitectureGuideOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
              {/* Section 1: Overview */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Server size={16} className="text-[#123b6d]" />
                  1. Full-Stack Setup & Architecture
                </h3>
                <p>
                  Loopin is built with an Express.js backend coupled to Vite in dev and static asset serving in production.
                  Unlike browser localStorage prototypes, all users, institutions, hierarchy nodes, approval steps, requests, and audit logs reside in persistent backend storage on disk (<code>./data/loopin_storage.json</code>) with atomic write operations.
                </p>
              </div>

              {/* Section 2: Environment Variables */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Terminal size={16} className="text-[#123b6d]" />
                  2. Required Environment Variables
                </h3>
                <div className="bg-slate-900 text-slate-100 p-3 rounded-lg font-mono text-[11px] space-y-1">
                  <div>PORT=3000                 <span className="text-slate-400"># Port for dev & production servers</span></div>
                  <div>NODE_ENV=development      <span className="text-slate-400"># Set to 'production' for compiled build</span></div>
                  <div>APP_URL=http://localhost:3000 <span className="text-slate-400"># Base URL for self-referential links</span></div>
                </div>
              </div>

              {/* Section 3: Database Seeding & First Super Admin */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Database size={16} className="text-[#123b6d]" />
                  3. Creating the First Super Admin & Database Seeding
                </h3>
                <p>
                  To bootstrap or re-seed the institutional database with the initial CEO / Principal Super Admin account, connected colleges, standard approval routes, and baseline organograms, run:
                </p>
                <div className="bg-slate-900 text-emerald-400 p-3 rounded-lg font-mono text-[11px]">
                  npm run seed   # or: npx tsx scripts/seed.ts
                </div>
                <div className="pt-1">
                  <b>Initial Super Admin Account:</b><br />
                  Email: <code className="bg-white px-1.5 py-0.5 rounded border">superadmin@sairam.group</code> | Password: <code className="bg-white px-1.5 py-0.5 rounded border">admin123</code>
                </div>
                <div className="pt-1">
                  <b>First Campus Admin (Engineering):</b><br />
                  Email: <code className="bg-white px-1.5 py-0.5 rounded border">admin@sairam.edu.in</code> | Password: <code className="bg-white px-1.5 py-0.5 rounded border">admin123</code>
                </div>
                <div className="pt-1">
                  <b>Faculty Staff (Applicant / Approver):</b><br />
                  Email: <code className="bg-white px-1.5 py-0.5 rounded border">senthil.nathan@sairam.edu.in</code> | Password: <code className="bg-white px-1.5 py-0.5 rounded border">staff123</code>
                </div>
              </div>

              {/* Section 4: Security & Institution Isolation */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  4. Institution Scoping & Access Control Rules
                </h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li><b>Super Admin:</b> Organization-wide scope. Manages connected institutions, assigns admins, configures group approval flows, and maintains organograms.</li>
                  <li><b>Campus Admin:</b> Enforced strictly on every read/write. Cannot view or edit staff, requests, or records from another college. Template creation is blocked (403 Forbidden).</li>
                  <li><b>Staff:</b> Can only submit requests with published templates eligible for their institution, and review tasks assigned to their authority.</li>
                  <li><b>Audit Logging:</b> Append-only at the backend level. Admin log is strictly view-only.</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsArchitectureGuideOpen(false)}
                className="px-4 py-2 bg-[#123b6d] text-white font-semibold rounded-lg text-xs hover:bg-[#0e2d50]"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
