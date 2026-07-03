import qrCodeSource from './qrcode.min.js?raw';

let cachedFactory = null;

export function getQrCodeFactory() {
  if (cachedFactory) return cachedFactory;
  if (typeof globalThis.qrcode === 'function') {
    cachedFactory = globalThis.qrcode;
    return cachedFactory;
  }

  const module = { exports: {} };
  const exports = module.exports;
  const loadFactory = new Function(
    'module',
    'exports',
    'define',
    `${qrCodeSource}; return typeof qrcode === "function" ? qrcode : module.exports;`
  );
  cachedFactory = loadFactory(module, exports, undefined);
  globalThis.qrcode = cachedFactory;
  return cachedFactory;
}
