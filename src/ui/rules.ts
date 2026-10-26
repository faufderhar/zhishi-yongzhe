/* D14 §7：战斗页「？」规则说明（按学段）与首次短提示 */
import type { RoundMode } from '../game/balance';
import type { LevelKind } from '../game/grades';
import { starRulesFor, STAR_NOTE } from '../game/levels';
export type TipKey = 'partial' | 'dodge' | 'perfect' | 'guard' | 'rage' | 'challenge' | 'cap' | 'focus' | 'energy';
export const TIP_KEYS: TipKey[] = ['partial', 'dodge', 'perfect', 'guard', 'rage', 'challenge', 'cap', 'focus', 'energy'];
export const TIP_TEXT: Record<TipKey, string> = {
  partial: '选对了一部分！伤害减半，下次把正确的都选上～',
  dodge: '运气好闪开了！不过还是看看正确答案吧',
  perfect: '完美闪避！答得又快又对，攒了 1 层专注',
  guard: '护体挡住了一部分伤害：这次只受 70%',   // r17-4（学霸裁定 §2.2）
  rage: 'Boss 怒了！攻击 +20%，还换了招式（蓄力重击仍是原攻击 ×2）',
  focus: '专注：完美闪避攒 1 层，每层闪避 +10%（攻击 +25%），最多 2 层',
  energy: '能量：答对就攒 ⚡，攒到 5 点的那道题当场放技能',   // r17-4（§3：以代码为准，到 5 点的这一题当场放）
  challenge: '每次我方出题前可以选：普通题（默认）或挑战题。挑战题难一档，答对伤害 ×1.5；答错会受到 ×1.5 反击，而且不能闪避。慢慢选，点了才开始计时。',   // r15.3 策划 D：原文照用
  cap: '连击、专注、技能、题卡、挑战、押注这些加成合起来最多 ×1.8；题目难度、角色主修、角色被动和怪物弱点另外计算。',   // r15.4.3 策划：改用和「？」规则同一句（不再用 D14 原文）；只在这一下真的被 ×1.8 截掉时弹
};
type Rule = [string, string, RoundMode[]];
const ALL: RoundMode[] = ['p36', 'j', 'h'], JH: RoundMode[] = ['j', 'h'];
const RULES: Rule[] = [
  ['轮流回合', '⚔ 我方回合答对就攻击，答错会被反击（有机会闪开）；🛡 对方回合答对就闪避，答错要挨打。', ALL],
  ['怪物意图', '怪物头上的图标是它下个对方回合要做的事：⚔ 攻击、⚡ 蓄力（下次重击 ×2，答对能打断）、💥 重击、🛡 开护盾（答对能破盾）、💤 发呆。', ALL],
  ['闪避', '我方回合答错时有 25% 的机会闪开（小学 30%）；对方回合答得快（用时不到一半）是「完美闪避」，攒 1 层专注。', ALL],
  ['专注', '对方回合「完美闪避」（答对且用时不到一半）攒 1 层；每层闪避 +10%、下次攻击 +25%，最多 2 层，我方回合结束清零。', JH],
  ['能量', '每次答对攒 1 点 ⚡（连对到第 3 题多攒 1 点，高中押注再多 1 点）。答对后能量到 5 点，这道题当场放技能；连续 4 次答对都没放，第 5 次答对也一定放。放完能量清零。', ALL],   // r17-4 §3
  ['连击', '连续答对每题伤害 +5%，最多 +30%；答错清零。', ALL],
  ['技能', '答对时自动放技能（不用按）：我方回合放攻击技能，对方回合放护体、回血或打乱怪物的技能；同一边的两个技能轮流出。', ALL],   // r17-4 §3
  ['护体', '护体：下一次受伤只受 70%（用掉就没了，不叠加）。', ALL],   // r17-4 §2.2
  ['漏选（半对）', '多选题选对了一部分但没选全。我方回合只造成一半伤害，怪物也不反击；对方回合算没闪开，但伤害减半。', JH],
  ['加成上限', '连击、专注、技能、题卡、挑战、押注这些加成合起来最多 ×1.8；题目难度、角色主修、角色被动和怪物弱点另外计算。', ALL],
  ['Boss 二阶段', 'Boss 血条分两段，打掉第一段就会发怒：攻击 +20%，换一套招式；蓄力重击仍按原攻击 ×2，不叠加；第一段多打的伤害不会带到第二段。', JH],
  ['挑战题', '每个我方回合出题前选：题更难一档，答对伤害 ×1.5；答错反击 ×1.5，而且闪不开。慢慢选，点了才出题、才开始计时，出题后不能再换。初中普通关要拿 3 星，得至少答对一道挑战题（挑战按钮一直是灰的那关不算）。', ['j']],
  ['题卡', '轻击 / 标准 / 重击：卡上写的是实际伤害倍率（题越简单，加成越少：难度 1 只有一半，难度 2 是 3/4）；答错的反击倍率不变。', ['h']],
  ['押注', '我方回合看题前，题卡旁边有「押注」开关（默认不押，点一下打开；每回合重新选）。押了：答对伤害 ×1.25、能量额外 +1（答对本来就 +1，押注再 +1）；答错（半对也算错）反击 ×1.25，而且不能闪避。押注的 ×1.25 也算在「加成上限 ×1.8」里。不押就照常结算（答错有机会闪开）。对方回合没有押注。', ['h']],
  ['复活', '血条空了可以挑战复活一次：最多 4 道题（本关没出过的新题优先）里答对 2 道，回到 50% 血量，不算回合。', ALL],   // r17-7：原「复活和星星」拆两条
  ['星星', '', ALL],
];
const BAND_OF: Record<RoundMode, string> = { p36: 'G2', j: 'J', h: 'H' };
/** r17-7：「星星」条按年级段 + 关卡类型取一行图例 + 补充说明 */
export const rulesFor = (m: RoundMode, kind?: LevelKind) => RULES.filter(r => r[2].includes(m)).map(r => [r[0], r[0] === '星星' ? `${starRulesFor(BAND_OF[m], kind ?? 'normal')}。${STAR_NOTE}` : r[1]] as [string, string]);
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
