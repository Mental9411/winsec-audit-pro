const HISTORY_LIMIT = 500;
// Fixed local port the FastAPI backend always runs on (see backend/run.py /
// electron/main.js). Used as a fallback when the frontend isn't being
// served by a dev server or a same-origin proxy - i.e. a packaged Electron
// build loading dist/index.html via file://, where window.location.host
// is empty and there's nothing to proxy /ws through.
const BACKEND_FALLBACK_HOST = '127.0.0.1:8000';

function resolveWsUrl() {
  const { protocol, host } = window.location;

  // Packaged Electron (file://) or any context with no host to proxy
  // through - talk to the local backend directly.
  if (!host || protocol === 'file:') {
    return `ws://${BACKEND_FALLBACK_HOST}/ws`;
  }

  // Dev server (vite) or any normal http(s) deployment - use whatever
  // host/port the page actually loaded from, so this keeps working even if
  // vite falls back to a different port than its configured default.
  const proto = protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${host}/ws`;
}

class WSClient {
  constructor() {
    this.listeners = new Map(); // event -> Set<fn>
    this.history = new Map(); // event -> array of recent payloads
    this.statusListeners = new Set();
    this.ws = null;
    this.connected = false;
    this.reconnectDelay = 1500;
    this.connect();
  }

  connect() {
    const url = resolveWsUrl();
    try {
      this.ws = new WebSocket(url);
    } catch (e) {
      this._setConnected(false);
      setTimeout(() => this.connect(), this.reconnectDelay);
      return;
    }

    this.ws.onopen = () => this._setConnected(true);

    this.ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        const { event, ...payload } = msg;
        if (!event) return;

        if (!this.history.has(event)) this.history.set(event, []);
        const buf = this.history.get(event);
        buf.push(payload);
        if (buf.length > HISTORY_LIMIT) buf.shift();

        const set = this.listeners.get(event);
        if (set) set.forEach((fn) => fn(payload));
      } catch (e) { /* ignore malformed */ }
    };

    this.ws.onclose = () => {
      this._setConnected(false);
      setTimeout(() => this.connect(), this.reconnectDelay);
    };
    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  _setConnected(value) {
    this.connected = value;
    this.statusListeners.forEach((fn) => fn(value));
  }

  /** Subscribe to an event. Returns an unsubscribe function. */
  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(fn);
    return () => this.listeners.get(event)?.delete(fn);
  }

  /** Subscribe to connection status changes (true/false). Returns an unsubscribe function. */
  onStatus(fn) {
    this.statusListeners.add(fn);
    fn(this.connected);
    return () => this.statusListeners.delete(fn);
  }

  /** Recent backlog for an event, e.g. terminal lines broadcast before this
   * page mounted - lets a page that mounts late (like navigating to Live
   * Terminal after a scan already ran) show full history immediately
   * instead of only messages that happen to arrive after mount. */
  getHistory(event) {
    return this.history.get(event) || [];
  }
}

export const wsClient = new WSClient();
