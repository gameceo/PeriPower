import streamDeck, { action, SingletonAction, type WillAppearEvent, type WillDisappearEvent, type DidReceiveSettingsEvent, type KeyDownEvent } from '@elgato/streamdeck';
import { BatteryClient } from './client.js';
import { display, svg, type Channel } from './model.js';
type Settings = { deviceId?: string; channel?: Channel; threshold?: number };
let client = new BatteryClient();
let initialized: Promise<void> | undefined;
let connectionKey = '';
let appearances = 0;
@action({ UUID: 'com.gameceo.peripower.battery' })
class BatteryAction extends SingletonAction<Settings> {
  constructor() {
    super();
    client.on('update', () => { void this.renderAll().catch(() => {}); });
    streamDeck.settings.onDidReceiveGlobalSettings(ev => this.configure(ev.settings));
  }
  private configure(settings: { port?: unknown; token?: unknown }) {
    const port = typeof settings.port === 'number' && Number.isInteger(settings.port) && settings.port >= 1024 && settings.port <= 65535 ? settings.port : 19211;
    const token = typeof settings.token === 'string' ? settings.token : '';
    const key = JSON.stringify([port, token]);
    if (key === connectionKey) return;
    connectionKey = key;
    client.removeAllListeners(); client.stop();
    client = new BatteryClient(`ws://127.0.0.1:${port}/`, token);
    client.on('update', () => { void this.renderAll().catch(() => {}); });
    if (appearances) client.start();
    void this.renderAll().catch(() => {});
  }
  private async renderAll() {
    for (const a of this.actions) {
      if (!a.isKey()) continue;
      const s = await a.getSettings();
      const channel = ['percentage','leftPercent','rightPercent','casePercent'].includes(s.channel ?? '') ? s.channel! : 'percentage';
      const threshold = typeof s.threshold === 'number' && s.threshold >= 0 && s.threshold <= 100 ? s.threshold : 20;
      const image = svg(display(client.devices.find(d => d.id === s.deviceId), channel, client.online, threshold));
      await a.setTitle(''); await a.setImage(`data:image/svg+xml,${encodeURIComponent(image)}`);
    }
  }
  override async onWillAppear(_ev: WillAppearEvent<Settings>) {
    appearances++;
    initialized ??= streamDeck.settings.getGlobalSettings().then(s => this.configure(s));
    await initialized; if (appearances) client.start(); await this.renderAll();
  }
  override onWillDisappear(_ev: WillDisappearEvent<Settings>) { if (--appearances <= 0) { appearances = 0; client.stop(); } }
  override async onDidReceiveSettings(_ev: DidReceiveSettingsEvent<Settings>) { await this.renderAll(); }
  override async onKeyDown(_ev: KeyDownEvent<Settings>) { try { await client.refresh(); } catch { /* disconnected state is rendered separately */ } }
  override async onSendToPlugin() {
    await streamDeck.ui.sendToPropertyInspector({ devices: client.devices.map(d => ({ id: d.id, name: d.displayName })), online: client.online });
  }
}
streamDeck.actions.registerAction(new BatteryAction());
streamDeck.connect();
