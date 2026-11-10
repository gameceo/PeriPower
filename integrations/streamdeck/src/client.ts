import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import { parseDevices, type Device } from './model.js';

// Shared by all key instances. Immediate notifications may precede subscribe replies.
export class BatteryClient extends EventEmitter {
  devices: Device[] = [];
  online = false;
  private socket?: WebSocket;
  private stopped = true;
  private sequence = 0;
  private retry = 500;
  private reconnect?: ReturnType<typeof setTimeout>;
  private poll?: ReturnType<typeof setInterval>;
  private lastRefresh = 0;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  constructor(readonly endpoint = 'ws://127.0.0.1:19211/', private token = '') { super(); }
  start() { if (!this.stopped) return; this.stopped = false; this.connect(); }
  stop() {
    this.stopped = true; clearTimeout(this.reconnect); clearInterval(this.poll);
    this.online = false; const previous = this.socket; this.socket = undefined;
    previous?.terminate(); this.failPending(); this.emit('update');
  }
  private failPending() {
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error('Connection closed')); }
    this.pending.clear();
  }
  request(method: string, params: object = {}): Promise<unknown> {
    if (this.socket?.readyState !== WebSocket.OPEN) return Promise.reject(new Error('Service unavailable'));
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('Request timeout')); }, 4000);
      this.pending.set(id, { resolve, reject, timer });
      this.socket!.send(JSON.stringify({ jsonrpc: '2.0', method, params, id }), e => {
        if (e) { clearTimeout(timer); this.pending.delete(id); reject(new Error('Send failed')); }
      });
    });
  }
  async refresh() {
    if (Date.now() - this.lastRefresh < 1500) return;
    this.lastRefresh = Date.now(); await this.request('refresh.now', { wait: false });
  }
  private connect() {
    if (this.stopped) return;
    const url = new URL(this.endpoint);
    if (url.protocol !== 'ws:' || !['127.0.0.1','localhost','[::1]'].includes(url.hostname) || url.username || url.password || url.search)
      throw new Error('Use a local WebSocket endpoint without credentials');
    const ws = this.socket = new WebSocket(url, { handshakeTimeout: 4000, maxPayload: 2 * 1024 * 1024 });
    ws.on('error', () => { /* close handles recovery; never log credentials */ });
    ws.on('message', raw => {
      if (this.socket !== ws) return;
      try {
        const m = JSON.parse(raw.toString());
        if (m.jsonrpc !== '2.0') return;
        if (m.method === 'devices.updated') { this.devices = parseDevices(m.params); this.emit('update'); }
        else if (typeof m.id === 'number') {
          const p = this.pending.get(m.id); if (!p) return;
          this.pending.delete(m.id); clearTimeout(p.timer);
          if (m.error) p.reject(new Error(`RPC error ${m.error.code}`)); else p.resolve(m.result);
        }
      } catch { /* malformed snapshots never replace the last valid snapshot */ }
    });
    ws.on('open', () => { void this.initialize(ws); });
    ws.on('close', () => {
      if (this.socket !== ws) return;
      this.online = false; clearInterval(this.poll); this.failPending(); this.emit('update');
      if (!this.stopped) { this.reconnect = setTimeout(() => this.connect(), this.retry); this.retry = Math.min(15000, this.retry * 2); }
    });
  }
  private async initialize(ws: WebSocket) {
    try {
      if (this.token) await this.request('system.authorize', { token: this.token });
      const info = await this.request('system.getInfo') as { apiVersion?: string };
      if (info.apiVersion !== '1.0') throw new Error('Unsupported API');
      await this.request('devices.subscribe', { events: ['devices.updated'], immediate: true });
      this.devices = parseDevices(await this.request('devices.list'));
      if (this.socket !== ws || this.stopped) return;
      this.online = true; this.retry = 500; this.emit('update');
      this.poll = setInterval(() => { void this.request('devices.list').then(v => {
        this.devices = parseDevices(v); this.emit('update');
      }).catch(() => ws.terminate()); }, 15000);
    } catch { ws.terminate(); }
  }
}
