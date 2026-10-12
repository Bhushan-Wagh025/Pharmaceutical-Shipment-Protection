'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { BellRing, Check, RotateCw, Filter, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [unackOnly, setUnackOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadAlerts = async () => {
    try {
      const data = await api.getAlerts({ unack_only: unackOnly });
      setAlerts(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [unackOnly]);

  const handleAcknowledge = async (alertId: number) => {
    try {
      await api.acknowledgeAlert(alertId, 'Dr. Vance (Admin)');
      loadAlerts();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            AIoT Alerts & Thermal Incident Console
          </h1>
          <p className="text-xs text-slate-500">
            Real-time notifications for predicted excursions, protection actuation, and sensor events.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={unackOnly}
              onChange={(e) => setUnackOnly(e.target.checked)}
              className="rounded text-brand-600 focus:ring-brand-500"
            />
            <span>Unacknowledged only</span>
          </label>
          <button
            onClick={loadAlerts}
            className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
            <tr>
              <th className="py-2.5 px-4">Severity</th>
              <th className="py-2.5 px-4">Alert Type</th>
              <th className="py-2.5 px-4">Title & Details</th>
              <th className="py-2.5 px-4">Timestamp</th>
              <th className="py-2.5 px-4">Status</th>
              <th className="py-2.5 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {alerts.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50/80">
                <td className="py-3 px-4">
                  {a.severity === 'CRITICAL' && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                      CRITICAL
                    </span>
                  )}
                  {a.severity === 'WARNING' && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                      WARNING
                    </span>
                  )}
                  {a.severity === 'INFO' && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                      INFO
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 font-mono font-semibold text-slate-700">{a.alert_type}</td>
                <td className="py-3 px-4 max-w-md">
                  <div className="font-bold text-slate-900">{a.title}</div>
                  <div className="text-[11px] text-slate-600 mt-0.5">{a.message}</div>
                </td>
                <td className="py-3 px-4 text-slate-500 font-mono">
                  {new Date(a.created_at).toLocaleString()}
                </td>
                <td className="py-3 px-4">
                  {a.is_acknowledged ? (
                    <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                      ✓ Acknowledged
                    </span>
                  ) : (
                    <span className="text-[11px] text-amber-700 font-semibold flex items-center gap-1">
                      ● Active
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  {!a.is_acknowledged && (
                    <button
                      onClick={() => handleAcknowledge(a.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-colors"
                    >
                      <Check className="w-3 h-3 text-emerald-600" />
                      Acknowledge
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {alerts.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                  No alerts on record.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
