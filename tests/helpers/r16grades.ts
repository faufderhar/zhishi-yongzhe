// r17.1：大班 K3 / 初三 9 / 高三 12 开放以后，按 r16–r17 线上 12 个年级钉住的快照测试（题量 18344、可见关卡 2387、可见性行……）只看这 12 个年级
import { BUILTIN_GRADES } from '../../src/bankStore';
import type { GradeKey } from '../../src/game/questions';
export const R171_NEW: GradeKey[] = ['K3', '9', '12'];
export const R16_GRADES: GradeKey[] = BUILTIN_GRADES.filter(g => !R171_NEW.includes(g));
