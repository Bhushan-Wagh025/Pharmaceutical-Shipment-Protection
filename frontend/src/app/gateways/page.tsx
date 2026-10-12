'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Wifi, Plus, RotateCw, Server } from 'lucide-react';

export default function GatewaysPage() {
  const [gateways, setGateways] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadGateways = async () => {
    try {
      const data = await api.getGateways();
      setGateways(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGateways();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Industrial BLE Gateways
          </h1>
          <p className="text-xs text-slate-500">
            Hardware gateway adapters for GAO BLE receivers and simulated edge nodes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/settings/gateways"
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
          >
            <Server className="w-3.5 h-3.5" />
            <span>Configure Gateway</span>
          </Link>
          <button
            onClick={loadGateways}
            className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
            title="Refresh list"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
            <tr>
              <th className="py-2.5 px-4">Gateway Identifier (EUI)</th>
              <th className="py-2.5 px-4">Gateway Name / Hardware Series</th>
              <th className="py-2.5 px-4">IP Address / Protocol</th>
              <th className="py-2.5 px-4">Status</th>
              <th className="py-2.5 px-4">Heartbeat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {gateways.map((g) => {
              const isOnline = g.status === 'ONLINE' || g.status === 'CONNECTED';
              const isNotConfigured = g.status === 'NOT_CONFIGURED';
              return (
                <tr key={g.id} className="hover:bg-slate-50/80">
                  <td className="py-3 px-4 font-mono font-bold text-slate-800">{g.gateway_eui}</td>
                  <td className="py-3 px-4 font-semibold text-slate-900">{g.name}</td>
                  <td className="py-3 px-4 font-mono text-slate-600">
                    {g.host_url || g.ip_address || 'Unassigned'}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                      isOnline
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : isNotConfigured
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                        isOnline ? 'bg-emerald-500' : isNotConfigured ? 'bg-amber-500' : 'bg-slate-400'
                      }`}></span>
                      {g.status || 'NOT_CONFIGURED'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500 font-mono">
                    {g.last_seen_at ? new Date(g.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Never'}
                  </td>
                </tr>
              );
            })}
            {gateways.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400 text-xs">
                  <Server className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  No industrial BLE gateways configured. Click "Configure Gateway" to set up a receiver.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
