/* 美术 / 音效挂钩。美术或音效到位后放到下列路径，并在对应 manifest.json 里登记文件名即可生效；
   未登记的走程序生成的特效/合成音效（不会产生 404 请求）。

   序列帧：public/fx/manifest.json  →  { "sprites": { "<角色或怪物id>_<动作>": { "file": "pup_suansuan_attack.png", "frames": 8, "fps": 16, "w": 256, "h": 256 } } }
     动作：idle / attack / skill / hit / dodge / victory / defeat；文件放 public/fx/
   音效：  public/sfx/manifest.json →  { "sfx": ["hit", "crit", "swing", ...] }，文件放 public/sfx/<名字>.mp3（iPad 也可 .m4a，登记为 "hit.m4a"） */
import { audioCtx } from '../tts';
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
export function sfx(name: SfxName) {
  if (muted) return;
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
    g.gain.setValueAtTime(vol, t + at); g.gain.exponentialRampToValueAtTime(0.0008, t + at + dur);
    o.connect(g).connect(c.destination); o.start(t + at); o.stop(t + at + dur + 0.02);
  };
  const noise = (dur: number, vol = 0.06, hp = 800) => {
    const b = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate); const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol;
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
