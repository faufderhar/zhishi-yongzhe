// r16 第 9 步 技术QA_r1544 P4 界面：押注说明（.bet-hint-pop）、挑战题提示不浮在卡片上、800×280 设密码键盘、朗读按钮不被挤出（浏览器复测见 scripts/r16-p4.mjs）
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
const css = readFileSync('src/app.css', 'utf8'), rb = readFileSync('src/ui/RoundBattle.tsx', 'utf8');
describe('r16 P4 界面', () => {
  it('P4-a 矮横屏样式写在 .bet-hint-pop 上；装不下时有「往下滑还有」', () => {
    expect(css).toMatch(/max-height:420px\)\{[^}]*\.modal:has\(\.bet-hint-pop\)/); expect(css).toMatch(/\.rules-list\.bet-hint-pop\{font-size:13px/);
    expect(rb).toMatch(/function BetHintList[\s\S]*bet-hint-more/);
  });
  it('P4-b 选题阶段的挑战提示在选题区里（inline），不再用浮层', () => {
    expect(rb).toMatch(/!\(tipNow\.k === 'challenge' && phase === 'chal'\) && <div className="first-tip"/);
    expect(rb).toMatch(/chal-pick[\s\S]{0,600}tipNow\?\.k === 'challenge' && <div className="first-tip inline" data-testid="tip-challenge"/);
    expect(css).toMatch(/\.first-tip\.inline\{position:static !important/);
  });
  it('P4-c 800×280 键盘不再整体缩放，按钮 40px', () => { expect(css).toMatch(/max-height:300px\)\{\s*\.pinpad\{transform:none\}\s*\.pinpad \.pin-keys\{gap:6px\}\.pinpad \.pin-keys button\{height:40px/); });
  it('P4-d 信息行文字可收缩，朗读按钮不收缩', () => {
    expect(rb).toMatch(/<div className="qmeta"><span className="qmeta-txt">[\s\S]*?<\/span>\{tts && \(cfg\.manualTTS \|\| isEn\) && <button/);
    expect(css).toMatch(/\.qmeta-txt\{flex:1 1 auto;min-width:0/); expect(css).toMatch(/\.qmeta > \[data-testid=tts\]\{flex:0 0 auto/);
  });
});
