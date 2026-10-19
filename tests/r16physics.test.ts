import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { THEME_OF, skinFor } from '../src/game/monsterSkin';
import { AREA, buildChapters } from '../src/game/levels';
import { loadBank, playable } from '../src/game/questions';
// r16 2d / 设计 R-7：初二物理（初中第一次出现）区域名「力之塔」+ gear 皮肤；初二 / 高二每个可玩科目都有区域名和皮肤
it('初二物理 region + skin', () => {
  expect(AREA['物理'][0]).toBe('力之塔'); expect(THEME_OF['物理']).toBe('gear');
  expect(skinFor('物理', 'normal', 'J', undefined, { grade: '8' })).not.toBeNull();
  expect(skinFor('物理', 'boss', 'J', undefined, { grade: '8' })?.name).toBeTruthy();
});
it('G8 / G11 subjects all have region + theme', () => {
  for (const g of ['8', '11']) {
    const b = loadBank(JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8')), `bank_${g}.json`);
    for (const c of buildChapters(playable(b.all, false), null, b.all)) {
      expect(AREA[c.subject], `${g} ${c.subject}`).toBeTruthy(); expect(THEME_OF[c.subject], `${g} ${c.subject}`).toBeTruthy();
      expect(c.name).toBe(AREA[c.subject][0]);
    }
  }
});
