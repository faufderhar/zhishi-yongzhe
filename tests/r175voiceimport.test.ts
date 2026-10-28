/* r17.5 import-voice 按键语速：幼儿园 zf_003@1.0 包里 17 个小学/初高年级名仍 zf_002@1.2。
   --except <语速>=<键…|@文件> → 按每个键的 meta.speed 校验（包头 speeds.* 旧值只警告）；例外清单必须和包完全一致；
   旧批次登记（deploy.r17_term 1.1）在本包已是 1.0 = --speed → 照常通过并警告「已不适用」；不带 --except 时行为和以前一样。
   全部用 --dry + 临时假包，不写 public/voice。 */
import { describe, it, expect, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const dirs: string[] = []; afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });
type M = Record<string, { voice?: string; speed?: number }>;
const pack = (meta: M, o: { speeds?: number; deploy?: object } = {}) => {
  const d = mkdtempSync(join(tmpdir(), 'zy-r175vi-')); dirs.push(d); const items: Record<string, string> = {};
  Object.keys(meta).forEach((k, i) => { const f = `zz_r175_${i}.${(0xabcdef00 + i).toString(16)}.mp3`; items[k] = f; writeFileSync(join(d, f), 'x' + k); });
  writeFileSync(join(d, 'manifest.json'), JSON.stringify({ complete: true, voice: 'zf_002', en_voice: 'af_maple', speeds: { questions: o.speeds ?? 1.2, prompts: o.speeds ?? 1.2, en: o.speeds ?? 1.2 }, items, meta, deploy: o.deploy ?? {} }));
  return d;
};
const run = (...a: string[]) => { const r = spawnSync(process.execPath, ['scripts/import-voice.mjs', ...a, '--dry'], { encoding: 'utf8' }); return { code: r.status, out: r.stdout + r.stderr }; };
const K = (n: number, voice: string, speed: number, p = 'K-'): M => Object.fromEntries(Array.from({ length: n }, (_, i) => [`${p}${i}#stem`, { voice, speed }]));
const keep = ['p:grade_1', 'p:stage_p', 'p:soon_8'];
const mixed = () => pack({ ...K(5, 'zf_003', 1.0), ...Object.fromEntries(keep.map(k => [k, { voice: 'zf_002', speed: 1.2 }])), 'p:k_term1_end': { voice: 'zf_003', speed: 1.0 } },
  { deploy: { r17_term: { keys: ['p:k_term1_end'], speed: 1.1 } } });

describe('r17.5 import-voice 按键语速', () => {
  it('混速包：不带 --except → 拦（包头 speeds 1.2 ≠ 1.0）；带上 17 键式的例外 → 通过，打印语速分布、例外、旧登记已不适用', () => {
    const d = mixed(); expect(run(d, '--speed', '1.0').code).toBe(1);
    const r = run(d, '--speed', '1.0', '--except', '1.2=' + keep.join(',')); expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/按键语速模式/); expect(r.out).toMatch(/语速分布：zf_003@1 ×6，zf_002@1\.2 ×3/); expect(r.out).toMatch(/登记过的例外语速 3 个/);
    expect(r.out).toMatch(/旧批次登记的例外语速已不适用 1 个[^\n]*p:k_term1_end（登记 1\.1，包里 1）/); expect(r.out).toMatch(/--dry：没有写入/);
  });
  it('--except 也可以读文件（一行一个键）', () => {
    const d = mixed(); const f = join(d, 'keep.txt'); writeFileSync(f, keep.join('\n') + '\n');
    expect(run(d, '--speed', '1.0', '--except', '1.2=@' + f).code).toBe(0);
  });
  it('例外清单少一个 → 那个 1.2 键被拦；多一个不在包里的 / 登记语速和包里不一样 → 拦', () => {
    const d = mixed();
    const a = run(d, '--speed', '1.0', '--except', '1.2=' + keep.slice(1).join(',')); expect(a.code).toBe(1); expect(a.out).toMatch(/1 个键的语速不是 1：p:grade_1/);
    const b = run(d, '--speed', '1.0', '--except', '1.2=' + [...keep, 'p:grade_99'].join(',')); expect(b.code).toBe(1); expect(b.out).toMatch(/--except 键不在包里：p:grade_99/);
    const c = run(d, '--speed', '1.0', '--except', '1.2=' + [...keep, 'K-0#stem'].join(',')); expect(c.code).toBe(1); expect(c.out).toMatch(/语速和登记的不一样：K-0#stem 包里 1 ≠ 1\.2/);
    expect(run(d, '--speed', '1.0', '--except', 'x=p:a').code).toBe(2);
  });
  it('按键模式：没有 meta.speed 的键 → 拦', () => {
    const d = pack({ ...K(2, 'zf_003', 1.0), 'p:grade_1': { voice: 'zf_002', speed: 1.2 }, 'p:x': { voice: 'zf_003' } });
    const r = run(d, '--speed', '1.0', '--except', '1.2=p:grade_1'); expect(r.code).toBe(1); expect(r.out).toMatch(/1 个键没有 meta\.speed：p:x/);
  });
  it('老用法不变：整包 1.2 + 包里登记的 1.1 批次 → 通过；没登记的 1.1 → 拦', () => {
    const ok = pack({ ...K(3, 'zf_002', 1.2), 'p:k_term1_end': { voice: 'zf_002', speed: 1.1 } }, { deploy: { r17_term: { keys: ['p:k_term1_end'], speed: 1.1 } } });
    const r = run(ok, '--speed', '1.2'); expect(r.code, r.out).toBe(0); expect(r.out).not.toMatch(/按键语速模式/);
    const bad = pack({ ...K(3, 'zf_002', 1.2), 'p:k_term1_end': { voice: 'zf_002', speed: 1.1 } }); expect(run(bad, '--speed', '1.2').code).toBe(1);
  });
});
