// r16.1 (c) 小萌新：中班 Boss 打的是「点点数星熊」，结算页却写「小乌云变成你的好朋友啦！」
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { kFriendLine, KMonFace } from '../src/ui/Screens';
import { kinderMon } from '../src/game/monsterSkin';
describe('r16.1 幼儿园结算页的怪物', () => {
  it('名字跟着战斗里的怪物走', () => {
    expect(kFriendLine()).toBe('小乌云变成你的好朋友啦！');
    const km = kinderMon('数数', 'boss', { grade: 'K2', unit: '数到10' });
    expect(km.skin?.name).toBe('点点数星熊');
    expect(kFriendLine(km.skin ?? undefined)).toBe('点点数星熊变成你的好朋友啦！');
  });
  it('立绘：首屏（还没读到序列帧）先显示小乌云图，data-mon 写清是谁', () => {
    const h = renderToStaticMarkup(createElement(KMonFace, { m: undefined }));
    expect(h).toContain('mon_k_naughty_cloud_sprite.png'); expect(h).toContain('data-mon="小乌云"');
  });
  it('源码：结算页不再写死小乌云；Battle 把 kMon 交给结算（4 处 onEnd）；App 传下去', () => {
    const s = readFileSync('src/ui/Screens.tsx', 'utf8'), b = readFileSync('src/ui/Battle.tsx', 'utf8'), a = readFileSync('src/App.tsx', 'utf8');
    expect(s).not.toMatch(/<h1>小乌云变成你的好朋友啦！<\/h1>/);
    expect(s).toMatch(/kFriendLine\(kMon\)/);
    expect((b.match(/demo: (k|ns)\.demo \}, kMon \}/g) ?? []).length).toBe(4);
    expect(a).toMatch(/<ResultScreen kMon=\{screen\.r\.kMon\}/);
  });
});
