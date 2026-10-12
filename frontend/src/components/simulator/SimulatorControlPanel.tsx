'use client';

import React, { useState } from 'react';
import { api } from '@/lib/api';
import { Play, Square, FastForward, RotateCcw, AlertTriangle, ArrowDownToLine, ArrowUpFromLine, CheckCircle2 } from 'lucide-react';

interface SimulatorControlPanelProps {
  shipmentId: number;
  trayId?: number;
  currentTemp: number;
  trayState: string;
  trayPosition?: number;
  onActionComplete?: () => void;
}

export function SimulatorControlPanel({
  shipmentId,
  trayId,
  currentTemp,
  trayState,
  trayPosition = 0,
  onActionComplete,
}: SimulatorControlPanelProps) {
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleStep = async () => {
    setIsLoading(true);
    try {
      const res = await api.simulatorStep(shipmentId);
      setStatusMessage(`Ingested reading: ${res.temperature}°C (Tray: ${res.tray_state})`);
      if (onActionComplete) onActionComplete();
    } catch (e: any) {
      setStatusMessage(`Error: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTriggerExcursion = async () => {
    setIsLoading(true);
    try {
      await api.simulatorTriggerExcursion(shipmentId);
      setStatusMessage(`⚠️ Rapid thermal excursion initiated! Temperature warming curve accelerated.`);
      if (onActionComplete) onActionComplete();
    } catch (e: any) {
      setStatusMessage(`Error: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleAutoRun = async () => {
    setIsLoading(true);
    try {
      if (isAutoRunning) {
        await api.simulatorAutoRunStop(shipmentId);
        setIsAutoRunning(false);
        setStatusMessage('Auto-simulation stopped.');
      } else {
        await api.simulatorAutoRunStart(shipmentId);
        setIsAutoRunning(true);
        setStatusMessage('Auto-simulation loop running (1 tick / 2.5s)...');
      }
      if (onActionComplete) onActionComplete();
    } catch (e: any) {
      setStatusMessage(`Error: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    setIsLoading(true);
    try {
      await api.simulatorReset(shipmentId);
      setIsAutoRunning(false);
      setStatusMessage('Demo reset: safe baseline restored (5.5°C, Tray Extended, Low Risk).');
      if (onActionComplete) onActionComplete();
    } catch (e: any) {
      setStatusMessage(`Error: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMoveTrayIn = async () => {
    if (!trayId) return;
    setIsLoading(true);
    try {
      await api.moveTrayIn(trayId);
      setStatusMessage('Manual command issued: Retracting tray into cold chamber.');
      if (onActionComplete) onActionComplete();
    } catch (e: any) {
      setStatusMessage(`Error: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMoveTrayOut = async () => {
    if (!trayId) return;
    setIsLoading(true);
    try {
      await api.moveTrayOut(trayId);
      setStatusMessage('Manual command issued: Extending tray out.');
      if (onActionComplete) onActionComplete();
    } catch (e: any) {
      setStatusMessage(`Error: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-slate-100 gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span>Hardware Simulation & AIoT Control Bench</span>
            <span className="text-[10px] bg-brand-50 text-brand-700 px-2 py-0.5 rounded font-mono font-semibold border border-brand-200">
              PHYSICAL EMULATOR
            </span>
          </h3>
          <p className="text-xs text-slate-500">
            Control simulated thermal chamber, trigger excursions, and observe automated AI tray protection.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-xs transition-colors"
            title="Reset scenario to 5.5°C baseline"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            Reset Scenario
          </button>
        </div>
      </div>

      {/* Simulator Action Controls */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <button
          onClick={handleStep}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors"
        >
          <FastForward className="w-3.5 h-3.5 text-slate-600" />
          Step +1 Tick
        </button>

        <button
          onClick={handleTriggerExcursion}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          Trigger Excursion
        </button>

        <button
          onClick={handleToggleAutoRun}
          disabled={isLoading}
          className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded transition-colors ${
            isAutoRunning
              ? 'bg-red-50 text-red-700 border border-red-300 hover:bg-red-100'
              : 'bg-brand-600 text-white hover:bg-brand-700'
          }`}
        >
          {isAutoRunning ? (
            <>
              <Square className="w-3.5 h-3.5" />
              Stop Auto-Run
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              Auto-Run Demo Loop
            </>
          )}
        </button>

        <div className="flex gap-1">
          <button
            onClick={handleMoveTrayIn}
            disabled={isLoading || !trayId}
            className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-2 text-xs font-medium rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
            title="Manual override: Move tray inside"
          >
            <ArrowDownToLine className="w-3.5 h-3.5 text-blue-600" />
            Tray IN
          </button>
          <button
            onClick={handleMoveTrayOut}
            disabled={isLoading || !trayId}
            className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-2 text-xs font-medium rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
            title="Manual override: Extend tray outside"
          >
            <ArrowUpFromLine className="w-3.5 h-3.5 text-slate-600" />
            Tray OUT
          </button>
        </div>
      </div>

      {/* Actuator State Progress Indicator */}
      <div className="bg-slate-50 rounded-md p-2.5 border border-slate-200 text-xs">
        <div className="flex items-center justify-between text-[11px] mb-1.5 font-medium text-slate-600">
          <span>Actuator Position: {trayState}</span>
          <span className="font-mono">{trayPosition}% Protected</span>
        </div>
        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              trayState === 'PROTECTED'
                ? 'bg-blue-600'
                : trayState.includes('MOVING')
                ? 'bg-amber-500 animate-pulse'
                : 'bg-slate-400'
            }`}
            style={{ width: `${trayPosition}%` }}
          ></div>
        </div>
      </div>

      {statusMessage && (
        <div className="mt-2 text-xs font-mono text-slate-600 bg-slate-100 p-2 rounded border border-slate-200 flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-brand-600 shrink-0" />
          <span className="truncate">{statusMessage}</span>
        </div>
      )}
    </div>
  );
}
