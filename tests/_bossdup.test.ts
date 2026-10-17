// 工具（默认跳过）：BOSSDUP=1 时导出初一 / 高一各科 Boss 名单，找出多章同名的 Boss
import { test } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { loadBank, playable } from '../src/game/questions';
import { buildChapters } from '../src/game/levels';
import { skinFor } from '../src/game/monsterSkin';
test.skipIf(!process.env.BOSSDUP)('boss dup', () => {
  const rows: string[][] = [];
  for (const [g, band, label] of [['7', 'J', '初一'], ['10', 'H', '高一']] as const) {
    const all = loadBank(JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8')), '').all; const qs = playable(all, false); const by = new Map(qs.map(q => [q.key, q]));
    for (const ch of buildChapters(qs, null, all)) for (const l of ch.levels.filter(l => l.kind === 'boss')) {
      const q0 = by.get(l.pool[0]); const unit = q0?.unit ?? l.unit; const sk = skinFor(ch.subject, 'boss', band, unit);
      rows.push([label, ch.subject, l.volume, unit, l.name, l.unit, sk?.name ?? '', sk?.hue != null ? String(sk.hue) : '原色']);
    }
  }
  writeFileSync('/workspace/tmp/boss_all.json', JSON.stringify(rows, null, 0));
});
