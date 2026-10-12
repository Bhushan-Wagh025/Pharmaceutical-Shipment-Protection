import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  alert?: boolean;
}

export function MetricCard({ title, value, subtitle, icon, badge, alert }: MetricCardProps) {
  return (
    <div className={`bg-white rounded-lg border p-4 shadow-xs transition-colors ${
      alert ? 'border-red-300 bg-red-50/20' : 'border-slate-200'
    }`}>
      <div className="flex items-center justify-between text-slate-500 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider">{title}</span>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>
      <div className="flex items-baseline justify-between">
        <div className="text-2xl font-bold tracking-tight text-slate-900">{value}</div>
        {badge}
      </div>
      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
    </div>
  );
}
