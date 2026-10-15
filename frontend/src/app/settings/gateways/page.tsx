'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Wifi,
  Radio,
  Server,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Play,
  Square,
  CheckCircle2,
  AlertTriangle,
  Save,
  HelpCircle,
  ExternalLink,
  Lock,
  Battery,
  Thermometer,
  Activity,
  ChevronRight,
  Info,
} from 'lucide-react';
import { api } from '@/lib/api';

interface DiscoveredDevice {
  device_mac: string;
  name: string;
  temperature?: number | null;
  battery?: number | null;
  rssi?: number | null;
  last_seen?: string | null;
}

interface GatewayData {
  id: number;
  name: string;
  gateway_eui: string;
  host_url?: string | null;
  ip_address?: string | null;
  api_base_path: string;
  auth_method: string;
  api_key_masked?: string | null;
  polling_interval: number;
  timeout_seconds: number;
  is_enabled: boolean;
  verify_ssl: boolean;
  tls_certificate?: string | null;
  adapter_type: string;
  status: string;
  is_monitoring: boolean;
  last_error?: string | null;
  last_communication_at?: string | null;
  last_reading_data?: string | null;
}

export default function GatewaySettingsPage() {
  const [gateways, setGateways] = useState<GatewayData[]>([]);
  const [selectedGatewayId, setSelectedGatewayId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [discovering, setDiscovering] = useState<boolean>(false);
  const [monitoringLoading, setMonitoringLoading] = useState<boolean>(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    gateway_eui: '',
    host_url: '',
    api_base_path: '/api/v1',
    auth_method: 'NONE',
    api_key: '',
    polling_interval: 5,
    timeout_seconds: 5,
    is_enabled: true,
    verify_ssl: true,
    tls_certificate: '',
    adapter_type: 'GAO_BLE',
  });

  // Action status results
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
    troubleshooting?: string | null;
  } | null>(null);

  // Discovered devices & status
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([]);
  const [lastReading, setLastReading] = useState<any>(null);
  const [lastCommTime, setLastCommTime] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTED' | 'DISCONNECTED' | 'ERROR'>('DISCONNECTED');
  const [lastErrorMsg, setLastErrorMsg] = useState<string | null>(null);
  const [troubleshootingTip, setTroubleshootingTip] = useState<string | null>(null);
  const [isMonitoringActive, setIsMonitoringActive] = useState<boolean>(false);

  // Load Gateways on mount
  const loadGateways = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getGateways();
      setGateways(data);
      if (data.length > 0) {
        const target = selectedGatewayId 
          ? data.find((g: GatewayData) => g.id === selectedGatewayId) || data[0]
          : data[0];
        selectGateway(target);
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: `Failed to load gateway configurations: ${err.message}`,
      });
    } finally {
      setLoading(false);
    }
  }, [selectedGatewayId]);

  useEffect(() => {
    loadGateways();
  }, []);

  const selectGateway = (gw: GatewayData) => {
    setSelectedGatewayId(gw.id);
    setFormData({
      name: gw.name || '',
      gateway_eui: gw.gateway_eui || '',
      host_url: gw.host_url || gw.ip_address || '',
      api_base_path: gw.api_base_path || '/api/v1',
      auth_method: gw.auth_method || 'NONE',
      api_key: gw.api_key_masked || '',
      polling_interval: gw.polling_interval || 5,
      timeout_seconds: gw.timeout_seconds || 5,
      is_enabled: gw.is_enabled ?? true,
      verify_ssl: gw.verify_ssl ?? true,
      tls_certificate: gw.tls_certificate || '',
      adapter_type: gw.adapter_type || 'GAO_BLE',
    });
    setConnectionStatus(
      gw.status === 'ONLINE' ? 'CONNECTED' : (gw.last_error ? 'ERROR' : 'DISCONNECTED')
    );
    setLastCommTime(gw.last_communication_at || null);
    setLastErrorMsg(gw.last_error || null);
    setIsMonitoringActive(gw.is_monitoring || false);

    if (gw.last_reading_data) {
      try {
        setLastReading(JSON.parse(gw.last_reading_data));
      } catch {
        setLastReading(null);
      }
    } else {
      setLastReading(null);
    }

    // Refresh live status
    fetchGatewayStatus(gw.id);
  };

  const fetchGatewayStatus = async (id: number) => {
    try {
      const res = await api.getGatewayStatus(id);
      setConnectionStatus(
        res.connected ? 'CONNECTED' : (res.last_error ? 'ERROR' : 'DISCONNECTED')
      );
      setLastCommTime(res.last_communication);
      setLastErrorMsg(res.last_error);
      setTroubleshootingTip(res.troubleshooting);
      setIsMonitoringActive(res.is_monitoring);
      if (res.last_reading) {
        setLastReading(res.last_reading);
      }
      if (res.discovered_devices) {
        setDiscoveredDevices(res.discovered_devices);
      }
    } catch (err: any) {
      loggerError('Status query error: ' + err.message);
    }
  };

  const loggerError = (msg: string) => {
    console.warn(msg);
  };

  // 1. Save Configuration
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGatewayId) return;

    try {
      setSaving(true);
      setNotification(null);

      // Clean payload: if api_key starts with •, don't overwrite with masked string
      const payload: any = { ...formData };
      if (payload.api_key && payload.api_key.startsWith('•')) {
        delete payload.api_key;
      }

      const updated = await api.updateGateway(selectedGatewayId, payload);
      setNotification({
        type: 'success',
        message: 'Gateway configuration successfully verified and saved to database.',
      });
      loadGateways();
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: `Failed to save configuration: ${err.message}`,
        troubleshooting: err.message.includes('Security Validation Error')
          ? 'URL was blocked by anti-SSRF protections. Ensure the host is not loopback (localhost/127.0.0.1) or cloud metadata (169.254.169.254).'
          : 'Check database connectivity and that the gateway identifier (EUI) is unique.',
      });
    } finally {
      setSaving(false);
    }
  };

  // 2. Test Connection
  const handleTestConnection = async () => {
    if (!selectedGatewayId) return;
    try {
      setTesting(true);
      setNotification(null);
      const res = await api.testGatewayConnection(selectedGatewayId);
      if (res.success) {
        setConnectionStatus('CONNECTED');
        setLastErrorMsg(null);
        setTroubleshootingTip(null);
        setNotification({
          type: 'success',
          message: `Connection Verified: ${res.details} (Latency: ${res.latency_ms} ms)`,
        });
      } else {
        setConnectionStatus('ERROR');
        setLastErrorMsg(res.error);
        setTroubleshootingTip(res.troubleshooting);
        setNotification({
          type: 'error',
          message: `Connection Test Failed: ${res.error}`,
          troubleshooting: res.troubleshooting,
        });
      }
      fetchGatewayStatus(selectedGatewayId);
    } catch (err: any) {
      setConnectionStatus('ERROR');
      setLastErrorMsg(err.message);
      setNotification({
        type: 'error',
        message: `Test Connection Request Failed: ${err.message}`,
        troubleshooting: 'Ensure the FastAPI backend is running and the target gateway URL is accessible.',
      });
    } finally {
      setTesting(false);
    }
  };

  // 3. Discover Devices
  const handleDiscoverDevices = async () => {
    if (!selectedGatewayId) return;
    try {
      setDiscovering(true);
      setNotification(null);
      const res = await api.discoverGatewayDevices(selectedGatewayId);
      setDiscoveredDevices(res.devices || []);
      setNotification({
        type: 'success',
        message: `Device Scan Completed: Found ${res.count} active BLE beacon(s).`,
      });
      fetchGatewayStatus(selectedGatewayId);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: `Device Discovery Failed: ${err.message}`,
        troubleshooting: 'Ensure the BLE gateway is in scanning mode and beacons (Aperture Industrial Beacon / BLE) are transmitting within RF range.',
      });
    } finally {
      setDiscovering(false);
    }
  };

  // 4. Start Monitoring
  const handleStartMonitoring = async () => {
    if (!selectedGatewayId) return;
    try {
      setMonitoringLoading(true);
      await api.startGatewayMonitoring(selectedGatewayId);
      setIsMonitoringActive(true);
      setNotification({
        type: 'success',
        message: 'Real-time telemetry monitoring started. Gateway adapter is actively ingesting sensor packets.',
      });
      fetchGatewayStatus(selectedGatewayId);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: `Failed to start monitoring: ${err.message}`,
      });
    } finally {
      setMonitoringLoading(false);
    }
  };

  // 5. Stop Monitoring
  const handleStopMonitoring = async () => {
    if (!selectedGatewayId) return;
    try {
      setMonitoringLoading(true);
      await api.stopGatewayMonitoring(selectedGatewayId);
      setIsMonitoringActive(false);
      setNotification({
        type: 'info',
        message: 'Telemetry monitoring suspended. Gateway is in standby mode.',
      });
      fetchGatewayStatus(selectedGatewayId);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: `Failed to stop monitoring: ${err.message}`,
      });
    } finally {
      setMonitoringLoading(false);
    }
  };

  // 6. Refresh Status
  const handleRefreshStatus = () => {
    if (selectedGatewayId) {
      fetchGatewayStatus(selectedGatewayId);
      setNotification({
        type: 'info',
        message: 'Gateway diagnostic state refreshed.',
      });
    }
  };

  return (
    <div className="space-y-6 max-w-6xl pb-12">
      {/* Page Header with Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link href="/settings" className="hover:text-blue-600">Settings</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-900 font-semibold">BLE Gateway Integration</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Radio className="w-6 h-6 text-blue-600" />
            <span>Industrial BLE Gateway Configuration</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure GAO BLE edge gateways, manage telemetry ingestion endpoints, credentials, and verify live sensor connectivity.
          </p>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshStatus}
            className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 shadow-2xs transition-colors"
            title="Refresh Diagnostic Status"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Refresh Status</span>
          </button>
        </div>
      </div>

      {/* Gateway Selector Tabs (if multiple registered) */}
      {gateways.length > 1 && (
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <span className="text-xs font-bold text-slate-500 mr-2 uppercase tracking-wider">Gateway Unit:</span>
          {gateways.map((gw) => (
            <button
              key={gw.id}
              onClick={() => selectGateway(gw)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedGatewayId === gw.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {gw.name} ({gw.gateway_eui})
            </button>
          ))}
        </div>
      )}

      {/* Notification Banner */}
      {notification && (
        <div
          className={`p-4 rounded-xl text-xs border shadow-xs space-y-1.5 ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : notification.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-900'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          <div className="flex items-center gap-2 font-bold text-sm">
            {notification.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            {notification.type === 'error' && <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />}
            {notification.type === 'info' && <Info className="w-4 h-4 text-blue-600 shrink-0" />}
            <span>{notification.message}</span>
          </div>
          {notification.troubleshooting && (
            <div className="pl-6 text-[11px] font-medium opacity-90 leading-relaxed">
              <strong className="block text-[11px] font-bold uppercase tracking-wider mb-0.5">
                Troubleshooting Guidance:
              </strong>
              <div className="whitespace-pre-line">{notification.troubleshooting}</div>
            </div>
          )}
        </div>
      )}

      {/* Top Status & Telemetry Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: Connection Health */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Connection Health</span>
            <Wifi className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full animate-pulse ${
                connectionStatus === 'CONNECTED'
                  ? 'bg-emerald-500 ring-4 ring-emerald-100'
                  : connectionStatus === 'ERROR'
                  ? 'bg-red-500 ring-4 ring-red-100'
                  : 'bg-slate-400 ring-4 ring-slate-100'
              }`}
            ></span>
            <span
              className={`text-base font-extrabold ${
                connectionStatus === 'CONNECTED'
                  ? 'text-emerald-700'
                  : connectionStatus === 'ERROR'
                  ? 'text-red-700'
                  : 'text-slate-600'
              }`}
            >
              {connectionStatus}
            </span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 font-mono truncate">
            {lastCommTime ? `Last comm: ${new Date(lastCommTime).toLocaleTimeString()}` : 'No communication yet'}
          </div>
        </div>

        {/* Card 2: Monitoring State */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Telemetry Pipeline</span>
            <Activity className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded text-xs font-black uppercase tracking-wider ${
                isMonitoringActive
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {isMonitoringActive ? '● MONITORING ACTIVE' : 'STANDBY PAUSED'}
            </span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 font-mono">
            Interval: {formData.polling_interval}s | Timeout: {formData.timeout_seconds}s
          </div>
        </div>

        {/* Card 3: Discovered Beacons */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Discovered Beacons</span>
            <Radio className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-slate-900">
              {discoveredDevices.length}
            </span>
            <span className="text-xs text-slate-500 ml-1.5 font-medium">active sensors</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 font-mono">
            Protocol: 2.4GHz RF KSensor / BLE
          </div>
        </div>

        {/* Card 4: Last Reading */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Latest Sensor Reading</span>
            <Thermometer className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            {lastReading && lastReading.temperature !== undefined ? (
              <>
                <span className="text-2xl font-black text-blue-700">
                  {Number(lastReading.temperature).toFixed(1)}°C
                </span>
                <span className="text-[10px] font-mono text-emerald-600 font-bold">
                  {lastReading.data_source || 'LIVE'}
                </span>
              </>
            ) : (
              <span className="text-sm font-bold text-slate-400">Waiting for data</span>
            )}
          </div>
          <div className="mt-2 text-[10px] text-slate-400 font-mono truncate">
            {lastReading?.battery ? `Battery: ${lastReading.battery}% | RSSI: ${lastReading.rssi || -60}dBm` : 'Telemetry ready'}
          </div>
        </div>
      </div>


      {/* Aperture Live Industrial BLE Gateway Active Banner */}
      {formData.host_url?.toLowerCase().includes('aperture') && (
        <div className="bg-blue-50/90 border border-blue-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping"></span>
              <span className="font-bold text-blue-950 uppercase tracking-wide">
                Aperture Live Industrial BLE Gateway (GAO / KKM Firmware)
              </span>
              <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px] border border-emerald-200">
                Live Gateway Stream Active
              </span>
            </div>
            <p className="text-blue-800 text-[11px]">
              Connected to live industrial BLE gateway <span className="font-mono font-bold">GW-304A2657BF44</span> with live multi-beacon temperature sensors, battery monitoring, and telemetry history.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="https://gateway.apertureventurestudio.com/api/v1/gateway/ble/telemetry/latest"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-xs"
            >
              <span>View /latest JSON</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <a
              href="https://gateway.apertureventurestudio.com/api/v1/gateway/ble/telemetry/history"
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-xs transition-all flex items-center gap-1"
            >
              <span>View /history JSON</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
          </div>
        </div>
      )}

      {/* Main Grid: Configuration Form & Live Discovered Devices */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Gateway Configuration Form (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Server className="w-4 h-4 text-blue-600" />
                <span>Gateway Connection Parameters</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Parameters required by the FastAPI gateway adapter to query telemetry.
              </p>
            </div>
            <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
              Adapter: {formData.adapter_type}
            </span>
          </div>

          <form onSubmit={handleSave} className="space-y-4 text-xs">
            {/* Row 1: Gateway Name & Identifier */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Gateway Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. GAO Cold-Chain Gateway Hub 1"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Gateway Identifier (EUI / MAC) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.gateway_eui}
                  onChange={(e) => setFormData({ ...formData, gateway_eui: e.target.value })}
                  placeholder="e.g. GW-304A2657BF44"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Row 2: Gateway Host URL & API Base Path */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Gateway Host URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.host_url}
                  onChange={(e) => setFormData({ ...formData, host_url: e.target.value })}
                  placeholder="http://192.168.10.45:8080 or https://gateway.company.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Enforces anti-SSRF: Private IP allowed via admin policy; remote hosts require HTTPS.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">API Base Path</label>
                <input
                  type="text"
                  value={formData.api_base_path}
                  onChange={(e) => setFormData({ ...formData, api_base_path: e.target.value })}
                  placeholder="/api/v1"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Row 3: Authentication Method & Credentials */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Authentication Method
                </label>
                <select
                  value={formData.auth_method}
                  onChange={(e) => setFormData({ ...formData, auth_method: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="NONE">None (Open Local LAN)</option>
                  <option value="API_KEY">API Key Header (X-API-Key)</option>
                  <option value="BEARER_TOKEN">Bearer Token (Authorization)</option>
                  <option value="BASIC">HTTP Basic Auth</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>API Key / Secret Token</span>
                  <Lock className="w-3 h-3 text-slate-400" />
                </label>
                <input
                  type="password"
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  placeholder={formData.auth_method === 'NONE' ? 'Not required for None' : 'Enter secret key'}
                  disabled={formData.auth_method === 'NONE'}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-400"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Encrypted at rest in database. Frontend only receives masked representation.
                </span>
              </div>
            </div>

            {/* Row 4: Polling Interval, Timeout & Adapter Type */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Polling Interval (sec)</label>
                <input
                  type="number"
                  min="1"
                  max="300"
                  value={formData.polling_interval}
                  onChange={(e) => setFormData({ ...formData, polling_interval: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Timeout (seconds)</label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={formData.timeout_seconds}
                  onChange={(e) => setFormData({ ...formData, timeout_seconds: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Adapter Implementation</label>
                <select
                  value={formData.adapter_type}
                  onChange={(e) => setFormData({ ...formData, adapter_type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="GAO_BLE">GAO 214060/217030 Hardware</option>
                  <option value="SIMULATED">Software Simulator (Dev Mode)</option>
                </select>
              </div>
            </div>

            {/* Row 5: Security Toggles */}
            <div className="flex flex-wrap items-center gap-6 pt-2 pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_enabled}
                  onChange={(e) => setFormData({ ...formData, is_enabled: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="font-semibold text-slate-700 text-xs">Gateway Enabled</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.verify_ssl}
                  onChange={(e) => setFormData({ ...formData, verify_ssl: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="font-semibold text-slate-700 text-xs">Verify TLS / SSL Certificate</span>
              </label>
            </div>

            {/* Action Buttons Toolbar */}
            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg border border-slate-300 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Activity className={`w-3.5 h-3.5 ${testing ? 'animate-spin text-blue-600' : 'text-slate-600'}`} />
                  <span>{testing ? 'Testing...' : 'Test Connection'}</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDiscoverDevices}
                  disabled={discovering}
                  className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg border border-indigo-200 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Radio className={`w-3.5 h-3.5 ${discovering ? 'animate-pulse text-indigo-600' : ''}`} />
                  <span>{discovering ? 'Scanning...' : 'Discover Devices'}</span>
                </button>

                {isMonitoringActive ? (
                  <button
                    type="button"
                    onClick={handleStopMonitoring}
                    disabled={monitoringLoading}
                    className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-lg border border-amber-300 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <Square className="w-3.5 h-3.5 text-amber-600 fill-amber-600" />
                    <span>Stop Monitoring</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartMonitoring}
                    disabled={monitoringLoading}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Start Monitoring</span>
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* Right Column: Live Status, Discovered Devices & Troubleshooting (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Panel 1: Discovered Devices Table */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Radio className="w-4 h-4 text-indigo-600" />
                <span>Discovered BLE Sensors</span>
              </h3>
              <span className="text-[11px] font-mono text-slate-500 font-semibold">
                {discoveredDevices.length} Detected
              </span>
            </div>

            {discoveredDevices.length === 0 ? (
              <div className="text-center py-8 px-4 text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                <Radio className="w-6 h-6 mx-auto text-slate-300 mb-2" />
                <p className="font-semibold text-slate-600">No BLE Devices Discovered Yet</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Click <strong>Discover Devices</strong> above to scan for nearby temperature beacons (Aperture Industrial Beacon / BLE).
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                      <th className="pb-2">Sensor / MAC</th>
                      <th className="pb-2">Temp</th>
                      <th className="pb-2">Batt</th>
                      <th className="pb-2 text-right">RSSI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {discoveredDevices.map((dev, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5">
                          <div className="font-bold text-slate-800 text-[11px] truncate max-w-[130px]">
                            {dev.name}
                          </div>
                          <div className="font-mono text-[10px] text-slate-400">
                            {dev.device_mac}
                          </div>
                        </td>
                        <td className="py-2.5 font-bold font-mono">
                          {dev.temperature !== undefined && dev.temperature !== null ? (
                            <span className={dev.temperature > 8.0 ? 'text-red-600' : 'text-emerald-700'}>
                              {Number(dev.temperature).toFixed(1)}°C
                            </span>
                          ) : (
                            <span className="text-slate-400">--</span>
                          )}
                        </td>
                        <td className="py-2.5">
                          <span className="font-mono text-[11px] text-slate-600">
                            {dev.battery ?? 95}%
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-mono text-[11px] text-slate-500">
                          {dev.rssi ?? -65} dBm
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Panel 2: Error & Troubleshooting Guidance */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-amber-600" />
              <span>Diagnostics &amp; Troubleshooting</span>
            </h3>

            {lastErrorMsg ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-red-800">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                  <span>Last Error Recorded:</span>
                </div>
                <div className="font-mono text-[11px] text-red-700 break-words">{lastErrorMsg}</div>
                {troubleshootingTip && (
                  <div className="mt-2 pt-2 border-t border-red-200/80 text-[11px] text-red-800">
                    <strong>Recommended Fix:</strong>
                    <div className="whitespace-pre-line mt-0.5">{troubleshootingTip}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-2">
                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Operational Guidance:</span>
                </div>
                <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-500 leading-relaxed">
                  <li>Hardware adapters query physical GAO BLE gateways via FastAPI on private or approved HTTPS channels.</li>
                  <li>In simulated mode, telemetry is dynamically generated by the physics engine in <code>temp_simulator.py</code>.</li>
                  <li>All credential changes are securely audited in the system compliance trail.</li>
                </ul>
              </div>
            )}

            <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-100">
              <span>Security Policy: Anti-SSRF Enabled</span>
              <Link href="/audit-logs" className="text-blue-600 hover:underline flex items-center gap-1">
                <span>View Gateway Audit Logs</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
