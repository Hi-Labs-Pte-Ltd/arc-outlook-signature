// 测试用：在 fixture.config.js 基础上关掉精简签名（文件名不能以 config.js 结尾，否则会被测试里的重定向规则替换掉）
import { SIGNATURE_CONFIG as BASE } from "./fixture.config.js";
export const SIGNATURE_CONFIG = { ...BASE, useShortSignature: false };
