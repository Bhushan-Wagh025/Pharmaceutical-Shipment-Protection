'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { TrayBadge } from '@/components/common/StatusBadge';
import { Layers, ArrowDownToLine, ArrowUpFromLine, RotateCcw, RotateCw, CheckCircle2 } from 'lucide-react';

export default function TraysPage() {
  const [trays, setTrays] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const loadTrays = async () => {
    try {
      const data = await api.getTrays();
      setTrays(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTrays();
    const interval = setInterval(loadTrays, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleMoveIn = async (trayId: number) => {
    try {
      await api.moveTrayIn(trayId);
      setActionFeedback(`Tray #${trayId}: Command MOVE_IN dispatched.`);
      loadTrays();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleMoveOut = async (trayId: number) => {
    try {
      await api.moveTrayOut(trayId);
      setActionFeedback(`Tray #${trayId}: Command MOVE_OUT dispatched.`);
      loadTrays();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleReset = async (trayId: number) => {
    try {
      await api.resetTray(trayId);
      setActionFeedback(`Tray #${trayId}: Actuator reset to EXTENDED position.`);
      loadTrays();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Motorized Protection Tray Units
          </h1>
          <p className="text-xs text-slate-500">
            Automated stepper & linear actuator control interface for active cold-pack chambers.
          </p>
        </div>
        <button
          onClick={loadTrays}
          className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      {actionFeedback && (
        <div className="p-2.5 rounded bg-blue-50 border border-blue-200 text-xs font-mono text-blue-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-blue-600" />
          <span>{actionFeedback}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {trays.map((t) => (
          <div key={t.id} className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-slate-900">{t.tray_code}</span>
                  <TrayBadge state={t.state} />
                </div>
                <p className="text-xs text-slate-500 mt-1">{t.name}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Position</span>
                <span className="font-mono text-base font-bold text-slate-800">{t.position_percentage}%</span>
              </div>
            </div>

            {/* Visual Mechanical Actuator Representation */}
            <div className="bg-slate-50 rounded p-3 border border-slate-200">
              <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                <span>0% EXTENDED (Ambient)</span>
                <span>100% PROTECTED (Cold Enclosure)</span>
              </div>
              <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-700 ${
                    t.state === 'PROTECTED'
                      ? 'bg-blue-600'
                      : t.state.includes('MOVING')
                      ? 'bg-amber-500 animate-pulse'
                      : 'bg-slate-400'
                  }`}
                  style={{ width: `${t.position_percentage}%` }}
                ></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
              <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block text-[10px]">Cold-Pack Enclosure:</span>
                <span className="font-mono font-semibold text-slate-800">{t.temp_cold_pack} °C</span>
              </div>
              <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block text-[10px]">Target Stabilization:</span>
                <span className="font-mono font-semibold text-slate-800">{t.target_temp} °C</span>
              </div>
            </div>

            {/* Actuator Action Controls */}
            <div className="pt-2 flex items-center gap-2">
              <button
                onClick={() => handleMoveIn(t.id)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
              >
                <ArrowDownToLine className="w-4 h-4" />
                Retract IN
              </button>
              <button
                onClick={() => handleMoveOut(t.id)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors"
              >
                <ArrowUpFromLine className="w-4 h-4" />
                Extend OUT
              </button>
              <button
                onClick={() => handleReset(t.id)}
                className="p-2 rounded border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors"
                title="Reset Actuator State"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
