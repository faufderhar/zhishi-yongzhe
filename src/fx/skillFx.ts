/* 角色技能特效（v0.3.7）：优先用美术序列帧 public/fx/skills/<id>.webp（按战斗懒加载），失败时用程序化特效。
   护眼硬性规则：只改 transform / opacity；无全屏白闪；无 >3 Hz 闪烁；发光只用 ≥0.4 s 透明度渐变；
   小班 / 小学 1–2 不震屏、强制 normal 混合；粒子按学段上限，帧率 <45 时减半。减少动画：只显示横幅 + 图标淡入淡出。
   测试钩子：window.__fxLog 记录每次释放的关键帧与时长（自动化护眼检查用）。 */
import type { SkillDef } from '../game/skills';
import { SKILL } from '../game/balance';
import { reducedMotion, sleep } from './motion';
import { loadSkillSheet, playFx, type Sheet } from './sheets';
import type { ParticleLayer, Preset } from './particles';
import { sfx, SKILL_SFX } from './assets';

const B = () => import.meta.env.BASE_URL;
export const skillIconUrl = (id: string) => `${B()}fx/skills/icons/icon_${id}.webp`;
export interface FxLogEntry { id: string; t0: number; t1: number; mode: 'sheet' | 'proc' | 'reduced'; anims: { el: string; frames: Keyframe[]; duration: number; delay: number; area: number }[]; particles: number; shake: boolean; blend: string }
type W = { __fxLog?: FxLogEntry[]; __zyTest?: boolean; __zyNoArt?: boolean };
const W_ = () => window as unknown as W;
/* ---- 帧率监测：技能播放时采样，<45 fps 后粒子减半（持续生效） ---- */
let lowFps = false; export const fxLowFps = () => lowFps;
function sampleFps(ms: number) {
  let n = 0; const t0 = performance.now(); let raf = 0;
  const f = () => { n++; if (performance.now() - t0 < ms) raf = requestAnimationFrame(f); else { const fps = n / ((performance.now() - t0) / 1000); if (fps < SKILL.lowFps) lowFps = true; (window as unknown as { __fxFps?: number[] }).__fxFps?.push(Math.round(fps)); } };
  raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf);
}
/** 预载本角色这一学段的技能序列帧（每场战斗调用一次） */
export function preloadSkillArt(skills: SkillDef[]) { for (const k of skills) void loadSkillSheet(k.id); }

export interface SkillRig { stage: HTMLElement; hero: HTMLElement; monster: HTMLElement; p: ParticleLayer }
export interface PlaySkillOpts { gentle: boolean; kinder?: boolean; onImpact?: () => void; maxMs?: number }
const center = (el: HTMLElement, rel: HTMLElement) => { const a = el.getBoundingClientRect(), b = rel.getBoundingClientRect(); return { x: a.left - b.left + a.width / 2, y: a.top - b.top + a.height / 2, w: a.width, h: a.height }; };

export async function playSkill(r: SkillRig, k: SkillDef, o: PlaySkillOpts): Promise<void> {
  const log: FxLogEntry = { id: k.id, t0: performance.now(), t1: 0, mode: 'proc', anims: [], particles: 0, shake: false, blend: 'normal' };
  const total = Math.min(k.durMs, o.maxMs ?? k.durMs);
  const stageArea = r.stage.clientWidth * r.stage.clientHeight || 1;
  const fa = (el: HTMLElement, frames: Keyframe[], duration: number, delay = 0, name = el.className) => {
    log.anims.push({ el: name, frames, duration, delay, area: (el.offsetWidth * el.offsetHeight) / stageArea });
    return el.animate(frames, { duration, delay, easing: 'ease-in-out', fill: 'both' }).finished.catch(() => undefined);
  };
  const mk = (cls: string, html = '', css: Partial<CSSStyleDeclaration> = {}) => { const e = document.createElement('div'); e.className = cls; e.innerHTML = html; Object.assign(e.style, css); r.stage.appendChild(e); return e; };
  const hc = center(r.hero, r.stage), mc = center(r.monster, r.stage);
  const self = k.type === 'guard' || k.type === 'heal';
  const tgt = self ? hc : mc;
  // 音效（技能 ID → 交付音效；缺失时合成）
  sfx(k.id, { kinder: !!o.kinder, fallback: SKILL_SFX[k.major] ?? 'skill_math' });
  // 技能名横幅（头像 + 图标 + 技能名，0.6 s，放在舞台顶部，不挡题目区）
  const ban = mk('skill-banner', `<img class="skill-ico" src="${skillIconUrl(k.id)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'skill-ico',textContent:'${k.icon}'}))"><b>${k.char}</b> · ${k.name}`);
  ban.setAttribute('data-testid', 'skill-banner'); ban.dataset.skill = k.id;
  const rm = reducedMotion();
  const banP = fa(ban, rm ? [{ opacity: 0, transform: 'translate(-50%,0)' }, { opacity: 1, transform: 'translate(-50%,0)', offset: 0.25 }, { opacity: 1, transform: 'translate(-50%,0)', offset: 0.75 }, { opacity: 0, transform: 'translate(-50%,0)' }]
    : [{ opacity: 0, transform: 'translate(-50%,-8px)' }, { opacity: 1, transform: 'translate(-50%,0)', offset: 0.25 }, { opacity: 1, transform: 'translate(-50%,0)', offset: 0.75 }, { opacity: 0, transform: 'translate(-50%,-4px)' }], rm ? 900 : 600, 0, 'skill-banner');
  // r10 小班：技能名横幅更大，停留 ≥4 秒或点一下才消失（不跟着特效一起收掉）
  if (o.kinder) { ban.classList.add('kinder'); ban.style.pointerEvents = 'auto'; banP.catch(() => {}); ban.getAnimations().forEach(a => a.cancel()); ban.style.opacity = '1';
    const gone = () => ban.remove(); ban.addEventListener('pointerdown', gone); window.setTimeout(gone, 4500); }
  const cleanup: HTMLElement[] = o.kinder ? [] : [ban];
  const stopFps = sampleFps(total);
  try {
    if (reducedMotion()) {   // 只保留横幅 + 图标淡入淡出（无位移、无粒子）
      log.mode = 'reduced';
      const ic = mk('skill-fx-icon', k.icon, { left: `${tgt.x}px`, top: `${tgt.y - tgt.h * 0.3}px` }); cleanup.push(ic);
      await Promise.all([banP, fa(ic, [{ opacity: 0 }, { opacity: 1, offset: 0.4 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], Math.max(800, Math.min(total, 1000)), 0, 'skill-fx-icon')]);
      o.onImpact?.(); return;
    }
    const sheet = (__TEST_HOOKS__ && W_().__zyNoArt) ? null : await Promise.race([loadSkillSheet(k.id), sleep(250).then(() => null)]) as Sheet | null;   // 素材没到 250 ms 内 → 程序化
    if (sheet) {
      log.mode = 'sheet';
      // 超过本次时长上限（小班 1.0 s）时提高播放帧率把整张播完，不截掉收尾帧
      const fit = sheet.meta.frame_count / sheet.meta.fps * 1000 > total ? { ...sheet, meta: { ...sheet.meta, fps: sheet.meta.frame_count / (total / 1000) } } : sheet;
      const m = fit.meta; const gentle = o.gentle;
      const blend = gentle ? 'normal' : m.blend === 'additive' ? 'plus-lighter' : m.blend === 'screen' ? 'screen' : 'normal'; log.blend = blend;
      const x = self ? hc.x : (hc.x + mc.x) / 2, y = self ? hc.y : (hc.y + mc.y) / 2;
      const scale = Math.min(1, (r.stage.clientHeight * 0.75) / m.frame_height);
      let hitDone = false; const peak = m.peak_frame ?? Math.floor(m.frame_count / 2);
      log.anims.push({ el: 'fx-sprite', frames: [], duration: m.frame_count / m.fps * 1000, delay: 0, area: (m.frame_width * m.frame_height * scale * scale) / stageArea });
      await Promise.all([banP, Promise.race([playFx(r.stage, fit, x, y, scale, { blend, onFrame: i => { if (!hitDone && i >= peak) { hitDone = true; o.onImpact?.(); } } }), sleep(total)])]);
      if (!hitDone) o.onImpact?.();
      return;
    }
    await procedural(k, r, o, total, hc, mc, tgt, mk, fa, log, cleanup);
    await banP;
  } finally {
    stopFps(); cleanup.forEach(e => e.remove()); log.t1 = performance.now();
    if ((__TEST_HOOKS__ && W_().__zyTest)) (W_().__fxLog ??= []).push(log);
  }
}

type Pt = { x: number; y: number; w: number; h: number };
async function procedural(k: SkillDef, r: SkillRig, o: PlaySkillOpts, total: number, hc: Pt, mc: Pt, tgt: Pt,
  mk: (c: string, h?: string, css?: Partial<CSSStyleDeclaration>) => HTMLElement, fa: (el: HTMLElement, f: Keyframe[], d: number, delay?: number, name?: string) => Promise<unknown>, log: FxLogEntry, cleanup: HTMLElement[]) {
  const cap = SKILL.particleCap[k.seg] / (fxLowFps() ? 2 : 1);
  const budget = Math.max(4, Math.min(k.particles, cap));
  const col = k.colors.length ? k.colors : ['#90CAF9'];
  const gl = k.glyphs.length ? k.glyphs : [k.icon];
  const pr = (count: number, extra: Partial<Preset> = {}): Preset => ({ colors: col, shapes: k.recipe === 'heal' ? ['dot', 'star'] : k.recipe === 'rain' ? ['petal', 'dot'] : ['dot', 'star', 'glyph'], glyphs: gl, count, speed: [40, 140], size: [6, 14], life: [0.4, 0.8], ...extra });
  let used = 0; const burst = (x: number, y: number, n: number, extra: Partial<Preset> = {}, dir?: number) => { const c = Math.min(n, budget - used); if (c <= 0) return; used += c; r.p.burst(x, y, pr(c, extra), dir); };
  const fly = (n: number, from: Pt, to: Pt, dur: number, stagger: number, arc = 60, html?: (i: number) => string) => Promise.all(Array.from({ length: n }, (_, i) => {
    const el = mk('skill-fx-glyph', html ? html(i) : (i === 0 ? k.icon : gl[i % gl.length]), { left: `${from.x}px`, top: `${from.y - from.h * 0.2}px`, color: col[i % col.length] }); cleanup.push(el);
    const dx = to.x - from.x, dy = (to.y - to.h * 0.2) - (from.y - from.h * 0.2); const fr: Keyframe[] = [];
    for (let j = 0; j <= 10; j++) { const t = j / 10; fr.push({ transform: `translate(${dx * t}px,${dy * t - Math.sin(t * Math.PI) * (arc + i * 12)}px) translate(-50%,-50%) scale(${0.7 + 0.3 * Math.sin(t * Math.PI)})`, opacity: j === 0 ? 0 : j === 10 ? 0 : 1 }); }
    return fa(el, fr, dur, i * stagger, 'skill-fx-glyph').then(() => burst(to.x, to.y - to.h * 0.2, Math.ceil(budget / Math.max(2, n))));
  }));
  const p0 = 150, body = Math.max(400, total - p0 - 100);
  await sleep(p0);
  switch (k.recipe) {
    case 'projectile': await fly(Math.min(3, Math.max(1, gl.length)), hc, mc, Math.min(520, body * 0.6), Math.min(160, body * 0.15)); o.onImpact?.(); break;
    case 'rise': await fly(Math.min(3, gl.length), hc, k.type === 'visual' ? mc : { ...hc, y: hc.y - hc.h * 0.6 }, body * 0.7, 140, 30); o.onImpact?.(); break;
    case 'rain': {
      const n = Math.min(5, Math.max(3, Math.floor(budget / 4)));
      await Promise.all(Array.from({ length: n }, (_, i) => {
        const el = mk('skill-fx-glyph', i % 2 ? gl[i % gl.length] : k.icon, { left: `${tgt.x + (i - n / 2) * 26}px`, top: `${tgt.y - tgt.h * 0.9}px`, color: col[i % col.length] }); cleanup.push(el);
        return fa(el, [{ transform: 'translate(-50%,-60px)', opacity: 0 }, { transform: 'translate(-50%,0)', opacity: 1, offset: 0.4 }, { transform: `translate(-50%,${tgt.h * 0.55}px) rotate(${i % 2 ? 20 : -20}deg)`, opacity: 1, offset: 0.85 }, { transform: `translate(-50%,${tgt.h * 0.6}px)`, opacity: 0 }], body * 0.8, i * 90, 'skill-fx-glyph');
      }));
      burst(tgt.x, tgt.y, budget, { gravity: 120, speed: [20, 80] }); o.onImpact?.(); break;
    }
    case 'slash': {
      const n = k.effect === 'A2H' ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const el = mk('skill-fx-slash', '', { left: `${mc.x}px`, top: `${mc.y - mc.h * 0.15}px`, background: `linear-gradient(90deg,transparent,${col[0]},transparent)` }); cleanup.push(el);
        await fa(el, [{ transform: `translate(-50%,-50%) rotate(${i ? 35 : -35}deg) scaleX(0)`, opacity: 0 }, { transform: `translate(-50%,-50%) rotate(${i ? 35 : -35}deg) scaleX(1)`, opacity: 0.9, offset: 0.5 }, { transform: `translate(-50%,-50%) rotate(${i ? 35 : -35}deg) scaleX(1.1)`, opacity: 0 }], Math.min(420, body / 2), 0, 'skill-fx-slash');
        burst(mc.x, mc.y - mc.h * 0.15, Math.ceil(budget / n), { shapes: ['spark', 'dot'] });
      }
      o.onImpact?.(); break;
    }
    case 'ring': {
      await Promise.all([0, 1].map(i => { const el = mk('skill-fx-ring', '', { left: `${hc.x}px`, top: `${hc.y - hc.h * 0.2}px`, borderColor: col[i % col.length] }); cleanup.push(el);
        const dx = mc.x - hc.x, dy = (mc.y - hc.y) * 0.8;
        return fa(el, [{ transform: 'translate(-50%,-50%) scale(.2)', opacity: 0.9 }, { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(1.4)`, opacity: 0 }], Math.min(600, body * 0.7), i * 220, 'skill-fx-ring'); }));
      burst(mc.x, mc.y - mc.h * 0.2, budget); o.onImpact?.(); break;
    }
    case 'shield': {
      const el = mk('skill-fx-shield', `<span>${gl.slice(0, 3).join(' ')}</span>`, { left: `${hc.x}px`, top: `${hc.y}px`, borderColor: col[0], color: col[0] }); cleanup.push(el);
      // 「发光」= 透明度慢渐变 ≥0.4 s，不闪
      await fa(el, [{ transform: 'translate(-50%,-50%) scale(.8)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 0.85, offset: 0.45 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 0.85, offset: 0.7 }, { transform: 'translate(-50%,-50%) scale(1.02)', opacity: 0 }], Math.max(800, body), 0, 'skill-fx-shield');
      o.onImpact?.(); break;
    }
    case 'heal': {
      const n = Math.min(8, budget);
      await Promise.all(Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2, R = Math.max(hc.w, 80) * 0.8;
        const el = mk('skill-fx-dot', '', { left: `${hc.x}px`, top: `${hc.y}px`, background: col[i % col.length] }); cleanup.push(el);
        return fa(el, [{ transform: `translate(${Math.cos(a) * R}px,${Math.sin(a) * R}px) translate(-50%,-50%)`, opacity: 0 }, { transform: `translate(${Math.cos(a) * R * 0.6}px,${Math.sin(a) * R * 0.6}px) translate(-50%,-50%)`, opacity: 0.9, offset: 0.45 }, { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 }], Math.max(700, body * 0.85), i * 30, 'skill-fx-dot'); }));
      o.onImpact?.(); break;
    }
    case 'control': {
      const el = mk('skill-fx-sign', gl[0] && gl[0].length <= 6 ? gl[0] : k.icon, { left: `${mc.x}px`, top: `${mc.y - mc.h * 0.6}px` }); cleanup.push(el);
      await fa(el, [{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1.15)', opacity: 1, offset: 0.35 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.75 }, { transform: 'translate(-50%,-60%) scale(1)', opacity: 0 }], Math.max(700, body * 0.85), 0, 'skill-fx-sign');
      o.onImpact?.(); break;
    }
    default: {
      const el = mk('skill-fx-glyph big', k.icon, { left: `${tgt.x}px`, top: `${tgt.y - tgt.h * 0.25}px` }); cleanup.push(el);
      await fa(el, [{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1.1)', opacity: 1, offset: 0.5 }, { transform: 'translate(-50%,-55%) scale(1)', opacity: 0 }], Math.max(600, body * 0.8), 0, 'skill-fx-glyph');
      burst(tgt.x, tgt.y - tgt.h * 0.25, budget); o.onImpact?.();
    }
  }
  log.particles = used;
}
