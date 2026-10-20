// r16 4：幼儿园怪物按 LevelKind（中班 Boss 专属美术；没有美术的 Boss = 柔和版普通怪 + 王冠 + 1.15）
import { it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { loadBank, playable } from '../src/game/questions';
import { buildChapters } from '../src/game/levels';
import { kinderMon, kinderSkin, KINDER_BOSS, KBOSS_SCALE, dashScale, chapterBoss } from '../src/game/monsterSkin';
import { offlineList } from '../src/offlineCache';
import { boxPath, missing } from './boxSrc';
const levels = (g: string) => { const all = loadBank(JSON.parse(readFileSync(`public/banks/bank_${g}.json`, 'utf8')), '').all; const qs = playable(all, false); const by = new Map(qs.map(q => [q.key, q]));
  return buildChapters(qs, null, all).flatMap(c => c.levels.map(l => ({ l, q0: by.get(l.pool[0])!, subject: c.subject }))); };
// 美术源（manifest / todo / Boss 名对照表）只在开发机上（CI 上没有）：缺了就跳过「重新生成再比对」；序列帧文件在 public/，照样检查
const K2_SRC = ['art/monsters/manifest.json', 'art/k2/todo.json', 'questions/中班Boss名对照_v34.csv'].map(boxPath);
it('gen.json = 导入脚本输出（没被手改）', ({ skip }) => {
  const miss = missing(...K2_SRC);
  skip(miss.length > 0 || boxPath('') !== '/workspace/', `开发机美术源不在（CI）：缺 ${miss.join('、') || '（ZY_BOX_ROOT 不是 /workspace，导入脚本只认 /workspace）'}——不重新生成比对`);
  const before = readFileSync('src/game/kinderBoss.gen.json', 'utf8'); execFileSync('python3', ['scripts/import-k2-monsters.py']);
  expect(readFileSync('src/game/kinderBoss.gen.json', 'utf8')).toBe(before);
});
it('提交的 kinderBoss.gen.json：23 个 Boss，引用的序列帧 json / 图片都在 public/', () => {
  expect(KINDER_BOSS.length).toBe(23);
  for (const b of KINDER_BOSS) for (const a of Object.values(b.anims)) {
    const j = `public/${b.dir}/${a.soft}.json`; expect(existsSync(j), j).toBe(true);
    expect(existsSync(`public/${b.dir}/${JSON.parse(readFileSync(j, 'utf8')).image}`)).toBe(true);
  }
});
it('中班：23 个 Boss 关各有专属美术（不放大、不戴王冠），名字 = Boss 名对照表；精英 = 柔和版普通怪；普通 = 小乌云', () => {
  const ids: string[] = [];
  for (const { l, q0, subject } of levels('K2')) {
    const m = kinderMon(subject, l.kind, { grade: q0.grade, unit: l.unit });
    if (l.kind === 'normal') expect(m.skin).toBeNull();
    else if (l.kind === 'elite') { expect(m.skin?.id).toBe(kinderSkin(subject)!.id); expect(m.crown).toBe(false); }
    else {
      expect(m.crown, `${subject} ${l.unit}`).toBe(false); expect(m.scale).toBe(1); expect(m.skin!.id).toMatch(/^mon_k2_/);
      expect(m.skin!.name).toBe(chapterBoss(undefined, subject, l.unit, { grade: 'K2', volume: l.volume })!.name);
      ids.push(m.skin!.id);
    }
  }
  expect(ids.length).toBe(23); expect(new Set(ids).size).toBe(23);
});
it('没有专属美术的 Boss（小班）：柔和版普通怪 + 王冠 + 1.15；中班别的年级 / 错科目不串', () => {
  const k1 = levels('K1').filter(x => x.l.kind === 'boss'); expect(k1.length).toBeGreaterThan(0);
  for (const { l, q0, subject } of k1) { const m = kinderMon(subject, 'boss', { grade: q0.grade, unit: l.unit }); expect(m.crown).toBe(true); expect(m.scale).toBe(KBOSS_SCALE); expect(m.skin?.id).toBe(kinderSkin(subject)?.id); }
  expect(kinderMon('数数', 'boss', { grade: 'K1', unit: '数到10' }).crown).toBe(true);
  expect(kinderMon('英语', 'boss', { grade: 'K2', unit: '数到10' }).crown).toBe(true);
});
it('宽 Boss 冲刺距离按宽度缩短：风筝 / 工具箱 / 音乐盒 / 小精灵 < 1，瘦的 = 1', () => {
  const a = (t: string) => KINDER_BOSS.find(b => b.k2_topic === t)!.aspect;
  for (const t of ['kite', 'toolbox', 'musicbox', 'sprite', 'train', 'seesaw']) expect(dashScale(a(t)), t).toBeLessThan(1);
  expect(dashScale(a('count10'))).toBe(1); expect(dashScale(a('train'))).toBeGreaterThan(0.45);
});
it('离线缓存：中班档案带上中班 Boss 柔和版序列帧', () => {
  const { json } = offlineList([{ grade: 'K2', subjects: ['数数'] }], {}, {});
  expect(json.filter(x => x.url.includes('k2_boss/anim/mon_k2_num_')).length).toBe(5 * 4);
  expect(offlineList([{ grade: 'K1', subjects: ['数数'] }], {}, {}).json.some(x => x.url.includes('k2_boss'))).toBe(false);
});
