import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import { useToast } from './Toast.tsx';
import { User } from '../../server/types.ts';
import {
  ShieldCheck,
  Building2,
  GitFork,
  FileCheck,
  Clock,
  ArrowRight,
  Server,
  KeyRound,
  Users,
  CheckCircle,
  AlertCircle,
  Database,
} from 'lucide-react';

interface Props {
  onLoginSuccess: (user: User, token: string) => void;
  onExploreTemplates?: () => void;
}

export const LandingPage: React.FC<Props> = ({ onLoginSuccess, onExploreTemplates }) => {
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Please enter both institutional email and password.');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);
      const res = await api.login(email, password);
      showToast(`Welcome, ${res.user.name}!`);
      onLoginSuccess(res.user, res.token);
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const quickFill = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMessage(null);
    showToast(`Credentials filled for ${demoEmail}`);
  };

  return (
    <div className="min-h-screen bg-[#f5f7fc] text-[#1b2635] flex flex-col font-sans">
      {/* Top Header */}
      <header className="h-16 border-b border-[#e2e8f0] bg-white/90 backdrop-blur-md sticky top-0 z-40 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#123b6d] text-white flex items-center justify-center font-bold font-serif text-xl shadow-sm">
            L
          </div>
          <div>
            <span className="font-bold text-lg text-[#123b6d] tracking-tight">Loopin</span>
            <span className="hidden sm:inline-block ml-2 text-[11px] text-slate-500 font-medium">
              Workflow & Institutional Request Management
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onExploreTemplates && (
            <button
              onClick={onExploreTemplates}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-[#123b6d] rounded-lg text-xs font-semibold transition-colors border border-slate-200"
            >
              ▧ Request Templates Directory
            </button>
          )}
          <a
            href="#login-section"
            className="px-4 py-2 bg-[#123b6d] text-white rounded-lg text-xs font-semibold hover:bg-[#0e2d50] transition-colors shadow-sm"
          >
            Portal Login
          </a>
        </div>
      </header>

      {/* Hero & Authentication Section */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-12 w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Presentation (7 Cols) */}
        <div className="lg:col-span-7 space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#edf3ff] border border-[#dce7f8] rounded-full text-xs font-semibold text-[#123b6d]">
              <ShieldCheck size={14} />
              Unified Institutional Request Governance
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-[#1b2635] leading-[1.15]">
              Streamlined requests, dynamic organograms, and multi-campus approvals.
            </h1>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-2xl">
              Loopin connects campuses under a single workflow engine. Staff submit requests, campus admins manage local directories, and super admins oversee organogram reporting lines, sequential approval routes, and immutable audit logs.
            </p>
          </div>

          {/* Core Feature Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 bg-white rounded-xl border border-[#e2e8f0] shadow-sm flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#edf3ff] text-[#123b6d] flex items-center justify-center shrink-0">
                <Building2 size={18} />
              </div>
              <div>
                <h2 className="text-xs font-bold text-slate-800">Multi-Institution Isolation</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Strict backend boundaries. Campus admins access records only for their assigned institution.
                </p>
              </div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-[#e2e8f0] shadow-sm flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#edf3ff] text-[#123b6d] flex items-center justify-center shrink-0">
                <GitFork size={18} />
              </div>
              <div>
                <h2 className="text-xs font-bold text-slate-800">Dynamic Tier 1–3 Organograms</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Super Admin drag-and-drop hierarchy updates reporting lines with full revision history.
                </p>
              </div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-[#e2e8f0] shadow-sm flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#edf3ff] text-[#123b6d] flex items-center justify-center shrink-0">
                <FileCheck size={18} />
              </div>
              <div>
                <h2 className="text-xs font-bold text-slate-800">Sequential Approval Routing</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Faculty submissions route through Department HoD, Dean, Finance, and Principal.
                </p>
              </div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-[#e2e8f0] shadow-sm flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#edf3ff] text-[#123b6d] flex items-center justify-center shrink-0">
                <Database size={18} />
              </div>
              <div>
                <h2 className="text-xs font-bold text-slate-800">Append-Only Audit Logs</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Every sign-in, approval, decline, and delegation is immutably logged with actor and timestamp.
                </p>
              </div>
            </div>
          </div>

          {/* Connected Campuses Strip */}
          <div className="p-4 bg-white/70 border border-[#e2e8f0] rounded-xl flex items-center justify-between text-xs text-slate-600">
            <span className="font-semibold text-slate-800">Connected Institutions:</span>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="px-2.5 py-1 bg-[#f0f4fa] rounded-md font-medium text-[#123b6d]">
                Sri Sairam Engineering College
              </span>
              <span className="px-2.5 py-1 bg-[#f0f4fa] rounded-md font-medium text-[#123b6d]">
                Sri Sairam Institute of Tech
              </span>
              <span className="px-2.5 py-1 bg-[#f0f4fa] rounded-md font-medium text-[#123b6d]">
                Sri Sairam Siddha Medical
              </span>
            </div>
          </div>
        </div>

        {/* Right Authentication Card (5 Cols) */}
        <div className="lg:col-span-5" id="login-section">
          <div className="bg-white rounded-2xl border border-[#dfe5ef] p-8 shadow-xl space-y-6">
            <div className="space-y-1">
              <div className="text-[10px] uppercase font-bold text-[#123b6d] tracking-wider">
                Institutional Access Portal
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                Sign in to Loopin
              </h2>
              <p className="text-xs text-slate-500">
                Role and institution are securely determined by trusted backend records.
              </p>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Institutional Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="e.g. superadmin@sairam.group or admin@sairam.edu.in"
                  className="w-full text-xs px-3.5 py-2.5 border border-[#dedbe2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#123b6d]/20 focus:border-[#123b6d] bg-white transition-all"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Password
                  </label>
                  <span className="text-[10px] text-slate-400">Standard demo passwords pre-configured</span>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full text-xs px-3.5 py-2.5 border border-[#dedbe2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#123b6d]/20 focus:border-[#123b6d] bg-white transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-[#123b6d] hover:bg-[#0e2d50] text-white rounded-lg text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Authenticating with Backend...
                  </>
                ) : (
                  <>
                    Sign In to Assigned Dashboard
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>

            {/* Interactive Demo Account Quick-Fillers */}
            <div className="pt-4 border-t border-slate-100 space-y-2.5">
              <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Instant Demo Testing Logins:
              </span>

              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => quickFill('superadmin@sairam.group', 'admin123')}
                  className="text-left p-2.5 rounded-lg border border-slate-200 hover:border-[#123b6d] hover:bg-[#edf3ff]/50 transition-all flex items-center justify-between group"
                >
                  <div>
                    <div className="text-xs font-bold text-[#123b6d] flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                      1. Super Admin (CEO / Central Owner)
                    </div>
                    <div className="text-[10px] text-slate-500">
                      superadmin@sairam.group · Full multi-campus & organogram control
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-[#123b6d] opacity-0 group-hover:opacity-100 transition-opacity">
                    Fill →
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => quickFill('admin@sairam.edu.in', 'admin123')}
                  className="text-left p-2.5 rounded-lg border border-slate-200 hover:border-[#123b6d] hover:bg-[#edf3ff]/50 transition-all flex items-center justify-between group"
                >
                  <div>
                    <div className="text-xs font-bold text-[#123b6d] flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                      2. Campus Admin (Engineering College)
                    </div>
                    <div className="text-[10px] text-slate-500">
                      admin@sairam.edu.in · Scoped to Sri Sairam Engineering College
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-[#123b6d] opacity-0 group-hover:opacity-100 transition-opacity">
                    Fill →
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => quickFill('senthil.nathan@sairam.edu.in', 'staff123')}
                  className="text-left p-2.5 rounded-lg border border-slate-200 hover:border-[#123b6d] hover:bg-[#edf3ff]/50 transition-all flex items-center justify-between group"
                >
                  <div>
                    <div className="text-xs font-bold text-[#123b6d] flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                      3. Faculty Staff (Dr. K. Senthil Nathan)
                    </div>
                    <div className="text-[10px] text-slate-500">
                      senthil.nathan@sairam.edu.in · My requests, dynamic forms, approvals inbox
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-[#123b6d] opacity-0 group-hover:opacity-100 transition-opacity">
                    Fill →
                  </span>
                </button>
              </div>
            </div>

            <div className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-2">
              <ShieldCheck size={12} className="text-emerald-600" />
              <span>Role spoofing prohibited. Server authorizes each endpoint.</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#e2e8f0] bg-white py-6 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#123b6d]">Loopin Platform</span>
            <span>· ISO 9001:2015 Compliant Institutional Workflows</span>
          </div>
          <div>
            Central Database Engine with Atomic File Persistence & Scoped RBAC.
          </div>
        </div>
      </footer>
    </div>
  );
};
