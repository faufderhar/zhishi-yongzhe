/* r17-1（学霸裁定 §1）：技能详情——角色卡〔技能详情〕和战斗能量环弹窗用同一个组件、同一份文案：
   逐技能一行「图标 名字：效果」（我方回合的攻击技能在前，对方回合的在后），再加共用触发行；高中加冷却行。
   cdLeft 只在战斗里传（这一局剩余冷却），不改文案本身。 */
import { skillBlock, SKILL_TRIGGER_TEXT, SKILL_COOLDOWN_TEXT, type SkillSeg } from '../game/skills';
import { skillIconUrl } from '../fx/skillFx';

export function SkillDetail({ seg, major, testid, cdLeft }: { seg: SkillSeg; major: string; testid: string; cdLeft?: Record<string, number> }) {
  const b = skillBlock(seg, major); if (!b) return null;
  return <>
    <ul className="skill-list" data-testid={testid + '-list'}>{[...b.mine, ...b.theirs].map(k => <li key={k.id} data-side={k.type === 'atk' ? 'P' : 'M'}>
      <img src={skillIconUrl(k.id)} alt="" width={32} height={32} style={{ verticalAlign: 'middle' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} /> {k.icon} <b>{k.name}</b>：{k.effectText}{k.cd ? `（冷却 ${k.cd} 回合${cdLeft?.[k.id] ? `，还剩 ${cdLeft[k.id]}` : ''}）` : ''}</li>)}</ul>
    <p className="hint">我方回合答对 → 攻击技能；对方回合答对 → 防护 / 恢复 / 控制技能{seg === 'H' ? '（高中有冷却）' : ''}</p>
    <p data-testid={testid}>{SKILL_TRIGGER_TEXT}</p>{seg === 'H' && <p data-testid={testid + '-cd'}>{SKILL_COOLDOWN_TEXT}</p>}
  </>;
}
