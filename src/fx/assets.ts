/* 美术 / 音效挂钩。美术或音效到位后放到下列路径，并在对应 manifest.json 里登记文件名即可生效；
   未登记的走程序生成的特效/合成音效（不会产生 404 请求）。

   序列帧：public/fx/manifest.json  →  { "sprites": { "<角色或怪物id>_<动作>": { "file": "pup_suansuan_attack.png", "frames": 8, "fps": 16, "w": 256, "h": 256 } } }
     动作：idle / attack / skill / hit / dodge / victory / defeat；文件放 public/fx/
   音效：  public/sfx/manifest.json →  { "sfx": ["hit", "crit", "swing", ...] }，文件放 public/sfx/<名字>.mp3（iPad 也可 .m4a，登记为 "hit.m4a"） */
import { audioCtx, audioPrefs } from '../tts';
export type SfxName = 'swing' | 'hit' | 'crit' | 'dodge' | 'monster_attack' | 'player_hurt' | 'heal' | 'skill_math' | 'skill_chinese' | 'skill_english' | 'skill_poetry' | 'skill_chem' | 'skill_physics' | 'victory' | 'defeat' | 'soft_pop' | 'soft_cheer';
export interface SpriteSheet { file: string; frames: number; fps: number; w: number; h: number }
let sfxFiles: Set<string> | null = null; let sprites: Record<string, SpriteSheet> = {};
const base = () => import.meta.env.BASE_URL;
export async function loadFxManifests() {
  try { const r = await fetch(base() + 'sfx/manifest.json'); sfxFiles = new Set(((await r.json()).sfx ?? []) as string[]); } catch { sfxFiles = new Set(); }
  try { const r = await fetch(base() + 'fx/manifest.json'); sprites = (await r.json()).sprites ?? {}; } catch { sprites = {}; }
}
export const spriteFor = (id: string, action: string): SpriteSheet | undefined => sprites[`${id}_${action}`];
export const spriteUrl = (s: SpriteSheet) => base() + 'fx/' + s.file;
const cache = new Map<string, HTMLAudioElement>();
let muted = false; export const setSfxMuted = (b: boolean) => { muted = b; };
/* ---- 角色技能音效（85 个，public/sfx/skills/）：按需懒加载，不预缓存 ----
   技能 ID → 文件由 public/sfx/skills-manifest.json 给出；小班用 kindergarten 字段（-6 dB 版）。
   首次播放时 fetch + decodeAudioData，内存里最多留 24 个 AudioBuffer；Service Worker 对 sfx/skills/*.mp3 运行时 CacheFirst（离线后可重放已听过的）。
   文件缺失或解码失败 → 合成占位音。音量：主音量 −6 dB（gain 0.5）；小班文件本身再 −6 dB，合计 −12 dB。 */
interface SkillSfxEntry { file: string; kindergarten?: string }
let skillMan: Promise<Record<string, SkillSfxEntry>> | null = null;
const skillBuf = new Map<string, Promise<AudioBuffer | null>>();
export const SKILL_SFX_GAIN = 0.5;
export const isSkillSfxId = (id: string) => /^(k|p12|p36|j1|h1)_[a-z]+_\d+$/.test(id);
function skillManifest() {
  return skillMan ??= fetch(base() + 'sfx/skills-manifest.json').then(r => r.ok ? r.json() : { skills: {} }).then(j => (j.skills ?? {}) as Record<string, SkillSfxEntry>).catch(() => ({} as Record<string, SkillSfxEntry>));
}
function loadSkillBuf(path: string) {
  let p = skillBuf.get(path);
  if (!p) {
    const c = audioCtx();
    p = !c ? Promise.resolve(null) : fetch(base() + 'sfx/' + path).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer(); })
      .then(b => new Promise<AudioBuffer>((res, rej) => c.decodeAudioData(b, res, rej))).catch(() => null);
    skillBuf.set(path, p);
    if (skillBuf.size > 24) skillBuf.delete(skillBuf.keys().next().value as string);
  }
  return p;
}
/** 已登记的音效文件数（测试 / 报告用） */
export const sfxStats = { skillPlayed: 0, skillFallback: 0, last: '', paths: [] as string[] };
if (__TEST_HOOKS__ && typeof window !== 'undefined') (window as unknown as { __zySfxStats?: typeof sfxStats }).__zySfxStats = sfxStats;   // 仅测试构建
async function playSkillSfx(id: string, o: { kinder?: boolean; fallback?: SfxName }) {
  const m = await skillManifest(); const e = m[id];
  const path = e ? (o.kinder && e.kindergarten ? e.kindergarten : e.file) : undefined;
  const buf = path ? await loadSkillBuf(path) : null; const c = audioCtx();
  if (muted || !audioPrefs.sfx) return;
  if (!buf || !c) { sfxStats.skillFallback++; synth(o.fallback ?? 'skill_math'); return; }
  const s = c.createBufferSource(), g = c.createGain(); g.gain.value = SKILL_SFX_GAIN * audioPrefs.volume; s.buffer = buf; s.connect(g).connect(c.destination); s.start();
  sfxStats.skillPlayed++; sfxStats.last = path!; sfxStats.paths.push(id + '=' + path);
}
/** 播放音效：内置名（SfxName）或技能 ID（如 "j1_suansuan_2"）。静音开关对两者都生效 */
export function sfx(name: SfxName | string, o: { kinder?: boolean; fallback?: SfxName } = {}) {
  if (muted || !audioPrefs.sfx) return;
  if (isSkillSfxId(name)) { void playSkillSfx(name, o); return; }
  return builtin(name as SfxName);
}
function builtin(name: SfxName) {
  const f = sfxFiles && [...sfxFiles].find(x => x === name || x.startsWith(name + '.'));
  if (f) { let a = cache.get(f); if (!a) { a = new Audio(base() + 'sfx/' + (f.includes('.') ? f : f + '.mp3')); cache.set(f, a); } a.currentTime = 0; a.play().catch(() => {}); return; }
  synth(name);
}
/** 合成占位音效（WebAudio，首次点击后才有声音） */
function synth(name: SfxName) {
  const c = audioCtx(); if (!c) return;
  const t = c.currentTime;
  const tone = (f0: number, f1: number, dur: number, type: OscillatorType = 'triangle', vol = 0.07, at = 0) => {
    const o = c.createOscillator(), g = c.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t + at); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + at + dur);
    g.gain.setValueAtTime(vol * audioPrefs.volume, t + at); g.gain.exponentialRampToValueAtTime(0.0008, t + at + dur);
    o.connect(g).connect(c.destination); o.start(t + at); o.stop(t + at + dur + 0.02);
  };
  const noise = (dur: number, vol = 0.06, hp = 800) => {
    const b = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate); const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol * audioPrefs.volume;
    s.buffer = b; s.connect(f).connect(g).connect(c.destination); s.start();
  };
  switch (name) {
    case 'swing': noise(0.15, 0.05, 2500); break;
    case 'hit': tone(180, 60, 0.15, 'square', 0.08); noise(0.08, 0.05, 1200); break;
    case 'crit': tone(220, 50, 0.25, 'sawtooth', 0.09); tone(880, 1760, 0.12, 'triangle', 0.05, 0.02); noise(0.12, 0.07, 800); break;
    case 'dodge': noise(0.2, 0.04, 4000); tone(600, 1200, 0.15, 'sine', 0.03); break;
    case 'monster_attack': tone(140, 70, 0.25, 'sawtooth', 0.06); break;
    case 'player_hurt': tone(300, 120, 0.2, 'square', 0.06); break;
    case 'heal': tone(523, 784, 0.25, 'sine', 0.05); break;
    case 'victory': [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.18, 'triangle', 0.06, i * 0.12)); break;
    case 'defeat': [392, 330, 262].forEach((f, i) => tone(f, f * 0.95, 0.25, 'sine', 0.05, i * 0.18)); break;
    case 'soft_pop': tone(660, 990, 0.12, 'sine', 0.05); break;
    case 'soft_cheer': [659, 784, 988].forEach((f, i) => tone(f, f, 0.2, 'sine', 0.045, i * 0.1)); break;
    default: tone(700, 1400, 0.18, 'triangle', 0.05); noise(0.1, 0.03, 3000); // skill_*
  }
}
export const SKILL_SFX: Record<string, SfxName> = { 数学: 'skill_math', 语文: 'skill_chinese', 英语: 'skill_english', 诗词: 'skill_poetry', 化学: 'skill_chem', 物理: 'skill_physics' };
