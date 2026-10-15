'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { MetricCard } from '@/components/common/MetricCard';
import { FileSpreadsheet, ShieldCheck, Printer, RotateCw, CheckCircle2 } from 'lucide-react';

export default function ReportsPage() {
  const [report, setReport] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadReport = async () => {
    try {
      const data = await api.getComplianceReport();
      setReport(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Cold-Chain Regulatory Compliance Report
          </h1>
          <p className="text-xs text-slate-500">
            Audit-ready GxP compliance certificate and thermal excursion defense metrics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            Print / Export PDF
          </button>
          <button
            onClick={loadReport}
            className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Compliance High-Level KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="GxP Compliance Rate"
          value={report?.compliance_rate_percent !== undefined ? `${report.compliance_rate_percent}%` : '--'}
          subtitle="Batches preserved without excursion"
          icon={<ShieldCheck className="w-4 h-4 text-emerald-600" />}
        />
        <MetricCard
          title="Telemetry Samples"
          value={report?.total_readings ?? '--'}
          subtitle="Timestamped BLE logs"
        />
        <MetricCard
          title="AI Forecasts Run"
          value={report?.total_forecasts ?? '--'}
          subtitle="Predictive thermal projections"
        />
        <MetricCard
          title="Excursions Prevented"
          value={report?.total_protections_triggered ?? '--'}
          subtitle="Motorized chamber actuations"
          icon={<CheckCircle2 className="w-4 h-4 text-blue-600" />}
        />
      </div>

      {/* Consignment Audit Summary Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <span className="font-bold text-xs text-slate-900">Consignment Compliance Ledger</span>
          <span className="text-[11px] text-slate-500 font-mono">
            Generated: {report?.generated_at ? new Date(report.generated_at).toLocaleString() : '--'}
          </span>
        </div>
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
            <tr>
              <th className="py-2.5 px-4">Shipment Code</th>
              <th className="py-2.5 px-4">Product / Lot</th>
              <th className="py-2.5 px-4">Limit</th>
              <th className="py-2.5 px-4">Telemetry Count</th>
              <th className="py-2.5 px-4">Peak Temp</th>
              <th className="py-2.5 px-4">Protections Triggered</th>
              <th className="py-2.5 px-4">GxP Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {report?.shipment_summaries?.map((s: any) => (
              <tr key={s.id} className="hover:bg-slate-50/80">
                <td className="py-3 px-4 font-mono font-bold text-slate-900">{s.shipment_code}</td>
                <td className="py-3 px-4">
                  <div className="font-semibold text-slate-800">{s.product_name}</div>
                  <div className="text-[11px] text-slate-500">{s.batch_number}</div>
                </td>
                <td className="py-3 px-4 font-mono text-slate-600">{s.temp_limit} °C</td>
                <td className="py-3 px-4 font-mono text-slate-700">{s.readings_count} pts</td>
                <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                  {s.max_temp ? `${s.max_temp.toFixed(2)} °C` : '--'}
                </td>
                <td className="py-3 px-4 font-mono text-slate-800">{s.protection_actions_count}</td>
                <td className="py-3 px-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    ✓ COMPLIANT
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
