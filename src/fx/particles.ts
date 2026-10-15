/* 轻量 Canvas 粒子层：对象池、最多 160 个粒子、空闲自动停 rAF、DPR 上限 2。
   不依赖任何引擎；所有特效程序生成，美术到位后可用 sprite 帧替换（见 assets.ts）。 */
import { reducedMotion } from './motion';
type Shape = 'dot' | 'star' | 'square' | 'glyph' | 'petal' | 'ring' | 'bubble' | 'spark' | 'heart' | 'ink';
interface P { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; shape: Shape; rot: number; vr: number; g: number; text?: string; grow: number; alpha: number }
export interface Preset { colors: string[]; shapes: Shape[]; glyphs?: string[]; count: number; speed: [number, number]; size: [number, number]; life: [number, number]; gravity?: number; spread?: number; grow?: number; glow?: string }
const MAX = 160;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export class ParticleLayer {
  private ctx: CanvasRenderingContext2D | null;
  private ps: P[] = [];
  private raf = 0; private last = 0; private dpr = 1;
  private canvas: HTMLCanvasElement;
  constructor(canvas: HTMLCanvasElement) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.resize(); }
  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, r.width * this.dpr); this.canvas.height = Math.max(1, r.height * this.dpr);
  }
  /** 在 (x,y)（相对画布的 CSS 像素）喷发；dir 给定时朝该方向（弧度）喷 */
  burst(x: number, y: number, pr: Preset, dir?: number) {
    if (!this.ctx) return;
    const n = reducedMotion() ? Math.min(6, pr.count) : pr.count;
    for (let i = 0; i < n && this.ps.length < MAX; i++) {
      const a = dir === undefined ? rnd(0, Math.PI * 2) : dir + rnd(-(pr.spread ?? 0.6), pr.spread ?? 0.6);
      const sp = rnd(pr.speed[0], pr.speed[1]); const life = rnd(pr.life[0], pr.life[1]);
      const shape = pick(pr.shapes);
      this.ps.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life, size: rnd(pr.size[0], pr.size[1]), color: pick(pr.colors), shape,
        rot: rnd(0, 6.28), vr: rnd(-6, 6), g: pr.gravity ?? 0, text: shape === 'glyph' ? pick(pr.glyphs ?? ['✦']) : undefined, grow: pr.grow ?? 0, alpha: 1 });
    }
    this.start();
  }
  /** 从 a 飞向 b 的拖尾弹道（技能飞行物），返回飞行时长 ms */
  trail(ax: number, ay: number, bx: number, by: number, pr: Preset, ms = 320) {
    const steps = reducedMotion() ? 1 : 8;
    for (let i = 0; i < steps; i++) setTimeout(() => {
      const t = i / steps; this.burst(ax + (bx - ax) * t, ay + (by - ay) * t - Math.sin(t * Math.PI) * 40, { ...pr, count: Math.ceil(pr.count / 5), speed: [10, 60], life: [0.25, 0.45] });
    }, (ms / steps) * i);
    return ms;
  }
  clear() { this.ps.length = 0; }
  private start() { if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(this.tick); } }
  private tick = (t: number) => {
    const dt = Math.min(0.05, (t - this.last) / 1000); this.last = t;
    const c = this.ctx!; const d = this.dpr;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.canvas.width, this.canvas.height); c.setTransform(d, 0, 0, d, 0, 0);
    let w = 0;
    for (const p of this.ps) {
      p.life -= dt; if (p.life <= 0) continue;
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.985; p.vy *= 0.985; p.rot += p.vr * dt; p.size += p.grow * dt;
      const k = p.life / p.max; c.globalAlpha = Math.min(1, k * 1.6);
      draw(c, p);
      this.ps[w++] = p;
    }
    this.ps.length = w;
    c.globalAlpha = 1;
    if (w) this.raf = requestAnimationFrame(this.tick); else { this.raf = 0; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.canvas.width, this.canvas.height); }
  };
  destroy() { cancelAnimationFrame(this.raf); this.raf = 0; this.ps.length = 0; }
}

function draw(c: CanvasRenderingContext2D, p: P) {
  c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = p.color; c.strokeStyle = p.color;
  const s = p.size;
  switch (p.shape) {
    case 'dot': c.beginPath(); c.arc(0, 0, s / 2, 0, 6.283); c.fill(); break;
    case 'square': c.fillRect(-s / 2, -s / 2, s, s); break;
    case 'spark': c.lineWidth = Math.max(1.5, s / 5); c.beginPath(); c.moveTo(-s, 0); c.lineTo(s, 0); c.stroke(); break;
    case 'ring': c.lineWidth = 3; c.beginPath(); c.arc(0, 0, s, 0, 6.283); c.stroke(); break;
    case 'bubble': c.lineWidth = 2; c.globalAlpha *= 0.9; c.beginPath(); c.arc(0, 0, s / 2, 0, 6.283); c.stroke(); c.globalAlpha *= 0.4; c.fill(); break;
    case 'petal': c.beginPath(); c.ellipse(0, 0, s / 2, s / 5, 0, 0, 6.283); c.fill(); break;
    case 'ink': c.beginPath(); c.ellipse(0, 0, s / 2, s / 3, 0, 0, 6.283); c.fill(); c.beginPath(); c.arc(s / 2, s / 4, s / 6, 0, 6.283); c.fill(); break;
    case 'star': star(c, s / 2); break;
    case 'heart': heart(c, s / 2); break;
    case 'glyph': c.rotate(-p.rot * 0.8); c.font = `bold ${s}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(p.text ?? '✦', 0, 0); break;
  }
  c.restore();
}
function star(c: CanvasRenderingContext2D, r: number) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); c.fill(); }
function heart(c: CanvasRenderingContext2D, r: number) { c.beginPath(); c.moveTo(0, r * 0.6); c.bezierCurveTo(-r * 1.2, -r * 0.2, -r * 0.5, -r * 1.1, 0, -r * 0.4); c.bezierCurveTo(r * 0.5, -r * 1.1, r * 1.2, -r * 0.2, 0, r * 0.6); c.fill(); }
