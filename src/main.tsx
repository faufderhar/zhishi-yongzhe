import { StrictMode, Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { registerSW } from 'virtual:pwa-register';
// 新版本不在战斗中自动刷新：广播给 App，由孩子/家长在首页或地图点按钮更新（技术QA P1-7）
const update = registerSW({ immediate: true, onNeedRefresh() { window.dispatchEvent(new CustomEvent('zy-update-ready', { detail: () => update(true) })); } });
/** 出错页的家长操作（策划 T-P0-1）：都要家长密码 */
async function rescue(kind: 'export' | 'restore') {
  const { getKV, exportAll, importAll } = await import('./db');
  const { verifyPin } = await import('./game/pin');
  const st = await getKV<{ pinHash?: string }>('settings');
  if (st && typeof st === 'object' && st.pinHash) { const pin = prompt('请输入家长密码'); if (!pin || !(await verifyPin(pin, st.pinHash))) { alert('密码不对'); return; } }
  if (kind === 'export') {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(await exportAll())], { type: 'application/json' }));
    a.download = '知识勇者_原始数据.json'; document.body.appendChild(a); a.click(); return;
  }
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
  inp.onchange = async () => { const f = inp.files?.[0]; if (!f) return; try { await importAll(JSON.parse(await f.text())); location.reload(); } catch (e) { alert('这个文件不是知识勇者的备份，或已损坏：' + (e as Error).message); } };
  inp.click();
}
/** 兜底错误边界：任何渲染异常不再白屏（技术QA P0-1） */
class Boundary extends Component<{ children: ReactNode }, { err?: string }> {
  state: { err?: string } = {};
  static getDerivedStateFromError(e: Error) { return { err: String(e?.message ?? e) }; }
  render() {
    if (!this.state.err) return this.props.children;
    return <div className="center-screen" style={{ padding: 32, textAlign: 'center' }}><h2>游戏遇到一点问题，进度没有丢</h2><p className="hint">{this.state.err}</p>
      <div className="row gap16">
        <button className="btn big-sq" onClick={() => location.reload()}>重新加载</button>
        <button className="btn ghost big-sq" onClick={() => void rescue('export')}>导出原始数据</button>
        <button className="btn ghost big-sq" onClick={() => void rescue('restore')}>从备份恢复</button>
      </div><p className="hint">后两项需要家长密码。</p></div>;
  }
}
createRoot(document.getElementById('root')!).render(<StrictMode><Boundary><App /></Boundary></StrictMode>);
