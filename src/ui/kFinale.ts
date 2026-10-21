/* r17：幼儿园闯关成功的结算页动画（美术分镜 /workspace/art/k_qban/finale_storyboard.md，3 秒）：
   B1 进场（0–0.3 s）→ B2 变朋友（默认 → 开心交叉淡化，头顶小爱心）→ B3 抱抱（怪物蹦到小狗身边，中间一颗爱心留着）→
   B4 星星从拥抱点飞进星槽 → B5 彩带落下弹一下再淡出，「下一关」轻跳。
   节拍跟着结算页的朗读走：B4 = max(1.2 s, 第 1 段「开心值一共 m 个」开始)，B5 = max(2.2 s, 第 2 段（副标题）开始)；
   没有声音 / 朗读迟迟不开始 → 按兜底时间（看门狗），动画总长 3 s。「好朋友」那句仍在战斗页读（r16.3 方案 A 不变），朗读顺序不变。
   护眼：不用白色遮罩、不用 brightness 滤镜、星星落位不发光、没有重复闪烁。减少动画：只有淡入淡出（怪物直接站在拥抱位置、星星原地淡入、静态彩旗）。
   点任何地方 → 所有动画直接到最后一帧（不拦按钮）。 */
import { reducedMotion } from '../fx/motion';
export const KFIN = { b2: 300, b3: 600, b4: 1200, b5: 2200, b4Wait: 4500, b5Wait: 3500, starMs: 520, starGap: 160, confetti: 18, total: 3000 };
const EO = 'cubic-bezier(.22,1,.36,1)', EIO = 'cubic-bezier(.45,0,.55,1)', BACK = 'cubic-bezier(.34,1.56,.64,1)';
export const CONFETTI_COLORS = ['#f4d9a6', '#f2c6cf', '#c9ddf0', '#cfe5c4', '#dcd2ee', '#f6cbb5'];
/** 节拍调度（纯逻辑，可单测）：voice = 会不会有朗读；seg(i) = 朗读第 i 段开始；到点调用 fire('b4' | 'b5') */
export function kFinaleClock(o: { voice: boolean; fire: (b: 'b4' | 'b5') => void; now?: () => number; setT?: (f: () => void, ms: number) => unknown; clearT?: (h: unknown) => void }) {
  const now = o.now ?? (() => performance.now()), setT = o.setT ?? ((f, ms) => setTimeout(f, ms)), clearT = o.clearT ?? (h => clearTimeout(h as number));
  const t0 = now(); const done = { b4: false, b5: false }; const timers: unknown[] = [];
  const at = (b: 'b4' | 'b5', ms: number) => { timers.push(setT(() => go(b), Math.max(0, ms - (now() - t0)))); };
  const go = (b: 'b4' | 'b5') => { if (done[b]) return; if (b === 'b5' && !done.b4) go('b4'); done[b] = true; o.fire(b);
    if (b === 'b4' && !done.b5) at('b5', o.voice ? Math.max(KFIN.b5, now() - t0 + KFIN.b5Wait) : Math.max(KFIN.b5, now() - t0 + (KFIN.b5 - KFIN.b4))); };
  at('b4', o.voice ? KFIN.b4Wait : KFIN.b4);   // 看门狗：朗读一直没开始 → 4.5 s 时照样飞星星
  return {
    seg(i: number) { const t = now() - t0; if (i === 0 && !done.b4) at('b4', Math.max(KFIN.b4, t)); else if (i >= 1 && !done.b5) { if (!done.b4) go('b4'); at('b5', Math.max(KFIN.b5, t)); } },
    finish() { go('b4'); go('b5'); },
    stop() { timers.forEach(clearT); },
    state: () => ({ ...done }),
  };
}
const anim = (el: Element | null | undefined, kf: Keyframe[], o: KeyframeAnimationOptions, list: Animation[]) => { if (!el || typeof (el as HTMLElement).animate !== 'function') return null; const a = (el as HTMLElement).animate(kf, { fill: 'both', ...o }); list.push(a); return a; };
/** 在结算页根节点上演：需要 [data-kfin=pup] [data-kfin=mon]（里面 .kfin-def / .kfin-happy 两张图）[data-kfin=heart] [data-kfin=stars] .stars .on，[data-kfin=layer] 装饰层 */
export function runKFinale(root: HTMLElement, voice: boolean) {
  const rm = reducedMotion(); const list: Animation[] = []; const q = (s: string) => root.querySelector<HTMLElement>(`[data-kfin=${s}]`);
  const pup = q('pup'), mon = q('mon'), heart = q('heart'), layer = q('layer'), stars = q('stars');
  const def = mon?.querySelector<HTMLElement>('.kfin-def'), happy = mon?.querySelector<HTMLElement>('.kfin-happy');
  const on = [...(stars?.querySelectorAll<HTMLElement>('.on') ?? [])];
  root.dataset.beat = 'b1';
  const pr = pup?.getBoundingClientRect(), mr = mon?.getBoundingClientRect();
  const dx = pr && mr ? -Math.max(0, Math.min(mr.left - pr.right + mr.width * 0.18, mr.width * 1.2)) : 0;   // 蹦到小狗身边（贴住，稍微重叠）
  on.forEach(s => { s.style.opacity = '0'; });
  if (rm) {
    if (mon) mon.style.transform = `translateX(${dx}px)`;
    anim(def, [{ opacity: 1 }, { opacity: 0 }], { duration: 600, delay: KFIN.b2 }, list); anim(happy, [{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: KFIN.b2 }, list);
    anim(heart, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: KFIN.b3 + 300 }, list);
  } else {
    anim(pup, [{ transform: 'translateX(-24px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300, easing: EO }, list);
    // 1.2 s 一条：0–0.3 进场 / 0.3–0.54 放大 1.06 / –0.6 回到 1 / 0.6–1.02 抛物线蹦过去（最高 -28 px）/ 1.02–1.2 挤一下
    anim(mon, [{ transform: 'translateX(24px)', opacity: 0, offset: 0, easing: EO }, { transform: 'translateX(0)', opacity: 1, offset: 0.25 }, { transform: 'translateX(0) scale(1.06)', offset: 0.45 }, { transform: 'translateX(0) scale(1)', offset: 0.5, easing: EIO },
      { transform: `translateX(${dx * 0.5}px) translateY(-28px)`, offset: 0.675, easing: EIO }, { transform: `translateX(${dx}px)`, offset: 0.85 }, { transform: `translateX(${dx}px) scale(1.04,.96)`, offset: 0.925 }, { transform: `translateX(${dx}px)`, offset: 1 }],
    { duration: KFIN.b4, easing: 'linear' }, list);
    anim(def, [{ opacity: 1 }, { opacity: 0 }], { duration: 240, delay: KFIN.b2 }, list); anim(happy, [{ opacity: 0 }, { opacity: 1 }], { duration: 240, delay: KFIN.b2 }, list);
    anim(mon?.querySelector('.kfin-up'), [{ transform: 'translateY(0)', opacity: 0 }, { transform: 'translateY(-22px)', opacity: 1, offset: 0.4 }, { transform: 'translateY(-44px)', opacity: 0 }], { duration: 600, delay: KFIN.b2, easing: EO }, list);
    anim(pup, [{ rotate: '0deg' }, { rotate: '6deg', offset: 0.5 }, { rotate: '3deg' }], { duration: 300, delay: 900, easing: EIO }, list);
    anim(heart, [{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 240, delay: 1020, easing: BACK }, list);
  }
  const b4 = () => { root.dataset.beat = 'b4';
    if (rm || !layer) { on.forEach(s => { s.style.opacity = ''; anim(s, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 }, list); }); return; }
    const L = layer.getBoundingClientRect(); const hr = (heart ?? mon)?.getBoundingClientRect(); const sx = hr ? hr.left + hr.width / 2 - L.left : L.width / 3, sy = hr ? hr.top + hr.height / 2 - L.top : L.height / 2;
    on.forEach((s, k) => { const r = s.getBoundingClientRect(); const ex = r.left + r.width / 2 - L.left, ey = r.top + r.height / 2 - L.top; const fs = getComputedStyle(s).fontSize;
      const f = document.createElement('span'); f.className = 'kfin-fly'; f.textContent = '★'; f.style.fontSize = fs; layer.appendChild(f);
      const mx = sx + (ex - sx) * 0.45, my = Math.min(sy, ey) - 60; const tr = (x: number, y: number, sc: number) => `translate(${x}px,${y}px) translate(-50%,-50%) scale(${sc})`;
      const a = anim(f, [{ transform: tr(sx, sy, 0.5), opacity: 0 }, { transform: tr(mx, my, 0.9), opacity: 1, offset: 0.45 }, { transform: tr(ex, ey, 1.2), opacity: 1, offset: 0.8 }, { transform: tr(ex, ey, 1), opacity: 1 }],
        { duration: KFIN.starMs, delay: k * KFIN.starGap, easing: 'cubic-bezier(.33,0,.2,1)' }, list);
      const land = () => { s.style.opacity = ''; f.remove(); }; if (a) a.finished.then(land, land); else land(); }); };
  const b5 = () => { root.dataset.beat = 'b5';
    if (!layer) return;
    if (rm) { const g = document.createElement('div'); g.className = 'kfin-garland'; g.setAttribute('aria-hidden', 'true'); g.innerHTML = CONFETTI_COLORS.concat(CONFETTI_COLORS).map(c => `<i style="border-top-color:${c}"></i>`).join(''); layer.appendChild(g); anim(g, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 }, list); return; }
    const L = layer.getBoundingClientRect(); const ground = Math.min(L.height - 8, (pup?.getBoundingClientRect().bottom ?? L.bottom) - L.top);
    for (let i = 0; i < KFIN.confetti; i++) { const p = document.createElement('i'); p.className = `kfin-conf k${i % 4}`; p.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length]; layer.appendChild(p);
      const x = L.width * (0.06 + 0.88 * ((i * 37) % KFIN.confetti) / KFIN.confetti), rot = 90 + (i * 53) % 120, d = (i * 29) % 120;
      const a = anim(p, [{ transform: `translate(${x}px,-30px) rotate(0deg)`, opacity: 1, offset: 0, easing: 'cubic-bezier(.55,0,1,.45)' }, { transform: `translate(${x}px,${ground}px) rotate(${rot}deg)`, offset: 0.44 },
        { transform: `translate(${x}px,${ground - 16}px) rotate(${rot}deg)`, offset: 0.56 }, { transform: `translate(${x}px,${ground}px) rotate(${rot}deg)`, opacity: 1, offset: 0.6 }, { transform: `translate(${x}px,${ground}px) rotate(${rot}deg)`, opacity: 0, offset: 1 }],
      { duration: 1000, delay: d }, list); const rmv = () => p.remove(); if (a) a.finished.then(rmv, rmv); else rmv(); }
    anim(root.querySelector('[data-testid=next-level]'), [{ transform: 'none' }, { transform: 'translateY(-6px)', offset: 0.5 }, { transform: 'none' }], { duration: 300, delay: 400, easing: EIO, fill: 'none' }, list); };
  const clock = kFinaleClock({ voice, fire: b => (b === 'b4' ? b4 : b5)() });
  const skip = () => { clock.finish(); list.forEach(a => { try { a.finish(); } catch { /* */ } }); root.dataset.beat = 'done'; };
  root.addEventListener('pointerdown', skip, { once: true, capture: true });
  return { seg: clock.seg, skip, stop: () => { clock.stop(); root.removeEventListener('pointerdown', skip, { capture: true }); list.forEach(a => { try { a.finish(); } catch { /* */ } }); } };
}
