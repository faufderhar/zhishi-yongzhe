import { useEffect, useState, type ReactNode } from 'react';
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
  const keys = letters ? 'qwertyuiopasdfghjklzxcvbnm'.split('') : ['7', '8', '9', '4', '5', '6', '1', '2', '3', '-', '0', '.', '/', ...(sci ? ['e'] : [])];
  return (
    <div className="keypad-wrap">
      <div className="input-box" data-testid="input">{value.replace(/e/g, '×10^') || <span className="ph">点下面的键输入{letters ? '' : '（分数用 /）'}</span>}</div>
      {letters ? <div className="keypad alpha">
        {keys.map(k => <button key={k} data-key={k} onClick={() => onChange(value + k)}>{k}</button>)}
        <button onClick={() => onChange(value + ' ')}>空格</button>
        <button className="del" aria-label="退格" onClick={() => onChange(value.slice(0, -1))}>⌫</button>
        <button className="ok" data-testid="ok" onClick={onOk} disabled={!value.trim()}>确定</button>
      </div> : <div className="keypad num3">
        {/* 技术QA P2-4：固定 3×4「7 8 9 / 4 5 6 / 1 2 3 / - 0 .」，退格/分数/确定在右侧一列，横竖屏一致 */}
        <div className="kp-digits">{['7', '8', '9', '4', '5', '6', '1', '2', '3', '-', '0', '.'].map(k => <button key={k} data-key={k} onClick={() => onChange(value + k)}>{k}</button>)}</div>
        <div className="kp-side">
          <button className="del" aria-label="退格" onClick={() => onChange(value.slice(0, -1))}>⌫</button>
          <button data-key="/" onClick={() => onChange(value + '/')}>/</button>
          {sci && <button data-key="e" onClick={() => onChange(value + 'e')}>×10ⁿ</button>}
          <button className="ok" data-testid="ok" onClick={onOk} disabled={!value.trim()}>确定</button>
        </div>
      </div>}
    </div>
  );
}
/** 家长密码键盘 */
export function PinPad({ title, hint, onSubmit, error, onCancel, disabled, extra }: { title: string; hint?: string; onSubmit: (pin: string) => void; error?: string; onCancel?: () => void; disabled?: boolean; extra?: ReactNode }) {
  const [v, setV] = useState('');
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
        <button className="ok" data-testid="pin-ok" disabled={disabled || v.length < 4} onClick={() => { onSubmit(v); setV(''); }}>确定</button>
      </div>
      {!disabled && v.length < 4 && <p className="pin-why">请输入 4–6 位数字</p>}
      {extra}
      {onCancel && <button className="btn ghost" onClick={onCancel}>返回</button>}
      <p className="hint">4–6 位数字。只用来防止孩子误入，不是安全密码。</p>
    </div>
  );
}
export function fmtMin(sec: number) { return sec === Infinity ? '不限' : `${Math.ceil(sec / 60)} 分钟`; }
