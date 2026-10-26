// r17.1 B18：Boss 测试面板只能从 App 里「__TEST_HOOKS__ ? lazy(import) : null」进来（Boss测试解锁_r17 §4.3）
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

describe('r17.1 BossLab gating', () => {
  const files = walk('src').filter(f => /\.(tsx?|mjs|js)$/.test(f) && !f.includes(join('src', 'debug')));
  it('只有 App.tsx 引用 debug/BossLab 和 debug/bossLabSim', () => {
    const refs = files.filter(f => /debug\/(BossLab|bossLabSim)/.test(readFileSync(f, 'utf8')));
    expect(refs.map(f => f.replace(/\\/g, '/'))).toEqual(['src/App.tsx']);
  });
  it('App 里是 __TEST_HOOKS__ 守着的动态 import，没有静态 import', () => {
    const s = readFileSync('src/App.tsx', 'utf8');
    expect(s).not.toMatch(/^import[^\n]*debug\/BossLab/m);
    expect(s).toMatch(/const BossLab = __TEST_HOOKS__ \? lazy\(\(\) => import\('\.\/debug\/BossLab'\)\) : null;/);
  });
  it('RoundBattle 的 labRng 只在 __TEST_HOOKS__ 下生效', () => {
    expect(readFileSync('src/ui/RoundBattle.tsx', 'utf8')).toMatch(/const lab = __TEST_HOOKS__ \? labRng : undefined;/);
  });
  it('测试版加 noindex（vite 插件），版本号旁「测试版」只在 __TEST_HOOKS__', () => {
    expect(readFileSync('vite.config.ts', 'utf8')).toMatch(/noindex,nofollow/);
    expect(readFileSync('src/ui/Screens.tsx', 'utf8')).toMatch(/__TEST_HOOKS__ && <b data-testid="test-build-tag"/);
  });
});
