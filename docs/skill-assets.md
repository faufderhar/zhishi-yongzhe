# 技能素材键（自动生成，`python3 scripts/gen-skills.py`）

程序化特效已覆盖全部 85 个技能。美术/音频到位后，把文件放到 `public/` 下对应路径，并在 `public/fx/manifest.json` 的 `skills` 数组里登记技能 id，即自动替换程序化特效（未登记的不发请求）：
- `fx`：序列帧 webp（横排 ≤12 帧，单帧 ≤512×512，≤150 KB）
- `icon`：128×128 技能图标
- `sfx`：已交付（`public/sfx/skills/`，小班另有 `skills/kindergarten/` −6 dB 版），运行时按 `public/sfx/skills-manifest.json` 查找，详见 `public/sfx/README.md`

| id | 学段 | 角色 | 技能 | 类型 | 程序化配方 | 时长 ms | 粒子上限 | fx | icon | sfx |
|---|---|---|---|---|---|---|---|---|---|---|
| k_suansuan_1 | K | 算算 | 数字泡泡 | visual | rise | 1000 | 12 | `fx/skills/k_suansuan_1.webp` | `fx/skills/icons/icon_k_suansuan_1.webp` | `sfx/skills/sfx_skill_k_suansuan_1.mp3` |
| k_suansuan_2 | K | 算算 | 积木城堡 | visual | rain | 1200 | 12 | `fx/skills/k_suansuan_2.webp` | `fx/skills/icons/icon_k_suansuan_2.webp` | `sfx/skills/sfx_skill_k_suansuan_2.mp3` |
| k_suansuan_3 | K | 算算 | 彩虹算珠 | visual | projectile | 1000 | 7 | `fx/skills/k_suansuan_3.webp` | `fx/skills/icons/icon_k_suansuan_3.webp` | `sfx/skills/sfx_skill_k_suansuan_3.mp3` |
| k_momo_1 | K | 墨墨 | 毛笔画小花 | visual | burst | 1200 | 10 | `fx/skills/k_momo_1.webp` | `fx/skills/icons/icon_k_momo_1.webp` | `sfx/skills/sfx_skill_k_momo_1.mp3` |
| k_momo_2 | K | 墨墨 | 墨点变蝴蝶 | visual | rain | 1200 | 2 | `fx/skills/k_momo_2.webp` | `fx/skills/icons/icon_k_momo_2.webp` | `sfx/skills/sfx_skill_k_momo_2.mp3` |
| k_momo_3 | K | 墨墨 | 小书本抱抱 | visual | rise | 1000 | 8 | `fx/skills/k_momo_3.webp` | `fx/skills/icons/icon_k_momo_3.webp` | `sfx/skills/sfx_skill_k_momo_3.mp3` |
| k_abei_1 | K | 阿贝 | ABC 气球 | visual | burst | 1200 | 3 | `fx/skills/k_abei_1.webp` | `fx/skills/icons/icon_k_abei_1.webp` | `sfx/skills/sfx_skill_k_abei_1.mp3` |
| k_abei_2 | K | 阿贝 | Hello 挥手 | visual | rise | 1000 | 12 | `fx/skills/k_abei_2.webp` | `fx/skills/icons/icon_k_abei_2.webp` | `sfx/skills/sfx_skill_k_abei_2.mp3` |
| k_abei_3 | K | 阿贝 | 字母小火车 | visual | projectile | 1200 | 6 | `fx/skills/k_abei_3.webp` | `fx/skills/icons/icon_k_abei_3.webp` | `sfx/skills/sfx_skill_k_abei_3.mp3` |
| k_shishi_1 | K | 诗诗 | 月亮摇篮 | visual | rain | 1200 | 10 | `fx/skills/k_shishi_1.webp` | `fx/skills/icons/icon_k_shishi_1.webp` | `sfx/skills/sfx_skill_k_shishi_1.mp3` |
| k_shishi_2 | K | 诗诗 | 花瓣飘飘 | visual | rain | 1000 | 15 | `fx/skills/k_shishi_2.webp` | `fx/skills/icons/icon_k_shishi_2.webp` | `sfx/skills/sfx_skill_k_shishi_2.mp3` |
| k_shishi_3 | K | 诗诗 | 小星星亮亮 | visual | rise | 1200 | 12 | `fx/skills/k_shishi_3.webp` | `fx/skills/icons/icon_k_shishi_3.webp` | `sfx/skills/sfx_skill_k_shishi_3.mp3` |
| k_beibei_1 | K | 杯杯 | 七彩泡泡 | visual | rise | 1000 | 12 | `fx/skills/k_beibei_1.webp` | `fx/skills/icons/icon_k_beibei_1.webp` | `sfx/skills/sfx_skill_k_beibei_1.mp3` |
| k_beibei_2 | K | 杯杯 | 小苗长大 | visual | rise | 1200 | 12 | `fx/skills/k_beibei_2.webp` | `fx/skills/icons/icon_k_beibei_2.webp` | `sfx/skills/sfx_skill_k_beibei_2.mp3` |
| k_beibei_3 | K | 杯杯 | 水滴变彩虹 | visual | rain | 1200 | 12 | `fx/skills/k_beibei_3.webp` | `fx/skills/icons/icon_k_beibei_3.webp` | `sfx/skills/sfx_skill_k_beibei_3.mp3` |
| p12_suansuan_1 | P12 | 算算 | 加法小火箭 | visual | projectile | 1000 | 20 | `fx/skills/p12_suansuan_1.webp` | `fx/skills/icons/icon_p12_suansuan_1.webp` | `sfx/skills/sfx_skill_p12_suansuan_1.mp3` |
| p12_suansuan_2 | P12 | 算算 | 数字积木雨 | visual | rain | 1200 | 10 | `fx/skills/p12_suansuan_2.webp` | `fx/skills/icons/icon_p12_suansuan_2.webp` | `sfx/skills/sfx_skill_p12_suansuan_2.mp3` |
| p12_suansuan_3 | P12 | 算算 | 尺子小剑 | visual | slash | 800 | 12 | `fx/skills/p12_suansuan_3.webp` | `fx/skills/icons/icon_p12_suansuan_3.webp` | `sfx/skills/sfx_skill_p12_suansuan_3.mp3` |
| p12_momo_1 | P12 | 墨墨 | 笔画飞镖 | visual | projectile | 900 | 15 | `fx/skills/p12_momo_1.webp` | `fx/skills/icons/icon_p12_momo_1.webp` | `sfx/skills/sfx_skill_p12_momo_1.mp3` |
| p12_momo_2 | P12 | 墨墨 | 汉字小盾 | visual | burst | 1000 | 15 | `fx/skills/p12_momo_2.webp` | `fx/skills/icons/icon_p12_momo_2.webp` | `sfx/skills/sfx_skill_p12_momo_2.mp3` |
| p12_momo_3 | P12 | 墨墨 | 识字灯笼 | visual | rise | 1200 | 12 | `fx/skills/p12_momo_3.webp` | `fx/skills/icons/icon_p12_momo_3.webp` | `sfx/skills/sfx_skill_p12_momo_3.mp3` |
| p12_abei_1 | P12 | 阿贝 | 单词蝴蝶 | visual | projectile | 1200 | 12 | `fx/skills/p12_abei_1.webp` | `fx/skills/icons/icon_p12_abei_1.webp` | `sfx/skills/sfx_skill_p12_abei_1.mp3` |
| p12_abei_2 | P12 | 阿贝 | Phonics 鼓点 | visual | burst | 1000 | 5 | `fx/skills/p12_abei_2.webp` | `fx/skills/icons/icon_p12_abei_2.webp` | `sfx/skills/sfx_skill_p12_abei_2.mp3` |
| p12_abei_3 | P12 | 阿贝 | ABC 泡泡盾 | visual | shield | 1000 | 10 | `fx/skills/p12_abei_3.webp` | `fx/skills/icons/icon_p12_abei_3.webp` | `sfx/skills/sfx_skill_p12_abei_3.mp3` |
| p12_shishi_1 | P12 | 诗诗 | 春风吹 | visual | burst | 1000 | 20 | `fx/skills/p12_shishi_1.webp` | `fx/skills/icons/icon_p12_shishi_1.webp` | `sfx/skills/sfx_skill_p12_shishi_1.mp3` |
| p12_shishi_2 | P12 | 诗诗 | 古诗小船 | visual | projectile | 1200 | 2 | `fx/skills/p12_shishi_2.webp` | `fx/skills/icons/icon_p12_shishi_2.webp` | `sfx/skills/sfx_skill_p12_shishi_2.mp3` |
| p12_shishi_3 | P12 | 诗诗 | 萤火虫 | visual | burst | 1200 | 10 | `fx/skills/p12_shishi_3.webp` | `fx/skills/icons/icon_p12_shishi_3.webp` | `sfx/skills/sfx_skill_p12_shishi_3.mp3` |
| p12_beibei_1 | P12 | 杯杯 | 泡泡弹 | visual | projectile | 900 | 12 | `fx/skills/p12_beibei_1.webp` | `fx/skills/icons/icon_p12_beibei_1.webp` | `sfx/skills/sfx_skill_p12_beibei_1.mp3` |
| p12_beibei_2 | P12 | 杯杯 | 种子发芽 | visual | rise | 1000 | 8 | `fx/skills/p12_beibei_2.webp` | `fx/skills/icons/icon_p12_beibei_2.webp` | `sfx/skills/sfx_skill_p12_beibei_2.mp3` |
| p12_beibei_3 | P12 | 杯杯 | 小火山 | visual | projectile | 1200 | 20 | `fx/skills/p12_beibei_3.webp` | `fx/skills/icons/icon_p12_beibei_3.webp` | `sfx/skills/sfx_skill_p12_beibei_3.mp3` |
| p36_suansuan_1 | P36 | 算算 | 数字风暴 | atk | projectile | 1200 | 30 | `fx/skills/p36_suansuan_1.webp` | `fx/skills/icons/icon_p36_suansuan_1.webp` | `sfx/skills/sfx_skill_p36_suansuan_1.mp3` |
| p36_suansuan_2 | P36 | 算算 | 乘法连击 | atk | slash | 1100 | 20 | `fx/skills/p36_suansuan_2.webp` | `fx/skills/icons/icon_p36_suansuan_2.webp` | `sfx/skills/sfx_skill_p36_suansuan_2.mp3` |
| p36_suansuan_3 | P36 | 算算 | 方程护盾 | guard | shield | 1000 | 12 | `fx/skills/p36_suansuan_3.webp` | `fx/skills/icons/icon_p36_suansuan_3.webp` | `sfx/skills/sfx_skill_p36_suansuan_3.mp3` |
| p36_momo_1 | P36 | 墨墨 | 妙笔生花 | atk | burst | 1300 | 25 | `fx/skills/p36_momo_1.webp` | `fx/skills/icons/icon_p36_momo_1.webp` | `sfx/skills/sfx_skill_p36_momo_1.mp3` |
| p36_momo_2 | P36 | 墨墨 | 墨韵护体 | guard | shield | 1000 | 20 | `fx/skills/p36_momo_2.webp` | `fx/skills/icons/icon_p36_momo_2.webp` | `sfx/skills/sfx_skill_p36_momo_2.mp3` |
| p36_momo_3 | P36 | 墨墨 | 成语回春 | heal | heal | 1000 | 15 | `fx/skills/p36_momo_3.webp` | `fx/skills/icons/icon_p36_momo_3.webp` | `sfx/skills/sfx_skill_p36_momo_3.mp3` |
| p36_abei_1 | P36 | 阿贝 | Echo 回声 | atk | ring | 1100 | 2 | `fx/skills/p36_abei_1.webp` | `fx/skills/icons/icon_p36_abei_1.webp` | `sfx/skills/sfx_skill_p36_abei_1.mp3` |
| p36_abei_2 | P36 | 阿贝 | 字母飞镖 | atk | shield | 1000 | 12 | `fx/skills/p36_abei_2.webp` | `fx/skills/icons/icon_p36_abei_2.webp` | `sfx/skills/sfx_skill_p36_abei_2.mp3` |
| p36_abei_3 | P36 | 阿贝 | Stop! | control | control | 1000 | 12 | `fx/skills/p36_abei_3.webp` | `fx/skills/icons/icon_p36_abei_3.webp` | `sfx/skills/sfx_skill_p36_abei_3.mp3` |
| p36_shishi_1 | P36 | 诗诗 | 月下吟 | guard | shield | 1000 | 20 | `fx/skills/p36_shishi_1.webp` | `fx/skills/icons/icon_p36_shishi_1.webp` | `sfx/skills/sfx_skill_p36_shishi_1.mp3` |
| p36_shishi_2 | P36 | 诗诗 | 飞花令 | atk | projectile | 1200 | 20 | `fx/skills/p36_shishi_2.webp` | `fx/skills/icons/icon_p36_shishi_2.webp` | `sfx/skills/sfx_skill_p36_shishi_2.mp3` |
| p36_shishi_3 | P36 | 诗诗 | 春眠不觉晓 | control | control | 1000 | 12 | `fx/skills/p36_shishi_3.webp` | `fx/skills/icons/icon_p36_shishi_3.webp` | `sfx/skills/sfx_skill_p36_shishi_3.mp3` |
| p36_beibei_1 | P36 | 杯杯 | 炼金爆裂 | atk | projectile | 1200 | 30 | `fx/skills/p36_beibei_1.webp` | `fx/skills/icons/icon_p36_beibei_1.webp` | `sfx/skills/sfx_skill_p36_beibei_1.mp3` |
| p36_beibei_2 | P36 | 杯杯 | 酸碱中和 | guard | shield | 1000 | 16 | `fx/skills/p36_beibei_2.webp` | `fx/skills/icons/icon_p36_beibei_2.webp` | `sfx/skills/sfx_skill_p36_beibei_2.mp3` |
| p36_beibei_3 | P36 | 杯杯 | 光合作用 | heal | heal | 1000 | 15 | `fx/skills/p36_beibei_3.webp` | `fx/skills/icons/icon_p36_beibei_3.webp` | `sfx/skills/sfx_skill_p36_beibei_3.mp3` |
| j1_suansuan_1 | J | 算算 | 数字风暴 | atk | burst | 1200 | 40 | `fx/skills/j1_suansuan_1.webp` | `fx/skills/icons/icon_j1_suansuan_1.webp` | `sfx/skills/sfx_skill_j1_suansuan_1.mp3` |
| j1_suansuan_2 | J | 算算 | 数轴突刺 | atk | projectile | 1000 | 20 | `fx/skills/j1_suansuan_2.webp` | `fx/skills/icons/icon_j1_suansuan_2.webp` | `sfx/skills/sfx_skill_j1_suansuan_2.mp3` |
| j1_suansuan_3 | J | 算算 | 坐标锁定 | control | control | 1000 | 12 | `fx/skills/j1_suansuan_3.webp` | `fx/skills/icons/icon_j1_suansuan_3.webp` | `sfx/skills/sfx_skill_j1_suansuan_3.mp3` |
| j1_suansuan_4 | J | 算算 | 绝对值护盾 | guard | shield | 1000 | 12 | `fx/skills/j1_suansuan_4.webp` | `fx/skills/icons/icon_j1_suansuan_4.webp` | `sfx/skills/sfx_skill_j1_suansuan_4.mp3` |
| j1_momo_1 | J | 墨墨 | 妙笔生花 | atk | burst | 1300 | 30 | `fx/skills/j1_momo_1.webp` | `fx/skills/icons/icon_j1_momo_1.webp` | `sfx/skills/sfx_skill_j1_momo_1.mp3` |
| j1_momo_2 | J | 墨墨 | 文言飞白 | atk | shield | 1000 | 12 | `fx/skills/j1_momo_2.webp` | `fx/skills/icons/icon_j1_momo_2.webp` | `sfx/skills/sfx_skill_j1_momo_2.mp3` |
| j1_momo_3 | J | 墨墨 | 墨韵护体 | guard | shield | 1000 | 20 | `fx/skills/j1_momo_3.webp` | `fx/skills/icons/icon_j1_momo_3.webp` | `sfx/skills/sfx_skill_j1_momo_3.mp3` |
| j1_momo_4 | J | 墨墨 | 成语回春 | heal | heal | 1000 | 15 | `fx/skills/j1_momo_4.webp` | `fx/skills/icons/icon_j1_momo_4.webp` | `sfx/skills/sfx_skill_j1_momo_4.mp3` |
| j1_abei_1 | J | 阿贝 | Echo 回声 | atk | burst | 1100 | 12 | `fx/skills/j1_abei_1.webp` | `fx/skills/icons/icon_j1_abei_1.webp` | `sfx/skills/sfx_skill_j1_abei_1.mp3` |
| j1_abei_2 | J | 阿贝 | 语法连锁 | atk | projectile | 1100 | 15 | `fx/skills/j1_abei_2.webp` | `fx/skills/icons/icon_j1_abei_2.webp` | `sfx/skills/sfx_skill_j1_abei_2.mp3` |
| j1_abei_3 | J | 阿贝 | Stop! | control | control | 1000 | 12 | `fx/skills/j1_abei_3.webp` | `fx/skills/icons/icon_j1_abei_3.webp` | `sfx/skills/sfx_skill_j1_abei_3.mp3` |
| j1_abei_4 | J | 阿贝 | Word Shield | guard | shield | 1000 | 12 | `fx/skills/j1_abei_4.webp` | `fx/skills/icons/icon_j1_abei_4.webp` | `sfx/skills/sfx_skill_j1_abei_4.mp3` |
| j1_shishi_1 | J | 诗诗 | 飞花令 | atk | burst | 1200 | 25 | `fx/skills/j1_shishi_1.webp` | `fx/skills/icons/icon_j1_shishi_1.webp` | `sfx/skills/sfx_skill_j1_shishi_1.mp3` |
| j1_shishi_2 | J | 诗诗 | 大江东去 | atk | shield | 1300 | 30 | `fx/skills/j1_shishi_2.webp` | `fx/skills/icons/icon_j1_shishi_2.webp` | `sfx/skills/sfx_skill_j1_shishi_2.mp3` |
| j1_shishi_3 | J | 诗诗 | 月下吟 | guard | shield | 1000 | 20 | `fx/skills/j1_shishi_3.webp` | `fx/skills/icons/icon_j1_shishi_3.webp` | `sfx/skills/sfx_skill_j1_shishi_3.mp3` |
| j1_shishi_4 | J | 诗诗 | 春眠不觉晓 | control | control | 1000 | 12 | `fx/skills/j1_shishi_4.webp` | `fx/skills/icons/icon_j1_shishi_4.webp` | `sfx/skills/sfx_skill_j1_shishi_4.mp3` |
| j1_beibei_1 | J | 杯杯 | 炼金爆裂 | atk | burst | 1200 | 30 | `fx/skills/j1_beibei_1.webp` | `fx/skills/icons/icon_j1_beibei_1.webp` | `sfx/skills/sfx_skill_j1_beibei_1.mp3` |
| j1_beibei_2 | J | 杯杯 | 催化连击 | atk | projectile | 1100 | 20 | `fx/skills/j1_beibei_2.webp` | `fx/skills/icons/icon_j1_beibei_2.webp` | `sfx/skills/sfx_skill_j1_beibei_2.mp3` |
| j1_beibei_3 | J | 杯杯 | 酸碱中和 | guard | shield | 1000 | 16 | `fx/skills/j1_beibei_3.webp` | `fx/skills/icons/icon_j1_beibei_3.webp` | `sfx/skills/sfx_skill_j1_beibei_3.mp3` |
| j1_beibei_4 | J | 杯杯 | 光合作用 | heal | heal | 1000 | 15 | `fx/skills/j1_beibei_4.webp` | `fx/skills/icons/icon_j1_beibei_4.webp` | `sfx/skills/sfx_skill_j1_beibei_4.mp3` |
| h1_asuan_1 | H | 阿算 | 数字风暴 | atk | burst | 1200 | 40 | `fx/skills/h1_asuan_1.webp` | `fx/skills/icons/icon_h1_asuan_1.webp` | `sfx/skills/sfx_skill_h1_asuan_1.mp3` |
| h1_asuan_2 | H | 阿算 | 函数斩 | atk | slash | 1100 | 12 | `fx/skills/h1_asuan_2.webp` | `fx/skills/icons/icon_h1_asuan_2.webp` | `sfx/skills/sfx_skill_h1_asuan_2.mp3` |
| h1_asuan_3 | H | 阿算 | 向量偏转 | control | control | 1000 | 12 | `fx/skills/h1_asuan_3.webp` | `fx/skills/icons/icon_h1_asuan_3.webp` | `sfx/skills/sfx_skill_h1_asuan_3.mp3` |
| h1_asuan_4 | H | 阿算 | 几何壁垒 | guard | shield | 1000 | 12 | `fx/skills/h1_asuan_4.webp` | `fx/skills/icons/icon_h1_asuan_4.webp` | `sfx/skills/sfx_skill_h1_asuan_4.mp3` |
| h1_xiaomo_1 | H | 小墨 | 墨韵护体 | guard | shield | 1000 | 25 | `fx/skills/h1_xiaomo_1.webp` | `fx/skills/icons/icon_h1_xiaomo_1.webp` | `sfx/skills/sfx_skill_h1_xiaomo_1.mp3` |
| h1_xiaomo_2 | H | 小墨 | 笔落惊风 | atk | shield | 1100 | 12 | `fx/skills/h1_xiaomo_2.webp` | `fx/skills/icons/icon_h1_xiaomo_2.webp` | `sfx/skills/sfx_skill_h1_xiaomo_2.mp3` |
| h1_xiaomo_3 | H | 小墨 | 以文载道 | atk | rain | 1200 | 30 | `fx/skills/h1_xiaomo_3.webp` | `fx/skills/icons/icon_h1_xiaomo_3.webp` | `sfx/skills/sfx_skill_h1_xiaomo_3.mp3` |
| h1_xiaomo_4 | H | 小墨 | 清心 | guard | ring | 1000 | 2 | `fx/skills/h1_xiaomo_4.webp` | `fx/skills/icons/icon_h1_xiaomo_4.webp` | `sfx/skills/sfx_skill_h1_xiaomo_4.mp3` |
| h1_lexi_1 | H | Lexi | Echo 回声 | atk | ring | 1100 | 25 | `fx/skills/h1_lexi_1.webp` | `fx/skills/icons/icon_h1_lexi_1.webp` | `sfx/skills/sfx_skill_h1_lexi_1.mp3` |
| h1_lexi_2 | H | Lexi | Starlight Lexicon | atk | projectile | 1300 | 40 | `fx/skills/h1_lexi_2.webp` | `fx/skills/icons/icon_h1_lexi_2.webp` | `sfx/skills/sfx_skill_h1_lexi_2.mp3` |
| h1_lexi_3 | H | Lexi | Mute | control | control | 1000 | 12 | `fx/skills/h1_lexi_3.webp` | `fx/skills/icons/icon_h1_lexi_3.webp` | `sfx/skills/sfx_skill_h1_lexi_3.mp3` |
| h1_lexi_4 | H | Lexi | Translation Field | heal | heal | 1000 | 20 | `fx/skills/h1_lexi_4.webp` | `fx/skills/icons/icon_h1_lexi_4.webp` | `sfx/skills/sfx_skill_h1_lexi_4.mp3` |
| h1_xiaobai_1 | H | 小白 | 月下吟 | guard | shield | 1000 | 25 | `fx/skills/h1_xiaobai_1.webp` | `fx/skills/icons/icon_h1_xiaobai_1.webp` | `sfx/skills/sfx_skill_h1_xiaobai_1.mp3` |
| h1_xiaobai_2 | H | 小白 | 将进酒 | atk | projectile | 1300 | 40 | `fx/skills/h1_xiaobai_2.webp` | `fx/skills/icons/icon_h1_xiaobai_2.webp` | `sfx/skills/sfx_skill_h1_xiaobai_2.mp3` |
| h1_xiaobai_3 | H | 小白 | 青莲剑歌 | atk | slash | 1100 | 12 | `fx/skills/h1_xiaobai_3.webp` | `fx/skills/icons/icon_h1_xiaobai_3.webp` | `sfx/skills/sfx_skill_h1_xiaobai_3.mp3` |
| h1_xiaobai_4 | H | 小白 | 举杯邀月 | heal | heal | 1000 | 15 | `fx/skills/h1_xiaobai_4.webp` | `fx/skills/icons/icon_h1_xiaobai_4.webp` | `sfx/skills/sfx_skill_h1_xiaobai_4.mp3` |
| h1_bola_1 | H | 铂拉 | 炼金爆裂 | atk | projectile | 1200 | 40 | `fx/skills/h1_bola_1.webp` | `fx/skills/icons/icon_h1_bola_1.webp` | `sfx/skills/sfx_skill_h1_bola_1.mp3` |
| h1_bola_2 | H | 铂拉 | 链式反应 | atk | projectile | 1200 | 12 | `fx/skills/h1_bola_2.webp` | `fx/skills/icons/icon_h1_bola_2.webp` | `sfx/skills/sfx_skill_h1_bola_2.mp3` |
| h1_bola_3 | H | 铂拉 | 惰性气体屏障 | guard | shield | 1000 | 20 | `fx/skills/h1_bola_3.webp` | `fx/skills/icons/icon_h1_bola_3.webp` | `sfx/skills/sfx_skill_h1_bola_3.mp3` |
| h1_bola_4 | H | 铂拉 | 催化剂 | guard | shield | 1000 | 20 | `fx/skills/h1_bola_4.webp` | `fx/skills/icons/icon_h1_bola_4.webp` | `sfx/skills/sfx_skill_h1_bola_4.mp3` |
