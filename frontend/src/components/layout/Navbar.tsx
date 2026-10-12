'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Shield, Bell, Activity, LogOut } from 'lucide-react';

export function Navbar() {
  const { user, logout } = useAuth();
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const timeStr = now.toTimeString().split(' ')[0];
      setCurrentTime(`${dateStr}  ${timeStr}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'BW';

  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 flex items-center justify-between px-6">
      {/* Brand & Subtitle */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20 group-hover:bg-blue-700 transition-colors">
            <div className="relative">
              <Shield className="w-6 h-6 fill-blue-600 text-white" />
              <span className="absolute inset-0 flex items-center justify-center text-white font-extrabold text-sm leading-none">+</span>
            </div>
          </div>
          <div>
            <h1 className="text-slate-900 font-bold tracking-tight text-base sm:text-lg leading-tight">
              Pharmaceutical Shipment Protection
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
              AI Powered Cold Chain Monitoring & Automated Response
            </p>
          </div>
        </Link>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* System Online Badge with Pulse & ECG wave */}
        <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold shadow-xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>System Online</span>
          <Activity className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
        </div>

        {/* Live Date / Time */}
        <div className="hidden lg:block text-xs font-medium text-slate-600 pl-3 border-l border-slate-200">
          {currentTime || 'Oct 10, 2024  14:32:18'}
        </div>

        {/* Notifications with Red Badge */}
        <Link
          href="/alerts"
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors relative"
          title="Alerts & Events"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white"></span>
        </Link>

        {/* User Avatar */}
        {user ? (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div
              className="w-8 h-8 rounded-full bg-blue-500/15 border border-blue-200 text-blue-700 font-bold text-xs flex items-center justify-center cursor-pointer shadow-xs"
              title={`${user.full_name} (${user.role?.name || 'User'})`}
            >
              {initials}
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 text-blue-700 font-bold text-xs flex items-center justify-center hover:bg-blue-200 transition-colors shadow-xs"
            title="Sign In"
          >
            BW
          </Link>
        )}
      </div>
    </header>
  );
}
