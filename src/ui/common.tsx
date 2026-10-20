import { useRef, useEffect, useState, type ReactNode } from 'react';
import { addNumKey, press, physKey, type Burst } from '../game/keypad';
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
/* r16.1：kind = 'ime' 时不用自带键盘，换成普通文本框（系统输入法：汉字、化学式等），见 game/inputKind.ts */
export function Keypad({ letters, sci, value, onChange, onOk, ime }: { letters: boolean; sci?: boolean; value: string; onChange: (v: string) => void; onOk: (v: string) => void; ime?: boolean }) {
  // 字母键盘：完整 a–z（含 e），不显示 ×10ⁿ；×10ⁿ 只在数字键盘（理科）出现（试玩报告 #1）
  // 技术QA R6-2/R6-3：QWERTY 三行（10/9/7）+ ' - 两键，第 4 行空格、退格、确定
  const rows = ['qwertyuiop', 'asdfghjkl', "zxcvbnm'-"].map(r => r.split(''));
  /* r15.4 学霸：输入框在「已输入的值」和「空」之间闪、「确定」亮暗切换、有一次点确定没反应（和上轮「36 变 3」同根）。
     以前有两份「当前输入」：键盘里的 vRef（按键立即更新）和父组件的 input（要等重绘）；每次渲染又用父组件的旧值盖回 vRef，
     而「确定」提交的是父组件上一次渲染时的 input。按键和「确定」挨得很近（同一帧、物理键盘回车、工具连发）时，提交的是旧值（空 → 当超时、「36」→「3」），
     显示也会在两份值之间来回。现在键盘自己持有唯一的当前值：显示、「确定」能不能点、提交的内容都用它；父组件只接收通知。
     父组件主动改值（换题清空、复活换题）时才同步进来——判断依据是「和我最后一次报出去的值不同」，不会把正在输入的值盖掉 */
  const [val, setVal] = useState(value); const burst = useRef<Burst | null>(null);
  const vRef = useRef(value); const sentRef = useRef(value);
  const onChangeRef = useRef(onChange); onChangeRef.current = onChange; const onOkRef = useRef(onOk); onOkRef.current = onOk;
  useEffect(() => { if (value !== sentRef.current) { sentRef.current = value; vRef.current = value; burst.current = null; setVal(value); } }, [value]);
  const commit = (n: string) => { vRef.current = n; sentRef.current = n; setVal(n); onChangeRef.current(n); };
  const submitNow = () => { const v = vRef.current; if (v.trim()) onOkRef.current(v); };
  // r14.1 学霸：打完字第一次点「确定」常常没反应——按下后键盘区域重排（输入框变高 / 计时刷新）时按下和抬起不在同一元素上，click 不触发。
  // 现在抬起就提交；随后的 click 去重（400 ms 内不重复提交）
  /* r15.2.1 学霸：快速打字时手指交叠（上一个键还没抬起，下一个键已经按下）——以前按键在 click 时才生效，而 click 要等抬手才合成：
     交叠时顺序按「谁先抬手」来（-,1 变成「1-」，-,3,/,2 变成「3-/2」），甚至整个 click 被浏览器丢掉（100 变 1、41 变 4）。
     现在按下（pointerdown）就生效，每个手指各有一次、顺序就是按下的顺序；之后合成的 click 不再重复。
     另外每次按键都在 vRef 上接着拼，不用渲染时的旧 value（两次按键之间还没重绘也不会丢字） */
  const ptrAt = useRef(0);
  const apply = (f: (v: string) => string) => commit(f(vRef.current));
  /* r15.3 学霸：多指几乎同时按（工具一次发几个 touch）时，1234 曾显示 3214——事件到达顺序 ≠ 按下顺序。
     现在按 pointerdown 的时间戳排：150 ms 内的一串按键，晚到但更早按下的键插回原位重算（见 game/keypad.ts） */
  const keyProps = (f: (v: string) => string) => ({
    onPointerDown: (e: React.PointerEvent) => { if (e.pointerType === 'mouse' && e.button !== 0) return; ptrAt.current = Date.now();
      const nb = press(burst.current, vRef.current, e.timeStamp, performance.now(), f); burst.current = nb; commit(nb.cur); },
    onClick: (e: React.MouseEvent) => { if (e.detail !== 0 && Date.now() - ptrAt.current < 1500) return; apply(f); },   // 键盘 / 读屏激活（没有 pointerdown）照常生效
  });
  const add = (k: string) => keyProps(v => letters ? v + k : addNumKey(v, k));   // r15.3：数字键盘的「-」只在数的开头有效
  /* r15.4.2 学霸：输了数字后按「-」直接切换这个数的正负（keypad.ts toggleMinus），不再弹提示 */
  const addKey = add;
  const back = keyProps(v => v.slice(0, -1));
  const okAt = useRef(0);
  const okUp = (e: React.PointerEvent) => { if (e.button !== 0 || !vRef.current.trim()) return; okAt.current = Date.now(); submitNow(); };
  const okClick = () => { if (Date.now() - okAt.current < 400) return; submitNow(); };
  useEffect(() => {   // 物理键盘也能输入
    if (ime) return;   // 系统输入法：文本框自己收键（不能拦 Backspace / 字母，也不能打断输入法组字）
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return; const v = vRef.current;
      const key = physKey(e, letters);   // r15.4 学霸：中文输入法 / 小键盘的「-」（key 为 Process、－、−、Subtract 等）也认
      if (e.key === 'Enter') { if (v.trim()) submitNow(); }
      else if (e.key === 'Backspace') apply(x => x.slice(0, -1));
      else if (letters ? /^[a-zA-Z '\-’‘–—]$/.test(key) : /^[0-9.\-/]$/.test(key)) { const k = letters ? key.toLowerCase() : key; apply(x => letters ? x + k : addNumKey(x, k)); }
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [letters, ime]);
  if (ime) return (
    <div className="keypad-wrap ime-wrap">
      <input className="input-box ime-input" data-testid="input" type="text" inputMode="text" lang="zh-CN" enterKeyHint="done" autoFocus
        autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} maxLength={80} placeholder="用输入法打字，打完点「确定」" value={val}
        onChange={e => commit(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) { e.preventDefault(); submitNow(); } }} />
      <div className="kp-row ime-row"><button className="ok" data-testid="ok" onPointerUp={okUp} onClick={okClick} disabled={!val.trim()}>确定</button></div>
    </div>
  );
  return (
    <div className="keypad-wrap">
      <div className="input-box" data-testid="input">{(letters ? val : val.replace(/e/g, '×10^')) || <span className="ph">点下面的键输入{letters ? '' : '（分数用 /）'}</span>}</div>
      {letters ? <div className="keypad alpha">
        {rows.map((r, i) => <div className="kp-row" key={i}>{r.map(k => <button key={k} data-key={k} className={k === "'" || k === '-' ? 'sym' : ''} {...add(k)}>{k}</button>)}</div>)}
        <div className="kp-row last">
          <button className="space" data-key="space" {...add(' ')}>空格</button>
          <button className="del" aria-label="退格" {...back}>⌫</button>
          <button className="ok" data-testid="ok" onPointerUp={okUp} onClick={okClick} disabled={!val.trim()}>确定</button></div>
      </div> : <div className="keypad num3">
        {/* 技术QA P2-4：固定 3×4「7 8 9 / 4 5 6 / 1 2 3 / - 0 .」，退格/分数/确定在右侧一列，横竖屏一致 */}
        <div className="kp-digits">{['7', '8', '9', '4', '5', '6', '1', '2', '3', '-', '0', '.'].map(k => <button key={k} data-key={k} {...addKey(k)}>{k}</button>)}</div>
        <div className="kp-side">
          <button className="del" aria-label="退格" {...back}>⌫</button>
          <button data-key="/" {...add('/')}>/</button>
          {sci && !letters && <button data-key="e" {...add('e')}>×10ⁿ</button>}
          <button className="ok" data-testid="ok" onPointerUp={okUp} onClick={okClick} disabled={!val.trim()}>确定</button>
        </div>
      </div>}
    </div>
  );
}
/** 家长密码键盘 */
export function PinPad({ title, hint, onSubmit, error, onCancel, disabled, extra }: { title: string; hint?: string; onSubmit: (pin: string) => void; error?: ReactNode; onCancel?: () => void; disabled?: boolean; extra?: ReactNode }) {
  const [v, setV] = useState(''); const sent = useRef(false);   /* r15.1：触屏抬手就确认（同答题键盘），之后的 click 不再重复 */
  /* r15.4.3 较真家长 P1（丢字排查）：数字键改用函数式更新（连点时不会用到旧的 v 吞掉一位）；按下确定时清掉上一次触屏留下的标记（确定后按钮立刻变灰、那次 click 不会来，标记会一直留着吞掉之后的鼠标确定） */
  /* r16：error 可以是倒计时组件（LockLeft，自己每秒刷新）——只按「有没有 / 文字变没变」清空 */
  const errKey = typeof error === 'string' ? error : !!error;
  useEffect(() => { if (errKey) setV(''); }, [errKey]);
  return (
    <div className="pinpad">
      <h2>{title}</h2>
      <div className="pin-dots" data-testid="pin-dots">{Array.from({ length: 6 }, (_, i) => <span key={i} className={i < v.length ? 'on' : ''} />)}</div>
      {error ? <p className="warn" data-testid="pin-error">{error}</p> : hint && <p className="pin-hint">{v.length < 4 ? `${hint}（已输入 ${v.length} 位）` : '可以点「确定」了'}</p>}
      <div className={`pin-keys ${disabled ? 'locked' : ''}`}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(k => <button key={k} disabled={disabled} data-testid={'pin-' + k} onClick={() => setV(x => x.length < 6 ? x + k : x)}>{k}</button>)}
        <button className="del" onClick={() => setV(x => x.slice(0, -1))}>⌫</button>
        <button data-testid="pin-0" disabled={disabled} onClick={() => setV(x => x.length < 6 ? x + '0' : x)}>0</button>
        <button className="ok" data-testid="pin-ok" disabled={disabled || v.length < 4} onPointerDown={() => { sent.current = false; }} onPointerUp={e => { if (e.pointerType === 'mouse' || disabled || v.length < 4) return; sent.current = true; onSubmit(v); setV(''); }} onClick={() => { if (sent.current) { sent.current = false; return; } onSubmit(v); setV(''); }}>确定</button>
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
