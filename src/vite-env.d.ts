/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
/** 构建期开关：测试构建（ZY_TEST=1 或 dev）才保留自动化测试钩子；正式构建里整段被删掉 */
declare const __TEST_HOOKS__: boolean;
