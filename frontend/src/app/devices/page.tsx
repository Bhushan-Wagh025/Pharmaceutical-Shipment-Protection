'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Cpu, Battery, Radio, Plus, RotateCw } from 'lucide-react';

export default function DevicesPage() {
  const [devices, setDevices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newDevice, setNewDevice] = useState({
    device_mac: '',
    name: '',
    battery_level: 100.0,
    company_id: 1,
  });

  const loadDevices = async () => {
    try {
      const data = await api.getDevices();
      setDevices(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createDevice(newDevice);
      setShowModal(false);
      setNewDevice({ device_mac: '', name: '', battery_level: 100.0, company_id: 1 });
      loadDevices();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            BLE Thermal Sensor Tags
          </h1>
          <p className="text-xs text-slate-500">
            Bluetooth Low Energy sensor tags broadcasting real-time cold-chain environmental metrics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadDevices}
            className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-brand-600 hover:bg-brand-700 text-white shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Register Tag
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
            <tr>
              <th className="py-2.5 px-4">Tag MAC Address</th>
              <th className="py-2.5 px-4">Tag Name / Model</th>
              <th className="py-2.5 px-4">Battery Level</th>
              <th className="py-2.5 px-4">Status</th>
              <th className="py-2.5 px-4">Last Seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {devices.map((d) => {
              const isOnline = d.status === 'ONLINE' || d.status === 'ACTIVE';
              return (
                <tr key={d.id} className="hover:bg-slate-50/80">
                  <td className="py-3 px-4 font-mono font-bold text-slate-800">{d.device_mac}</td>
                  <td className="py-3 px-4 font-semibold text-slate-900">{d.name}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5 text-slate-700 font-mono">
                      <Battery className="w-4 h-4 text-emerald-600" />
                      <span>{d.battery_level}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                      isOnline
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                      {d.status || 'OFFLINE'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500 font-mono">
                    {d.last_seen_at ? new Date(d.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Never'}
                  </td>
                </tr>
              );
            })}
            {devices.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400 text-xs">
                  <Cpu className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  No BLE thermal sensor tags registered in database.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-sm w-full p-6 text-xs">
            <h2 className="text-base font-bold text-slate-900 mb-1">Bind New BLE Sensor</h2>
            <p className="text-slate-500 mb-4">Register tag MAC for shipment monitoring.</p>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">MAC Address</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CC:50:E3:88:42:01"
                  value={newDevice.device_mac}
                  onChange={(e) => setNewDevice({ ...newDevice, device_mac: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tag Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BLE ColdTag Ultra #8021"
                  value={newDevice.name}
                  onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded font-semibold"
                >
                  Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
