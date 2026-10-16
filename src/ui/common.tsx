import { useRef, useEffect, useState, type ReactNode } from 'react';
export function Bar({ label, v, max, cls }: { label: string; v: number; max: number; cls: string }) {
  return <span className={`bar ${cls}`} aria-live="polite" aria-label={`${cls === "hp" ? "我的血量" : "怪物血量"} ${v}/${max}`}>{label}<span className="track"><span className="ghost" style={{ transform: `scaleX(${Math.max(0, v) / max})` }} /><span className="fill" style={{ transform: `scaleX(${Math.max(0, v) / max})` }} /></span>{v}/{max}</span>;
}
export function Stars({ n, max = 3, size }: { n: number; max?: number; size?: number }) {
  return <span className="stars" style={size ? { fontSize: size } : undefined}>{Array.from({ length: max }, (_, i) => <span key={i} className={i < n ? 'on' : 'off'}>★</span>)}</span>;
}
export function Modal({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return <div className="modal-back" onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}><div className="modal">{children}</div></div>;
}
/** 自带屏幕键盘（GDD §9.4） */
export function Keypad({ letters, sci, value, onChange, onOk }: { letters: boolean; sci?: boolean; value: string; onChange: (v: string) => void; onOk: () => void }) {
  // 字母键盘：完整 a–z（含 e），不显示 ×10ⁿ；×10ⁿ 只在数字键盘（理科）出现（试玩报告 #1）
  // 技术QA R6-2/R6-3：QWERTY 三行（10/9/7）+ ' - 两键，第 4 行空格、退格、确定
  const rows = ['qwertyuiop', 'asdfghjkl', "zxcvbnm'-"].map(r => r.split(''));
  const vRef = useRef(value); vRef.current = value;
  // r14.1 学霸：打完字第一次点「确定」常常没反应——按下后键盘区域重排（输入框变高 / 计时刷新）时按下和抬起不在同一元素上，click 不触发。
  // 现在抬起就提交；随后的 click 去重（400 ms 内不重复提交）
  const okAt = useRef(0);
  const okUp = (e: React.PointerEvent) => { if (e.button !== 0 || !vRef.current.trim()) return; okAt.current = Date.now(); onOk(); };
  const okClick = () => { if (Date.now() - okAt.current < 400) return; if (vRef.current.trim()) onOk(); };
  useEffect(() => {   // 物理键盘也能输入
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return; const v = vRef.current;
      if (e.key === 'Enter') { if (v.trim()) onOk(); }
      else if (e.key === 'Backspace') onChange(v.slice(0, -1));
      else if (letters ? /^[a-zA-Z '\-’‘–—]$/.test(e.key) : /^[0-9.\-/]$/.test(e.key)) onChange(v + (letters ? e.key.toLowerCase() : e.key));
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [letters, onOk, onChange]);
  return (
    <div className="keypad-wrap">
      <div className="input-box" data-testid="input">{(letters ? value : value.replace(/e/g, '×10^')) || <span className="ph">点下面的键输入{letters ? '' : '（分数用 /）'}</span>}</div>
      {letters ? <div className="keypad alpha">
        {rows.map((r, i) => <div className="kp-row" key={i}>{r.map(k => <button key={k} data-key={k} className={k === "'" || k === '-' ? 'sym' : ''} onClick={() => onChange(value + k)}>{k}</button>)}</div>)}
        <div className="kp-row last">
          <button className="space" data-key="space" onClick={() => onChange(value + ' ')}>空格</button>
          <button className="del" aria-label="退格" onClick={() => onChange(value.slice(0, -1))}>⌫</button>
          <button className="ok" data-testid="ok" onPointerUp={okUp} onClick={okClick} disabled={!value.trim()}>确定</button></div>
      </div> : <div className="keypad num3">
        {/* 技术QA P2-4：固定 3×4「7 8 9 / 4 5 6 / 1 2 3 / - 0 .」，退格/分数/确定在右侧一列，横竖屏一致 */}
        <div className="kp-digits">{['7', '8', '9', '4', '5', '6', '1', '2', '3', '-', '0', '.'].map(k => <button key={k} data-key={k} onClick={() => onChange(value + k)}>{k}</button>)}</div>
        <div className="kp-side">
          <button className="del" aria-label="退格" onClick={() => onChange(value.slice(0, -1))}>⌫</button>
          <button data-key="/" onClick={() => onChange(value + '/')}>/</button>
          {sci && !letters && <button data-key="e" onClick={() => onChange(value + 'e')}>×10ⁿ</button>}
          <button className="ok" data-testid="ok" onPointerUp={okUp} onClick={okClick} disabled={!value.trim()}>确定</button>
        </div>
      </div>}
    </div>
  );
}
/** 家长密码键盘 */
export function PinPad({ title, hint, onSubmit, error, onCancel, disabled, extra }: { title: string; hint?: string; onSubmit: (pin: string) => void; error?: string; onCancel?: () => void; disabled?: boolean; extra?: ReactNode }) {
  const [v, setV] = useState(''); const sent = useRef(false);   /* r15.1：触屏抬手就确认（同答题键盘），之后的 click 不再重复 */
  useEffect(() => { if (error) setV(''); }, [error]);
  return (
    <div className="pinpad">
      <h2>{title}</h2>
      <div className="pin-dots" data-testid="pin-dots">{Array.from({ length: 6 }, (_, i) => <span key={i} className={i < v.length ? 'on' : ''} />)}</div>
      {error ? <p className="warn" data-testid="pin-error">{error}</p> : hint && <p className="pin-hint">{v.length < 4 ? `${hint}（已输入 ${v.length} 位）` : '可以点「确定」了'}</p>}
      <div className={`pin-keys ${disabled ? 'locked' : ''}`}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(k => <button key={k} disabled={disabled} data-testid={'pin-' + k} onClick={() => v.length < 6 && setV(v + k)}>{k}</button>)}
        <button className="del" onClick={() => setV(v.slice(0, -1))}>⌫</button>
        <button data-testid="pin-0" disabled={disabled} onClick={() => v.length < 6 && setV(v + '0')}>0</button>
        <button className="ok" data-testid="pin-ok" disabled={disabled || v.length < 4} onPointerUp={e => { if (e.pointerType === 'mouse' || disabled || v.length < 4) return; sent.current = true; onSubmit(v); setV(''); }} onClick={() => { if (sent.current) { sent.current = false; return; } onSubmit(v); setV(''); }}>确定</button>
      </div>
      <p className="pin-why" style={{ visibility: !disabled && v.length < 4 ? 'visible' : 'hidden' }}>请输入 4–6 位数字</p>{/* r15.1：占位不收起，第 4 位时键盘不跳 */}
      {extra}
      {onCancel && <button className="btn ghost" onClick={onCancel}>返回</button>}
      <p className="hint">4–6 位数字。只用来防止孩子误入，不是安全密码。</p>
    </div>
  );
}
export function fmtMin(sec: number) { return sec === Infinity ? '不限' : `${Math.ceil(sec / 60)} 分钟`; }

/** 技术QA R4-7：正确答案只放在 JS 里，选项 DOM 不带 data-correct；仅自动化测试（window.__zyTest）时才标出来方便脚本点 */
export const TEST_DOM = typeof window !== 'undefined' && !!(__TEST_HOOKS__ && (window as unknown as { __zyTest?: boolean }).__zyTest);
