'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Activity,
  Package,
  Layers,
  Cpu,
  Wifi,
  BellRing,
  FileSpreadsheet,
  FileClock,
  Users,
  Settings,
  Flame,
} from 'lucide-react';

const NAV_ITEMS = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Live Monitoring', href: '/live-monitoring', icon: Activity },
  { name: 'Device Status', href: '/devices', icon: Cpu },
  { name: 'Alerts & Events', href: '/alerts', icon: BellRing },
  { name: 'Reports', href: '/reports', icon: FileSpreadsheet },
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Shipments', href: '/shipments', icon: Package },
  { name: 'Motorized Trays', href: '/trays', icon: Layers },
  { name: 'Gateways', href: '/gateways', icon: Wifi },
  { name: 'Audit Logs', href: '/audit-logs', icon: FileClock },
  { name: 'Users & RBAC', href: '/users', icon: Users },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-slate-50 border-r border-slate-200 flex flex-col justify-between shrink-0 min-h-[calc(100vh-3.5rem)] text-sm">
      <div className="py-4 px-3 space-y-1">
        <div className="px-3 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Enterprise Fleet
        </div>

        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium text-xs transition-colors ${
                isActive
                  ? 'bg-brand-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
              <span className="flex-1">{item.name}</span>
            </Link>
          );
        })}
      </div>

      {/* System Telemetry Info Box */}
      <div className="p-3 m-3 bg-white rounded-lg border border-slate-200 text-xs">
        <div className="flex items-center gap-1.5 font-semibold text-slate-800 text-[11px] mb-1">
          <Activity className="w-3.5 h-3.5 text-emerald-600" />
          <span>Cold Chain Network</span>
        </div>
        <p className="text-[10px] text-slate-500 leading-relaxed mb-2">
          Connected to live IoT telemetry stream and automated protection services.
        </p>
        <Link
          href="/live-monitoring"
          className="inline-flex w-full items-center justify-center py-1 rounded bg-brand-50 hover:bg-brand-100 text-brand-700 font-semibold text-[11px] border border-brand-200 transition-colors"
        >
          Open Live Monitor &rarr;
        </Link>
      </div>
    </aside>
  );
}
