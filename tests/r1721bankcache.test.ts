// r17.2.1 热修（学霸 r17.2：旧档点更新条后初三仍只 5 科——SW 预缓存忽略 ?v=，把旧题库当新题库返回）
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fetchBuiltinBanks } from '../src/bankStore';
import { waitForController, controllerGen } from '../src/swUpdate';
import type { GradeKey } from '../src/game/questions';

const cfg = readFileSync('vite.config.ts', 'utf8');
const ignoreList = () => cfg.match(/ignoreURLParametersMatching: \[([^\]]*)\]/)?.[1] ?? '';
const G: GradeKey[] = ['7', '8', '9'];
const bank = (g: string, version: string) => ({ bank_name: 't', version, grade: Number(g), questions: [] });
type Init = RequestInit | undefined;
const resp = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body }) as unknown as Response;
/** 模拟 Workbox 预缓存匹配：去掉 ignore 命中的参数后，地址和预缓存条目完全一样才命中；否则走网络 */
function fakeSW(ignore: RegExp[], precache: Record<string, string>, network: Record<string, string> | null) {
  const calls: { url: string; init: Init; from: 'precache' | 'network' | 'fail' }[] = [];
  const fn = async (url: string, init?: Init) => {
    const u = new URL(url, 'https://x/app/'); for (const k of [...u.searchParams.keys()]) if (ignore.some(r => r.test(k))) u.searchParams.delete(k);
    const key = u.pathname.replace('/app/', '') + u.search; const g = /bank_(\w+)\.json/.exec(url)![1];
    if (precache[key] && init?.cache !== 'no-store') { calls.push({ url, init, from: 'precache' }); return resp(bank(g, precache[key])); }
    if (!network) { calls.push({ url, init, from: 'fail' }); throw new TypeError('Failed to fetch'); }
    calls.push({ url, init, from: 'network' }); return resp(bank(g, network[g]));
  };
  return { fn: fn as unknown as typeof fetch, calls };
}
const OLD_IGNORE = [/^v$/, /^utm_/], NEW_IGNORE = [/^utm_/];
const allV = (v: string) => Object.fromEntries(G.map(g => [g, v]));
const pre = (v: Record<string, string>) => Object.fromEntries(G.map(g => [`banks/bank_${g}.json`, v[g]]));

describe('r17.2.1 题库缓存', () => {
  it('vite.config：ignoreURLParametersMatching 不再有 /^v$/（utm_ 还在）', () => {
    expect(ignoreList()).not.toMatch(/\/\^v\$\//);
    expect(ignoreList()).toMatch(/\/\^utm_\//);
  });
  it('新 SW：?v=新哈希 不命中预缓存 → 直接走网络拿新题库，不用重拉', async () => {
    const sw = fakeSW(NEW_IGNORE, pre({ ...allV('v58'), 9: 'v57' }), allV('v58'));
    const r = await fetchBuiltinBanks({ base: '', ver: 'NEWHASH', release: 'v58', grades: G, fetchFn: sw.fn });
    expect(sw.calls.every(c => c.from === 'network')).toBe(true);
    expect(r.stale).toEqual([]); expect(G.map(g => r.builtin[g].version)).toEqual(['v58', 'v58', 'v58']);
  });
  it('老 SW（忽略 v）喂旧题库 → 比对 BANK_RELEASE 发现旧了 → no-store + r= 重拉，记 bank-stale', async () => {
    const sw = fakeSW(OLD_IGNORE, pre({ 7: 'v58', 8: 'v58', 9: 'v57' }), allV('v58'));
    const log = vi.fn();
    const r = await fetchBuiltinBanks({ base: '', ver: 'NEWHASH', release: 'v58', grades: G, fetchFn: sw.fn, log, now: () => 123 });
    expect(r.stale).toEqual(['9']); expect(r.refetched).toEqual(['9']);
    expect(r.builtin['9'].version).toBe('v58');
    const re = sw.calls.filter(c => c.init?.cache === 'no-store');
    expect(re.map(c => c.url)).toEqual(['banks/bank_9.json?v=NEWHASH&r=123']);
    expect(re[0].from).toBe('network');
    expect(log).toHaveBeenCalledWith('bank-stale', expect.stringContaining('9=v57'));
  });
  it('全部新鲜：每册只请求一次（带 ?v=），不重拉、不记日志', async () => {
    const sw = fakeSW(NEW_IGNORE, {}, allV('v58')); const log = vi.fn(); const prog = vi.fn();
    const r = await fetchBuiltinBanks({ base: './', ver: 'H', release: 'v58', grades: G, fetchFn: sw.fn, log, onProgress: prog });
    expect(sw.calls.map(c => c.url).sort()).toEqual(G.map(g => `./banks/bank_${g}.json?v=H`).sort());
    expect(r.refetched).toEqual([]); expect(log).not.toHaveBeenCalled(); expect(prog).toHaveBeenLastCalledWith(3, 3);
  });
  it('断网：?v= 不在预缓存 → 退回不带参数的预缓存地址，照常能玩', async () => {
    const sw = fakeSW(NEW_IGNORE, pre(allV('v58')), null);
    const r = await fetchBuiltinBanks({ base: '', ver: 'H', release: 'v58', grades: G, fetchFn: sw.fn });
    expect(r.offline.sort()).toEqual(['7', '8', '9']); expect(G.every(g => r.builtin[g]?.version === 'v58')).toBe(true);
  });
  it('断网 + 预缓存是旧题库：重拉失败就先用旧的（不白屏），记日志', async () => {
    const sw = fakeSW(NEW_IGNORE, pre({ 7: 'v58', 8: 'v58', 9: 'v57' }), null); const log = vi.fn();
    const r = await fetchBuiltinBanks({ base: '', ver: 'H', release: 'v58', grades: G, fetchFn: sw.fn, log });
    expect(r.stale).toEqual(['9']); expect(r.refetched).toEqual([]); expect(r.builtin['9'].version).toBe('v57');
    expect(log.mock.calls.some(c => /重拉失败/.test(c[1]))).toBe(true);
  });
  it('重拉回来仍是旧版：不替换，记日志', async () => {
    const sw = fakeSW(OLD_IGNORE, pre({ 7: 'v58', 8: 'v58', 9: 'v57' }), { 7: 'v58', 8: 'v58', 9: 'v57' }); const log = vi.fn();
    const r = await fetchBuiltinBanks({ base: '', ver: 'H', release: 'v58', grades: G, fetchFn: sw.fn, log });
    expect(r.refetched).toEqual([]); expect(log.mock.calls.some(c => /仍是 v57/.test(c[1]))).toBe(true);
  });
  it('HTTP 404 不当成题库（以前 .json() 失败才算），退回预缓存地址', async () => {
    const fn = vi.fn(async (url: string) => url.includes('?v=') ? resp({}, false, 404) : resp(bank('9', 'v58'))) as unknown as typeof fetch;
    const r = await fetchBuiltinBanks({ base: '', ver: 'H', release: 'v58', grades: ['9'], fetchFn: fn });
    expect(r.builtin['9'].version).toBe('v58'); expect(r.offline).toEqual(['9']);
  });
  it('开发环境（release=dev）不比对', async () => {
    const sw = fakeSW(OLD_IGNORE, pre(allV('v57')), allV('v58'));
    const r = await fetchBuiltinBanks({ base: '', ver: 'H', release: 'dev', grades: G, fetchFn: sw.fn });
    expect(r.stale).toEqual([]); expect(sw.calls.length).toBe(3);
  });
});

describe('r17.2.1 更新条：等新 SW 接管再刷新', () => {
  afterEach(() => { vi.useRealTimers(); });
  const fakeContainer = () => { const ls = new Set<() => void>(); return { addEventListener: (_: string, f: () => void) => ls.add(f), removeEventListener: (_: string, f: () => void) => ls.delete(f), fire: () => [...ls].forEach(f => f()), size: () => ls.size }; };
  it('controllerchange 来了 → true，并摘掉监听', async () => {
    const c = fakeContainer(); const p = waitForController(controllerGen(), 8000, c as never);
    expect(c.size()).toBe(1); c.fire(); await expect(p).resolves.toBe(true); expect(c.size()).toBe(0);
  });
  it('一直没接管 → 超时 false（照样刷新，不卡死）', async () => {
    vi.useFakeTimers(); const c = fakeContainer(); const p = waitForController(controllerGen(), 8000, c as never);
    vi.advanceTimersByTime(8000); await expect(p).resolves.toBe(false); expect(c.size()).toBe(0);
  });
  it('发现新版之后已经接管过了 → 立即 true', async () => {
    await expect(waitForController(controllerGen() - 1, 8000, fakeContainer() as never)).resolves.toBe(true);
  });
  it('App：自动刷新被挡住时每 3 秒重试，不再只试一次', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    expect(app).toMatch(/if \(blocked\) \{ t = window\.setTimeout\(attempt, 3000\); return; \}/);
    expect(app).toMatch(/t = window\.setTimeout\(attempt, 2000\)/);
  });
  it('swUpdate：自愈刷新先等新 SW 接管', () => {
    const sw = readFileSync('src/swUpdate.ts', 'utf8');
    expect(sw).toMatch(/await waitForController\(gen\)/);
    expect(sw).toMatch(/if \(!had \|\| healWaiting\) return;/);
  });
});
