/* 离线素材（技术QA R6-1）：学科怪物序列帧、技能特效/图标/音效不进安装预缓存（体积大）。
   首次启动后、联网且空闲时，按当前所有档案的学段与学科，在后台把它们放进 SW 运行时缓存（与 vite.config.ts 的 cacheName 一致）。
   小班与一二年级取 *_soft 版本。进度写 localStorage，家长页显示「离线就绪」。 */
import MON from './game/monsters.manifest.json';
import { bandOf, type Band } from './game/grades';
import type { GradeKey } from './game/questions';
const B = () => (import.meta.env?.BASE_URL ?? './');
const STAGE: Record<Band, string> = { K: 'k', G1: 'p12', G2: 'p36', G3: 'p36', J: 'j1', H: 'h1' };
type Mon = { pool_cn: string[]; dir: string; anims: Record<string, { json: string; soft: string }> };
export interface Need { grade: GradeKey; subjects: string[] }
export interface OfflineStatus { done: number; total: number; failed: number; at: number; key: string }
const KEY = 'zy-offline';
export const offlineStatus = (): OfflineStatus | null => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
const listeners = new Set<(s: OfflineStatus) => void>();
export const onOffline = (f: (s: OfflineStatus) => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
const save = (s: OfflineStatus) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* */ } listeners.forEach(f => f(s)); };

/** 要缓存的 JSON（其 image 字段指向 webp，会一并缓存）与直接文件，按 SW cacheName 分组 */
export function offlineList(needs: Need[], skills: Record<string, { stage: string; sheet?: string; icon?: string }>, sfx: Record<string, { stage: string; file: string; kindergarten?: string }>) {
  const json: { url: string; cache: string }[] = []; const file: { url: string; cache: string }[] = [];
  const seen = new Set<string>(['fx/skills/manifest.json']); const add = (arr: typeof json, url: string, cache: string) => { if (!seen.has(url)) { seen.add(url); arr.push({ url, cache }); } };
  for (const n of needs) {
    const band = bandOf(n.grade); const soft = band === 'K' || band === 'G1';
    for (const m of Object.values(MON as Record<string, Mon>)) {
      if (!m.pool_cn.some(s => n.subjects.includes(s))) continue;
      for (const a of Object.values(m.anims)) add(json, `${m.dir}/${soft ? a.soft : a.json}.json`, 'zy-monsters');
    }
    const st = STAGE[band];
    for (const [id, s] of Object.entries(skills)) if (s.stage === st) { add(json, `fx/skills/${id}.json`, 'zy-anim'); add(file, `fx/skills/icons/icon_${id}.webp`, 'zy-anim'); }
    for (const s of Object.values(sfx)) if (s.stage === st) add(file, 'sfx/' + (band === 'K' && s.kindergarten ? s.kindergarten : s.file), 'zy-sfx-skills');
  }
  return { json, file };
}
const idle = () => new Promise<void>(r => { const ric = (window as unknown as { requestIdleCallback?: (f: () => void, o?: object) => void }).requestIdleCallback; ric ? ric(() => r(), { timeout: 2000 }) : setTimeout(r, 200); });
let running = false;
export async function cacheForOffline(needs: Need[]) {
  if (running || typeof caches === 'undefined' || !navigator.onLine || !needs.length) return; running = true;
  try {
    const get = (p: string): Promise<{ skills?: Record<string, never> }> => fetch(B() + p).then(r => r.ok ? r.json() : {}).catch(() => ({}));
    const [sk, sf] = await Promise.all([get('fx/skills/manifest.json'), get('sfx/skills-manifest.json')]);
    const { json, file } = offlineList(needs, sk.skills ?? {}, sf.skills ?? {}); file.push({ url: 'fx/skills/manifest.json', cache: 'zy-anim' });
    const key = needs.map(n => n.grade + ':' + n.subjects.join('')).sort().join('|');
    const total = json.length * 2 + file.length; let done = 0, failed = 0;
    const one = async (url: string, cache: string) => {
      const c = await caches.open(cache); const full = new URL(B() + url, location.href).href;
      if (await c.match(full)) return true;
      if (!navigator.onLine) return false;
      const r = await fetch(full).catch(() => null); if (!r?.ok) return false; await c.put(full, r.clone()); return r;
    };
    for (const j of json) {
      await idle();
      const r = await one(j.url, j.cache); let img: string | undefined;
      if (r instanceof Response) img = (await r.json().catch(() => ({})))?.image;
      else if (r) img = (await (await caches.open(j.cache)).match(new URL(B() + j.url, location.href).href).then(x => x?.json()).catch(() => ({})))?.image;
      done++; if (!r) failed++;
      const ok2 = img ? await one(j.url.replace(/[^/]+$/, '') + img, j.cache) : false; done++; if (!ok2) failed++;
      if (done % 10 < 2) save({ done, total, failed, at: Date.now(), key });
    }
    for (const f of file) { await idle(); if (!await one(f.url, f.cache)) failed++; done++; if (done % 10 === 0) save({ done, total, failed, at: Date.now(), key }); }
    save({ done, total, failed, at: Date.now(), key });
  } finally { running = false; }
}

/* r15.4.1 技术QA P2-1：小班录音离线也要能播——以前只在线听过的进运行时缓存 zy-voice。
   录音文件本来就在 dist/voice（也在离线包里），这里在首次联网打开后（有小班档案时）后台把 manifest 里全部录音放进 zy-voice
   （约 500 个 / 4.5 MB；不进 SW 安装预缓存，避免装 SW 时一次拉太多、拖慢首屏）。开始前等一次空闲，之后 4 路并发，已缓存的跳过。
   进度写 localStorage「zy-offline-voice」，家长页显示「小班离线录音 n/N」，也可手动点「下载离线录音」。 */
const VKEY = 'zy-offline-voice';
export interface VoiceStatus { done: number; total: number; failed: number; at: number }
export const voiceStatus = (): VoiceStatus | null => { try { return JSON.parse(localStorage.getItem(VKEY) || 'null'); } catch { return null; } };
const vListeners = new Set<(s: VoiceStatus) => void>();
export const onVoiceStatus = (f: (s: VoiceStatus) => void) => { vListeners.add(f); return () => { vListeners.delete(f); }; };
const vSave = (s: VoiceStatus) => { try { localStorage.setItem(VKEY, JSON.stringify(s)); } catch { /* */ } vListeners.forEach(f => f(s)); };
/** manifest items → 去重后的文件列表（值可以是文件名或分段文件名数组） */
export const voiceFiles = (items: Record<string, string | string[]> | undefined) => [...new Set(Object.values(items ?? {}).flatMap(v => Array.isArray(v) ? v : [v]).filter(f => typeof f === 'string' && /\.(mp3|m4a)$/.test(f)))];
let vRunning = false;
export async function cacheVoiceForOffline(): Promise<VoiceStatus | null> {
  if (vRunning || typeof caches === 'undefined' || !navigator.onLine) return null; vRunning = true;
  try {
    const base = new URL('voice/', document.baseURI).href;
    const man = await fetch(base + 'manifest.json').then(r => r.ok ? r.json() : {}).catch(() => ({})) as { items?: Record<string, string | string[]> };
    const files = voiceFiles(man.items); const c = await caches.open('zy-voice');
    let done = 0, failed = 0; const total = files.length; const st = () => ({ done, total, failed, at: Date.now() });
    if (!total) return null;
    await idle(); let i = 0;   // 只在开始时等一次空闲：每个文件都等空闲时，动画页面上 500 个文件要好几分钟
    const worker = async () => { while (i < files.length) { const f = files[i++]; const url = base + f;
      try { if (!(await c.match(url))) { if (!navigator.onLine) { failed++; done++; continue; } const r = await fetch(url); if (r.ok && r.status === 200) await c.put(url, r); else failed++; } } catch { failed++; }
      done++; if (done % 20 === 0) vSave(st()); } };
    await Promise.all([worker(), worker(), worker(), worker()]);
    const s = st(); vSave(s); return s;
  } finally { vRunning = false; }
}
