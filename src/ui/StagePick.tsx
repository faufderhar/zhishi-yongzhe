/* r8b 两级入口：第 1 级选学段（大按钮 + 图标，点按朗读，小班不识字也能用）；第 2 级选年级（总是显示），再进该年级地图 */
import { STAGES, stageOf, type StageId } from '../game/stages';
import { speak } from '../tts';
import type { GradeKey } from '../game/questions';
export function StagePick({ current, profileGrade, onPick, onBack }: { current: GradeKey; profileGrade: GradeKey; onPick: (s: StageId) => void; onBack: () => void }) {
  const cur = stageOf(current);
  return (
    <div className="center-screen stage-pick" data-testid="stage-pick">
      <h1>选学段</h1>
      <div className="stage-grid">
        {STAGES.map(s => <button key={s.id} className={`stage-btn ${s.id === cur ? 'on' : ''}`} data-testid={'stage-' + s.id} aria-label={s.label}
          onClick={() => { speak(s.label); onPick(s.id); }}>
          <span className="stage-icon" aria-hidden>{s.icon}</span><span className="stage-label">{s.label}</span>
          {s.id === stageOf(profileGrade) && <small className="mine">我的</small>}</button>)}
      </div>
      <button className="btn ghost" onClick={onBack}>返回</button>
    </div>);
}
export function GradePick({ stage, current, profileGrade, onPick, onBack }: { stage: StageId; current: GradeKey; profileGrade: GradeKey; onPick: (g: GradeKey) => void; onBack: () => void }) {
  const st = STAGES.find(s => s.id === stage)!;
  return (
    <div className="center-screen stage-pick" data-testid="grade-pick">
      <h1><span aria-hidden>{st.icon}</span> {st.label} · 选年级</h1>
      <div className="stage-grid grades">
        {st.grades.map(g => g.grade
          ? <button key={g.key} className={`stage-btn grade ${g.grade === current ? 'on' : ''}`} data-testid={'grade-' + g.key} aria-label={g.label}
              onClick={() => { speak(g.label); onPick(g.grade!); }}>
              <span className="stage-label">{g.label}</span>{g.grade === profileGrade && <small className="mine">我的年级</small>}</button>
          : <button key={g.key} className="stage-btn grade locked" data-testid={'grade-' + g.key} aria-disabled="true" aria-label={`${g.label}，敬请期待`}
              onClick={() => speak(`${g.label}还在准备中，敬请期待`)}>
              <span className="stage-label">🔒 {g.label}</span><small>敬请期待</small></button>)}
      </div>
      <button className="btn ghost" data-testid="grade-back" onClick={onBack}>返回选学段</button>
    </div>);
}
