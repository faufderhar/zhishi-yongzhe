/* r17：Boss 美术导入（scripts/import-k2-monsters.py）支持大班；小节够格的题不满 12 道的 Boss 跳过 + 打印 WARN（不报错） */
import { it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
const anims = (id: string) => Object.fromEntries(['idle', 'attack', 'hit', 'defeat'].map(k => [k, { json: `art/monsters/k3_boss/anim/${id}/${k}.json`, soft_json: `art/monsters/k3_boss/anim/${id}/${k}_soft.json`, soft_sheet: `art/monsters/k3_boss/anim/${id}/${k}_soft_sheet.webp` }]));
function box() {
  const d = mkdtempSync(join(tmpdir(), 'zy-kboss-')); const w = (p: string, s: string) => { mkdirSync(join(d, p, '..'), { recursive: true }); writeFileSync(join(d, p), s); };
  const mons = [['mon_k3_a_boss', '小甲', 'num', 'a'], ['mon_k3_b_boss', '小乙', 'shape', 'b']].map(([id, name, sub, topic]) => ({ id, name, grade: 'k3', level_kind: 'boss', k3_subject: sub, k3_topic: topic, theme: 'number', subject_key: 'math', cutout_size: [512, 512], anims: anims(id) }));
  w('art/monsters/manifest.json', JSON.stringify({ monsters: mons }));
  for (const m of mons) for (const k of ['idle', 'attack', 'hit', 'defeat']) w(`art/monsters/k3_boss/anim/${m.id}/${k}.json`, JSON.stringify({ hit_frame: k === 'attack' ? 5 : null }));
  w('questions/中班Boss名对照_v34.csv', '科目,册别 volume,小节 unit,Boss名,Boss专用题 id\n'); w('questions/题库_游戏可用_幼儿园中班.json', JSON.stringify({ questions: [] }));
  w('questions/大班Boss名对照_v39.csv', '科目,册别 volume,小节 unit,Boss名,Boss专用题 id\n数数,大班,甲节,小甲,A-13 A-14\n颜色形状,大班,乙节,小乙,B-12 B-13\n');
  const qs = [...Array.from({ length: 14 }, (_, i) => ({ id: `A-${i + 1}`, subject: '数数', unit: '甲节' })), ...Array.from({ length: 13 }, (_, i) => ({ id: `B-${i + 1}`, subject: '颜色形状', unit: ' 乙节 ' }))];
  w('questions/题库_游戏可用_幼儿园大班.json', JSON.stringify({ questions: qs }));
  return d;
}
it('够格 12 道 → 导入；11 道（去掉 Boss 专用题）→ 跳过并打印 WARN，脚本照常结束（exit 0）', () => {
  const d = box(); const out = join(d, 'gen.json');
  const so = execFileSync('python3', ['scripts/import-k2-monsters.py', '--dry'], { env: { ...process.env, ZY_BOX_ROOT: d, ZY_KBOSS_OUT: out }, encoding: 'utf8' });
  expect(so).toMatch(/WARN 跳过 K3 Boss 小乙（mon_k3_b_boss）：颜色形状·乙节 只有 11 道够格的题（< 12）/);
  expect(so).not.toMatch(/小甲（/); expect(so).toMatch(/1 只幼儿园 Boss（中班 0 \/ 大班 1，跳过 1）/);
});
it('qualifying()：同科目同小节、去掉 Boss 专用题；12 道正好够', () => {
  const r = execFileSync('python3', ['-B', '-c', `import importlib.util as u;s=u.spec_from_file_location('m','scripts/import-k2-monsters.py');m=u.module_from_spec(s);s.loader.exec_module(m)
qs=[{'id':f'X-{i}','subject':'数数','unit':'甲'} for i in range(14)]+[{'id':'Y','subject':'英语','unit':'甲'}]
print(m.qualifying(qs,'数数','甲',{'X-0','X-1'}), m.qualifying(qs,'数数','甲',{'X-0','X-1','X-2'}), m.MIN_Q)`], { encoding: 'utf8' });
  expect(r.trim()).toBe('12 11 12');
});
