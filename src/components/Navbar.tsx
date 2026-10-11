import React from 'react';
import { User } from '../../server/types.ts';
import { LogOut, RotateCcw, Shield, Building, UserCheck } from 'lucide-react';

interface Props {
  user: User;
  onLogout: () => void;
  onFastSwitch: (role: 'super_admin' | 'admin' | 'staff') => void;
  onResetDatabase: () => void;
}

export const Navbar: React.FC<Props> = ({
  user,
  onLogout,
  onFastSwitch,
  onResetDatabase,
}) => {
  const roleLabel =
    user.role === 'super_admin'
      ? 'Super Admin'
      : user.role === 'admin'
      ? 'Campus Admin'
      : 'Staff / Faculty';

  const roleColor =
    user.role === 'super_admin'
      ? 'bg-purple-100 text-purple-800 border-purple-200'
      : user.role === 'admin'
      ? 'bg-blue-100 text-[#123b6d] border-blue-200'
      : 'bg-emerald-100 text-emerald-800 border-emerald-200';

  return (
    <header className="h-14 bg-white/95 backdrop-blur border-b border-[#e2e8f0] sticky top-0 z-40 px-4 sm:px-6 flex items-center justify-between shadow-xs">
      {/* Brand & Context */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#123b6d] text-white flex items-center justify-center font-serif font-bold text-lg">
          L
        </div>
        <div>
          <span className="font-bold text-base text-[#123b6d] tracking-tight">Loopin</span>
          <span className="hidden md:inline-block text-xs text-slate-400 mx-2">/</span>
          <span className="hidden md:inline-block text-xs font-medium text-slate-600">
            {user.institutionName || 'Organization-wide Central Governance'}
          </span>
        </div>
      </div>

      {/* Role Badge & Quick Switcher */}
      <div className="flex items-center gap-3">
        {/* Fast Switcher for Reviewers & Testing */}
        <div className="hidden lg:flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-[11px]">
          <span className="text-[10px] uppercase font-bold text-slate-400 px-2 tracking-wider">
            Switch:
          </span>
          <button
            type="button"
            onClick={() => onFastSwitch('super_admin')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              user.role === 'super_admin'
                ? 'bg-white text-[#123b6d] shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Super Admin
          </button>
          <button
            type="button"
            onClick={() => onFastSwitch('admin')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              user.role === 'admin'
                ? 'bg-white text-[#123b6d] shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Admin
          </button>
          <button
            type="button"
            onClick={() => onFastSwitch('staff')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              user.role === 'staff'
                ? 'bg-white text-[#123b6d] shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Staff
          </button>
        </div>

        {/* User Card */}
        <div className="flex items-center gap-2.5 pl-2 sm:border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-[#edf3ff] text-[#123b6d] flex items-center justify-center font-bold text-xs border border-[#dce8f9]">
            {user.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-xs font-bold text-slate-900 leading-tight">
              {user.name}
            </div>
            <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
              <span className={`inline-block px-1.5 py-0.2 rounded border font-semibold text-[9px] ${roleColor}`}>
                {roleLabel}
              </span>
              <span>· {user.designation}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 ml-2">
          {user.role === 'super_admin' && (
            <button
              onClick={onResetDatabase}
              title="Reset Database to Clean Reference Seed"
              className="p-1.5 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition-colors"
            >
              <RotateCcw size={16} />
            </button>
          )}

          <button
            onClick={onLogout}
            title="Sign out of Loopin"
            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50 transition-colors flex items-center gap-1 text-xs font-medium"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
};
