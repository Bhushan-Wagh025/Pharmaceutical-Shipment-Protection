'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useDashboardWebSocket } from '@/lib/websocket';
import { MetricCard } from '@/components/common/MetricCard';
import { StatusBadge, RiskBadge, TrayBadge } from '@/components/common/StatusBadge';
import {
  Package,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Wifi,
  Activity,
  ArrowRight,
  TrendingUp,
  RotateCw,
} from 'lucide-react';

export default function DashboardPage() {
  const [overview, setOverview] = useState<any>(null);
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);
  const [recentProtections, setRecentProtections] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [ovData, alertsData, protectionsData] = await Promise.all([
        api.getOverview(),
        api.getAlerts({ limit: 5 }),
        api.getProtectionActions(),
      ]);
      setOverview(ovData);
      setRecentAlerts(alertsData || []);
      setRecentProtections(protectionsData?.slice(0, 5) || []);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err);
      setError(err?.message || 'Failed to connect to backend API');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Polling backup
    return () => clearInterval(interval);
  }, [loadData]);

  // Real-time WebSocket live feed
  useDashboardWebSocket((msg) => {
    loadData();
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Fast Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200 gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Cold-Chain Operations Dashboard
          </h1>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium text-[11px] border border-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Source: PostgreSQL DB via FastAPI
            </span>
            {lastUpdated && <span>Last sync: <strong className="text-slate-700 font-mono">{lastUpdated}</strong></span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setIsLoading(true); loadData(); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5 text-slate-500" />
            Refresh
          </button>
          <Link
            href="/live-monitoring"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
          >
            <Activity className="w-3.5 h-3.5" />
            Live Demo Monitoring
          </Link>
        </div>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Active Shipments"
          value={overview?.active_shipments_count ?? '--'}
          subtitle="Monitored in transit"
          icon={<Package className="w-4 h-4" />}
        />
        <MetricCard
          title="Normal (Safe)"
          value={overview?.normal_count ?? '--'}
          subtitle="Temperature stable"
          icon={<ShieldCheck className="w-4 h-4 text-emerald-600" />}
        />
        <MetricCard
          title="At Risk / Warning"
          value={overview?.at_risk_count ?? '--'}
          subtitle="Imminent excursion predicted"
          alert={overview?.at_risk_count > 0}
          icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}
        />
        <MetricCard
          title="Protected In Chamber"
          value={overview?.protected_count ?? '--'}
          subtitle="Cold pack tray retracted"
          icon={<Layers className="w-4 h-4 text-blue-600" />}
        />
      </div>

      {/* Active Shipments Fleet Overview Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900">
              Active Shipments Fleet Telemetry
            </h2>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
              {overview?.shipments?.length || 0} batches
            </span>
          </div>
          <Link
            href="/shipments"
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
          >
            All Shipments <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
              <tr>
                <th className="py-2.5 px-4">Shipment / Product</th>
                <th className="py-2.5 px-4">Current Temp</th>
                <th className="py-2.5 px-4">Temp Limit</th>
                <th className="py-2.5 px-4">AI Forecast (15m)</th>
                <th className="py-2.5 px-4">Risk Level</th>
                <th className="py-2.5 px-4">Tray State</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {overview?.shipments?.map((s: any) => {
                const currentTemp = s.current_temperature !== undefined && s.current_temperature !== null ? s.current_temperature : null;
                const forecastTemp = s.latest_forecast?.predicted_temp !== undefined && s.latest_forecast?.predicted_temp !== null ? s.latest_forecast.predicted_temp : null;
                const isOverLimit = (currentTemp !== null && currentTemp >= s.temp_limit) || (forecastTemp !== null && forecastTemp >= s.temp_limit);

                return (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <Link href={`/shipments/${s.id}`} className="font-semibold text-slate-900 hover:text-brand-600">
                        {s.shipment_code}
                      </Link>
                      <div className="text-[11px] text-slate-500 truncate max-w-xs">{s.product_name}</div>
                    </td>
                    <td className="py-3 px-4">
                      {currentTemp !== null ? (
                        <span className={`font-mono text-sm font-bold ${
                          currentTemp >= s.temp_limit ? 'text-red-600' : 'text-slate-900'
                        }`}>
                          {currentTemp.toFixed(2)} °C
                        </span>
                      ) : (
                        <span className="font-mono text-xs text-slate-400">--</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs text-slate-600">{s.temp_limit.toFixed(1)} °C</span>
                    </td>
                    <td className="py-3 px-4">
                      {forecastTemp !== null ? (
                        <div className="flex items-center gap-1.5 font-mono">
                          <TrendingUp className={`w-3.5 h-3.5 ${isOverLimit ? 'text-red-500' : 'text-slate-400'}`} />
                          <span className={`font-semibold ${isOverLimit ? 'text-red-600 font-bold' : 'text-slate-800'}`}>
                            {forecastTemp.toFixed(2)} °C
                          </span>
                          <span className="text-[10px] text-slate-400 font-sans">(15m)</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Unavailable</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <RiskBadge risk={s.risk_level} />
                    </td>
                    <td className="py-3 px-4">
                      <TrayBadge state={s.tray?.state || 'EXTENDED'} />
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/shipments/${s.id}`}
                        className="inline-flex items-center px-2.5 py-1 rounded border border-slate-200 text-slate-700 hover:bg-slate-100 font-medium text-xs transition-colors"
                      >
                        Inspect &rarr;
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {(!overview?.shipments || overview.shipments.length === 0) && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                    <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    No active consignments found in database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two Column Layout: Recent Alerts & Recent Protection Events */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Alerts */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-4">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Recent AIoT Alerts
            </h3>
            <Link href="/alerts" className="text-xs text-brand-600 hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-2.5">
            {recentAlerts.map((alt) => (
              <div key={alt.id} className="p-2.5 rounded bg-slate-50 border border-slate-100 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-slate-800">{alt.title}</span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(alt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 line-clamp-2">{alt.message}</p>
              </div>
            ))}
            {recentAlerts.length === 0 && (
              <p className="text-xs text-slate-400 py-4 text-center">No recent alerts recorded.</p>
            )}
          </div>
        </div>

        {/* Recent Protection Actions */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-4">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              Automated Tray Protection Actions
            </h3>
            <Link href="/audit-logs" className="text-xs text-brand-600 hover:underline">
              Audit log
            </Link>
          </div>
          <div className="space-y-2.5">
            {recentProtections.map((act) => (
              <div key={act.id} className="p-2.5 rounded bg-blue-50/40 border border-blue-100 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-blue-900">
                    {act.decision}: Pred {act.prediction_temp}°C ≥ Limit {act.threshold}°C
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">{act.reason}</p>
                {act.cooling_verified && (
                  <div className="mt-1 text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                    ✓ Cooling verified at {act.recovery_temp}°C
                  </div>
                )}
              </div>
            ))}
            {recentProtections.length === 0 && (
              <p className="text-xs text-slate-400 py-4 text-center">No protection actions triggered yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
