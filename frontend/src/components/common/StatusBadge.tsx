import React from 'react';

export function StatusBadge({ status }: { status: string }) {
  const s = (status || '').toUpperCase();
  
  if (s === 'NORMAL' || s === 'ACTIVE') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
        Normal
      </span>
    );
  }
  if (s === 'AT_RISK') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>
        At Risk
      </span>
    );
  }
  if (s === 'PROTECTED') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5"></span>
        Protected
      </span>
    );
  }
  if (s === 'DELIVERED') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
        Delivered
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
      {status}
    </span>
  );
}

export function RiskBadge({ risk }: { risk: string }) {
  const r = (risk || 'LOW').toUpperCase();

  if (r === 'LOW') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        LOW RISK
      </span>
    );
  }
  if (r === 'MEDIUM') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
        MED RISK
      </span>
    );
  }
  if (r === 'HIGH') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200 animate-pulse">
        HIGH RISK
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-50 text-red-700 border border-red-200 animate-pulse">
      CRITICAL
    </span>
  );
}

export function TrayBadge({ state }: { state: string }) {
  const st = (state || 'EXTENDED').toUpperCase();
  if (st === 'PROTECTED') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
        <span className="w-2 h-2 rounded-full bg-blue-600 mr-1.5"></span>
        PROTECTED (Cold Enclosure)
      </span>
    );
  }
  if (st === 'MOVING_IN' || st === 'MOVING_OUT') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
        <span className="w-2 h-2 rounded-full bg-amber-600 mr-1.5 animate-ping"></span>
        {st === 'MOVING_IN' ? 'RETRACTING IN' : 'EXTENDING OUT'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
      <span className="w-2 h-2 rounded-full bg-slate-400 mr-1.5"></span>
      EXTENDED (Normal Ambient)
    </span>
  );
}
