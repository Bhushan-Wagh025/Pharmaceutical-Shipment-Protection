'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Users as UsersIcon, Shield, Plus, RotateCw, CheckCircle2 } from 'lucide-react';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    full_name: '',
    password: '',
    role_id: 4, // OPERATOR
    company_id: 1,
  });

  const loadData = async () => {
    try {
      const [uData, rData] = await Promise.all([api.getUsers(), api.getRoles()]);
      setUsers(uData || []);
      setRoles(rData || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createUser(newUser);
      setShowModal(false);
      setNewUser({ email: '', full_name: '', password: '', role_id: 4, company_id: 1 });
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Identity & Role-Based Access Control (RBAC)
          </h1>
          <p className="text-xs text-slate-500">
            Manage authenticated enterprise staff across Super Admin, Company Admin, Manager, Operator, and Viewer tiers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-brand-600 hover:bg-brand-700 text-white shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Add User
          </button>
        </div>
      </div>

      {/* Roles Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {roles.map((r) => (
          <div key={r.id} className="p-3 bg-white rounded-lg border border-slate-200 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-900 mb-1">
              <Shield className="w-3.5 h-3.5 text-brand-600" />
              <span>{r.name}</span>
            </div>
            <p className="text-[11px] text-slate-500 line-clamp-2">{r.description}</p>
          </div>
        ))}
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
            <tr>
              <th className="py-2.5 px-4">Full Name</th>
              <th className="py-2.5 px-4">Email Address</th>
              <th className="py-2.5 px-4">Role Assigned</th>
              <th className="py-2.5 px-4">Company</th>
              <th className="py-2.5 px-4">Status</th>
              <th className="py-2.5 px-4">Last Login</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50/80">
                <td className="py-3 px-4 font-bold text-slate-900">{u.full_name}</td>
                <td className="py-3 px-4 font-mono text-slate-600">{u.email}</td>
                <td className="py-3 px-4">
                  <span className="font-mono text-[11px] font-semibold bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                    {u.role?.name || 'OPERATOR'}
                  </span>
                </td>
                <td className="py-3 px-4 text-slate-600">{u.company?.name || 'BioPharma Cold Chain'}</td>
                <td className="py-3 px-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    ACTIVE
                  </span>
                </td>
                <td className="py-3 px-4 text-slate-500 font-mono">
                  {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-sm w-full p-6 text-xs">
            <h2 className="text-base font-bold text-slate-900 mb-1">Create User Account</h2>
            <p className="text-slate-500 mb-4">Provision role and system credentials.</p>
            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newUser.full_name}
                  onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Role</label>
                <select
                  value={newUser.role_id}
                  onChange={(e) => setNewUser({ ...newUser, role_id: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name} - {r.description}</option>
                  ))}
                </select>
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
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
