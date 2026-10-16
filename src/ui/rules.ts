/* D14 §7：战斗页「？」规则说明（按学段）与首次短提示 */
import type { RoundMode } from '../game/balance';
export type TipKey = 'partial' | 'dodge' | 'perfect' | 'guard' | 'rage' | 'challenge' | 'cap';
export const TIP_KEYS: TipKey[] = ['partial', 'dodge', 'perfect', 'guard', 'rage', 'challenge', 'cap'];
export const TIP_TEXT: Record<TipKey, string> = {
  partial: '选对了一部分！伤害减半，下次把正确的都选上～',
  dodge: '运气好闪开了！不过还是看看正确答案吧',
  perfect: '完美闪避！答得又快又对，攒了 1 层专注',
  guard: '护体挡住了一部分伤害（只受 70%）',
  rage: 'Boss 怒了！攻击变强，还换了招式，小心💥',
  challenge: '想打得更快？点『挑战题』：更难，答对伤害 ×1.5，答错闪不开哦',
  cap: '加成已经到顶啦（最多 ×1.8）',
};
type Rule = [string, string, RoundMode[]];
const ALL: RoundMode[] = ['p36', 'j', 'h'], JH: RoundMode[] = ['j', 'h'];
const RULES: Rule[] = [
  ['轮流回合', '⚔ 我方回合答对就攻击，答错会被反击（有机会闪开）；🛡 对方回合答对就闪避，答错要挨打。', ALL],
  ['怪物意图', '怪物头上的图标是它下个对方回合要做的事：⚔ 攻击、⚡ 蓄力（下次重击 ×2，答对能打断）、💥 重击、🛡 开护盾（答对能破盾）、💤 发呆。', ALL],
  ['闪避', '我方回合答错时有 25% 的机会闪开（小学 30%）；对方回合答得快（用时不到一半）是「完美闪避」，攒 1 层专注。', ALL],
  ['专注', '每层让下次攻击 +25%、闪避 +10%，最多 2 层，我方回合结束清零。', JH],
  ['连击', '连续答对每题伤害 +5%，最多 +30%；答错清零。', ALL],
  ['技能', '答对时有机会自动放技能，能量攒满必定放。我方回合放攻击技能，对方回合放护体、回血或打乱怪物的技能。', ALL],
  ['护体', '下一次受伤只受 70%。', ALL],
  ['漏选（半对）', '多选题选对了一部分但没选全。我方回合只造成一半伤害，怪物也不反击；对方回合算没闪开，但伤害减半。', JH],
  ['加成上限', '连击、专注、技能、题卡、挑战一起最多 ×1.8。', ALL],
  ['Boss 二阶段', 'Boss 血量打掉一半会发怒，攻击 +20%，换一套招式；第一阶段多打的伤害不会带到第二阶段。', JH],
  ['挑战题', '题更难一档，答对伤害 ×1.5；答错反击 ×1.5，而且闪不开。', ['j']],
  ['题卡和押注', '重击伤害高，答错挨打也多；押「确定」答错了闪不开。', ['h']],
  ['复活和星星', '血条空了，答对 2 道错题就能复活一次。★ 通关；★★ 答对率 60%；★★★ 答对率 80%、没复活、剩一半血以上。', ALL],
];
export const rulesFor = (m: RoundMode) => RULES.filter(r => r[2].includes(m)).map(r => [r[0], r[1]] as [string, string]);
/** 「Boss 怒了」低沉鼓声：WebAudio 合成两下低频（不依赖素材） */
export function playRageDrum() {
  try {
    const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return; const ac = new AC();
    for (const t0 of [0, 0.32]) {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(90, ac.currentTime + t0); o.frequency.exponentialRampToValueAtTime(45, ac.currentTime + t0 + 0.3);
      g.gain.setValueAtTime(0.0001, ac.currentTime + t0); g.gain.exponentialRampToValueAtTime(0.5, ac.currentTime + t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + t0 + 0.35);
      o.connect(g).connect(ac.destination); o.start(ac.currentTime + t0); o.stop(ac.currentTime + t0 + 0.4);
    }
    setTimeout(() => void ac.close().catch(() => {}), 1200);
  } catch { /* */ }
}
