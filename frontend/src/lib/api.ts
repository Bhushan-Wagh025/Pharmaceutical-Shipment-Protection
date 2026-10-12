const API_BASE_URL = typeof window !== 'undefined' 
  ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1')
  : 'http://127.0.0.1:8000/api/v1';

export interface Gateway {
  id: number;
  name: string;
  gateway_identifier?: string;
  gateway_eui?: string;
  host_url?: string;
  api_base_path?: string;
  auth_method?: string;
  api_key?: string;
  api_key_masked?: string;
  polling_interval?: number;
  timeout_seconds?: number;
  is_enabled?: boolean;
  verify_ssl?: boolean;
  tls_certificate?: string;
  adapter_type?: string;
  status?: string;
  is_monitoring?: boolean;
  last_error?: string | null;
  last_communication_at?: string | null;
  last_reading_data?: string | null;
  created_at?: string;
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('pharma_auth_token');
}

export function setAuthToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('pharma_auth_token', token);
  }
}

export function removeAuthToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('pharma_auth_token');
    localStorage.removeItem('pharma_user_info');
  }
}

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, { ...options, headers });
  
  if (!response.ok) {
    let errMessage = `Error ${response.status}: ${response.statusText}`;
    try {
      const errData = await response.json();
      if (errData.detail) errMessage = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
    } catch {
      // ignore
    }
    throw new Error(errMessage);
  }

  return response.json();
}

export const api = {
  // Auth
  login: async (creds: { email: string; password: string }) => {
    const data = await fetchWithAuth('/auth/login', {
      method: 'POST',
      body: JSON.stringify(creds),
    });
    setAuthToken(data.access_token);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pharma_user_info', JSON.stringify(data.user));
    }
    return data;
  },
  getCurrentUser: () => fetchWithAuth('/auth/me'),

  // Shipments & Overview
  getOverview: () => fetchWithAuth('/shipments/overview'),
  getShipments: (params?: { status?: string; risk?: string }) => {
    const q = new URLSearchParams(params as any).toString();
    return fetchWithAuth(`/shipments${q ? `?${q}` : ''}`);
  },
  getShipment: (id: string | number) => fetchWithAuth(`/shipments/${id}`),
  createShipment: (data: any) => fetchWithAuth('/shipments', { method: 'POST', body: JSON.stringify(data) }),
  updateShipment: (id: string | number, data: any) => fetchWithAuth(`/shipments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteShipment: (id: string | number) => fetchWithAuth(`/shipments/${id}`, { method: 'DELETE' }),

  // Telemetry & Forecast
  getTempHistory: (shipmentId: string | number, limit = 100) => fetchWithAuth(`/temperature/history/${shipmentId}?limit=${limit}`),
  ingestReading: (data: any) => fetchWithAuth('/temperature/readings', { method: 'POST', body: JSON.stringify(data) }),
  getLatestForecast: (shipmentId: string | number) => fetchWithAuth(`/forecast/${shipmentId}/latest`),
  runForecast: (shipmentId: string | number) => fetchWithAuth(`/forecast/${shipmentId}/run`, { method: 'POST' }),
  getRiskEvents: (shipmentId: string | number) => fetchWithAuth(`/risk/${shipmentId}/events`),

  // Trays & Actuation
  getTrays: () => fetchWithAuth('/trays'),
  getTrayStatus: (trayId: string | number) => fetchWithAuth(`/trays/${trayId}/status`),
  moveTrayIn: (trayId: string | number) => fetchWithAuth(`/trays/${trayId}/move-in`, { method: 'POST' }),
  moveTrayOut: (trayId: string | number) => fetchWithAuth(`/trays/${trayId}/move-out`, { method: 'POST' }),
  resetTray: (trayId: string | number) => fetchWithAuth(`/trays/${trayId}/reset`, { method: 'POST' }),

  // Protection Actions
  getProtectionActions: (shipmentId?: string | number) => {
    const q = shipmentId ? `?shipment_id=${shipmentId}` : '';
    return fetchWithAuth(`/protection/actions${q}`);
  },

  // Devices & Gateways
  getDevices: () => fetchWithAuth('/devices'),
  createDevice: (data: any) => fetchWithAuth('/devices', { method: 'POST', body: JSON.stringify(data) }),
  getGateways: () => fetchWithAuth('/gateways'),
  getGateway: (id: string | number) => fetchWithAuth(`/gateways/${id}`),
  createGateway: (data: any) => fetchWithAuth('/gateways', { method: 'POST', body: JSON.stringify(data) }),
  updateGateway: (id: string | number, data: any) => fetchWithAuth(`/gateways/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  testGatewayConnection: (id: string | number) => fetchWithAuth(`/gateways/${id}/test-connection`, { method: 'POST' }),
  discoverGatewayDevices: (id: string | number) => fetchWithAuth(`/gateways/${id}/discover-devices`, { method: 'POST' }),
  startGatewayMonitoring: (id: string | number) => fetchWithAuth(`/gateways/${id}/start-monitoring`, { method: 'POST' }),
  stopGatewayMonitoring: (id: string | number) => fetchWithAuth(`/gateways/${id}/stop-monitoring`, { method: 'POST' }),
  getGatewayStatus: (id: string | number) => fetchWithAuth(`/gateways/${id}/status`),
  emergencyStopTray: (trayId: string | number) => fetchWithAuth(`/trays/${trayId}/emergency-stop`, { method: 'POST' }),
  overrideTray: (trayId: string | number, targetPercentage: number, reason?: string) => 
    fetchWithAuth(`/trays/${trayId}/override`, { method: 'POST', body: JSON.stringify({ target_percentage: targetPercentage, reason }) }),

  // Alerts
  getAlerts: (params?: { shipment_id?: string | number; unack_only?: boolean; severity?: string; limit?: number }) => {
    const q = new URLSearchParams(params as any).toString();
    return fetchWithAuth(`/alerts${q ? `?${q}` : ''}`);
  },
  acknowledgeAlert: (alertId: string | number, acknowledgedBy = 'Operator') => 
    fetchWithAuth(`/alerts/${alertId}/acknowledge`, { method: 'POST', body: JSON.stringify({ acknowledged_by: acknowledgedBy }) }),

  // Reports & Audits
  getComplianceReport: () => fetchWithAuth('/reports/compliance'),
  getAuditLogs: (params?: { action?: string; resource_type?: string }) => {
    const q = new URLSearchParams(params as any).toString();
    return fetchWithAuth(`/audit${q ? `?${q}` : ''}`);
  },

  // Users & Companies
  getUsers: () => fetchWithAuth('/users'),
  getRoles: () => fetchWithAuth('/users/roles'),
  createUser: (data: any) => fetchWithAuth('/users', { method: 'POST', body: JSON.stringify(data) }),
  getCompanies: () => fetchWithAuth('/companies'),

  // Simulator Controls
  simulatorStep: (shipmentId: string | number) => fetchWithAuth(`/simulator/step/${shipmentId}`, { method: 'POST' }),
  simulatorTriggerExcursion: (shipmentId: string | number) => fetchWithAuth(`/simulator/trigger-excursion/${shipmentId}`, { method: 'POST' }),
  simulatorReset: (shipmentId: string | number) => fetchWithAuth(`/simulator/reset/${shipmentId}`, { method: 'POST' }),
  simulatorAutoRunStart: (shipmentId: string | number) => fetchWithAuth(`/simulator/auto-run/start/${shipmentId}`, { method: 'POST' }),
  simulatorAutoRunStop: (shipmentId: string | number) => fetchWithAuth(`/simulator/auto-run/stop/${shipmentId}`, { method: 'POST' }),
};
