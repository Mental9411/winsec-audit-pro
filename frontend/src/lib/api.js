const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : await res.blob();
  if (!res.ok) {
    const message = isJson ? (data.detail || data.error || 'Request failed') : 'Request failed';
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
  }
  return data;
}

export const api = {
  health: () => request('/health'),

  scanModules: () => request('/scan/modules'),
  startScan: (scan_type) => request('/scan/start', { method: 'POST', body: JSON.stringify({ scan_type }) }),
  cancelScan: (scanId) => request(`/scan/${scanId}/cancel`, { method: 'POST' }),
  getScan: (scanId) => request(`/scan/${scanId}`),
  latestScan: () => request('/scan/latest'),
  scanHistory: (limit = 50) => request(`/scan/history?limit=${limit}`),

  dashboardSummary: () => request('/dashboard/summary'),

  reportUrl: (scanId, fmt) => `${BASE}/reports/${scanId}/${fmt}`,

  killProcess: (pid, confirm) => request('/actions/kill-process', { method: 'POST', body: JSON.stringify({ pid, confirm }) }),
  disableStartup: (hive, value_name, confirm) => request('/actions/disable-startup', { method: 'POST', body: JSON.stringify({ hive, value_name, confirm }) }),

  getSettings: () => request('/settings'),
  updateSettings: (payload) => request('/settings', { method: 'PUT', body: JSON.stringify(payload) }),

  aiChat: (messages) => request('/ai/chat', { method: 'POST', body: JSON.stringify({ messages }) }),
  aiContext: () => request('/ai/context'),
  aiStatus: () => request('/ai/status'),
};
