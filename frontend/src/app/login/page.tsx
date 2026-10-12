'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Shield, Lock, Mail, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@pharmaprotect.com');
  const [password, setPassword] = useState('Admin123!');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const setDemoAccount = (demEmail: string, demPass: string) => {
    setEmail(demEmail);
    setPassword(demPass);
  };

  return (
    <div className="min-h-[80vh] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-xl border border-slate-200 shadow-sm p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-brand-600 rounded-lg flex items-center justify-center text-white mb-3 shadow-sm">
            <Shield className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            PharmaProtect AIoT
          </h2>
          <p className="text-xs text-slate-500 mt-1 text-center">
            B2B Cold Chain Thermal Protection & Motorized Actuation Console
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Enterprise Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Mail className="h-4 w-4" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="block w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="block w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 bg-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent rounded-md shadow-xs text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-colors disabled:opacity-60"
          >
            {isLoading ? 'Authenticating...' : (
              <>
                Sign In to Console
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Demo Fast-Switch Buttons */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Demo Credentials (Click to pre-fill):
          </p>
          <div className="space-y-1.5 text-xs">
            <button
              type="button"
              onClick={() => setDemoAccount('admin@pharmaprotect.com', 'Admin123!')}
              className="w-full text-left px-2.5 py-1.5 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-between transition-colors"
            >
              <span className="font-medium text-slate-700">Super Admin (Dr. Vance)</span>
              <span className="text-[10px] font-mono text-brand-600">SUPER_ADMIN</span>
            </button>
            <button
              type="button"
              onClick={() => setDemoAccount('operator@pharmaprotect.com', 'Operator123!')}
              className="w-full text-left px-2.5 py-1.5 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-between transition-colors"
            >
              <span className="font-medium text-slate-700">Floor Operator (Elena)</span>
              <span className="text-[10px] font-mono text-slate-600">OPERATOR</span>
            </button>
            <button
              type="button"
              onClick={() => setDemoAccount('manager@pharmaprotect.com', 'Manager123!')}
              className="w-full text-left px-2.5 py-1.5 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-between transition-colors"
            >
              <span className="font-medium text-slate-700">Cold Chain Mgr (Marcus)</span>
              <span className="text-[10px] font-mono text-slate-600">MANAGER</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
