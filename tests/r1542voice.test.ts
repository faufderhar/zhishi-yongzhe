// r15.4.2 较真家长 D / 技术QA P3-4：离线录音状态用家长话、真实已下载数、失败自动退避重试、缺录音提示「联网后自动补全」
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
const store = new Map<string, unknown>(); let online = true; let failSet = new Set<string>(); let fetchN = 0;
beforeEach(() => {
  store.clear(); online = true; failSet = new Set(); fetchN = 0; vi.resetModules(); vi.useFakeTimers();
  const ls = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => ls.get(k) ?? null, setItem: (k: string, v: string) => ls.set(k, v), removeItem: (k: string) => ls.delete(k) });
  vi.stubGlobal('navigator', { get onLine() { return online; } });
  vi.stubGlobal('document', { baseURI: 'http://x/' });
  vi.stubGlobal('window', { requestIdleCallback: (f: () => void) => setTimeout(f, 0) });
  vi.stubGlobal('caches', { open: async () => ({ match: async (u: string) => store.get(u), put: async (u: string, r: unknown) => { store.set(u, r); } }) });
  vi.stubGlobal('fetch', async (u: string) => { if (u.endsWith('manifest.json')) return { ok: true, json: async () => ({ items: { a: 'a.mp3', b: ['b1.mp3', 'b2.mp3'], c: 'c.mp3' } }) };
    fetchN++; const f = u.split('/').pop()!; return failSet.has(f) ? { ok: false, status: 503 } : { ok: true, status: 200 }; });
});
describe('r15.4.2 离线录音下载', () => {
  it('全部成功：ok = total，state done，没有重试', async () => {
    const m = await import('../src/offlineCache'); const p = m.cacheVoiceForOffline(); await vi.advanceTimersByTimeAsync(50); const s = await p;
    expect(s).toMatchObject({ total: 4, done: 4, failed: 0, ok: 4, state: 'done' }); expect(s!.retryAt).toBeUndefined();
  });
  it('有失败：state failed、ok 只算真下载到的；按 10s → 30s 退避自动重试，修好后补全', async () => {
    const m = await import('../src/offlineCache'); failSet = new Set(['b2.mp3', 'c.mp3']);
    const p = m.cacheVoiceForOffline(); await vi.advanceTimersByTimeAsync(50); const s = await p;
    expect(s).toMatchObject({ total: 4, failed: 2, ok: 2, state: 'failed' }); expect(s!.retryAt! - s!.at).toBeGreaterThanOrEqual(9000);
    await vi.advanceTimersByTimeAsync(10050); expect(m.voiceStatus()).toMatchObject({ failed: 2, ok: 2, state: 'failed' });   // 第 1 次重试还失败
    failSet.clear(); await vi.advanceTimersByTimeAsync(29000); expect(m.voiceStatus()!.state).toBe('failed');   // 第 2 次是 30 秒后
    await vi.advanceTimersByTimeAsync(1100); expect(m.voiceStatus()).toMatchObject({ failed: 0, ok: 4, state: 'done' });
    const n = fetchN; await vi.advanceTimersByTimeAsync(600e3); expect(fetchN).toBe(n);   // 好了以后不再重试
  });
  it('断网时调用：下载中的状态改成 failed（显示「联网后会自动补全」），不发请求', async () => {
    const m = await import('../src/offlineCache'); localStorage.setItem('zy-offline-voice', JSON.stringify({ done: 1, total: 4, failed: 0, ok: 1, at: 1, state: 'running' })); online = false;
    expect(await m.cacheVoiceForOffline()).toBeNull(); expect(m.voiceStatus()).toMatchObject({ state: 'failed' }); expect(fetchN).toBe(0);
  });
  it('退避表', async () => { const m = await import('../src/offlineCache'); expect([0, 1, 2, 3, 9].map(m.voiceRetryDelay)).toEqual([10e3, 30e3, 90e3, 300e3, 300e3]); });
  it('联网事件也会重试（App online 监听调 cacheVoiceForOffline）', () => { expect(readFileSync('src/App.tsx', 'utf8')).toMatch(/const on = \(\) => \{[^\n]*cacheVoiceForOffline\(\)[^\n]*window\.addEventListener\('online', on\)/); });
});
describe('r15.4.2 家长页文案', () => {
  const src = readFileSync('src/ui/Parent.tsx', 'utf8');
  it('不再显示「N 段」；三种状态都是家长话', () => {
    const vo = src.slice(src.indexOf('export function VoiceOffline'), src.indexOf('function PrefetchAnim'));
    expect(vo).not.toMatch(/段）/); expect(vo).toMatch(/小班录音已下载，断网也能听/); expect(vo).toMatch(/正在下载…已下载/); expect(vo).toMatch(/联网后会自动补全/);
  });
  it('构建号 / 题库指纹收进「技术信息」', () => { expect(src).toMatch(/<details className="tech-info"><summary>技术信息<\/summary><b data-testid="version-label">/); });
  it('缺录音时提示「联网后自动补全」，不是安装语音引擎', () => {
    expect(readFileSync('src/App.tsx', 'utf8')).toMatch(/ttsIssue === 'missing' \? '这段录音还没下载好，联网后自动补全'/);
    expect(readFileSync('src/tts.ts', 'utf8')).toMatch(/notify\(recHad \? 'missing'/);
  });
});
describe('r15.4.2 技术QA P4：朗读提示条紧凑', () => {
  it('文字短、用 ✕ 关闭；小屏字号 / 内边距更小', () => {
    const app = readFileSync('src/App.tsx', 'utf8'); const css = readFileSync('src/app.css', 'utf8');
    const line = app.split('\n').find(l => l.includes('tts-bar'))!; expect(line).not.toMatch(/点此关闭/); expect(line).toMatch(/className="tts-x"/); expect(app).not.toMatch(/安装语音引擎并下载中文语音/);
    expect(css).toMatch(/@media \(max-width:700px\),\(max-height:460px\)\{\.sys-bar\.tts-bar\{font-size:13px/);
  });
});
