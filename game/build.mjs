#!/usr/bin/env node
/**
 * Đóng gói game thành MỘT file HTML duy nhất (chơi offline, không cần CDN):
 *   1. Nhúng Three.js r160 (bản ESM min) thành script cổ điển, tự bọc IIFE
 *      để không xung đột tên biến với code game.
 *   2. Gộp logic.js (lõi logic thuần) + game.js (engine + UI) vào một IIFE.
 *   3. Nhét tất cả vào template.html theo hai mốc đánh dấu trong template.
 *
 * Dùng:  node game/build.mjs [duong-dan-xuat]     (mặc định: ./game3d.html)
 */
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, 'src');

/** Tách three.js thành script cổ điển + ghép logic.js/game.js. */
export function buildParts() {
  const threeRaw = readFileSync(join(HERE, 'vendor', 'three.module.min.js'), 'utf8');
  const m = threeRaw.match(/export\s*\{([\s\S]*?)\}\s*;?\s*$/);
  if (!m) throw new Error('Không tìm thấy khối `export{...}` ở cuối three.module.min.js');

  const pairs = m[1].split(',').map((s) => s.trim()).filter(Boolean).map((entry) => {
    const mm = entry.match(/^(\S+)\s+as\s+(\S+)$/);
    return mm ? `${mm[2]}:${mm[1]}` : `${entry}:${entry}`;
  });
  const threeBody = threeRaw.slice(0, m.index).trimEnd();
  const threeScript = `/* Three.js r160 — Copyright 2010-2023 Three.js Authors · MIT License.
   Nhúng sẵn trong file để game chạy được offline (không cần CDN). */
(function(){ 'use strict';
${threeBody}
window.THREE = { ${pairs.join(',')} };
})();`;

  const logic = readFileSync(join(SRC, 'logic.js'), 'utf8').replace(/^export\s+/gm, '');
  const game = readFileSync(join(SRC, 'game.js'), 'utf8');
  const gameScript = `(function(){ 'use strict';
const THREE = window.THREE;
/* =========================================================================
 * PHẦN 1/2 — LÕI LOGIC (đường đi, đợt sóng, tháp, kinh tế) — logic.js
 * ========================================================================= */
${logic}
/* =========================================================================
 * PHẦN 2/2 — ENGINE 3D + GAMEPLAY + GIAO DIỆN — game.js
 * ========================================================================= */
${game}
})();`;

  for (const [name, code] of [['three', threeScript], ['game', gameScript]]) {
    if (/<\/script/i.test(code)) throw new Error(`Nội dung "${name}" chứa chuỗi "</script" — không thể nhúng vào HTML`);
    if (/<!--/.test(code)) throw new Error(`Nội dung "${name}" chứa "<!--" — không thể nhúng vào HTML`);
  }
  return { threeScript, gameScript };
}

/** Ghép template + các phần đã đóng gói. `extra` chèn ngay trước script game (dùng cho test). */
export function buildHtml(parts = buildParts(), extra = '') {
  const tpl = readFileSync(join(SRC, 'template.html'), 'utf8');
  return tpl
    .replace('/*__THREE__*/', () => parts.threeScript)
    .replace('<!--__EXTRA__-->', () => extra || '')
    .replace('/*__GAME__*/', () => parts.gameScript);
}

function main() {
  const out = resolve(process.argv[2] || join(HERE, '..', 'game3d.html'));
  const parts = buildParts();
  const html = buildHtml(parts);
  writeFileSync(out, html);
  const kb = (n) => (n / 1024).toFixed(0) + ' KB';
  console.log('✅ Đã tạo', out);
  console.log('   · three.js  :', kb(Buffer.byteLength(parts.threeScript)));
  console.log('   · logic+game:', kb(Buffer.byteLength(parts.gameScript)));
  console.log('   · tổng file :', kb(statSync(out).size));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
