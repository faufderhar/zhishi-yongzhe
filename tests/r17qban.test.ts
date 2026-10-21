/* r17 C1：幼儿园 Q版三态（小乌云 + 5 只学科柔和版 + 中班 23 / 大班 23 Boss），scripts/copy-kinder-art.mjs 可重复运行 */
import { it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { hasQban, qbanIds, qbanUrl, qbanState, QBAN_CLOUD } from '../src/game/kinderQban';
import { KINDER_BOSS, KINDER_MON } from '../src/game/monsterSkin';
it('Q版范围：小乌云 + 5 只学科柔和版 + kinderBoss.gen.json 里全部 Boss；小黏黏只备用；三张图都在、≤150 KB', () => {
  const want = new Set([QBAN_CLOUD, ...Object.values(KINDER_MON), ...KINDER_BOSS.map(b => b.id)]);
  expect(new Set(qbanIds())).toEqual(want); expect(qbanIds().length).toBe(53);
  expect(hasQban('mon_k_sticky_jelly')).toBe(false); expect(hasQban('mon_k3_shape_mirrorfox_boss')).toBe(true);   // v57：镜子小狐狸有 Boss 关了
  for (const id of [...qbanIds(), 'mon_k_sticky_jelly']) for (const s of ['default', 'happy', 'mischief']) {
    const p = `public/art/k_qban/${id}_${s}.webp`; expect(existsSync(p), p).toBe(true); expect(statSync(p).size).toBeLessThanOrEqual(150 * 1024);
    expect(readFileSync(p).subarray(8, 12).toString()).toBe('WEBP'); }
  expect(qbanUrl(QBAN_CLOUD, 'happy')).toMatch(/art\/k_qban\/mon_k_naughty_cloud_happy\.webp$/);
});
it('表情：答错 / 演示 → 调皮；答对 / 挥手 / 回家 → 开心；平时 → 默认', () => {
  expect(qbanState({})).toBe('default'); expect(qbanState({ tilt: true })).toBe('mischief'); expect(qbanState({ face: '😜' })).toBe('mischief');
  expect(qbanState({ ok: true })).toBe('happy'); expect(qbanState({ face: '👋' })).toBe('happy'); expect(qbanState({ home: true })).toBe('happy');
  expect(qbanState({ tilt: true, ok: true })).toBe('mischief');
});
it('拷贝脚本：源目录不在（CI）→ 只打印 WARN、不改文件、exit 0', () => {
  const so = execFileSync('node', ['scripts/copy-kinder-art.mjs', '--dry'], { env: { ...process.env, ZY_BOX_ROOT: '/nonexistent-box' }, encoding: 'utf8' });
  expect(so).toMatch(/WARN Q版源目录不在/); expect(so).toMatch(/WARN 题干配图源目录不在/); expect(so).toMatch(/WARN 期末庆祝关源目录不在/); expect(so).toMatch(/拷贝 0 个/);
});
