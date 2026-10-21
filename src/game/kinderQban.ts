/* r17：幼儿园怪物 Q版三态（美术 /workspace/art/k_qban，scripts/copy-kinder-art.mjs 拷进 public/art/k_qban/）。
   默认 default（站着眨眼）/ 开心 happy（答对、变朋友、结算拥抱）/ 调皮 mischief（答错，替代歪头 ktilt 的表情）。
   有 Q版的怪物不再加载序列帧（战斗里的走近 / 抖动仍由 director 对外层容器做）。小黏黏只拷进来备用，不显示。 */
import Q from './kinderQban.gen.json';
export type QState = 'default' | 'happy' | 'mischief';
export const QBAN_CLOUD = 'mon_k_naughty_cloud';
const IDS = new Set<string>((Q as { ids: string[] }).ids);
export const hasQban = (id: string | undefined): id is string => !!id && IDS.has(id);
export const qbanIds = () => [...IDS];
const base = () => (import.meta.env?.BASE_URL ?? './');
export const qbanUrl = (id: string, s: QState) => `${base()}art/k_qban/${id}_${s}.webp`;
/** 战斗里这一刻的表情：答错 / 演示（歪头）→ 调皮；答对 / 挥手回家 / 变朋友 → 开心；其他 → 默认 */
export function qbanState(o: { tilt?: boolean; face?: string | null; ok?: boolean; home?: boolean }): QState {
  if (o.tilt || o.face === '😜') return 'mischief';
  if (o.ok || o.home || o.face === '😆' || o.face === '👋') return 'happy';
  return 'default';
}
