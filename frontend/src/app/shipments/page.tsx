'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { StatusBadge, RiskBadge, TrayBadge } from '@/components/common/StatusBadge';
import { Package, Plus, Search, RotateCw, Filter, ArrowRight } from 'lucide-react';

export default function ShipmentsListPage() {
  const [shipments, setShipments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New Shipment Form State (Clean empty state, no pre-filled fake data)
  const [formData, setFormData] = useState({
    shipment_code: '',
    package_id: '',
    company_id: 1,
    product_name: '',
    batch_number: '',
    customer_name: '',
    origin: '',
    destination: '',
    temp_limit: 8.0,
    temp_safe_min: 2.0,
    forecast_horizon_minutes: 15,
  });

  const loadShipments = async () => {
    setIsLoading(true);
    try {
      const data = await api.getShipments({
        status: statusFilter || undefined,
      });
      setShipments(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadShipments();
  }, [statusFilter]);

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createShipment(formData);
      setShowCreateModal(false);
      loadShipments();
    } catch (e: any) {
      alert(`Error creating shipment: ${e.message}`);
    }
  };

  const filtered = shipments.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.shipment_code.toLowerCase().includes(q) ||
      s.product_name.toLowerCase().includes(q) ||
      s.customer_name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Pharmaceutical Shipments Registry
          </h1>
          <p className="text-xs text-slate-500">
            Manage cold-chain consignments, configure thermal limits, and bind IoT hardware tags.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadShipments}
            className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-brand-600 hover:bg-brand-700 text-white shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Consignment
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search shipment ID, product, customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All Statuses</option>
            <option value="NORMAL">Normal</option>
            <option value="ACTIVE">Active</option>
            <option value="PROTECTED">Protected</option>
            <option value="DELIVERED">Delivered</option>
          </select>
        </div>
      </div>

      {/* Shipments Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
              <tr>
                <th className="py-2.5 px-4">Shipment Code</th>
                <th className="py-2.5 px-4">Product / Batch</th>
                <th className="py-2.5 px-4">Destination</th>
                <th className="py-2.5 px-4">Current Temp</th>
                <th className="py-2.5 px-4">Upper Limit</th>
                <th className="py-2.5 px-4">Risk</th>
                <th className="py-2.5 px-4">Tray Position</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Console</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900 font-mono">
                    <Link href={`/shipments/${s.id}`} className="hover:text-brand-600">
                      {s.shipment_code}
                    </Link>
                    <div className="text-[10px] text-slate-400 font-sans">{s.package_id}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-800">{s.product_name}</div>
                    <div className="text-[11px] text-slate-500">Lot: {s.batch_number}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-600">{s.destination}</td>
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">
                    {s.current_temperature ? `${s.current_temperature.toFixed(2)} °C` : '--'}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600">{s.temp_limit.toFixed(1)} °C</td>
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
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
                    >
                      Monitor <ArrowRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                    No shipments matching current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create Consignment */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-lg w-full p-6 text-xs">
            <h2 className="text-base font-bold text-slate-900 mb-1">Register New Consignment</h2>
            <p className="text-slate-500 mb-4">Initialize tracking for a temperature-sensitive shipment batch.</p>

            <form onSubmit={handleCreateShipment} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Shipment Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SHIP-BC5729206C16"
                    value={formData.shipment_code}
                    onChange={(e) => setFormData({ ...formData, shipment_code: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Package ID</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PKG-mRNA-892"
                    value={formData.package_id}
                    onChange={(e) => setFormData({ ...formData, package_id: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Product Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. mRNA Vaccine BNT162b2 (Ultra-Sensitive)"
                  value={formData.product_name}
                  onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Batch / Lot</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. LOT-2026-9948"
                    value={formData.batch_number}
                    onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Customer / Consignee</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Novartis Healthcare / Hospital"
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Limit (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={formData.temp_limit}
                    onChange={(e) => setFormData({ ...formData, temp_limit: parseFloat(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Safe Min (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={formData.temp_safe_min}
                    onChange={(e) => setFormData({ ...formData, temp_safe_min: parseFloat(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Horizon (Min)</label>
                  <input
                    type="number"
                    required
                    value={formData.forecast_horizon_minutes}
                    onChange={(e) => setFormData({ ...formData, forecast_horizon_minutes: parseInt(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded font-semibold"
                >
                  Save Consignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
