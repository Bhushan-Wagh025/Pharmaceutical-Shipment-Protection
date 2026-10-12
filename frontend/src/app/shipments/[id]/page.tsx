'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useShipmentWebSocket } from '@/lib/websocket';
import { MetricCard } from '@/components/common/MetricCard';
import { StatusBadge, RiskBadge, TrayBadge } from '@/components/common/StatusBadge';
import { TemperatureHistoryChart } from '@/components/charts/TemperatureHistoryChart';
import { AIForecastChart } from '@/components/charts/AIForecastChart';
import { SimulatorControlPanel } from '@/components/simulator/SimulatorControlPanel';
import {
  Thermometer,
  Shield,
  Clock,
  TrendingUp,
  Cpu,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  RotateCw,
  FileText,
} from 'lucide-react';

export default function ShipmentDetailPage() {
  const params = useParams();
  const shipmentId = params?.id ? Number(params.id) : 1;

  const [shipment, setShipment] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [latestForecast, setLatestForecast] = useState<any>(null);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadShipmentData = useCallback(async () => {
    try {
      const [sData, hData, fData, pData, aData] = await Promise.all([
        api.getShipment(shipmentId),
        api.getTempHistory(shipmentId, 50),
        api.getLatestForecast(shipmentId),
        api.getProtectionActions(shipmentId),
        api.getAlerts({ shipment_id: shipmentId, limit: 10 }),
      ]);
      setShipment(sData);
      setHistory(hData || []);
      setLatestForecast(fData || sData?.latest_forecast);

      // Combine protection actions and alerts into an unified event timeline
      const events: any[] = [];
      (pData || []).forEach((p: any) => {
        events.push({
          id: `p-${p.id}`,
          type: 'PROTECTION',
          title: `Protection Triggered (${p.decision})`,
          description: p.reason,
          timestamp: p.timestamp,
          verified: p.cooling_verified,
        });
      });
      (aData || []).forEach((a: any) => {
        events.push({
          id: `a-${a.id}`,
          type: 'ALERT',
          title: a.title,
          description: a.message,
          timestamp: a.created_at,
          severity: a.severity,
        });
      });
      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setTimelineEvents(events);
    } catch (err) {
      console.error('Error loading shipment console data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [shipmentId]);

  useEffect(() => {
    loadShipmentData();
    const interval = setInterval(loadShipmentData, 4000);
    return () => clearInterval(interval);
  }, [loadShipmentData]);

  // Live WebSocket Real-time Telemetry Feed
  const { isConnected } = useShipmentWebSocket(shipmentId, (data) => {
    if (data.type === 'TELEMETRY_UPDATE' || data.type === 'SIMULATOR_STEP' || data.type === 'SIMULATOR_RESET') {
      loadShipmentData();
    }
  });

  const currentTemp = shipment?.current_temperature ?? (history.length > 0 ? history[history.length - 1].temperature : null);
  const tempLimit = shipment?.temp_limit ?? 8.0;
  const forecastTemp = latestForecast?.predicted_temp ?? null;
  const horizon = shipment?.forecast_horizon_minutes ?? 15;
  const trayState = shipment?.tray?.state ?? 'EXTENDED';
  const trayPosition = shipment?.tray?.position_percentage ?? 0;
  const isExcursionImminent = (currentTemp !== null && currentTemp >= tempLimit) || (forecastTemp !== null && forecastTemp >= tempLimit);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/shipments"
            className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                {shipment?.shipment_code || 'Loading Shipment...'}
              </h1>
              {shipment && <StatusBadge status={shipment.status} />}
              {shipment && <RiskBadge risk={shipment.risk_level} />}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {shipment?.product_name} &bull; Batch {shipment?.batch_number} &bull; {shipment?.customer_name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
            isConnected
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-slate-100 text-slate-600 border-slate-200'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
            {isConnected ? 'WebSocket Stream Live' : 'Polling Sync'}
          </div>
          <button
            onClick={loadShipmentData}
            className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
            title="Reload Data"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Prominent Cold Chain Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <MetricCard
          title="Current Temp"
          value={currentTemp !== null ? `${currentTemp.toFixed(2)} °C` : '--'}
          subtitle={`Limit: ${tempLimit.toFixed(1)} °C`}
          alert={currentTemp !== null && currentTemp >= tempLimit}
          icon={<Thermometer className="w-4 h-4 text-brand-600" />}
        />
        <MetricCard
          title="Temperature Limit"
          value={`${tempLimit.toFixed(1)} °C`}
          subtitle="Max Allowed Upper Bound"
          icon={<AlertTriangle className="w-4 h-4 text-slate-400" />}
        />
        <MetricCard
          title="AI Forecast"
          value={forecastTemp !== null ? `${forecastTemp.toFixed(2)} °C` : 'Unavailable'}
          subtitle={forecastTemp !== null ? `Trajectory at +${horizon}m` : 'No forecast available'}
          alert={forecastTemp !== null && forecastTemp >= tempLimit}
          icon={<TrendingUp className="w-4 h-4 text-purple-600" />}
        />
        <MetricCard
          title="Forecast Horizon"
          value={`${horizon} min`}
          subtitle="scikit-learn extrapolation"
          icon={<Clock className="w-4 h-4 text-slate-400" />}
        />
        <MetricCard
          title="Risk Level"
          value={shipment?.risk_level || 'LOW'}
          subtitle={latestForecast?.slope_c_per_min ? `Slope: ${latestForecast.slope_c_per_min > 0 ? '+' : ''}${latestForecast.slope_c_per_min} °C/m` : 'Stable'}
          alert={shipment?.risk_level === 'HIGH' || shipment?.risk_level === 'CRITICAL'}
          icon={<Shield className="w-4 h-4 text-amber-500" />}
        />
        <MetricCard
          title="Tray Actuator"
          value={trayState}
          subtitle={`${trayPosition}% Retracted In Chamber`}
          icon={<Layers className="w-4 h-4 text-blue-600" />}
        />
      </div>

      {/* Interactive Simulation & Actuator Control Bench */}
      <SimulatorControlPanel
        shipmentId={shipmentId}
        trayId={shipment?.tray?.id || 1}
        currentTemp={currentTemp ?? 5.0}
        trayState={trayState}
        trayPosition={trayPosition}
        onActionComplete={loadShipmentData}
      />

      {/* Charts Section: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Real-time Telemetry History Chart */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-4">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Temperature History (BLE Telemetry)
              </h3>
              <p className="text-xs text-slate-500">
                Continuous Bluetooth Low Energy sensor temperature stream.
              </p>
            </div>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              {history.length} samples
            </span>
          </div>
          <TemperatureHistoryChart
            data={history}
            tempLimit={tempLimit}
            tempSafeMin={shipment?.temp_safe_min || 2.0}
          />
        </div>

        {/* AI ML Forecast Trajectory Chart */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-4">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>AI Predictive Excursion Forecast</span>
                <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-mono font-medium border border-purple-200">
                  scikit-learn
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Polynomial regression extrapolating next {horizon} minutes of thermal physics.
              </p>
            </div>
            {latestForecast && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                latestForecast.will_cross_limit
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {latestForecast.will_cross_limit ? '⚠️ Breach Predicted' : '✓ Safe Trajectory'}
              </span>
            )}
          </div>
          <AIForecastChart
            currentTemp={currentTemp}
            predictedTemp={forecastTemp}
            tempLimit={tempLimit}
            horizonMinutes={horizon}
            historyData={history}
          />
        </div>
      </div>

      {/* Shipment Specs & Event Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Metadata Details */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-4 text-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-500" />
            Consignment Metadata & Hardware Binding
          </h3>
          <div className="grid grid-cols-2 gap-2 text-slate-600">
            <div>
              <span className="font-semibold text-slate-800 block">Package ID:</span>
              <span className="font-mono">{shipment?.package_id || 'Not Assigned'}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-800 block">Batch / Lot:</span>
              <span className="font-mono">{shipment?.batch_number || '—'}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-800 block">Origin:</span>
              <span>{shipment?.origin || '—'}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-800 block">Destination:</span>
              <span>{shipment?.destination || '—'}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-800 block">BLE Tag MAC:</span>
              <span className="font-mono">{shipment?.ble_device?.device_mac || 'Unpaired'}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-800 block">Assigned Tray Unit:</span>
              <span className="font-mono">{shipment?.tray?.tray_code || 'Unassigned'}</span>
            </div>
          </div>
        </div>

        {/* Real-time Event Timeline */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 shadow-xs p-4">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-600" />
              Real-time Decision & Audit Event Timeline
            </h3>
            <span className="text-xs text-slate-400">Chronological history</span>
          </div>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {timelineEvents.map((ev) => (
              <div key={ev.id} className="flex items-start gap-3 text-xs">
                <div className="mt-0.5">
                  {ev.type === 'PROTECTION' ? (
                    <div className="w-6 h-6 rounded-full bg-blue-100 border border-blue-300 flex items-center justify-center text-blue-700">
                      <Shield className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700">
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
                <div className="flex-1 bg-slate-50 p-2.5 rounded border border-slate-100">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-bold text-slate-800">{ev.title}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">{ev.description}</p>
                </div>
              </div>
            ))}
            {timelineEvents.length === 0 && (
              <p className="text-xs text-slate-400 py-6 text-center">No protection or alert events recorded yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
