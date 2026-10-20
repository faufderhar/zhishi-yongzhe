/* r16.2 技术QA B3（P4 加固）：运行时开关以前挂在 window 上（window.__zyPaused 冻结每日计时、window.__zyRestoring 不写 PIN 锁定状态、
   __zyRotate、__zyInactive）——懂 devtools 的孩子在控制台改一下就能绕过时长限制或密码锁定。现在只是这个模块里的变量，window 上没有。
   测试构建（__TEST_HOOKS__）另给一个只读快照 window.__zyTestFlags 给 e2e 看；生产包里没有任何 __zy 名字（scripts/check-prod-globals.mjs，CI 守着）。 */
declare const __TEST_HOOKS__: boolean;
const st = { paused: false, rotate: false, restoring: false, inactive: false };
let restoreTimer: ReturnType<typeof setTimeout> | undefined;
/** 战斗里按了暂停（每日计时不走） */
export const setBattlePaused = (v: boolean) => { st.paused = v; };
export const battlePaused = () => st.paused;
/** 手机竖屏「请横过来」盖层期间（每日计时不走） */
export const setRotateLock = (v: boolean) => { st.rotate = v; };
export const rotateLock = () => st.rotate;
/** 覆盖恢复 / 合并写库期间（约 15 秒，之后 reload）：state.ts 的保存、PIN 锁定状态都不写 */
export const isRestoring = () => st.restoring;
export function beginRestoring(ms = 15e3) { st.restoring = true; clearTimeout(restoreTimer); restoreTimer = setTimeout(() => { st.restoring = false; }, ms); }
export const setRestoring = (v: boolean) => { clearTimeout(restoreTimer); st.restoring = v; };
/** 这个标签页不是当前活动页（tabGuard） */
export const setInactive = (v: boolean) => { st.inactive = v; };
export const isInactive = () => st.inactive;
if (__TEST_HOOKS__ && typeof window !== 'undefined') { try { Object.defineProperty(window, '__zyTestFlags', { configurable: true, get: () => ({ ...st }) }); } catch { /* */ } }   // 仅测试构建：只读
