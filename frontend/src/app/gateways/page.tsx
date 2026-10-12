'use client';

import React, { useState, useEffect } from 'react';
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
        <button
          onClick={loadGateways}
          className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
        >
          <RotateCw className="w-4 h-4" />
        </button>
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
            {gateways.map((g) => (
              <tr key={g.id} className="hover:bg-slate-50/80">
                <td className="py-3 px-4 font-mono font-bold text-slate-800">{g.gateway_eui}</td>
                <td className="py-3 px-4 font-semibold text-slate-900">{g.name}</td>
                <td className="py-3 px-4 font-mono text-slate-600">{g.ip_address || '192.168.10.45'} (MQTT/HTTP)</td>
                <td className="py-3 px-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
                    ONLINE
                  </span>
                </td>
                <td className="py-3 px-4 text-slate-500 font-mono">
                  {new Date(g.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
