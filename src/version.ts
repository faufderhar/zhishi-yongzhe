import { BANK_RELEASE } from './bankStore';
declare const __RELEASE__: string; declare const __BUILD__: string;
/** r9：界面上显示的版本号，如「r9 · 题库v18 · cb1cbfb」 */
export const VERSION_LABEL = `${typeof __RELEASE__ === 'string' ? __RELEASE__ : 'dev'} · 题库${BANK_RELEASE} · ${typeof __BUILD__ === 'string' ? __BUILD__ : 'dev'}`;
