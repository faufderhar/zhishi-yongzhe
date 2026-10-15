/* 各科目「招牌技能」特效配方（程序生成，不使用任何外部游戏素材） */
import type { Preset } from './particles';
export interface Signature { name: string; trail: Preset; impact: Preset; glow: string }
const P = (o: Partial<Preset> & Pick<Preset, 'colors' | 'shapes'>): Preset => ({ count: 26, speed: [120, 420], size: [6, 14], life: [0.4, 0.9], ...o });
export const SIGNATURES: Record<string, Signature> = {
  数学: { name: '公式斩', glow: '#4da3ff', trail: P({ colors: ['#4da3ff', '#bfe0ff'], shapes: ['glyph'], glyphs: ['+', '−', '×', '÷', '=', 'π', '√'] }),
    impact: P({ colors: ['#4da3ff', '#ffffff', '#9fd0ff'], shapes: ['square', 'glyph', 'spark'], glyphs: ['+', '×', '=', '∑'], count: 34, size: [8, 20] }) },
  语文: { name: '墨染千里', glow: '#e5484d', trail: P({ colors: ['#222', '#3a3a3a', '#c0392b'], shapes: ['ink'], size: [10, 22] }),
    impact: P({ colors: ['#111', '#2b2b2b', '#c0392b'], shapes: ['ink', 'dot'], count: 30, size: [10, 26], gravity: 300 }) },
  英语: { name: 'Echo 回声', glow: '#3ecf6e', trail: P({ colors: ['#3ecf6e', '#c9f7d8'], shapes: ['glyph'], glyphs: ['A', 'B', 'C', 'a', 'e', '!'] }),
    impact: P({ colors: ['#3ecf6e', '#ffffff'], shapes: ['ring', 'glyph'], glyphs: ['A', 'B', 'C'], count: 22, size: [10, 26], grow: 40 }) },
  诗词: { name: '飞花令', glow: '#b07cff', trail: P({ colors: ['#d8b4ff', '#ffc1e3', '#fff'], shapes: ['petal'], size: [10, 18] }),
    impact: P({ colors: ['#d8b4ff', '#ffc1e3', '#b07cff', '#fff'], shapes: ['petal', 'star'], count: 36, speed: [80, 300], gravity: 60 }) },
  化学: { name: '沸腾试剂', glow: '#ff9f43', trail: P({ colors: ['#ffb36b', '#ffe0b8'], shapes: ['bubble'], size: [8, 18] }),
    impact: P({ colors: ['#ff9f43', '#ffd166', '#7bed9f'], shapes: ['bubble', 'dot'], count: 32, gravity: -200, size: [8, 22] }) },
  物理: { name: '受力分析', glow: '#3dd6ff', trail: P({ colors: ['#3dd6ff', '#ffffff'], shapes: ['spark'], size: [8, 16] }),
    impact: P({ colors: ['#3dd6ff', '#ffffff', '#a0f0ff'], shapes: ['spark', 'ring'], count: 30, speed: [200, 520], size: [6, 18] }) },
  历史: { name: '时光回溯', glow: '#f5c542', trail: P({ colors: ['#f5c542', '#fff3c4'], shapes: ['dot'], size: [4, 8] }),
    impact: P({ colors: ['#f5c542', '#e6a817', '#fff3c4'], shapes: ['dot', 'ring'], count: 34, size: [4, 14], gravity: 120 }) },
  道德与法治: { name: '公正之光', glow: '#ffd166', trail: P({ colors: ['#ffd166', '#fff6d5'], shapes: ['star'] }),
    impact: P({ colors: ['#ffd166', '#ffffff', '#f4a261'], shapes: ['ring', 'star'], count: 26, grow: 30 }) },
  政治: { name: '理想之火', glow: '#e63946', trail: P({ colors: ['#e63946', '#ffd166'], shapes: ['star', 'dot'] }),
    impact: P({ colors: ['#e63946', '#ffd166', '#fff'], shapes: ['star', 'ring'], count: 28 }) },
  生物: { name: '细胞分裂', glow: '#52d681', trail: P({ colors: ['#52d681', '#c9f7d8'], shapes: ['bubble'] }),
    impact: P({ colors: ['#52d681', '#a7f3d0', '#fff'], shapes: ['bubble', 'petal'], count: 30, grow: 20 }) },
  地理: { name: '地脉涌动', glow: '#3a86ff', trail: P({ colors: ['#3a86ff', '#8ecae6', '#90be6d'], shapes: ['dot'] }),
    impact: P({ colors: ['#3a86ff', '#90be6d', '#ffd166'], shapes: ['ring', 'dot'], count: 30, gravity: 150 }) },
  科学: { name: '自然之力', glow: '#7bd389', trail: P({ colors: ['#7bd389', '#c8f2c4'], shapes: ['petal'] }),
    impact: P({ colors: ['#7bd389', '#4caf50', '#fff'], shapes: ['petal', 'dot'], count: 28, gravity: 80 }) },
};
export const GENERIC: Signature = { name: '普通攻击', glow: '#ffffff',
  trail: P({ colors: ['#fff'], shapes: ['spark'], count: 8 }),
  impact: P({ colors: ['#ffffff', '#ffe08a', '#ffb347'], shapes: ['spark', 'dot'], count: 20, speed: [180, 460], size: [5, 12] }) };
export const CRIT: Preset = P({ colors: ['#fff', '#ffd54a', '#ff6b6b'], shapes: ['spark', 'star'], count: 40, speed: [260, 640], size: [8, 20], life: [0.3, 0.7] });
export const HEAL: Preset = P({ colors: ['#7dffa0', '#d4ffe0'], shapes: ['dot', 'glyph'], glyphs: ['+'], count: 14, speed: [40, 120], gravity: -160 });
export const MONSTER_HIT: Preset = P({ colors: ['#ff6b6b', '#ffb3b3', '#fff'], shapes: ['spark', 'dot'], count: 16, speed: [160, 380] });
export const CONFETTI: Preset = P({ colors: ['#ffd54a', '#4da3ff', '#ff6b9a', '#7bed9f', '#b07cff'], shapes: ['square', 'star'], count: 60, speed: [200, 560], gravity: 520, life: [1, 1.8], size: [6, 12] });
/* 幼儿园：柔和、低饱和、无血腥/刺激 */
export const SOFT_STARS: Preset = P({ colors: ['#ffe9a8', '#ffd1dc', '#cdebff', '#fff'], shapes: ['star', 'heart'], count: 18, speed: [60, 200], size: [12, 22], life: [0.7, 1.2], gravity: -30 });
export const SOFT_CONFETTI: Preset = P({ colors: ['#ffe9a8', '#ffd1dc', '#cdebff', '#d5f0c4'], shapes: ['heart', 'star'], count: 40, speed: [100, 320], gravity: 140, life: [1.2, 2], size: [12, 22] });
export const signatureOf = (subject: string) => SIGNATURES[subject] ?? GENERIC;
