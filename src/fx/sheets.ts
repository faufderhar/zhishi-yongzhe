/* 美术序列帧（public/anim/<角色>/{idle,attack,hit}_sheet.webp + .json，public/fx/<特效>/）
   按战斗懒加载；加载失败或缺文件时返回 null，导演自动退回程序特效。
   播放只改 transform（整张图在 overflow:hidden 的框里平移），帧按行优先。 */
import { reducedMotion } from './motion';
export interface SheetMeta { image: string; frame_width: number; frame_height: number; frame_count: number; columns: number; rows: number; fps: number; loop: boolean; anchor: { x: number; y: number }; hit_frame?: number; peak_frame?: number }
export interface Sheet { meta: SheetMeta; url: string }
const B = () => import.meta.env.BASE_URL;
const cache = new Map<string, Promise<Sheet | null>>();
function load(dir: string, name: string): Promise<Sheet | null> {
  const k = dir + '/' + name;
  if (!cache.has(k)) cache.set(k, (async () => {
    try {
      const r = await fetch(`${B()}${dir}/${name}.json`); if (!r.ok) return null;
      const meta = await r.json() as SheetMeta;
      const url = `${B()}${dir}/${meta.image}`;
      await new Promise<void>((ok, bad) => { const i = new Image(); i.onload = () => ok(); i.onerror = bad; i.src = url; });
      return { meta, url };
    } catch { return null; }
  })());
  return cache.get(k)!;
}
/** 角色 id → 素材目录 */
export const ANIM_DIR: Record<string, string> = {
  suansuan: 'pup_math_suansuan', momo: 'pup_chinese_momo', abei: 'pup_english_abei', shishi: 'pup_poetry_shishi', beibei: 'pup_chem_beibei',
  asuan: 'hs_math_asuan', xiaomo: 'hs_chinese_xiaomo', lexi: 'hs_english_lexi', xiaobai: 'hs_poetry_xiaobai', bola: 'hs_alchemist_bola',
};
export const SUBJECT_FX: Record<string, string> = { 数学: 'math_number_storm', 语文: 'chinese_ink_stroke', 英语: 'english_letter_missile', 诗词: 'poetry_moon_scroll', 化学: 'chem_alchemy_blast' };
export const FX_NAMES = [...Object.values(SUBJECT_FX), 'hs_energy_beam', 'hit_spark_light', 'hit_spark_crit', 'heal_star'];
export type CharAnims = { idle: Sheet; attack: Sheet; hit: Sheet };
export async function loadCharAnims(charId: string): Promise<CharAnims | null> {
  const d = ANIM_DIR[charId]; if (!d) return null;
  const [idle, attack, hit] = await Promise.all(['idle', 'attack', 'hit'].map(n => load('anim/' + d, n)));
  return idle && attack && hit ? { idle, attack, hit } : null;
}
export const loadFx = (name: string) => load('fx/' + name, name);
/** 家长页「预下载动画」：把全部序列帧拉进离线缓存 */
export async function prefetchAll(onP?: (d: number, t: number) => void, kinds: ('pup' | 'hs')[] = ['pup', 'hs']) {
  const ids = Object.keys(ANIM_DIR).filter(id => kinds.some(k => ANIM_DIR[id].startsWith(k + '_')));
  const jobs = [...ids.map(id => () => loadCharAnims(id)), ...FX_NAMES.map(n => () => loadFx(n))];
  let d = 0; for (const j of jobs) { await j(); onP?.(++d, jobs.length); }
}

/** 序列帧播放器：box 尺寸 = 帧尺寸 × scale */
export class SheetPlayer {
  box: HTMLDivElement; img: HTMLImageElement;
  private cur: Sheet | null = null; private f = 0; private t0 = 0; private raf = 0; private hold = 0; private holdStart = 0;
  private onFrame?: (i: number) => void; private resolve?: () => void; private flipped = false;
  scale: number;
  constructor(scale: number, flip = false) {
    this.scale = scale; this.flipped = flip;
    this.box = document.createElement('div'); this.box.className = 'sheet-box';
    this.img = document.createElement('img'); this.img.alt = ''; this.img.draggable = false; this.box.appendChild(this.img);
  }
  /** 播放；循环动画永不 resolve（直到被下一个打断） */
  play(s: Sheet, onFrame?: (i: number) => void): Promise<void> {
    this.resolve?.(); this.cur = s; this.f = -1; this.onFrame = onFrame; this.t0 = performance.now(); this.hold = 0;
    const m = s.meta, k = this.scale;
    if (this.img.src !== new URL(s.url, location.href).href) this.img.src = s.url;
    Object.assign(this.box.style, { width: `${m.frame_width * k}px`, height: `${m.frame_height * k}px`, transform: this.flipped ? 'scaleX(-1)' : '' });
    Object.assign(this.img.style, { width: `${m.columns * m.frame_width * k}px`, height: `${m.rows * m.frame_height * k}px` });
    this.draw(0);
    const p = new Promise<void>(r => { this.resolve = r; });
    if (!this.raf) this.raf = requestAnimationFrame(this.tick);
    return p;
  }
  /** 顿帧：冻结当前帧 ms 毫秒 */
  freeze(ms: number) { this.hold = ms; this.holdStart = performance.now(); }
  private draw(i: number) {
    if (!this.cur || i === this.f) return;
    const m = this.cur.meta, k = this.scale;
    this.f = i;
    this.img.style.transform = `translate(${-(i % m.columns) * m.frame_width * k}px,${-Math.floor(i / m.columns) * m.frame_height * k}px)`;
    this.onFrame?.(i);
  }
  private tick = (t: number) => {
    this.raf = 0; const s = this.cur; if (!s) return;
    if (this.hold) { if (t - this.holdStart < this.hold) { this.raf = requestAnimationFrame(this.tick); return; } this.t0 += this.hold; this.hold = 0; }
    const m = s.meta; let i = Math.floor((t - this.t0) / 1000 * m.fps);
    if (m.loop) { if (reducedMotion()) i = 0; i %= m.frame_count; }
    else if (i >= m.frame_count) {
      for (let j = this.f + 1; j < m.frame_count; j++) this.draw(j);   // 不漏掉事件帧
      const r = this.resolve; this.resolve = undefined; r?.(); if (this.cur === s) this.raf = requestAnimationFrame(this.tick); return;
    }
    if (!m.loop) for (let j = this.f + 1; j < i; j++) this.draw(j);
    this.draw(i);
    this.raf = requestAnimationFrame(this.tick);
  };
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; this.resolve?.(); this.cur = null; }
}

/** 一次性特效：放进 layer，锚点对准 (x,y)，播完删除；additive 混合 */
export function playFx(layer: HTMLElement, s: Sheet, x: number, y: number, scale = 1, opts: { onFrame?: (i: number) => void; stretchX?: number } = {}) {
  const p = new SheetPlayer(scale);
  p.box.classList.add('fx-sprite');
  const m = s.meta;
  Object.assign(p.box.style, { left: `${x - m.anchor.x * scale}px`, top: `${y - m.anchor.y * scale}px`, transformOrigin: `${m.anchor.x * scale}px ${m.anchor.y * scale}px` });
  layer.appendChild(p.box);
  const done = p.play(s, opts.onFrame);
  if (opts.stretchX) p.box.style.transform = `scaleX(${opts.stretchX})`;
  return done.then(() => { p.stop(); p.box.remove(); });
}
