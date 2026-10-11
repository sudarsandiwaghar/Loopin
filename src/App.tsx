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

import { TemplatesLandingPage } from './components/TemplatesLandingPage.tsx';

function AppContent() {
  const { showToast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isArchitectureGuideOpen, setIsArchitectureGuideOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'templates'>('dashboard');

  // Sync hash routing (#templates)
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#templates') {
        setCurrentView('templates');
      } else {
        setCurrentView('dashboard');
      }
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateToTemplates = () => {
    window.location.hash = '#templates';
    setCurrentView('templates');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToDashboard = () => {
    window.location.hash = '';
    setCurrentView('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Check stored session on mount with safety timeout
  useEffect(() => {
    let isMounted = true;
    const safetyTimer = setTimeout(() => {
      if (isMounted) setIsInitializing(false);
    }, 2000);

    const token = getStoredToken();
    if (token) {
      api.getMe()
        .then(res => {
          if (isMounted) setUser(res.user);
        })
        .catch(err => {
          console.warn('[Auth] Stored session invalid, resetting token:', err);
          setStoredToken(null);
        })
        .finally(() => {
          if (isMounted) setIsInitializing(false);
          clearTimeout(safetyTimer);
        });
    } else {
      setIsInitializing(false);
      clearTimeout(safetyTimer);
    }

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
    };
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
      setCurrentView('dashboard');
      window.location.hash = '';
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
      <div className="min-h-screen bg-[#f5f7fc] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="w-12 h-12 rounded-xl bg-[#123b6d] text-white flex items-center justify-center font-bold text-xl shadow-md tracking-tight">
            L
          </div>
          <div className="w-8 h-8 border-[3px] border-[#123b6d]/20 border-t-[#123b6d] rounded-full animate-spin"></div>
          <div>
            <div className="text-sm font-semibold text-slate-800">Initializing Loopin Engine</div>
            <div className="text-xs text-slate-500 mt-0.5">Connecting to institutional workflow services...</div>
          </div>
          <button
            onClick={() => setIsInitializing(false)}
            className="text-[11px] text-[#123b6d] hover:underline font-medium mt-1 cursor-pointer"
          >
            Continue to Portal &rarr;
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-[#3F4A5A] flex flex-col font-sans">
      {!user ? (
        currentView === 'templates' ? (
          <TemplatesLandingPage
            currentUser={null}
            onBack={navigateToDashboard}
            onFastSwitch={handleFastSwitch}
            onLogout={handleLogout}
          />
        ) : (
          <LandingPage
            onLoginSuccess={handleLoginSuccess}
            onExploreTemplates={navigateToTemplates}
          />
        )
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

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[Loopin ErrorBoundary]', error, errorInfo);
  }

  handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // ignore
    }
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f5f7fc] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold text-xl mx-auto">
              !
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Application Notice</h2>
              <p className="text-xs text-slate-500 mt-1">
                A client-side state issue was detected. You can instantly restore default settings below.
              </p>
            </div>
            {this.state.error && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-left text-[11px] font-mono text-slate-700 overflow-x-auto max-h-24">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-4 py-2 bg-[#123b6d] text-white rounded-lg text-xs font-semibold hover:bg-[#0e2d50] cursor-pointer"
              >
                Reload Page
              </button>
              <button
                onClick={this.handleReset}
                className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200 cursor-pointer"
              >
                Reset Session
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ErrorBoundary>
  );
}
