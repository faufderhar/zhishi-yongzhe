/* 自动生成：python3 scripts/gen-skills.py（数据源 /workspace/playtest/skills/data.py，v0.3.7）。不要手改。 */
export type SkillSeg = 'K' | 'P12' | 'P36' | 'J' | 'H';
export type SkillType = 'atk' | 'guard' | 'heal' | 'control' | 'visual';
export type SkillEffect = 'A14' | 'A2H' | 'A13P' | 'A125C' | 'G70' | 'H5' | 'C' | 'F1' | 'V';
export type FxRecipe = 'control' | 'heal' | 'ring' | 'shield' | 'slash' | 'rain' | 'projectile' | 'rise' | 'burst';
export interface SkillDef { id: string; seg: SkillSeg; char: string; charId: string; major: string; name: string; type: SkillType; effect: SkillEffect; effectText: string; cd: number;
  anim: string; durMs: number; srcDurMs: number; colors: string[]; particles: number; sfxNote: string; recipe: FxRecipe; glyphs: string[]; icon: string; assets: { fx: string; icon: string; sfx: string } }
export const SKILL_DATA: SkillDef[] = [
 {
  "id": "k_suansuan_1",
  "seg": "K",
  "char": "算算",
  "charId": "suansuan",
  "major": "数学",
  "name": "数字泡泡",
  "type": "visual",
  "effect": "V",
  "effectText": "纯视觉，无数值",
  "cd": 0,
  "anim": "1、2、3 三个圆泡泡从算算身边依次飘起，轻轻碰到小怪兽后化成小星星",
  "durMs": 1000,
  "srcDurMs": 1000,
  "colors": [
   "#7EC8E3",
   "#FFF4B8"
  ],
  "particles": 12,
  "sfxNote": "「啵、啵、啵」三声泡泡音",
  "recipe": "rise",
  "glyphs": [
   "1",
   "2",
   "3"
  ],
  "icon": "⭐",
  "assets": {
   "fx": "fx/skills/k_suansuan_1.webp",
   "icon": "fx/skills/icons/icon_k_suansuan_1.webp",
   "sfx": "sfx/skills/sfx_skill_k_suansuan_1.mp3"
  }
 },
 {
  "id": "k_suansuan_2",
  "seg": "K",
  "char": "算算",
  "charId": "suansuan",
  "major": "数学",
  "name": "积木城堡",
  "type": "visual",
  "effect": "V",
  "effectText": "纯视觉，无数值",
  "cd": 0,
  "anim": "三块彩色积木从上方慢慢落下叠成小城堡，城堡顶升起小旗子",
  "durMs": 1200,
  "srcDurMs": 1200,
  "colors": [
   "#FFB3B3",
   "#B3E5FC",
   "#C8E6C9"
  ],
  "particles": 12,
  "sfxNote": "木块轻碰「咚咚」+ 小号上扬音",
  "recipe": "rain",
  "glyphs": [
   "+",
   "−",
   "×",
   "÷",
   "="
  ],
  "icon": "🧱",
  "assets": {
   "fx": "fx/skills/k_suansuan_2.webp",
   "icon": "fx/skills/icons/icon_k_suansuan_2.webp",
   "sfx": "sfx/skills/sfx_skill_k_suansuan_2.mp3"
  }
 },
 {
  "id": "k_suansuan_3",
  "seg": "K",
  "char": "算算",
  "charId": "suansuan",
  "major": "数学",
  "name": "彩虹算珠",
  "type": "visual",
  "effect": "V",
  "effectText": "纯视觉，无数值",
  "cd": 0,
  "anim": "一串彩色算珠沿弧线滑向小怪兽，小怪兽被逗笑弹一下",
  "durMs": 1000,
  "srcDurMs": 1000,
  "colors": [
   "#29B6F6",
   "#E1F5FE"
  ],
  "particles": 7,
  "sfxNote": "算盘珠「嗒嗒嗒」",
  "recipe": "projectile",
  "glyphs": [
   "+",
   "−",
   "×",
   "÷",
   "="
  ],
  "icon": "🟠",
  "assets": {
   "fx": "fx/skills/k_suansuan_3.webp",
   "icon": "fx/skills/icons/icon_k_suansuan_3.webp",
   "sfx": "sfx/skills/sfx_skill_k_suansuan_3.mp3"
  }
 },
 {
  "id": "k_momo_1",
  "seg": "K",
  "char": "墨墨",
  "charId": "momo",
  "major": "语文",
  "name": "毛笔画小花",
  "type": "visual",
  "effect": "V",
  "effectText": "纯视觉，无数值",
  "cd": 0,
  "anim": "一支大毛笔在空中画出一朵小花，小花飘到小怪兽头上",
  "durMs": 1200,
  "srcDurMs": 1200,
  "colors": [
   "#F8BBD0",
   "#A5D6A7"
  ],
  "particles": 10,
  "sfxNote": "毛笔「唰」+ 风铃",
  "recipe": "burst",
  "glyphs": [
   "文",
   "字",
   "书"
  ],
  "icon": "🌼",
  "assets": {
   "fx": "fx/skills/k_momo_1.webp",
   "icon": "fx/skills/icons/icon_k_momo_1.webp",
   "sfx": "sfx/skills/sfx_skill_k_momo_1.mp3"
  }
 },
 {
  "id": "k_momo_2",
  "seg": "K",
  "char": "墨墨",
  "charId": "momo",
  "major": "语文",
  "name": "墨点变蝴蝶",
  "type": "visual",
  "effect": "V",
  "effectText": "纯视觉，无数值",
  "cd": 0,
  "anim": "一滴圆墨点落下后变成两只蝴蝶，绕小怪兽飞一圈",
  "durMs": 1200,
  "srcDurMs": 1200,
  "colors": [
   "#9FA8DA"
  ],
  "particles": 2,
  "sfxNote": "轻柔翅膀扑扇声",
  "recipe": "rain",
  "glyphs": [
   "文",
   "字",
   "书"
  ],
  "icon": "🦋",
  "assets": {
   "fx": "fx/skills/k_momo_2.webp",
   "icon": "fx/skills/icons/icon_k_momo_2.webp",
   "sfx": "sfx/skills/sfx_skill_k_momo_2.mp3"
  }
 },
 {
  "id": "k_momo_3",
  "seg": "K",
  "char": "墨墨",
  "charId": "momo",
  "major": "语文",
  "name": "小书本抱抱",
  "type": "visual",
  "effect": "V",
  "effectText": "纯视觉，无数值",
  "cd": 0,
  "anim": "一本小书打开，飞出一颗爱心贴到小怪兽脸上",
  "durMs": 1000,
  "srcDurMs": 1000,
  "colors": [
   "#FFCC80"
  ],
  "particles": 8,
  "sfxNote": "翻书声 + 「叮」",
  "recipe": "rise",
  "glyphs": [
   "文",
   "字",
   "书"
  ],
  "icon": "💗",
  "assets": {
   "fx": "fx/skills/k_momo_3.webp",
   "icon": "fx/skills/icons/icon_k_momo_3.webp",
   "sfx": "sfx/skills/sfx_skill_k_momo_3.mp3"
  }
 },
 {
  "id": "k_abei_1",
  "seg": "K",
  "char": "阿贝",
  "charId": "abei",
  "major": "英语",
  "name": "ABC 气球",
  "type": "visual",
  "effect": "V",
  "effectText": "纯视觉，无数值",
  "cd": 0,
  "anim": "A、B、C 三个字母气球从下方飘到小怪兽身边绕一圈",
  "durMs": 1200,
  "srcDurMs": 1200,
  "colors": [
   "#AB47BC",
   "#E1BEE7"
  ],
  "particles": 3,
  "sfxNote": "气球「噗」+ 轻快木琴",
  "recipe": "burst",
  "glyphs": [
   "A",
   "B",
   "C"
  ],
  "icon": "🎈",
  "assets": {
   "fx": "fx/skills/k_abei_1.webp",
   "icon": "fx/skills/icons/icon_k_abei_1.webp",
   "sfx": "sfx/skills/sfx_skill_k_abei_1.mp3"
  }
 },
 {
  "id": "k_abei_2",
  "seg": "K",
  "char": "阿贝",
  "charId": "abei",
  "major": "英语",
  "name": "Hello 挥手",
  "type": "visual",
  "effect": "V",
  "effectText": "纯视觉，无数值",
  "cd": 0,
  "anim": "阿贝挥手，对话框弹出「Hello!」，小怪兽也挥手",
  "durMs": 1000,
  "srcDurMs": 1000,
  "colors": [
   "#FFF59D"
  ],
  "particles": 12,
  "sfxNote": "童声「Hello!」（可用家长录音）",
  "recipe": "rise",
  "glyphs": [
   "Hello!"
  ],
  "icon": "👋",
  "assets": {
   "fx": "fx/skills/k_abei_2.webp",
   "icon": "fx/skills/icons/icon_k_abei_2.webp",
   "sfx": "sfx/skills/sfx_skill_k_abei_2.mp3"
  }
 },
 {
  "id": "k_abei_3",
  "seg": "K",
  "char": "阿贝",
  "charId": "abei",
  "major": "英语",
  "name": "字母小火车",
  "type": "visual",
  "effect": "V",
  "effectText": "纯视觉，无数值",
  "cd": 0,
  "anim": "载着字母的小火车从左开到小怪兽脚下，鸣笛",
  "durMs": 1200,
  "srcDurMs": 1200,
  "colors": [
   "#81D4FA",
   "#FFAB91"
  ],
  "particles": 6,
  "sfxNote": "「呜呜」小火车鸣笛（音量 ≤ -12dB）",
  "recipe": "projectile",
  "glyphs": [
   "A",
   "B",
   "C"
  ],
  "icon": "🚂",
  "assets": {
   "fx": "fx/skills/k_abei_3.webp",
   "icon": "fx/skills/icons/icon_k_abei_3.webp",
   "sfx": "sfx/skills/sfx_skill_k_abei_3.mp3"
  }
 },
 {
  "id": "k_shishi_1",
  "seg": "K",
  "char": "诗诗",
  "charId": "shishi",
  "major": "诗词",
  "name": "月亮摇篮",
  "type": "visual",
  "effect": "V",
  "effectText": "纯视觉，无数值",
  "cd": 0,
  "anim": "弯弯的月亮从天上降下，小怪兽躺进去轻轻摇两下",
  "durMs": 1200,
  "srcDurMs": 1200,
  "colors": [
   "#FFF9C4",
   "#B39DDB"
  ],
  "particles": 10,
  "sfxNote": "八音盒两小节",
  "recipe": "rain",
  "glyphs": [
   "❀",
   "月",
   "诗"
  ],
  "icon": "🌙",
  "assets": {
   "fx": "fx/skills/k_shishi_1.webp",
   "icon": "fx/skills/icons/icon_k_shishi_1.webp",
   "sfx": "sfx/skills/sfx_skill_k_shishi_1.mp3"
  }
 },
 {
  "id": "k_shishi_2",
  "seg": "K",
  "char": "诗诗",
  "charId": "shishi",
  "major": "诗词",
  "name": "花瓣飘飘",
  "type": "visual",
  "effect": "V",
  "effectText": "纯视觉，无数值",
  "cd": 0,
  "anim": "粉色花瓣从左上方随风飘过，落在小怪兽身上",
  "durMs": 1000,
  "srcDurMs": 1000,
  "colors": [
   "#F8BBD0"
  ],
  "particles": 15,
  "sfxNote": "风声 + 竖琴刮奏",
  "recipe": "rain",
  "glyphs": [
   "❀",
   "月",
   "诗"
  ],
  "icon": "🌸",
  "assets": {
   "fx": "fx/skills/k_shishi_2.webp",
   "icon": "fx/skills/icons/icon_k_shishi_2.webp",
   "sfx": "sfx/skills/sfx_skill_k_shishi_2.mp3"
  }
 },
 {
  "id": "k_shishi_3",
  "seg": "K",
  "char": "诗诗",
  "charId": "shishi",
  "major": "诗词",
  "name": "小星星亮亮",
  "type": "visual",
  "effect": "V",
  "effectText": "纯视觉，无数值",
  "cd": 0,
  "anim": "三颗小星星依次慢慢亮起（不闪），连成小三角送给小怪兽",
  "durMs": 1200,
  "srcDurMs": 1200,
  "colors": [
   "#FFE082"
  ],
  "particles": 12,
  "sfxNote": "钢片琴三音",
  "recipe": "rise",
  "glyphs": [
   "❀",
   "月",
   "诗"
  ],
  "icon": "⭐",
  "assets": {
   "fx": "fx/skills/k_shishi_3.webp",
   "icon": "fx/skills/icons/icon_k_shishi_3.webp",
   "sfx": "sfx/skills/sfx_skill_k_shishi_3.mp3"
  }
 },
 {
  "id": "k_beibei_1",
  "seg": "K",
  "char": "杯杯",
  "charId": "beibei",
  "major": "化学",
  "name": "七彩泡泡",
  "type": "visual",
  "effect": "V",
  "effectText": "纯视觉，无数值",
  "cd": 0,
  "anim": "杯杯吹出一串七彩泡泡，碰到小怪兽轻轻破掉",
  "durMs": 1000,
  "srcDurMs": 1000,
  "colors": [
   "#66BB6A",
   "#AB47BC"
  ],
  "particles": 12,
  "sfxNote": "「啵啵」",
  "recipe": "rise",
  "glyphs": [
   "⚗",
   "○",
   "◎"
  ],
  "icon": "🫧",
  "assets": {
   "fx": "fx/skills/k_beibei_1.webp",
   "icon": "fx/skills/icons/icon_k_beibei_1.webp",
   "sfx": "sfx/skills/sfx_skill_k_beibei_1.mp3"
  }
 },
 {
  "id": "k_beibei_2",
  "seg": "K",
  "char": "杯杯",
  "charId": "beibei",
  "major": "化学",
  "name": "小苗长大",
  "type": "visual",
  "effect": "V",
  "effectText": "纯视觉，无数值",
  "cd": 0,
  "anim": "地上冒出一颗小芽，长成小花，小怪兽闻一闻",
  "durMs": 1200,
  "srcDurMs": 1200,
  "colors": [
   "#A5D6A7",
   "#FFF59D"
  ],
  "particles": 12,
  "sfxNote": "「咻~」生长音 + 鸟叫",
  "recipe": "rise",
  "glyphs": [
   "⚗",
   "○",
   "◎"
  ],
  "icon": "🌼",
  "assets": {
   "fx": "fx/skills/k_beibei_2.webp",
   "icon": "fx/skills/icons/icon_k_beibei_2.webp",
   "sfx": "sfx/skills/sfx_skill_k_beibei_2.mp3"
  }
 },
 {
  "id": "k_beibei_3",
  "seg": "K",
  "char": "杯杯",
  "charId": "beibei",
  "major": "化学",
  "name": "水滴变彩虹",
  "type": "visual",
  "effect": "V",
  "effectText": "纯视觉，无数值",
  "cd": 0,
  "anim": "一滴水滴落下，展开成一道小彩虹拱桥",
  "durMs": 1200,
  "srcDurMs": 1200,
  "colors": [
   "#66BB6A",
   "#AB47BC"
  ],
  "particles": 12,
  "sfxNote": "水滴「叮咚」",
  "recipe": "rain",
  "glyphs": [
   "⚗",
   "○",
   "◎"
  ],
  "icon": "🌈",
  "assets": {
   "fx": "fx/skills/k_beibei_3.webp",
   "icon": "fx/skills/icons/icon_k_beibei_3.webp",
   "sfx": "sfx/skills/sfx_skill_k_beibei_3.mp3"
  }
 },
 {
  "id": "p12_suansuan_1",
  "seg": "P12",
  "char": "算算",
  "charId": "suansuan",
  "major": "数学",
  "name": "加法小火箭",
  "type": "visual",
  "effect": "V",
  "effectText": "纯视觉，无数值",
  "cd": 0,
  "anim": "带「+」号的小火箭飞向怪物，轻轻碰一下冒出彩色烟花（小，不闪）",
  "durMs": 1000,
  "srcDurMs": 1000,
  "colors": [
   "#4FC3F7",
   "#FFB74D"
  ],
  "particles": 20,
  "sfxNote": "「咻—啪」轻",
  "recipe": "projectile",
  "glyphs": [
   "+"
  ],
  "icon": "🚀",
  "assets": {
   "fx": "fx/skills/p12_suansuan_1.webp",
   "icon": "fx/skills/icons/icon_p12_suansuan_1.webp",
   "sfx": "sfx/skills/sfx_skill_p12_suansuan_1.mp3"
  }
 },
 {
  "id": "p12_suansuan_2",
  "seg": "P12",
  "char": "算算",
  "charId": "suansuan",
  "major": "数学",
  "name": "数字积木雨",
  "type": "visual",
  "effect": "V",
  "effectText": "纯视觉，无数值",
  "cd": 0,
  "anim": "0–9 数字积木从天上落下，轻轻砸在怪物头上弹开",
  "durMs": 1200,
  "srcDurMs": 1200,
  "colors": [
   "#29B6F6",
   "#E1F5FE"
  ],
  "particles": 10,
  "sfxNote": "积木落地「咚咚」",
  "recipe": "rain",
  "glyphs": [
   "0",
   "1",
   "2",
   "3",
   "4",
   "5"
  ],
  "icon": "🧱",
  "assets": {
   "fx": "fx/skills/p12_suansuan_2.webp",
   "icon": "fx/skills/icons/icon_p12_suansuan_2.webp",
   "sfx": "sfx/skills/sfx_skill_p12_suansuan_2.mp3"
  }
 },
 {
  "id": "p12_suansuan_3",
  "seg": "P12",
  "char": "算算",
  "charId": "suansuan",
  "major": "数学",
  "name": "尺子小剑",
  "type": "visual",
  "effect": "V",
  "effectText": "纯视觉，无数值",
  "cd": 0,
  "anim": "算算挥舞一把直尺，画出一道刻度弧光",
  "durMs": 800,
  "srcDurMs": 800,
  "colors": [
   "#FFD54F"
  ],
  "particles": 12,
  "sfxNote": "「唰」",
  "recipe": "slash",
  "glyphs": [
   "+",
   "−",
   "×",
   "÷",
   "="
  ],
  "icon": "📏",
  "assets": {
   "fx": "fx/skills/p12_suansuan_3.webp",
   "icon": "fx/skills/icons/icon_p12_suansuan_3.webp",
   "sfx": "sfx/skills/sfx_skill_p12_suansuan_3.mp3"
  }
 },
 {
  "id": "p12_momo_1",
  "seg": "P12",
  "char": "墨墨",
  "charId": "momo",
  "major": "语文",
  "name": "笔画飞镖",
  "type": "visual",
  "effect": "V",
  "effectText": "纯视觉，无数值",
  "cd": 0,
  "anim": "一横一竖一撇三道笔画飞向怪物",
  "durMs": 900,
  "srcDurMs": 900,
  "colors": [
   "#5C6BC0"
  ],
  "particles": 15,
  "sfxNote": "毛笔「唰唰唰」",
  "recipe": "projectile",
  "glyphs": [
   "文",
   "字",
   "书"
  ],
  "icon": "🖌️",
  "assets": {
   "fx": "fx/skills/p12_momo_1.webp",
   "icon": "fx/skills/icons/icon_p12_momo_1.webp",
   "sfx": "sfx/skills/sfx_skill_p12_momo_1.mp3"
  }
 },
 {
  "id": "p12_momo_2",
  "seg": "P12",
  "char": "墨墨",
  "charId": "momo",
  "major": "语文",
  "name": "汉字小盾",
  "type": "visual",
  "effect": "V",
  "effectText": "纯视觉，无数值",
  "cd": 0,
  "anim": "一个大大的「守」字挡在墨墨身前，然后化成光点散开",
  "durMs": 1000,
  "srcDurMs": 1000,
  "colors": [
   "#FFCC80"
  ],
  "particles": 15,
  "sfxNote": "「咚」鼓声",
  "recipe": "burst",
  "glyphs": [
   "守"
  ],
  "icon": "🖋️",
  "assets": {
   "fx": "fx/skills/p12_momo_2.webp",
   "icon": "fx/skills/icons/icon_p12_momo_2.webp",
   "sfx": "sfx/skills/sfx_skill_p12_momo_2.mp3"
  }
 },
 {
  "id": "p12_momo_3",
  "seg": "P12",
  "char": "墨墨",
  "charId": "momo",
  "major": "语文",
  "name": "识字灯笼",
  "type": "visual",
  "effect": "V",
  "effectText": "纯视觉，无数值",
  "cd": 0,
  "anim": "一盏红灯笼升起，上面写着刚答对的字，慢慢飘走",
  "durMs": 1200,
  "srcDurMs": 1200,
  "colors": [
   "#EF9A9A"
  ],
  "particles": 12,
  "sfxNote": "铃铛",
  "recipe": "rise",
  "glyphs": [
   "文",
   "字",
   "书"
  ],
  "icon": "🏮",
  "assets": {
   "fx": "fx/skills/p12_momo_3.webp",
   "icon": "fx/skills/icons/icon_p12_momo_3.webp",
   "sfx": "sfx/skills/sfx_skill_p12_momo_3.mp3"
  }
 },
 {
  "id": "p12_abei_1",
  "seg": "P12",
  "char": "阿贝",
  "charId": "abei",
  "major": "英语",
  "name": "单词蝴蝶",
  "type": "visual",
  "effect": "V",
  "effectText": "纯视觉，无数值",
  "cd": 0,
  "anim": "刚答对的英文单词变成蝴蝶飞到怪物身边",
  "durMs": 1200,
  "srcDurMs": 1200,
  "colors": [
   "#CE93D8"
  ],
  "particles": 12,
  "sfxNote": "竖琴上行",
  "recipe": "projectile",
  "glyphs": [
   "A",
   "B",
   "C"
  ],
  "icon": "🦋",
  "assets": {
   "fx": "fx/skills/p12_abei_1.webp",
   "icon": "fx/skills/icons/icon_p12_abei_1.webp",
   "sfx": "sfx/skills/sfx_skill_p12_abei_1.mp3"
  }
 },
 {
  "id": "p12_abei_2",
  "seg": "P12",
  "char": "阿贝",
  "charId": "abei",
  "major": "英语",
  "name": "Phonics 鼓点",
  "type": "visual",
  "effect": "V",
  "effectText": "纯视觉，无数值",
  "cd": 0,
  "anim": "阿贝敲小鼓，「a-a-apple」字母随鼓点跳出",
  "durMs": 1000,
  "srcDurMs": 1000,
  "colors": [
   "#FFF176",
   "#81C784"
  ],
  "particles": 5,
  "sfxNote": "三声小鼓",
  "recipe": "burst",
  "glyphs": [
   "a-a-apple"
  ],
  "icon": "🥁",
  "assets": {
   "fx": "fx/skills/p12_abei_2.webp",
   "icon": "fx/skills/icons/icon_p12_abei_2.webp",
   "sfx": "sfx/skills/sfx_skill_p12_abei_2.mp3"
  }
 },
 {
  "id": "p12_abei_3",
  "seg": "P12",
  "char": "阿贝",
  "charId": "abei",
  "major": "英语",
  "name": "ABC 泡泡盾",
  "type": "visual",
  "effect": "V",
  "effectText": "纯视觉，无数值",
  "cd": 0,
  "anim": "一个透明泡泡罩住阿贝，表面浮着 A B C",
  "durMs": 1000,
  "srcDurMs": 1000,
  "colors": [
   "#B3E5FC"
  ],
  "particles": 10,
  "sfxNote": "泡泡「呜~」",
  "recipe": "shield",
  "glyphs": [
   "A",
   "B",
   "C"
  ],
  "icon": "🫧",
  "assets": {
   "fx": "fx/skills/p12_abei_3.webp",
   "icon": "fx/skills/icons/icon_p12_abei_3.webp",
   "sfx": "sfx/skills/sfx_skill_p12_abei_3.mp3"
  }
 },
 {
  "id": "p12_shishi_1",
  "seg": "P12",
  "char": "诗诗",
  "charId": "shishi",
  "major": "诗词",
  "name": "春风吹",
  "type": "visual",
  "effect": "V",
  "effectText": "纯视觉，无数值",
  "cd": 0,
  "anim": "一阵带花瓣的春风吹过，怪物被吹得转个圈",
  "durMs": 1000,
  "srcDurMs": 1000,
  "colors": [
   "#F8BBD0",
   "#C5E1A5"
  ],
  "particles": 20,
  "sfxNote": "风声",
  "recipe": "burst",
  "glyphs": [
   "❀",
   "月",
   "诗"
  ],
  "icon": "🌸",
  "assets": {
   "fx": "fx/skills/p12_shishi_1.webp",
   "icon": "fx/skills/icons/icon_p12_shishi_1.webp",
   "sfx": "sfx/skills/sfx_skill_p12_shishi_1.mp3"
  }
 },
 {
  "id": "p12_shishi_2",
  "seg": "P12",
  "char": "诗诗",
  "charId": "shishi",
  "major": "诗词",
  "name": "古诗小船",
  "type": "visual",
  "effect": "V",
  "effectText": "纯视觉，无数值",
  "cd": 0,
  "anim": "一只纸船载着诗句漂到怪物面前",
  "durMs": 1200,
  "srcDurMs": 1200,
  "colors": [
   "#90CAF9"
  ],
  "particles": 2,
  "sfxNote": "流水 + 古筝一音",
  "recipe": "projectile",
  "glyphs": [
   "❀",
   "月",
   "诗"
  ],
  "icon": "⛵",
  "assets": {
   "fx": "fx/skills/p12_shishi_2.webp",
   "icon": "fx/skills/icons/icon_p12_shishi_2.webp",
   "sfx": "sfx/skills/sfx_skill_p12_shishi_2.mp3"
  }
 },
 {
  "id": "p12_shishi_3",
  "seg": "P12",
  "char": "诗诗",
  "charId": "shishi",
  "major": "诗词",
  "name": "萤火虫",
  "type": "visual",
  "effect": "V",
  "effectText": "纯视觉，无数值",
  "cd": 0,
  "anim": "几只萤火虫绕诗诗飞一圈（缓慢呼吸亮度，不闪）",
  "durMs": 1200,
  "srcDurMs": 1200,
  "colors": [
   "#DCE775"
  ],
  "particles": 10,
  "sfxNote": "夏夜虫鸣（短）",
  "recipe": "burst",
  "glyphs": [
   "❀",
   "月",
   "诗"
  ],
  "icon": "✨",
  "assets": {
   "fx": "fx/skills/p12_shishi_3.webp",
   "icon": "fx/skills/icons/icon_p12_shishi_3.webp",
   "sfx": "sfx/skills/sfx_skill_p12_shishi_3.mp3"
  }
 },
 {
  "id": "p12_beibei_1",
  "seg": "P12",
  "char": "杯杯",
  "charId": "beibei",
  "major": "化学",
  "name": "泡泡弹",
  "type": "visual",
  "effect": "V",
  "effectText": "纯视觉，无数值",
  "cd": 0,
  "anim": "杯杯摇烧杯，射出三颗彩色泡泡弹",
  "durMs": 900,
  "srcDurMs": 900,
  "colors": [
   "#80DEEA",
   "#F48FB1"
  ],
  "particles": 12,
  "sfxNote": "「啵啵啵」",
  "recipe": "projectile",
  "glyphs": [
   "⚗",
   "○",
   "◎"
  ],
  "icon": "🫧",
  "assets": {
   "fx": "fx/skills/p12_beibei_1.webp",
   "icon": "fx/skills/icons/icon_p12_beibei_1.webp",
   "sfx": "sfx/skills/sfx_skill_p12_beibei_1.mp3"
  }
 },
 {
  "id": "p12_beibei_2",
  "seg": "P12",
  "char": "杯杯",
  "charId": "beibei",
  "major": "化学",
  "name": "种子发芽",
  "type": "visual",
  "effect": "V",
  "effectText": "纯视觉，无数值",
  "cd": 0,
  "anim": "杯杯脚下长出一片叶子，叶子上冒出绿色小加号",
  "durMs": 1000,
  "srcDurMs": 1000,
  "colors": [
   "#A5D6A7"
  ],
  "particles": 8,
  "sfxNote": "生长「咻~」",
  "recipe": "rise",
  "glyphs": [
   "⚗",
   "○",
   "◎"
  ],
  "icon": "🍃",
  "assets": {
   "fx": "fx/skills/p12_beibei_2.webp",
   "icon": "fx/skills/icons/icon_p12_beibei_2.webp",
   "sfx": "sfx/skills/sfx_skill_p12_beibei_2.mp3"
  }
 },
 {
  "id": "p12_beibei_3",
  "seg": "P12",
  "char": "杯杯",
  "charId": "beibei",
  "major": "化学",
  "name": "小火山",
  "type": "visual",
  "effect": "V",
  "effectText": "纯视觉，无数值",
  "cd": 0,
  "anim": "迷你火山喷出彩色糖果碎（不是火焰）",
  "durMs": 1200,
  "srcDurMs": 1200,
  "colors": [
   "#FFAB91",
   "#FFF59D"
  ],
  "particles": 20,
  "sfxNote": "「噗」+ 欢呼",
  "recipe": "projectile",
  "glyphs": [
   "⚗",
   "○",
   "◎"
  ],
  "icon": "🍬",
  "assets": {
   "fx": "fx/skills/p12_beibei_3.webp",
   "icon": "fx/skills/icons/icon_p12_beibei_3.webp",
   "sfx": "sfx/skills/sfx_skill_p12_beibei_3.mp3"
  }
 },
 {
  "id": "p36_suansuan_1",
  "seg": "P36",
  "char": "算算",
  "charId": "suansuan",
  "major": "数学",
  "name": "数字风暴",
  "type": "atk",
  "effect": "A14",
  "effectText": "答对伤害 ×1.4",
  "cd": 0,
  "anim": "算算举手，0–9 数字旋成小旋风卷向怪物，命中时数字四散",
  "durMs": 1200,
  "srcDurMs": 1200,
  "colors": [
   "#29B6F6",
   "#FFFFFF"
  ],
  "particles": 30,
  "sfxNote": "旋风「呼—」+ 命中「嘭」",
  "recipe": "projectile",
  "glyphs": [
   "0",
   "1",
   "2",
   "3",
   "4",
   "5"
  ],
  "icon": "🍃",
  "assets": {
   "fx": "fx/skills/p36_suansuan_1.webp",
   "icon": "fx/skills/icons/icon_p36_suansuan_1.webp",
   "sfx": "sfx/skills/sfx_skill_p36_suansuan_1.mp3"
  }
 },
 {
  "id": "p36_suansuan_2",
  "seg": "P36",
  "char": "算算",
  "charId": "suansuan",
  "major": "数学",
  "name": "乘法连击",
  "type": "atk",
  "effect": "A2H",
  "effectText": "答对攻击 2 次，每次 70%",
  "cd": 0,
  "anim": "两道「×」形斩击依次划过怪物",
  "durMs": 1100,
  "srcDurMs": 1100,
  "colors": [
   "#FFB300"
  ],
  "particles": 20,
  "sfxNote": "两声「锵锵」",
  "recipe": "slash",
  "glyphs": [
   "×"
  ],
  "icon": "⚔️",
  "assets": {
   "fx": "fx/skills/p36_suansuan_2.webp",
   "icon": "fx/skills/icons/icon_p36_suansuan_2.webp",
   "sfx": "sfx/skills/sfx_skill_p36_suansuan_2.mp3"
  }
 },
 {
  "id": "p36_suansuan_3",
  "seg": "P36",
  "char": "算算",
  "charId": "suansuan",
  "major": "数学",
  "name": "方程护盾",
  "type": "guard",
  "effect": "G70",
  "effectText": "护体：下一次受伤 ×0.7",
  "cd": 0,
  "anim": "「x = ?」符号组成六边形护盾罩住算算，护盾停留在角色身上",
  "durMs": 1000,
  "srcDurMs": 1000,
  "colors": [
   "#4DD0E1"
  ],
  "particles": 12,
  "sfxNote": "「嗡」低频护盾音",
  "recipe": "shield",
  "glyphs": [
   "x = ?"
  ],
  "icon": "🛡️",
  "assets": {
   "fx": "fx/skills/p36_suansuan_3.webp",
   "icon": "fx/skills/icons/icon_p36_suansuan_3.webp",
   "sfx": "sfx/skills/sfx_skill_p36_suansuan_3.mp3"
  }
 },
 {
  "id": "p36_momo_1",
  "seg": "P36",
  "char": "墨墨",
  "charId": "momo",
  "major": "语文",
  "name": "妙笔生花",
  "type": "atk",
  "effect": "A14",
  "effectText": "答对伤害 ×1.4",
  "cd": 0,
  "anim": "大毛笔在怪物身上画一笔，墨迹开出一朵花后爆成花瓣",
  "durMs": 1300,
  "srcDurMs": 1300,
  "colors": [
   "#3949AB",
   "#F48FB1"
  ],
  "particles": 25,
  "sfxNote": "毛笔「唰」+「嘭」",
  "recipe": "burst",
  "glyphs": [
   "文",
   "字",
   "书"
  ],
  "icon": "🌸",
  "assets": {
   "fx": "fx/skills/p36_momo_1.webp",
   "icon": "fx/skills/icons/icon_p36_momo_1.webp",
   "sfx": "sfx/skills/sfx_skill_p36_momo_1.mp3"
  }
 },
 {
  "id": "p36_momo_2",
  "seg": "P36",
  "char": "墨墨",
  "charId": "momo",
  "major": "语文",
  "name": "墨韵护体",
  "type": "guard",
  "effect": "G70",
  "effectText": "护体：下一次受伤 ×0.7",
  "cd": 0,
  "anim": "墨汁在墨墨周围化成一圈水墨屏障",
  "durMs": 1000,
  "srcDurMs": 1000,
  "colors": [
   "#5C6BC0"
  ],
  "particles": 20,
  "sfxNote": "古筝滑音",
  "recipe": "shield",
  "glyphs": [
   "文",
   "字",
   "书"
  ],
  "icon": "🛡️",
  "assets": {
   "fx": "fx/skills/p36_momo_2.webp",
   "icon": "fx/skills/icons/icon_p36_momo_2.webp",
   "sfx": "sfx/skills/sfx_skill_p36_momo_2.mp3"
  }
 },
 {
  "id": "p36_momo_3",
  "seg": "P36",
  "char": "墨墨",
  "charId": "momo",
  "major": "语文",
  "name": "成语回春",
  "type": "heal",
  "effect": "H5",
  "effectText": "回复 5% 最大血量",
  "cd": 0,
  "anim": "四个字的成语卷轴展开，绿色光点飘入墨墨身上",
  "durMs": 1000,
  "srcDurMs": 1100,
  "colors": [
   "#81C784"
  ],
  "particles": 15,
  "sfxNote": "翻卷轴 + 治疗「叮~」",
  "recipe": "heal",
  "glyphs": [
   "文",
   "字",
   "书"
  ],
  "icon": "📜",
  "assets": {
   "fx": "fx/skills/p36_momo_3.webp",
   "icon": "fx/skills/icons/icon_p36_momo_3.webp",
   "sfx": "sfx/skills/sfx_skill_p36_momo_3.mp3"
  }
 },
 {
  "id": "p36_abei_1",
  "seg": "P36",
  "char": "阿贝",
  "charId": "abei",
  "major": "英语",
  "name": "Echo 回声",
  "type": "atk",
  "effect": "A2H",
  "effectText": "答对攻击 2 次，每次 70%",
  "cd": 0,
  "anim": "阿贝喊出单词，两圈音波依次撞向怪物",
  "durMs": 1100,
  "srcDurMs": 1100,
  "colors": [
   "#AB47BC"
  ],
  "particles": 2,
  "sfxNote": "回声「Hey—ey」",
  "recipe": "ring",
  "glyphs": [
   "A",
   "B",
   "C"
  ],
  "icon": "〰️",
  "assets": {
   "fx": "fx/skills/p36_abei_1.webp",
   "icon": "fx/skills/icons/icon_p36_abei_1.webp",
   "sfx": "sfx/skills/sfx_skill_p36_abei_1.mp3"
  }
 },
 {
  "id": "p36_abei_2",
  "seg": "P36",
  "char": "阿贝",
  "charId": "abei",
  "major": "英语",
  "name": "字母飞镖",
  "type": "atk",
  "effect": "A13P",
  "effectText": "答对伤害 ×1.3，无视护盾",
  "cd": 0,
  "anim": "三枚字母飞镖穿过怪物护盾命中",
  "durMs": 1000,
  "srcDurMs": 1000,
  "colors": [
   "#FFCA28"
  ],
  "particles": 12,
  "sfxNote": "「嗖嗖嗖」",
  "recipe": "shield",
  "glyphs": [
   "A",
   "B",
   "C"
  ],
  "icon": "🛡️",
  "assets": {
   "fx": "fx/skills/p36_abei_2.webp",
   "icon": "fx/skills/icons/icon_p36_abei_2.webp",
   "sfx": "sfx/skills/sfx_skill_p36_abei_2.mp3"
  }
 },
 {
  "id": "p36_abei_3",
  "seg": "P36",
  "char": "阿贝",
  "charId": "abei",
  "major": "英语",
  "name": "Stop!",
  "type": "control",
  "effect": "C",
  "effectText": "怪物下一个意图降级（⚔→发呆、💥→⚔、🛡/⚡→取消）",
  "cd": 0,
  "anim": "怪物头顶冒出路牌「STOP」，怪物愣住转圈",
  "durMs": 1000,
  "srcDurMs": 1000,
  "colors": [
   "#EF5350"
  ],
  "particles": 12,
  "sfxNote": "刹车「吱」（轻）",
  "recipe": "control",
  "glyphs": [
   "STOP"
  ],
  "icon": "🛑",
  "assets": {
   "fx": "fx/skills/p36_abei_3.webp",
   "icon": "fx/skills/icons/icon_p36_abei_3.webp",
   "sfx": "sfx/skills/sfx_skill_p36_abei_3.mp3"
  }
 },
 {
  "id": "p36_shishi_1",
  "seg": "P36",
  "char": "诗诗",
  "charId": "shishi",
  "major": "诗词",
  "name": "月下吟",
  "type": "guard",
  "effect": "G70",
  "effectText": "护体：下一次受伤 ×0.7",
  "cd": 0,
  "anim": "诗诗身后升起月亮，月光化成薄纱披在身上",
  "durMs": 1000,
  "srcDurMs": 1200,
  "colors": [
   "#FFF9C4",
   "#9575CD"
  ],
  "particles": 20,
  "sfxNote": "长笛一句",
  "recipe": "shield",
  "glyphs": [
   "❀",
   "月",
   "诗"
  ],
  "icon": "🌙",
  "assets": {
   "fx": "fx/skills/p36_shishi_1.webp",
   "icon": "fx/skills/icons/icon_p36_shishi_1.webp",
   "sfx": "sfx/skills/sfx_skill_p36_shishi_1.mp3"
  }
 },
 {
  "id": "p36_shishi_2",
  "seg": "P36",
  "char": "诗诗",
  "charId": "shishi",
  "major": "诗词",
  "name": "飞花令",
  "type": "atk",
  "effect": "A14",
  "effectText": "答对伤害 ×1.4",
  "cd": 0,
  "anim": "一句诗的字化成花瓣刀片飞向怪物",
  "durMs": 1200,
  "srcDurMs": 1200,
  "colors": [
   "#F06292"
  ],
  "particles": 20,
  "sfxNote": "竹笛 + 命中",
  "recipe": "projectile",
  "glyphs": [
   "❀",
   "月",
   "诗"
  ],
  "icon": "🌸",
  "assets": {
   "fx": "fx/skills/p36_shishi_2.webp",
   "icon": "fx/skills/icons/icon_p36_shishi_2.webp",
   "sfx": "sfx/skills/sfx_skill_p36_shishi_2.mp3"
  }
 },
 {
  "id": "p36_shishi_3",
  "seg": "P36",
  "char": "诗诗",
  "charId": "shishi",
  "major": "诗词",
  "name": "春眠不觉晓",
  "type": "control",
  "effect": "C",
  "effectText": "怪物下一个意图降级（⚔→发呆、💥→⚔、🛡/⚡→取消）",
  "cd": 0,
  "anim": "怪物头上冒出「zzz」，打一个大哈欠",
  "durMs": 1000,
  "srcDurMs": 1000,
  "colors": [
   "#90CAF9"
  ],
  "particles": 12,
  "sfxNote": "哈欠音",
  "recipe": "control",
  "glyphs": [
   "zzz"
  ],
  "icon": "💤",
  "assets": {
   "fx": "fx/skills/p36_shishi_3.webp",
   "icon": "fx/skills/icons/icon_p36_shishi_3.webp",
   "sfx": "sfx/skills/sfx_skill_p36_shishi_3.mp3"
  }
 },
 {
  "id": "p36_beibei_1",
  "seg": "P36",
  "char": "杯杯",
  "charId": "beibei",
  "major": "化学",
  "name": "炼金爆裂",
  "type": "atk",
  "effect": "A13P",
  "effectText": "答对伤害 ×1.3，无视护盾",
  "cd": 0,
  "anim": "烧杯抛出，在怪物身上炸开彩色气泡云（无白闪）",
  "durMs": 1200,
  "srcDurMs": 1200,
  "colors": [
   "#66BB6A",
   "#AB47BC"
  ],
  "particles": 30,
  "sfxNote": "玻璃「叮」+ 气泡爆「噗」",
  "recipe": "projectile",
  "glyphs": [
   "⚗",
   "○",
   "◎"
  ],
  "icon": "⚗️",
  "assets": {
   "fx": "fx/skills/p36_beibei_1.webp",
   "icon": "fx/skills/icons/icon_p36_beibei_1.webp",
   "sfx": "sfx/skills/sfx_skill_p36_beibei_1.mp3"
  }
 },
 {
  "id": "p36_beibei_2",
  "seg": "P36",
  "char": "杯杯",
  "charId": "beibei",
  "major": "化学",
  "name": "酸碱中和",
  "type": "guard",
  "effect": "G70",
  "effectText": "护体：下一次受伤 ×0.7",
  "cd": 0,
  "anim": "红蓝两色液体在杯杯身前汇合成紫色护罩",
  "durMs": 1000,
  "srcDurMs": 1000,
  "colors": [
   "#E57373",
   "#64B5F6",
   "#9575CD"
  ],
  "particles": 16,
  "sfxNote": "液体「咕噜」",
  "recipe": "shield",
  "glyphs": [
   "⚗",
   "○",
   "◎"
  ],
  "icon": "💧",
  "assets": {
   "fx": "fx/skills/p36_beibei_2.webp",
   "icon": "fx/skills/icons/icon_p36_beibei_2.webp",
   "sfx": "sfx/skills/sfx_skill_p36_beibei_2.mp3"
  }
 },
 {
  "id": "p36_beibei_3",
  "seg": "P36",
  "char": "杯杯",
  "charId": "beibei",
  "major": "化学",
  "name": "光合作用",
  "type": "heal",
  "effect": "H5",
  "effectText": "回复 5% 最大血量",
  "cd": 0,
  "anim": "阳光照下，杯杯身边的叶子吸收后冒出绿色光点",
  "durMs": 1000,
  "srcDurMs": 1100,
  "colors": [
   "#FFF176",
   "#81C784"
  ],
  "particles": 15,
  "sfxNote": "鸟鸣 + 治疗音",
  "recipe": "heal",
  "glyphs": [
   "⚗",
   "○",
   "◎"
  ],
  "icon": "🍃",
  "assets": {
   "fx": "fx/skills/p36_beibei_3.webp",
   "icon": "fx/skills/icons/icon_p36_beibei_3.webp",
   "sfx": "sfx/skills/sfx_skill_p36_beibei_3.mp3"
  }
 },
 {
  "id": "j1_suansuan_1",
  "seg": "J",
  "char": "算算",
  "charId": "suansuan",
  "major": "数学",
  "name": "数字风暴",
  "type": "atk",
  "effect": "A14",
  "effectText": "答对伤害 ×1.4",
  "cd": 0,
  "anim": "同小学版，数字改为带运算符的算式碎片，旋风更大",
  "durMs": 1200,
  "srcDurMs": 1200,
  "colors": [
   "#29B6F6",
   "#FFFFFF"
  ],
  "particles": 40,
  "sfxNote": "旋风 + 「嘭」",
  "recipe": "burst",
  "glyphs": [
   "0",
   "1",
   "2",
   "3",
   "4",
   "5"
  ],
  "icon": "🍃",
  "assets": {
   "fx": "fx/skills/j1_suansuan_1.webp",
   "icon": "fx/skills/icons/icon_j1_suansuan_1.webp",
   "sfx": "sfx/skills/sfx_skill_j1_suansuan_1.mp3"
  }
 },
 {
  "id": "j1_suansuan_2",
  "seg": "J",
  "char": "算算",
  "charId": "suansuan",
  "major": "数学",
  "name": "数轴突刺",
  "type": "atk",
  "effect": "A125C",
  "effectText": "答对伤害 ×1.25，连击额外 +1",
  "cd": 0,
  "anim": "一条数轴从算算脚下射出，箭头刺中怪物，刻度依次亮起",
  "durMs": 1000,
  "srcDurMs": 1000,
  "colors": [
   "#FFB300"
  ],
  "particles": 20,
  "sfxNote": "「铮」",
  "recipe": "projectile",
  "glyphs": [
   "+",
   "−",
   "×",
   "÷",
   "="
  ],
  "icon": "➡️",
  "assets": {
   "fx": "fx/skills/j1_suansuan_2.webp",
   "icon": "fx/skills/icons/icon_j1_suansuan_2.webp",
   "sfx": "sfx/skills/sfx_skill_j1_suansuan_2.mp3"
  }
 },
 {
  "id": "j1_suansuan_3",
  "seg": "J",
  "char": "算算",
  "charId": "suansuan",
  "major": "数学",
  "name": "坐标锁定",
  "type": "control",
  "effect": "C",
  "effectText": "怪物下一个意图降级（⚔→发呆、💥→⚔、🛡/⚡→取消）",
  "cd": 0,
  "anim": "怪物身上出现十字坐标准星，锁定后怪物动作被冻结 0.3 秒",
  "durMs": 1000,
  "srcDurMs": 1000,
  "colors": [
   "#26C6DA"
  ],
  "particles": 12,
  "sfxNote": "「滴—滴」",
  "recipe": "control",
  "glyphs": [
   "+",
   "−",
   "×",
   "÷",
   "="
  ],
  "icon": "⭐",
  "assets": {
   "fx": "fx/skills/j1_suansuan_3.webp",
   "icon": "fx/skills/icons/icon_j1_suansuan_3.webp",
   "sfx": "sfx/skills/sfx_skill_j1_suansuan_3.mp3"
  }
 },
 {
  "id": "j1_suansuan_4",
  "seg": "J",
  "char": "算算",
  "charId": "suansuan",
  "major": "数学",
  "name": "绝对值护盾",
  "type": "guard",
  "effect": "G70",
  "effectText": "护体：下一次受伤 ×0.7",
  "cd": 0,
  "anim": "两道竖线「| |」把算算夹在中间形成护盾",
  "durMs": 1000,
  "srcDurMs": 1000,
  "colors": [
   "#4DD0E1"
  ],
  "particles": 12,
  "sfxNote": "护盾「嗡」",
  "recipe": "shield",
  "glyphs": [
   "| |"
  ],
  "icon": "🛡️",
  "assets": {
   "fx": "fx/skills/j1_suansuan_4.webp",
   "icon": "fx/skills/icons/icon_j1_suansuan_4.webp",
   "sfx": "sfx/skills/sfx_skill_j1_suansuan_4.mp3"
  }
 },
 {
  "id": "j1_momo_1",
  "seg": "J",
  "char": "墨墨",
  "charId": "momo",
  "major": "语文",
  "name": "妙笔生花",
  "type": "atk",
  "effect": "A14",
  "effectText": "答对伤害 ×1.4",
  "cd": 0,
  "anim": "同小学版，花更大，花瓣落地成字",
  "durMs": 1300,
  "srcDurMs": 1300,
  "colors": [
   "#3949AB",
   "#F48FB1"
  ],
  "particles": 30,
  "sfxNote": "「唰」+「嘭」",
  "recipe": "burst",
  "glyphs": [
   "文",
   "字",
   "书"
  ],
  "icon": "🌸",
  "assets": {
   "fx": "fx/skills/j1_momo_1.webp",
   "icon": "fx/skills/icons/icon_j1_momo_1.webp",
   "sfx": "sfx/skills/sfx_skill_j1_momo_1.mp3"
  }
 },
 {
  "id": "j1_momo_2",
  "seg": "J",
  "char": "墨墨",
  "charId": "momo",
  "major": "语文",
  "name": "文言飞白",
  "type": "atk",
  "effect": "A13P",
  "effectText": "答对伤害 ×1.3，无视护盾",
  "cd": 0,
  "anim": "飞白笔触横扫，穿透怪物护盾",
  "durMs": 1000,
  "srcDurMs": 1000,
  "colors": [
   "#212121"
  ],
  "particles": 12,
  "sfxNote": "毛笔重扫",
  "recipe": "shield",
  "glyphs": [
   "文",
   "字",
   "书"
  ],
  "icon": "🖌️",
  "assets": {
   "fx": "fx/skills/j1_momo_2.webp",
   "icon": "fx/skills/icons/icon_j1_momo_2.webp",
   "sfx": "sfx/skills/sfx_skill_j1_momo_2.mp3"
  }
 },
 {
  "id": "j1_momo_3",
  "seg": "J",
  "char": "墨墨",
  "charId": "momo",
  "major": "语文",
  "name": "墨韵护体",
  "type": "guard",
  "effect": "G70",
  "effectText": "护体：下一次受伤 ×0.7",
  "cd": 0,
  "anim": "同小学版",
  "durMs": 1000,
  "srcDurMs": 1000,
  "colors": [
   "#5C6BC0"
  ],
  "particles": 20,
  "sfxNote": "古筝滑音",
  "recipe": "shield",
  "glyphs": [
   "文",
   "字",
   "书"
  ],
  "icon": "🖋️",
  "assets": {
   "fx": "fx/skills/j1_momo_3.webp",
   "icon": "fx/skills/icons/icon_j1_momo_3.webp",
   "sfx": "sfx/skills/sfx_skill_j1_momo_3.mp3"
  }
 },
 {
  "id": "j1_momo_4",
  "seg": "J",
  "char": "墨墨",
  "charId": "momo",
  "major": "语文",
  "name": "成语回春",
  "type": "heal",
  "effect": "H5",
  "effectText": "回复 5% 最大血量",
  "cd": 0,
  "anim": "同小学版",
  "durMs": 1000,
  "srcDurMs": 1100,
  "colors": [
   "#81C784"
  ],
  "particles": 15,
  "sfxNote": "治疗音",
  "recipe": "heal",
  "glyphs": [
   "文",
   "字",
   "书"
  ],
  "icon": "💚",
  "assets": {
   "fx": "fx/skills/j1_momo_4.webp",
   "icon": "fx/skills/icons/icon_j1_momo_4.webp",
   "sfx": "sfx/skills/sfx_skill_j1_momo_4.mp3"
  }
 },
 {
  "id": "j1_abei_1",
  "seg": "J",
  "char": "阿贝",
  "charId": "abei",
  "major": "英语",
  "name": "Echo 回声",
  "type": "atk",
  "effect": "A2H",
  "effectText": "答对攻击 2 次，每次 70%",
  "cd": 0,
  "anim": "同小学版",
  "durMs": 1100,
  "srcDurMs": 1100,
  "colors": [
   "#AB47BC"
  ],
  "particles": 12,
  "sfxNote": "回声",
  "recipe": "burst",
  "glyphs": [
   "A",
   "B",
   "C"
  ],
  "icon": "⚔️",
  "assets": {
   "fx": "fx/skills/j1_abei_1.webp",
   "icon": "fx/skills/icons/icon_j1_abei_1.webp",
   "sfx": "sfx/skills/sfx_skill_j1_abei_1.mp3"
  }
 },
 {
  "id": "j1_abei_2",
  "seg": "J",
  "char": "阿贝",
  "charId": "abei",
  "major": "英语",
  "name": "语法连锁",
  "type": "atk",
  "effect": "A125C",
  "effectText": "答对伤害 ×1.25，连击额外 +1",
  "cd": 0,
  "anim": "主谓宾三个词块像锁链一样连成一串砸中怪物",
  "durMs": 1100,
  "srcDurMs": 1100,
  "colors": [
   "#FFCA28",
   "#8D6E63"
  ],
  "particles": 15,
  "sfxNote": "锁链「哗啦」",
  "recipe": "projectile",
  "glyphs": [
   "A",
   "B",
   "C"
  ],
  "icon": "🔗",
  "assets": {
   "fx": "fx/skills/j1_abei_2.webp",
   "icon": "fx/skills/icons/icon_j1_abei_2.webp",
   "sfx": "sfx/skills/sfx_skill_j1_abei_2.mp3"
  }
 },
 {
  "id": "j1_abei_3",
  "seg": "J",
  "char": "阿贝",
  "charId": "abei",
  "major": "英语",
  "name": "Stop!",
  "type": "control",
  "effect": "C",
  "effectText": "怪物下一个意图降级（⚔→发呆、💥→⚔、🛡/⚡→取消）",
  "cd": 0,
  "anim": "同小学版",
  "durMs": 1000,
  "srcDurMs": 1000,
  "colors": [
   "#EF5350"
  ],
  "particles": 12,
  "sfxNote": "刹车",
  "recipe": "control",
  "glyphs": [
   "A",
   "B",
   "C"
  ],
  "icon": "⏸️",
  "assets": {
   "fx": "fx/skills/j1_abei_3.webp",
   "icon": "fx/skills/icons/icon_j1_abei_3.webp",
   "sfx": "sfx/skills/sfx_skill_j1_abei_3.mp3"
  }
 },
 {
  "id": "j1_abei_4",
  "seg": "J",
  "char": "阿贝",
  "charId": "abei",
  "major": "英语",
  "name": "Word Shield",
  "type": "guard",
  "effect": "G70",
  "effectText": "护体：下一次受伤 ×0.7",
  "cd": 0,
  "anim": "单词字母围成一圈旋转护盾",
  "durMs": 1000,
  "srcDurMs": 1000,
  "colors": [
   "#B3E5FC"
  ],
  "particles": 12,
  "sfxNote": "「嗡」",
  "recipe": "shield",
  "glyphs": [
   "A",
   "B",
   "C"
  ],
  "icon": "🛡️",
  "assets": {
   "fx": "fx/skills/j1_abei_4.webp",
   "icon": "fx/skills/icons/icon_j1_abei_4.webp",
   "sfx": "sfx/skills/sfx_skill_j1_abei_4.mp3"
  }
 },
 {
  "id": "j1_shishi_1",
  "seg": "J",
  "char": "诗诗",
  "charId": "shishi",
  "major": "诗词",
  "name": "飞花令",
  "type": "atk",
  "effect": "A14",
  "effectText": "答对伤害 ×1.4",
  "cd": 0,
  "anim": "同小学版",
  "durMs": 1200,
  "srcDurMs": 1200,
  "colors": [
   "#F06292"
  ],
  "particles": 25,
  "sfxNote": "竹笛",
  "recipe": "burst",
  "glyphs": [
   "❀",
   "月",
   "诗"
  ],
  "icon": "⚔️",
  "assets": {
   "fx": "fx/skills/j1_shishi_1.webp",
   "icon": "fx/skills/icons/icon_j1_shishi_1.webp",
   "sfx": "sfx/skills/sfx_skill_j1_shishi_1.mp3"
  }
 },
 {
  "id": "j1_shishi_2",
  "seg": "J",
  "char": "诗诗",
  "charId": "shishi",
  "major": "诗词",
  "name": "大江东去",
  "type": "atk",
  "effect": "A13P",
  "effectText": "答对伤害 ×1.3，无视护盾",
  "cd": 0,
  "anim": "水墨江浪从左涌向怪物，冲散护盾",
  "durMs": 1300,
  "srcDurMs": 1300,
  "colors": [
   "#4FC3F7"
  ],
  "particles": 30,
  "sfxNote": "浪涛",
  "recipe": "shield",
  "glyphs": [
   "❀",
   "月",
   "诗"
  ],
  "icon": "🛡️",
  "assets": {
   "fx": "fx/skills/j1_shishi_2.webp",
   "icon": "fx/skills/icons/icon_j1_shishi_2.webp",
   "sfx": "sfx/skills/sfx_skill_j1_shishi_2.mp3"
  }
 },
 {
  "id": "j1_shishi_3",
  "seg": "J",
  "char": "诗诗",
  "charId": "shishi",
  "major": "诗词",
  "name": "月下吟",
  "type": "guard",
  "effect": "G70",
  "effectText": "护体：下一次受伤 ×0.7",
  "cd": 0,
  "anim": "同小学版",
  "durMs": 1000,
  "srcDurMs": 1200,
  "colors": [
   "#FFF9C4"
  ],
  "particles": 20,
  "sfxNote": "长笛",
  "recipe": "shield",
  "glyphs": [
   "❀",
   "月",
   "诗"
  ],
  "icon": "🌙",
  "assets": {
   "fx": "fx/skills/j1_shishi_3.webp",
   "icon": "fx/skills/icons/icon_j1_shishi_3.webp",
   "sfx": "sfx/skills/sfx_skill_j1_shishi_3.mp3"
  }
 },
 {
  "id": "j1_shishi_4",
  "seg": "J",
  "char": "诗诗",
  "charId": "shishi",
  "major": "诗词",
  "name": "春眠不觉晓",
  "type": "control",
  "effect": "C",
  "effectText": "怪物下一个意图降级（⚔→发呆、💥→⚔、🛡/⚡→取消）",
  "cd": 0,
  "anim": "同小学版",
  "durMs": 1000,
  "srcDurMs": 1000,
  "colors": [
   "#90CAF9"
  ],
  "particles": 12,
  "sfxNote": "哈欠",
  "recipe": "control",
  "glyphs": [
   "❀",
   "月",
   "诗"
  ],
  "icon": "⏸️",
  "assets": {
   "fx": "fx/skills/j1_shishi_4.webp",
   "icon": "fx/skills/icons/icon_j1_shishi_4.webp",
   "sfx": "sfx/skills/sfx_skill_j1_shishi_4.mp3"
  }
 },
 {
  "id": "j1_beibei_1",
  "seg": "J",
  "char": "杯杯",
  "charId": "beibei",
  "major": "化学",
  "name": "炼金爆裂",
  "type": "atk",
  "effect": "A13P",
  "effectText": "答对伤害 ×1.3，无视护盾",
  "cd": 0,
  "anim": "同小学版",
  "durMs": 1200,
  "srcDurMs": 1200,
  "colors": [
   "#66BB6A",
   "#AB47BC"
  ],
  "particles": 30,
  "sfxNote": "「噗」",
  "recipe": "burst",
  "glyphs": [
   "⚗",
   "○",
   "◎"
  ],
  "icon": "⚔️",
  "assets": {
   "fx": "fx/skills/j1_beibei_1.webp",
   "icon": "fx/skills/icons/icon_j1_beibei_1.webp",
   "sfx": "sfx/skills/sfx_skill_j1_beibei_1.mp3"
  }
 },
 {
  "id": "j1_beibei_2",
  "seg": "J",
  "char": "杯杯",
  "charId": "beibei",
  "major": "化学",
  "name": "催化连击",
  "type": "atk",
  "effect": "A2H",
  "effectText": "答对攻击 2 次，每次 70%",
  "cd": 0,
  "anim": "两颗催化剂小球依次撞向怪物冒泡",
  "durMs": 1100,
  "srcDurMs": 1100,
  "colors": [
   "#FF7043"
  ],
  "particles": 20,
  "sfxNote": "「啵、嘭」",
  "recipe": "projectile",
  "glyphs": [
   "⚗",
   "○",
   "◎"
  ],
  "icon": "⚗️",
  "assets": {
   "fx": "fx/skills/j1_beibei_2.webp",
   "icon": "fx/skills/icons/icon_j1_beibei_2.webp",
   "sfx": "sfx/skills/sfx_skill_j1_beibei_2.mp3"
  }
 },
 {
  "id": "j1_beibei_3",
  "seg": "J",
  "char": "杯杯",
  "charId": "beibei",
  "major": "化学",
  "name": "酸碱中和",
  "type": "guard",
  "effect": "G70",
  "effectText": "护体：下一次受伤 ×0.7",
  "cd": 0,
  "anim": "同小学版",
  "durMs": 1000,
  "srcDurMs": 1000,
  "colors": [
   "#9575CD"
  ],
  "particles": 16,
  "sfxNote": "「咕噜」",
  "recipe": "shield",
  "glyphs": [
   "⚗",
   "○",
   "◎"
  ],
  "icon": "🛡️",
  "assets": {
   "fx": "fx/skills/j1_beibei_3.webp",
   "icon": "fx/skills/icons/icon_j1_beibei_3.webp",
   "sfx": "sfx/skills/sfx_skill_j1_beibei_3.mp3"
  }
 },
 {
  "id": "j1_beibei_4",
  "seg": "J",
  "char": "杯杯",
  "charId": "beibei",
  "major": "化学",
  "name": "光合作用",
  "type": "heal",
  "effect": "H5",
  "effectText": "回复 5% 最大血量",
  "cd": 0,
  "anim": "同小学版",
  "durMs": 1000,
  "srcDurMs": 1100,
  "colors": [
   "#81C784"
  ],
  "particles": 15,
  "sfxNote": "治疗音",
  "recipe": "heal",
  "glyphs": [
   "⚗",
   "○",
   "◎"
  ],
  "icon": "💚",
  "assets": {
   "fx": "fx/skills/j1_beibei_4.webp",
   "icon": "fx/skills/icons/icon_j1_beibei_4.webp",
   "sfx": "sfx/skills/sfx_skill_j1_beibei_4.mp3"
  }
 },
 {
  "id": "h1_asuan_1",
  "seg": "H",
  "char": "阿算",
  "charId": "asuan",
  "major": "数学",
  "name": "数字风暴",
  "type": "atk",
  "effect": "A14",
  "effectText": "答对伤害 ×1.4",
  "cd": 3,
  "anim": "（r4 已有）矢量箭头与数字旋成风暴",
  "durMs": 1200,
  "srcDurMs": 1200,
  "colors": [
   "#29B6F6",
   "#E1F5FE"
  ],
  "particles": 40,
  "sfxNote": "合成器上扫 +「嘭」",
  "recipe": "burst",
  "glyphs": [
   "0",
   "1",
   "2",
   "3",
   "4",
   "5"
  ],
  "icon": "🍃",
  "assets": {
   "fx": "fx/skills/h1_asuan_1.webp",
   "icon": "fx/skills/icons/icon_h1_asuan_1.webp",
   "sfx": "sfx/skills/sfx_skill_h1_asuan_1.mp3"
  }
 },
 {
  "id": "h1_asuan_2",
  "seg": "H",
  "char": "阿算",
  "charId": "asuan",
  "major": "数学",
  "name": "函数斩",
  "type": "atk",
  "effect": "A2H",
  "effectText": "答对攻击 2 次，每次 70%",
  "cd": 3,
  "anim": "一条正弦曲线化作两段光刃依次斩过",
  "durMs": 1100,
  "srcDurMs": 1100,
  "colors": [
   "#FFB300",
   "#FFF8E1"
  ],
  "particles": 12,
  "sfxNote": "两声金属斩",
  "recipe": "slash",
  "glyphs": [
   "+",
   "−",
   "×",
   "÷",
   "="
  ],
  "icon": "⚔️",
  "assets": {
   "fx": "fx/skills/h1_asuan_2.webp",
   "icon": "fx/skills/icons/icon_h1_asuan_2.webp",
   "sfx": "sfx/skills/sfx_skill_h1_asuan_2.mp3"
  }
 },
 {
  "id": "h1_asuan_3",
  "seg": "H",
  "char": "阿算",
  "charId": "asuan",
  "major": "数学",
  "name": "向量偏转",
  "type": "control",
  "effect": "C",
  "effectText": "怪物下一个意图降级（⚔→发呆、💥→⚔、🛡/⚡→取消）",
  "cd": 4,
  "anim": "怪物攻击箭头被一道向量力场推偏，意图图标降级",
  "durMs": 1000,
  "srcDurMs": 1000,
  "colors": [
   "#26C6DA"
  ],
  "particles": 12,
  "sfxNote": "低频「嗡—」",
  "recipe": "control",
  "glyphs": [
   "+",
   "−",
   "×",
   "÷",
   "="
  ],
  "icon": "🧲",
  "assets": {
   "fx": "fx/skills/h1_asuan_3.webp",
   "icon": "fx/skills/icons/icon_h1_asuan_3.webp",
   "sfx": "sfx/skills/sfx_skill_h1_asuan_3.mp3"
  }
 },
 {
  "id": "h1_asuan_4",
  "seg": "H",
  "char": "阿算",
  "charId": "asuan",
  "major": "数学",
  "name": "几何壁垒",
  "type": "guard",
  "effect": "G70",
  "effectText": "护体：下一次受伤 ×0.7",
  "cd": 3,
  "anim": "正多面体线框在阿算身前展开",
  "durMs": 1000,
  "srcDurMs": 1000,
  "colors": [
   "#4DD0E1"
  ],
  "particles": 12,
  "sfxNote": "护盾展开音",
  "recipe": "shield",
  "glyphs": [
   "+",
   "−",
   "×",
   "÷",
   "="
  ],
  "icon": "🔷",
  "assets": {
   "fx": "fx/skills/h1_asuan_4.webp",
   "icon": "fx/skills/icons/icon_h1_asuan_4.webp",
   "sfx": "sfx/skills/sfx_skill_h1_asuan_4.mp3"
  }
 },
 {
  "id": "h1_xiaomo_1",
  "seg": "H",
  "char": "小墨",
  "charId": "xiaomo",
  "major": "语文",
  "name": "墨韵护体",
  "type": "guard",
  "effect": "G70",
  "effectText": "护体：下一次受伤 ×0.7",
  "cd": 3,
  "anim": "（r4 已有）墨龙环身成屏障",
  "durMs": 1000,
  "srcDurMs": 1000,
  "colors": [
   "#3F51B5"
  ],
  "particles": 25,
  "sfxNote": "古筝 + 低鼓",
  "recipe": "shield",
  "glyphs": [
   "文",
   "字",
   "书"
  ],
  "icon": "🛡️",
  "assets": {
   "fx": "fx/skills/h1_xiaomo_1.webp",
   "icon": "fx/skills/icons/icon_h1_xiaomo_1.webp",
   "sfx": "sfx/skills/sfx_skill_h1_xiaomo_1.mp3"
  }
 },
 {
  "id": "h1_xiaomo_2",
  "seg": "H",
  "char": "小墨",
  "charId": "xiaomo",
  "major": "语文",
  "name": "笔落惊风",
  "type": "atk",
  "effect": "A13P",
  "effectText": "答对伤害 ×1.3，无视护盾",
  "cd": 3,
  "anim": "巨笔一划，墨刃穿透护盾",
  "durMs": 1100,
  "srcDurMs": 1100,
  "colors": [
   "#212121",
   "#FF5252"
  ],
  "particles": 12,
  "sfxNote": "重笔「唰」",
  "recipe": "shield",
  "glyphs": [
   "文",
   "字",
   "书"
  ],
  "icon": "🖌️",
  "assets": {
   "fx": "fx/skills/h1_xiaomo_2.webp",
   "icon": "fx/skills/icons/icon_h1_xiaomo_2.webp",
   "sfx": "sfx/skills/sfx_skill_h1_xiaomo_2.mp3"
  }
 },
 {
  "id": "h1_xiaomo_3",
  "seg": "H",
  "char": "小墨",
  "charId": "xiaomo",
  "major": "语文",
  "name": "以文载道",
  "type": "atk",
  "effect": "A125C",
  "effectText": "答对伤害 ×1.25，连击额外 +1",
  "cd": 3,
  "anim": "古籍翻页，文字化作金色箭雨",
  "durMs": 1200,
  "srcDurMs": 1200,
  "colors": [
   "#FFD54F"
  ],
  "particles": 30,
  "sfxNote": "翻书 + 箭雨",
  "recipe": "rain",
  "glyphs": [
   "文",
   "字",
   "书"
  ],
  "icon": "🏹",
  "assets": {
   "fx": "fx/skills/h1_xiaomo_3.webp",
   "icon": "fx/skills/icons/icon_h1_xiaomo_3.webp",
   "sfx": "sfx/skills/sfx_skill_h1_xiaomo_3.mp3"
  }
 },
 {
  "id": "h1_xiaomo_4",
  "seg": "H",
  "char": "小墨",
  "charId": "xiaomo",
  "major": "语文",
  "name": "清心",
  "type": "guard",
  "effect": "F1",
  "effectText": "解除 1 个负面状态，专注 +1",
  "cd": 4,
  "anim": "墨色涟漪扩散，洗掉身上负面状态图标",
  "durMs": 1000,
  "srcDurMs": 1000,
  "colors": [
   "#80CBC4"
  ],
  "particles": 2,
  "sfxNote": "水滴回响",
  "recipe": "ring",
  "glyphs": [
   "文",
   "字",
   "书"
  ],
  "icon": "💧",
  "assets": {
   "fx": "fx/skills/h1_xiaomo_4.webp",
   "icon": "fx/skills/icons/icon_h1_xiaomo_4.webp",
   "sfx": "sfx/skills/sfx_skill_h1_xiaomo_4.mp3"
  }
 },
 {
  "id": "h1_lexi_1",
  "seg": "H",
  "char": "Lexi",
  "charId": "lexi",
  "major": "英语",
  "name": "Echo 回声",
  "type": "atk",
  "effect": "A2H",
  "effectText": "答对攻击 2 次，每次 70%",
  "cd": 3,
  "anim": "（r4 已有）星光声波两连",
  "durMs": 1100,
  "srcDurMs": 1100,
  "colors": [
   "#AB47BC",
   "#E1BEE7"
  ],
  "particles": 25,
  "sfxNote": "回声合成器",
  "recipe": "ring",
  "glyphs": [
   "A",
   "B",
   "C"
  ],
  "icon": "⭐",
  "assets": {
   "fx": "fx/skills/h1_lexi_1.webp",
   "icon": "fx/skills/icons/icon_h1_lexi_1.webp",
   "sfx": "sfx/skills/sfx_skill_h1_lexi_1.mp3"
  }
 },
 {
  "id": "h1_lexi_2",
  "seg": "H",
  "char": "Lexi",
  "charId": "lexi",
  "major": "英语",
  "name": "Starlight Lexicon",
  "type": "atk",
  "effect": "A14",
  "effectText": "答对伤害 ×1.4",
  "cd": 3,
  "anim": "星图中的单词连成星座落向怪物",
  "durMs": 1300,
  "srcDurMs": 1300,
  "colors": [
   "#7C4DFF",
   "#FFFFFF"
  ],
  "particles": 40,
  "sfxNote": "星光琶音",
  "recipe": "projectile",
  "glyphs": [
   "A",
   "B",
   "C"
  ],
  "icon": "⭐",
  "assets": {
   "fx": "fx/skills/h1_lexi_2.webp",
   "icon": "fx/skills/icons/icon_h1_lexi_2.webp",
   "sfx": "sfx/skills/sfx_skill_h1_lexi_2.mp3"
  }
 },
 {
  "id": "h1_lexi_3",
  "seg": "H",
  "char": "Lexi",
  "charId": "lexi",
  "major": "英语",
  "name": "Mute",
  "type": "control",
  "effect": "C",
  "effectText": "怪物下一个意图降级（⚔→发呆、💥→⚔、🛡/⚡→取消）",
  "cd": 4,
  "anim": "怪物嘴上出现静音符号，下一招降级",
  "durMs": 1000,
  "srcDurMs": 1000,
  "colors": [
   "#B0BEC5"
  ],
  "particles": 12,
  "sfxNote": "「嘘」",
  "recipe": "control",
  "glyphs": [
   "A",
   "B",
   "C"
  ],
  "icon": "🔇",
  "assets": {
   "fx": "fx/skills/h1_lexi_3.webp",
   "icon": "fx/skills/icons/icon_h1_lexi_3.webp",
   "sfx": "sfx/skills/sfx_skill_h1_lexi_3.mp3"
  }
 },
 {
  "id": "h1_lexi_4",
  "seg": "H",
  "char": "Lexi",
  "charId": "lexi",
  "major": "英语",
  "name": "Translation Field",
  "type": "heal",
  "effect": "H5",
  "effectText": "回复 5% 最大血量",
  "cd": 4,
  "anim": "多语言字符环绕 Lexi 并转成绿光",
  "durMs": 1000,
  "srcDurMs": 1100,
  "colors": [
   "#69F0AE"
  ],
  "particles": 20,
  "sfxNote": "治疗合成器",
  "recipe": "heal",
  "glyphs": [
   "A",
   "B",
   "C"
  ],
  "icon": "🔤",
  "assets": {
   "fx": "fx/skills/h1_lexi_4.webp",
   "icon": "fx/skills/icons/icon_h1_lexi_4.webp",
   "sfx": "sfx/skills/sfx_skill_h1_lexi_4.mp3"
  }
 },
 {
  "id": "h1_xiaobai_1",
  "seg": "H",
  "char": "小白",
  "charId": "xiaobai",
  "major": "诗词",
  "name": "月下吟",
  "type": "guard",
  "effect": "G70",
  "effectText": "护体：下一次受伤 ×0.7",
  "cd": 3,
  "anim": "（r4 已有）明月升起，月华披身",
  "durMs": 1000,
  "srcDurMs": 1200,
  "colors": [
   "#FFF9C4",
   "#7E57C2"
  ],
  "particles": 25,
  "sfxNote": "长笛",
  "recipe": "shield",
  "glyphs": [
   "❀",
   "月",
   "诗"
  ],
  "icon": "🌙",
  "assets": {
   "fx": "fx/skills/h1_xiaobai_1.webp",
   "icon": "fx/skills/icons/icon_h1_xiaobai_1.webp",
   "sfx": "sfx/skills/sfx_skill_h1_xiaobai_1.mp3"
  }
 },
 {
  "id": "h1_xiaobai_2",
  "seg": "H",
  "char": "小白",
  "charId": "xiaobai",
  "major": "诗词",
  "name": "将进酒",
  "type": "atk",
  "effect": "A14",
  "effectText": "答对伤害 ×1.4",
  "cd": 3,
  "anim": "黄河之水自天而来，水墨巨浪拍向怪物",
  "durMs": 1300,
  "srcDurMs": 1300,
  "colors": [
   "#4FC3F7"
  ],
  "particles": 40,
  "sfxNote": "浪涛 + 鼓",
  "recipe": "projectile",
  "glyphs": [
   "❀",
   "月",
   "诗"
  ],
  "icon": "🌊",
  "assets": {
   "fx": "fx/skills/h1_xiaobai_2.webp",
   "icon": "fx/skills/icons/icon_h1_xiaobai_2.webp",
   "sfx": "sfx/skills/sfx_skill_h1_xiaobai_2.mp3"
  }
 },
 {
  "id": "h1_xiaobai_3",
  "seg": "H",
  "char": "小白",
  "charId": "xiaobai",
  "major": "诗词",
  "name": "青莲剑歌",
  "type": "atk",
  "effect": "A2H",
  "effectText": "答对攻击 2 次，每次 70%",
  "cd": 3,
  "anim": "两道青色剑气交叉",
  "durMs": 1100,
  "srcDurMs": 1100,
  "colors": [
   "#26A69A"
  ],
  "particles": 12,
  "sfxNote": "剑鸣两声",
  "recipe": "slash",
  "glyphs": [
   "❀",
   "月",
   "诗"
  ],
  "icon": "🗡️",
  "assets": {
   "fx": "fx/skills/h1_xiaobai_3.webp",
   "icon": "fx/skills/icons/icon_h1_xiaobai_3.webp",
   "sfx": "sfx/skills/sfx_skill_h1_xiaobai_3.mp3"
  }
 },
 {
  "id": "h1_xiaobai_4",
  "seg": "H",
  "char": "小白",
  "charId": "xiaobai",
  "major": "诗词",
  "name": "举杯邀月",
  "type": "heal",
  "effect": "H5",
  "effectText": "回复 5% 最大血量",
  "cd": 4,
  "anim": "举杯，月光倒入杯中化为绿光",
  "durMs": 1000,
  "srcDurMs": 1100,
  "colors": [
   "#DCE775"
  ],
  "particles": 15,
  "sfxNote": "古琴一音",
  "recipe": "heal",
  "glyphs": [
   "❀",
   "月",
   "诗"
  ],
  "icon": "🌙",
  "assets": {
   "fx": "fx/skills/h1_xiaobai_4.webp",
   "icon": "fx/skills/icons/icon_h1_xiaobai_4.webp",
   "sfx": "sfx/skills/sfx_skill_h1_xiaobai_4.mp3"
  }
 },
 {
  "id": "h1_bola_1",
  "seg": "H",
  "char": "铂拉",
  "charId": "bola",
  "major": "化学",
  "name": "炼金爆裂",
  "type": "atk",
  "effect": "A13P",
  "effectText": "答对伤害 ×1.3，无视护盾",
  "cd": 3,
  "anim": "（r4 已有）反应釜抛出，彩色反应云爆开（无白闪）",
  "durMs": 1200,
  "srcDurMs": 1200,
  "colors": [
   "#66BB6A",
   "#AB47BC"
  ],
  "particles": 40,
  "sfxNote": "玻璃 + 爆鸣",
  "recipe": "projectile",
  "glyphs": [
   "⚗",
   "○",
   "◎"
  ],
  "icon": "⚗️",
  "assets": {
   "fx": "fx/skills/h1_bola_1.webp",
   "icon": "fx/skills/icons/icon_h1_bola_1.webp",
   "sfx": "sfx/skills/sfx_skill_h1_bola_1.mp3"
  }
 },
 {
  "id": "h1_bola_2",
  "seg": "H",
  "char": "铂拉",
  "charId": "bola",
  "major": "化学",
  "name": "链式反应",
  "type": "atk",
  "effect": "A125C",
  "effectText": "答对伤害 ×1.25，连击额外 +1",
  "cd": 3,
  "anim": "分子球棍模型连锁碰撞，依次亮起后撞向怪物",
  "durMs": 1200,
  "srcDurMs": 1200,
  "colors": [
   "#FF7043",
   "#FFCA28"
  ],
  "particles": 12,
  "sfxNote": "连锁「嗒嗒嗒嘭」",
  "recipe": "projectile",
  "glyphs": [
   "⚗",
   "○",
   "◎"
  ],
  "icon": "⚗️",
  "assets": {
   "fx": "fx/skills/h1_bola_2.webp",
   "icon": "fx/skills/icons/icon_h1_bola_2.webp",
   "sfx": "sfx/skills/sfx_skill_h1_bola_2.mp3"
  }
 },
 {
  "id": "h1_bola_3",
  "seg": "H",
  "char": "铂拉",
  "charId": "bola",
  "major": "化学",
  "name": "惰性气体屏障",
  "type": "guard",
  "effect": "G70",
  "effectText": "护体：下一次受伤 ×0.7",
  "cd": 3,
  "anim": "淡紫色辉光气罩包裹铂拉（缓慢呼吸，不闪）",
  "durMs": 1000,
  "srcDurMs": 1000,
  "colors": [
   "#B39DDB"
  ],
  "particles": 20,
  "sfxNote": "低频嗡",
  "recipe": "shield",
  "glyphs": [
   "⚗",
   "○",
   "◎"
  ],
  "icon": "🛡️",
  "assets": {
   "fx": "fx/skills/h1_bola_3.webp",
   "icon": "fx/skills/icons/icon_h1_bola_3.webp",
   "sfx": "sfx/skills/sfx_skill_h1_bola_3.mp3"
  }
 },
 {
  "id": "h1_bola_4",
  "seg": "H",
  "char": "铂拉",
  "charId": "bola",
  "major": "化学",
  "name": "催化剂",
  "type": "guard",
  "effect": "F1",
  "effectText": "解除 1 个负面状态，专注 +1",
  "cd": 4,
  "anim": "金色催化剂粉末洒下，清除负面状态并点亮专注图标",
  "durMs": 1000,
  "srcDurMs": 1000,
  "colors": [
   "#FFD54F"
  ],
  "particles": 20,
  "sfxNote": "闪粉沙沙",
  "recipe": "shield",
  "glyphs": [
   "⚗",
   "○",
   "◎"
  ],
  "icon": "⚗️",
  "assets": {
   "fx": "fx/skills/h1_bola_4.webp",
   "icon": "fx/skills/icons/icon_h1_bola_4.webp",
   "sfx": "sfx/skills/sfx_skill_h1_bola_4.mp3"
  }
 }
];
