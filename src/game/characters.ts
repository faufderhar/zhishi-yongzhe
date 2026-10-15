/* 美术替换：只需用同名文件覆盖 public/art/ 下的图片（见 public/art/README.md）。 */
export interface Character { id: string; name: string; img: string; webp?: string; major: string; desc: string; emoji: string }
const A = (p: string) => `${import.meta.env.BASE_URL}art/${p}`;
const W = (c: Omit<Character, 'webp'>): Character => ({ ...c, webp: c.img.replace(/\.png$/, '.webp') });
/** 小狗救援队：幼儿园 + 初一 */
export const PUPS: Character[] = [
  W({ id: 'suansuan', name: '算算', img: A('pups/pup_math_suansuan.png'), major: '数学', emoji: '🐶', desc: '数学题伤害 ×1.2，再 +10%' }),
  W({ id: 'momo', name: '墨墨', img: A('pups/pup_chinese_momo.png'), major: '语文', emoji: '🐶', desc: '语文题伤害 ×1.2，答对回复 3 血' }),
  W({ id: 'abei', name: '阿贝', img: A('pups/pup_english_abei.png'), major: '英语', emoji: '🐶', desc: '英语题伤害 ×1.2，首次答错不断连击' }),
  W({ id: 'shishi', name: '诗诗', img: A('pups/pup_poetry_shishi.png'), major: '诗词', emoji: '🐩', desc: '诗词题伤害 ×1.2' }),
  W({ id: 'beibei', name: '杯杯', img: A('pups/pup_chem_beibei.png'), major: '化学', emoji: '🐶', desc: '化学题伤害 ×1.2' }),
];
/** 高一「熵之塔」科幻立绘 */
export const SCIFI: Character[] = [
  W({ id: 'asuan', name: '数理骑士·阿算', img: A('chars/char_math_asuan_sprite.png'), major: '数学', emoji: '🛡️', desc: '数学题伤害 ×1.2，再 +10%' }),
  W({ id: 'xiaomo', name: '墨灵书生·小墨', img: A('chars/char_chinese_xiaomo_sprite.png'), major: '语文', emoji: '🖌️', desc: '语文题伤害 ×1.2，答对回复 3 血' }),
  W({ id: 'lexi', name: '星语旅者·Lexi', img: A('chars/char_english_lexi_sprite.png'), major: '英语', emoji: '🌟', desc: '英语题伤害 ×1.2，首次答错不断连击' }),
  W({ id: 'xiaobai', name: '诗仙·小白', img: A('chars/char_poetry_xiaobai_sprite.png'), major: '诗词', emoji: '🌙', desc: '诗词题伤害 ×1.2' }),
  W({ id: 'bola', name: '炼金师·铂拉', img: A('chars/char_alchemist_bola_sprite.png'), major: '化学', emoji: '⚗️', desc: '化学题伤害 ×1.2' }),
];
export const MONSTER_IMG = {
  kinder: A('monsters/mon_k_naughty_cloud_sprite.png'),
  k: A('monsters/mon_k_sticky_jelly_sprite.png'),
  j: A('monsters/mon_j_number_goblin_sprite.png'),
  jb: A('monsters/mon_j_ink_slime_sprite.png'),
  h: A('monsters/mon_h_inertia_ghost_sprite.png'),
  hb: A('monsters/mon_h_entropy_warden_sprite.png'),
};
/** 被动按主修科目判断（与角色 id 无关，便于换皮） */
export const passive = {
  mathBonus: (c: Character) => c.major === '数学',
  heal: (c: Character) => c.major === '语文',
  comboGuard: (c: Character) => c.major === '英语',
};
