'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { FileClock, RotateCw, Search, Shield } from 'lucide-react';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadLogs = async () => {
    try {
      const data = await api.getAuditLogs();
      setLogs(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filtered = logs.filter((l) => {
    const q = search.toLowerCase();
    return (
      l.action.toLowerCase().includes(q) ||
      l.resource_type.toLowerCase().includes(q) ||
      (l.details || '').toLowerCase().includes(q) ||
      (l.user_email || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            21 CFR Part 11 Regulatory Audit Trail
          </h1>
          <p className="text-xs text-slate-500">
            Immutable log of all user logins, AI decisions, motorized tray actuations, and sensor events.
          </p>
        </div>
        <button
          onClick={loadLogs}
          className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      <div className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between">
        <div className="relative w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search action, user, or resource..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded bg-white text-xs"
          />
        </div>
        <span className="text-xs text-slate-500 font-mono">{filtered.length} audit records</span>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
            <tr>
              <th className="py-2.5 px-4">Timestamp (UTC)</th>
              <th className="py-2.5 px-4">Action</th>
              <th className="py-2.5 px-4">Resource</th>
              <th className="py-2.5 px-4">Actor / System</th>
              <th className="py-2.5 px-4">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-normal">
            {filtered.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50/80">
                <td className="py-3 px-4 font-mono text-slate-500">
                  {new Date(l.timestamp).toLocaleString()}
                </td>
                <td className="py-3 px-4">
                  <span className="font-mono font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-100">
                    {l.action}
                  </span>
                </td>
                <td className="py-3 px-4 font-mono text-slate-700">
                  {l.resource_type}:{l.resource_id}
                </td>
                <td className="py-3 px-4 font-semibold text-slate-800">
                  {l.user_email || 'SYSTEM'}
                </td>
                <td className="py-3 px-4 text-slate-600 max-w-md truncate" title={l.details}>
                  {l.details}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
