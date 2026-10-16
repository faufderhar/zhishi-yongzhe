/* 战斗演出导演：回合制「冲刺→出招→收招」、受击白闪/击退/顿帧/震屏、飘字、残影、胜负演出。
   全部只改 transform / opacity（WAAPI），粒子走 Canvas 层。减少动画模式下跳过位移与震屏，只保留飘字与淡入淡出。 */
import { ParticleLayer } from './particles';
import { anim, reducedMotion, sleep } from './motion';
import { signatureOf, CRIT, HEAL, MONSTER_HIT, CONFETTI, SOFT_STARS, SOFT_CONFETTI } from './presets';
import { sfx, SKILL_SFX } from './assets';
import { isSignature } from '../game/characters';
import { playSkill as playSkillFx, type PlaySkillOpts } from './skillFx';
import type { SkillDef } from '../game/skills';
import { loadFx, playFx, SUBJECT_FX, type SheetPlayer, type CharAnims, type Sheet } from './sheets';
export interface HeroSheets { player: SheetPlayer; anims: CharAnims; hs: boolean }

export interface Rig { stage: HTMLElement; shake: HTMLElement; hero: HTMLElement; monster: HTMLElement; flash: HTMLElement; canvas: HTMLCanvasElement; heroImg?: HTMLElement }
export interface AttackOpts { subject: string; major: string; dealt: number; crit: boolean; dodge: boolean; healed?: number; taken?: number; onImpact?: () => void; onCounter?: () => void }
const center = (el: HTMLElement, rel: HTMLElement) => { const a = el.getBoundingClientRect(), b = rel.getBoundingClientRect(); return { x: a.left - b.left + a.width / 2, y: a.top - b.top + a.height / 2, w: a.width, h: a.height }; };

export class Director {
  p: ParticleLayer;
  r: Rig; gentle: boolean; sheets: HeroSheets | null = null;
  private fxCache = new Map<string, Sheet | null>();
  /** 预取特效（命中时同步可用）；缺文件则记 null → 程序特效 */
  async preloadFx(names: string[]) { await Promise.all(names.map(async n => this.fxCache.set(n, await loadFx(n)))); }
  private sheetFx(name: string | undefined, x: number, y: number, scale = 0.8, opts?: { onFrame?: (i: number) => void; stretchX?: number }) {
    const s = name ? this.fxCache.get(name) : null; if (!s || reducedMotion() && !opts?.onFrame) return null;
    return playFx(this.r.stage, s, x, y, scale, opts);
  }
  private idle() { if (this.sheets) void this.sheets.player.play(this.sheets.anims.idle); }
  constructor(r: Rig, gentle = false) { this.r = r; this.gentle = gentle; this.p = new ParticleLayer(r.canvas); }
  destroy() { this.p.destroy(); }
  /** 角色技能释放（v0.3.7）：横幅 + 美术序列帧 / 程序化特效；小班、小学 1–2 强制温和 */
  playSkill(k: SkillDef, o: Partial<PlaySkillOpts> = {}) {
    const gentle = this.gentle || k.seg === 'K' || k.seg === 'P12';
    return playSkillFx({ stage: this.r.stage, hero: this.r.hero, monster: this.r.monster, p: this.p }, k, { gentle, ...o });
  }
  resize() { this.p.resize(); }

  /** 飘字：伤害数字（暴击更大 + 「暴击」），治疗绿色 */
  float(target: HTMLElement, text: string, kind: 'dmg' | 'crit' | 'heal' | 'hurt' | 'miss' | 'soft') {
    const c = center(target, this.r.stage);
    const el = document.createElement('span');
    el.className = `fnum fnum-${kind}`; el.textContent = text;
    el.style.left = `${c.x + (Math.random() * 30 - 15)}px`; el.style.top = `${c.y - c.h * 0.35}px`;
    this.r.stage.appendChild(el);
    const big = kind === 'crit';
    const a = el.animate(reducedMotion()
      ? [{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }]
      : [{ transform: 'translate(-50%,0) scale(.6)', opacity: 0 }, { transform: 'translate(-50%,-6px) scale(1.3)', opacity: 1, offset: 100 / 900 },
         { transform: 'translate(-50%,-14px) scale(1)', opacity: 1, offset: 220 / 900 }, { transform: 'translate(-50%,-40px) scale(1)', opacity: 1, offset: 600 / 900 }, { transform: 'translate(-50%,-48px) scale(1)', opacity: 0 }],
      { duration: 900, easing: 'ease-out' });
    a.finished.finally(() => el.remove());
  }
  shakeScreen(power = 1) {
    if (this.gentle) return Promise.resolve();
    // 衰减正弦：普通 6px / 暴击 12px，150ms
    const d = power > 1 ? 12 : 6; const fr: Keyframe[] = [];
    for (let i = 0; i <= 6; i++) { const k = 1 - i / 6; fr.push({ transform: `translate(${(i % 2 ? -1 : 1) * d * k}px,${(i % 3 - 1) * d * 0.4 * k}px)` }); }
    fr.push({ transform: 'translate(0,0)' });
    return anim(this.r.shake, fr, { duration: power > 1 ? 190 : 150, easing: 'linear' });
  }
  whiteFlash() {
    return anim(this.r.flash, [{ opacity: 0 }, { opacity: 0.95, offset: 0.15 }, { opacity: 0 }], { duration: 220, easing: 'linear' });
  }
  private distance() { const h = center(this.r.hero, this.r.stage), m = center(this.r.monster, this.r.stage); return Math.max(0, m.x - h.x - (h.w + m.w) * 0.35); }

  /** 我方出招：冲刺 → 出招(招牌技能/普攻) → 命中 → 收招 */
  async playerAttack(o: AttackOpts) {
    if (this.sheets) return this.sheetAttack(o);
    const { hero, monster, stage } = this.r;
    const signature = isSignature(o.subject, o.major);
    const sig = signature ? signatureOf(o.subject) : signatureOf('');
    const dist = this.distance();
    hero.style.setProperty('--glow', sig.glow);
    if (o.dodge) await this.dodge();
    // 1. 蓄力（招牌技能发光）
    if (signature) { hero.classList.add('glowing'); sfx(SKILL_SFX[o.major] ?? 'swing'); }
    await anim(hero, [{ transform: 'translate(0,0) scale(1)' }, { transform: 'translate(-14px,4px) scale(1.04,.96)' }], { duration: 140, fill: 'forwards' });
    // 2. 冲刺
    sfx('swing');
    const hc = center(hero, stage), mc = center(monster, stage);
    if (signature) this.p.trail(hc.x, hc.y, mc.x, mc.y, sig.trail, 260);
    await anim(hero, [{ transform: 'translate(-14px,4px) scale(1.04,.96)' }, { transform: `translate(${dist * 0.9}px,-18px) scale(1.06)`, offset: 0.7 }, { transform: `translate(${dist}px,0) scale(1)` }],
      { duration: 240, easing: 'cubic-bezier(.5,0,.8,.6)', fill: 'forwards' });
    // 3. 出招挥击
    await anim(hero, [{ transform: `translate(${dist}px,0) rotate(0)` }, { transform: `translate(${dist + 16}px,-6px) rotate(-10deg)` }, { transform: `translate(${dist + 8}px,0) rotate(6deg)` }],
      { duration: 110, fill: 'forwards' });
    // 4. 命中：白闪 + 顿帧 + 击退 + 震屏 + 粒子 + 飘字
    await this.monsterHit(o.dealt, o.crit, signature ? sig.impact : sig.impact, o.onImpact);
    // 5. 收招
    hero.classList.remove('glowing');
    await anim(hero, [{ transform: `translate(${dist + 8}px,0) rotate(6deg)` }, { transform: `translate(${dist * 0.4}px,-24px) rotate(0)`, offset: 0.5 }, { transform: 'translate(0,0) rotate(0)' }],
      { duration: 320, easing: 'ease-in-out' });
    hero.getAnimations().forEach(a => a.cancel());
    if (o.healed) { const c = center(hero, stage); this.p.burst(c.x, c.y, HEAL); this.float(hero, `+${o.healed}`, 'heal'); sfx('heal'); }
    if (o.taken) await this.monsterAttack(o.taken, o.onCounter);
  }
  /** 美术序列帧版出招（README 时序）：heal_star + 蓄力 0-2 → 3-5 冲刺(tween 补位) → 第 5 帧命中 → 6-9 回位 */
  private async sheetAttack(o: AttackOpts) {
    const { hero, monster, stage } = this.r; const sh = this.sheets!;
    const signature = isSignature(o.subject, o.major);
    if (o.dodge) await this.dodge();
    const hc = center(hero, stage), mc = center(monster, stage);
    this.sheetFx('heal_star', hc.x, hc.y + hc.h / 2, 0.6);
    if (signature) { hero.style.setProperty('--glow', signatureOf(o.subject).glow); hero.classList.add('glowing'); sfx(SKILL_SFX[o.major] ?? 'swing'); }
    const beam = sh.hs && signature && this.fxCache.get('hs_energy_beam');
    const reach = beam ? 0 : Math.max(0, this.distance() - 64 * sh.player.scale);
    let impact: Promise<void> = Promise.resolve();
    let resolveHit!: () => void; const hitDone = new Promise<void>(r => { resolveHit = r; });
    const doImpact = () => {
      sh.player.freeze(reducedMotion() ? 0 : o.crit ? 120 : 80);
      impact = this.monsterHit(o.dealt, o.crit, signatureOf(signature ? o.subject : '').impact, o.onImpact, signature ? SUBJECT_FX[o.major] : undefined).then(resolveHit);
    };
    const hitFrame = sh.anims.attack.meta.hit_frame ?? 5;
    const attackDone = sh.player.play(sh.anims.attack, f => {
      if (f === 3) { sfx('swing'); if (reach) void anim(hero, [{ transform: 'translateX(0)' }, { transform: `translateX(${reach}px)` }], { duration: 120, easing: 'ease-out', fill: 'forwards' }); }
      if (f === 3 && beam) {   // 高一能量束：起点在手部，横向拉伸到敌人；第 4 帧命中
        const hand = { x: hc.x + hc.w * 0.25, y: hc.y - hc.h * 0.05 };
        const len = Math.max(60, mc.x - hand.x), k = 0.5;
        const p = this.sheetFx('hs_energy_beam', mc.x, hand.y, k, { stretchX: len / (490 * k), onFrame: i => { if (i === 4) doImpact(); } });
        if (!p) doImpact();
      }
      if (f === hitFrame && !beam) doImpact();
    });
    await attackDone; if (!beam) await impact; else await hitDone;
    hero.classList.remove('glowing');
    if (reach) await anim(hero, [{ transform: `translateX(${reach}px)` }, { transform: 'translateX(0)' }], { duration: 200, easing: 'ease-in-out' });
    hero.getAnimations().forEach(a => a.cancel());
    this.idle();
    if (o.healed) { this.sheetFx('heal_star', hc.x, hc.y + hc.h / 2, 0.6) ?? this.p.burst(hc.x, hc.y, HEAL); this.float(hero, `+${o.healed}`, 'heal'); sfx('heal'); }
    if (o.taken) await this.monsterAttack(o.taken, o.onCounter);
  }
  async monsterHit(dealt: number, crit: boolean, impact = signatureOf('').impact, onImpact?: () => void, subjectFx?: string) {
    const { monster, stage } = this.r;
    const mc = center(monster, stage);
    sfx(crit ? 'crit' : 'hit');
    this.whiteFlash();
    const art = this.sheetFx(subjectFx, mc.x, mc.y, 0.75);
    const spark = this.sheetFx(crit ? 'hit_spark_crit' : 'hit_spark_light', mc.x - mc.w * 0.15, mc.y, crit ? 0.8 : 0.9);
    if (!art) this.p.burst(mc.x - mc.w * 0.15, mc.y, impact);
    if (!spark && crit) this.p.burst(mc.x - mc.w * 0.15, mc.y, CRIT);
    onImpact?.();
    this.float(monster, crit ? `暴击 ${dealt}` : `-${dealt}`, crit ? 'crit' : 'dmg');
    // 顿帧：保持受击姿态短暂停住
    await anim(monster, [{ transform: 'translate(0,0) scale(1)' }, { transform: 'translate(10px,0) scale(.94,1.04)' }], { duration: 40, fill: 'forwards' });
    await sleep(reducedMotion() ? 0 : crit ? 120 : 80);   // 顿帧
    this.shakeScreen(crit ? 2 : 1);
    await anim(monster, [{ transform: 'translate(10px,0) scale(.94,1.04)' }, { transform: `translate(${crit ? 46 : 30}px,-4px) rotate(4deg)`, offset: 0.35 },
      { transform: 'translate(-6px,0) rotate(-2deg)', offset: 0.7 }, { transform: 'translate(0,0)' }], { duration: 360 });
    monster.getAnimations().forEach(a => a.cancel());
  }
  /** 闪避：快速后跳 + 3 道残影 */
  async dodge() {
    const { hero } = this.r;
    sfx('dodge');
    if (!reducedMotion()) {
      const img = this.r.heroImg ?? hero;
      for (let i = 1; i <= 3; i++) {
        const g = img.cloneNode(true) as HTMLElement; g.classList.add('afterimage'); g.removeAttribute('data-testid');
        hero.parentElement!.appendChild(g);
        const hb = hero.getBoundingClientRect(), pb = hero.parentElement!.getBoundingClientRect();
        Object.assign(g.style, { left: `${hb.left - pb.left}px`, top: `${hb.top - pb.top}px`, width: `${hb.width}px`, height: `${hb.height}px` });
        g.animate([{ transform: `translateX(${-i * 22}px)`, opacity: 0.55 - i * 0.12 }, { transform: `translateX(${-i * 30}px)`, opacity: 0 }], { duration: 420, delay: i * 40, easing: 'ease-out', fill: 'backwards' })
          .finished.finally(() => g.remove());
      }
    }
    await anim(hero, [{ transform: 'translate(0,0)' }, { transform: 'translate(-70px,-10px) skewX(8deg)', offset: 0.4 }, { transform: 'translate(-70px,0)', offset: 0.7 }, { transform: 'translate(0,0)' }], { duration: 420 });
    this.float(hero, '闪避', 'miss');
  }
  /** 怪物出手：后仰蓄力 → 扑向主角 → 主角受击 → 回位 */
  async monsterAttack(taken: number, onImpact?: () => void) {
    const { hero, monster, stage } = this.r;
    const dist = this.distance();
    sfx('monster_attack');
    await anim(monster, [{ transform: 'translate(0,0) scale(1)' }, { transform: 'translate(22px,6px) scale(1.06,.92)' }], { duration: 220, fill: 'forwards' });
    await anim(monster, [{ transform: 'translate(22px,6px) scale(1.06,.92)' }, { transform: `translate(${-dist * 0.8}px,-20px) scale(1.05)`, offset: 0.7 }, { transform: `translate(${-dist}px,0) scale(1)` }],
      { duration: 220, easing: 'cubic-bezier(.5,0,.8,.6)', fill: 'forwards' });
    if (taken > 0) {
      sfx('player_hurt');
      const hc = center(hero, stage); this.p.burst(hc.x + hc.w * 0.15, hc.y, MONSTER_HIT);
      onImpact?.();
      this.float(hero, `-${taken}`, 'hurt');
      hero.classList.add('hurt');
      this.shakeScreen(1);
      if (this.sheets) { const sh = this.sheets; void sh.player.play(sh.anims.hit).then(() => this.idle()); }
      await anim(hero, [{ transform: 'translate(0,0)' }, { transform: 'translate(-28px,0) rotate(-6deg)', offset: 0.3 }, { transform: 'translate(6px,0) rotate(2deg)', offset: 0.7 }, { transform: 'translate(0,0)' }], { duration: 360 });
      hero.classList.remove('hurt');
    } else { onImpact?.(); this.float(monster, '护盾', 'miss'); }
    await anim(monster, [{ transform: `translate(${-dist}px,0)` }, { transform: 'translate(0,0)' }], { duration: 300, easing: 'ease-in-out' });
    monster.getAnimations().forEach(a => a.cancel());
  }
  async victory() {
    const { hero, monster, stage } = this.r;
    sfx('victory');
    const mc = center(monster, stage);
    this.p.burst(mc.x, mc.y, signatureOf('').impact);
    await anim(monster, [{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: 'translate(30px,10px) rotate(12deg)', opacity: 0.8, offset: 0.3 }, { transform: 'translate(60px,60px) rotate(30deg) scale(.6)', opacity: 0 }], { duration: 700, fill: 'forwards' });
    const hc = center(hero, stage);
    this.p.burst(hc.x, hc.y - 60, CONFETTI, -Math.PI / 2);
    await anim(hero, [{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-50px) scale(1.08)', offset: 0.4 }, { transform: 'translateY(0) scale(1)', offset: 0.7 }, { transform: 'translateY(-14px)', offset: 0.85 }, { transform: 'translateY(0)' }], { duration: 800 });
    await sleep(300);
  }
  async defeat() {
    const { hero } = this.r;
    sfx('defeat');
    this.r.stage.classList.add('defeated');
    await anim(hero, [{ transform: 'translateY(0) rotate(0)', opacity: 1 }, { transform: 'translateY(10px) rotate(-8deg)', opacity: 0.9, offset: 0.3 }, { transform: 'translateY(28px) rotate(-14deg) scale(.92)', opacity: 0.55 }], { duration: 900, fill: 'forwards' });
    await sleep(400);
  }

  /* ---------- 幼儿园：柔和版（无白闪 / 无震屏 / 无伤害数字） ---------- */
  async kinderCorrect() {
    const { hero, monster, stage } = this.r;
    sfx('soft_pop');
    const hc = center(hero, stage), mc = center(monster, stage);
    this.sheetFx('heal_star', hc.x, hc.y + hc.h / 2, 0.7);
    if (this.sheets) { const sh = this.sheets; void sh.player.play(sh.anims.attack).then(() => this.idle()); }
    await anim(hero, [{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(6px) scale(1.06,.94)', offset: 0.25 }, { transform: 'translateY(-42px) scale(.97,1.04)', offset: 0.6 }, { transform: 'translateY(0)' }], { duration: 520 });
    this.p.trail(hc.x, hc.y - 40, mc.x, mc.y - 20, SOFT_STARS, 420);
    await sleep(reducedMotion() ? 0 : 420);
    if (!this.sheetFx('heal_star', mc.x, mc.y + mc.h / 2, 0.7)) this.p.burst(mc.x, mc.y - 20, SOFT_STARS); else this.p.burst(mc.x, mc.y - 20, { ...SOFT_STARS, count: 8 });
    this.float(monster, '⭐ +1', 'soft');
    await anim(monster, [{ transform: 'translateY(0) rotate(0) scale(1)' }, { transform: 'translateY(-26px) rotate(-6deg) scale(1.05)', offset: 0.4 }, { transform: 'translateY(0) rotate(4deg)', offset: 0.75 }, { transform: 'rotate(0)' }], { duration: 700 });
  }
  async kinderRetry() {
    // 轻轻歪头，不是「受伤」
    await anim(this.r.hero, [{ transform: 'rotate(0)' }, { transform: 'rotate(-7deg)', offset: 0.3 }, { transform: 'rotate(5deg)', offset: 0.65 }, { transform: 'rotate(0)' }], { duration: 600 });
  }
  async kinderFinale() {
    const { hero, monster, stage } = this.r;
    sfx('soft_cheer');
    const hc = center(hero, stage), mc = center(monster, stage);
    this.p.burst((hc.x + mc.x) / 2, Math.min(hc.y, mc.y) - 60, SOFT_CONFETTI, -Math.PI / 2);
    await Promise.all([
      anim(monster, [{ transform: 'translateX(0)' }, { transform: `translateX(${-(mc.x - hc.x) * 0.45}px) translateY(-20px)`, offset: 0.5 }, { transform: `translateX(${-(mc.x - hc.x) * 0.45}px)` }], { duration: 900, fill: 'forwards' }),
      anim(hero, [{ transform: 'translateY(0)' }, { transform: 'translateY(-30px)', offset: 0.3 }, { transform: 'translateY(0)', offset: 0.6 }, { transform: 'translateY(-16px)', offset: 0.8 }, { transform: 'translateY(0)' }], { duration: 900 }),
    ]);
    await sleep(500);
  }
}
