// Node globals some crypto dependencies expect in the browser.
import { Buffer } from "buffer";
export { Buffer };
export const process = globalThis.process || { env: {}, browser: true, version: "", versions: {}, nextTick: (fn, ...a) => queueMicrotask(() => fn(...a)) };
