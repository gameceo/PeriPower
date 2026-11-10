export type Channel = 'percentage' | 'leftPercent' | 'rightPercent' | 'casePercent';
export type Device = {
  id: string; displayName: string; percentage: number | null;
  level: 'unknown' | 'empty' | 'low' | 'medium' | 'full';
  leftPercent?: number | null; rightPercent?: number | null; casePercent?: number | null;
  charging: boolean; leftCharging?: boolean; rightCharging?: boolean; caseCharging?: boolean;
  connected: boolean; stale: boolean; lastSeen: number;
};
export function parseDevices(value: unknown): Device[] {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { devices?: unknown }).devices))
    throw new Error('Invalid snapshot');
  const result: Device[] = [];
  const ids = new Set<string>();
  for (const entry of (value as { devices: unknown[] }).devices) {
    if (!entry || typeof entry !== 'object') throw new Error('Invalid device');
    const d = entry as Device;
    const validPercent = (p: unknown) => p === null || (typeof p === 'number' && Number.isInteger(p) && p >= 0 && p <= 100);
    if (typeof d.id !== 'string' || !d.id || ids.has(d.id) || typeof d.displayName !== 'string' ||
        !validPercent(d.percentage) || !['unknown','empty','low','medium','full'].includes(d.level) ||
        typeof d.connected !== 'boolean' || typeof d.stale !== 'boolean' || typeof d.charging !== 'boolean' ||
        !Number.isFinite(d.lastSeen) ||
        [d.leftPercent,d.rightPercent,d.casePercent].some(p => p !== undefined && !validPercent(p)))
      throw new Error('Invalid device fields');
    ids.add(d.id); result.push(d);
  }
  return result;
}
const levels = { unknown: '未知', empty: '空', low: '低', medium: '中', full: '满' };
export function display(d: Device | undefined, channel: Channel, online: boolean, threshold = 20) {
  if (!online) return { name: 'PeriPower', value: '服务断开', color: '#64748b' };
  if (!d) return { name: '选择设备', value: '设备未找到', color: '#64748b' };
  const p = d[channel];
  const charging = channel === 'percentage' ? d.charging : d[channel === 'leftPercent' ? 'leftCharging' : channel === 'rightPercent' ? 'rightCharging' : 'caseCharging'];
  const value = p === null || p === undefined ? (channel === 'percentage' ? levels[d.level] : '未知') : `${p}%`;
  const status = d.stale ? '缓存' : !d.connected ? '离线' : charging ? '充电' : '';
  return { name: d.displayName, value: `${value}${status ? ' · ' + status : ''}`,
    color: d.stale || !d.connected ? '#64748b' : charging ? '#38bdf8' :
      (typeof p === 'number' ? p <= threshold : ['empty','low'].includes(d.level)) ? '#f87171' : '#4ade80' };
}
export function svg(d: ReturnType<typeof display>) {
  const escape = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144"><rect width="144" height="144" rx="16" fill="#111827"/><rect x="14" y="18" width="116" height="5" rx="2" fill="${d.color}"/><text x="72" y="62" text-anchor="middle" fill="white" font-family="sans-serif" font-size="15">${escape(d.name.slice(0,16))}</text><text x="72" y="101" text-anchor="middle" fill="${d.color}" font-family="sans-serif" font-size="20">${escape(d.value)}</text></svg>`;
}
