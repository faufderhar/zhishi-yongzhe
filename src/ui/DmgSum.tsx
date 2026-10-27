/* r16 D15（r17.1 §6.2 B：增益 ｜ 多段技能 ｜ 减：减益，减益灰蓝、一直显示，放不下先收增益）：伤害加成摘要（一行灰色小字，放不下按「等」截断）+「明细 ⓘ」浮层（不打断战斗；再点一次或点空白处关闭；按设备记住展开状态） */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { DmgInfo } from '../game/rounds';
import { summary, detailLines, fmtX, negText } from '../game/dmgText';

const KEY = 'zy-dmg-detail';
const readOpen = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
const saveOpen = (v: boolean) => { try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* 隐私模式 */ } };

export function DmgSum({ d, dealt, absorbed, detail = true, tid = 'dmg-sum', onCard = false }: { d?: DmgInfo; dealt?: number; absorbed?: number; detail?: boolean; tid?: string; onCard?: boolean }) {
  const [n, setN] = useState(3); const [open, setOpen] = useState(() => detail && readOpen());
  const line = useRef<HTMLSpanElement>(null), wrap = useRef<HTMLDivElement>(null);
  const s = summary(d, n);
  const sig = d ? JSON.stringify(d) : '';
  useLayoutEffect(() => { setN(3); }, [sig]);
  useLayoutEffect(() => { const el = line.current; if (el && n > 1 && el.scrollWidth > el.clientWidth + 1) setN(n - 1); });
  useEffect(() => { if (!open) return; const f = (e: PointerEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };   // 点空白处只关掉这一次；记住的偏好只由「明细 ⓘ」按钮改
    document.addEventListener('pointerdown', f, true); return () => document.removeEventListener('pointerdown', f, true); }, [open]);
  if (!s || !d) return null;
  const toggle = () => { setOpen(v => { saveOpen(!v); return !v; }); };
  return <div className="dmg-sum-wrap" ref={wrap}>
    <div className="dmg-sum" data-testid={tid}>
      <span className="dmg-sum-line" ref={line} data-n={s.items.length}>
        {s.items.map((x, k) => <span key={k}>{k ? ' · ' : ''}{x.name} {fmtX(x.m)}</span>)}{s.more ? ' 等' : ''}
        {s.multi && <span className="dmg-multi" data-testid={tid + '-multi'}>{s.items.length ? ' ｜ ' : ''}{s.multi}</span>}
        {s.neg.length > 0 && <span className="dmg-neg" data-testid={tid + '-neg'}>{s.items.length || s.multi ? ' ｜ ' : ''}{negText(s.neg, onCard ? d.card?.name : undefined)}</span>}
        {s.cap && <b className="dmg-cap" data-testid={tid + '-cap'}>{s.items.length || s.multi || s.neg.length ? ' · ' : ''}{s.cap}</b>}
      </span>
      {detail && <button type="button" className="dmg-more" data-testid={tid + '-more'} aria-expanded={open} onClick={toggle}>明细 ⓘ</button>}
    </div>
    {detail && open && <div className="dmg-detail" data-testid={tid + '-detail'} role="note">{detailLines(d, dealt, absorbed).map((t, k) => <div key={k}>{t}</div>)}</div>}
  </div>;
}
