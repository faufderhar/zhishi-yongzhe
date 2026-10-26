// r17.1 学霸 r17-3（D15 §6.2 A / §6.3 第 4 条）：角色 desc 主修 / 被动分两行；卡面一行一个 span
import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PUPS, SCIFI } from '../src/game/characters';
import { AFFINITY } from '../src/game/balance';

const D: Record<string, string[]> = {
  数学: ['主修：数学题伤害 ×1.2', '被动：数学题再 ×1.1（合计 ×1.32）'], 语文: ['主修：语文题伤害 ×1.2', '被动：语文题答对回复 3 血'],
  英语: ['主修：英语题伤害 ×1.2', '被动：每局第一次答错不断连击'], 诗词: ['主修：诗词题伤害 ×1.2'], 化学: ['主修：化学题伤害 ×1.2'],
};
it('小狗 / 科幻两套角色：desc 按主修科目分行（诗词 / 化学只有主修一行）', () => {
  expect(AFFINITY).toBe(1.2);
  for (const c of [...PUPS, ...SCIFI]) expect(c.desc.split('\n'), c.id).toEqual(D[c.major]);
  expect(PUPS.find(c => c.id === 'suansuan')!.desc.split('\n')).toEqual(SCIFI.find(c => c.id === 'asuan')!.desc.split('\n'));
});
it('选角色卡：desc 每行一个块（char-desc-<id>）', () => {
  const s = readFileSync('src/ui/Screens.tsx', 'utf8');
  expect(s).toContain(`data-testid={'char-desc-' + c.id}>{c.desc.split('\\n').map(l => <span key={l}>{l}</span>)}`);
  expect(readFileSync('src/app.css', 'utf8')).toContain('.char-card .char-desc span{display:block}');
});
