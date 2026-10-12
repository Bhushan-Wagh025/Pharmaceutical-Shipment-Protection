'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Settings as SettingsIcon, Save, CheckCircle2, Radio, ArrowRight } from 'lucide-react';

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    defaultLimit: '8.0',
    safeMin: '2.0',
    forecastHorizon: '15',
    chamberTemp: '2.5',
    sensorFrequency: '10',
    hardwareAdapter: 'SIMULATED',
    mqttBroker: 'mqtt://192.168.10.1:1883',
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Global AIoT System Configuration
          </h1>
          <p className="text-xs text-slate-500">
            Configure default safety bounds, AI regression parameters, and hardware gateway bindings.
          </p>
        </div>
        <Link
          href="/settings/gateways"
          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs transition-colors shrink-0"
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Configure BLE Gateways</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {saved && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          Settings successfully persisted to system configuration store.
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Thermal Parameters */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs text-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
            Thermal Safety Thresholds & AI Parameters
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Default Upper Limit (°C)</label>
              <input
                type="text"
                value={form.defaultLimit}
                onChange={(e) => setForm({ ...form, defaultLimit: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono"
              />
              <span className="text-[10px] text-slate-400">Trigger threshold for tray retraction</span>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Default Safe Lower Bound (°C)</label>
              <input
                type="text"
                value={form.safeMin}
                onChange={(e) => setForm({ ...form, safeMin: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono"
              />
              <span className="text-[10px] text-slate-400">Freezing prevention threshold</span>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">AI Forecast Horizon (Minutes)</label>
              <input
                type="text"
                value={form.forecastHorizon}
                onChange={(e) => setForm({ ...form, forecastHorizon: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono"
              />
              <span className="text-[10px] text-slate-400">scikit-learn projection window</span>
            </div>
          </div>
        </div>

        {/* Hardware & Gateway Integration */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs text-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
            Gateway Hardware & Actuator Adapter
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Active Gateway Adapter</label>
              <select
                value={form.hardwareAdapter}
                onChange={(e) => setForm({ ...form, hardwareAdapter: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs"
              >
                <option value="SIMULATED">High-Fidelity Python Thermal Simulator (Dev)</option>
                <option value="GAO_BLE">GAO BLE Gateway Series 214060 (Industrial Hardware)</option>
                <option value="MQTT_EDGE">Custom MQTT Edge Gateway Broker</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Chamber Cold-Pack Temp (°C)</label>
              <input
                type="text"
                value={form.chamberTemp}
                onChange={(e) => setForm({ ...form, chamberTemp: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded font-semibold text-xs shadow-xs transition-colors"
        >
          <Save className="w-4 h-4" />
          Save Configurations
        </button>
      </form>
    </div>
  );
}
