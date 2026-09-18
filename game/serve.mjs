#!/usr/bin/env node
/**
 * Server tĩnh siêu nhỏ để chơi game trong trình duyệt / Arena Live Preview.
 * Mặc định mở thẳng game3d.html khi truy cập "/".
 *
 * Dùng:  node game/serve.mjs [cổng] [thư-mục-gốc]
 *        npm run game            (cổng 5173)
 *        npm run game -- 5180    (đổi cổng khi cổng 5173 đang bận)
 */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.argv[2] || process.env.PORT || 5173);
const ROOT = resolve(process.argv[3] || join(fileURLToPath(import.meta.url), '..', '..'));
const ENTRY = '/game3d.html';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent((req.url || '/').split('?')[0]);
    if (path === '/' || path === '') path = ENTRY;
    if (path === '/game' || path === '/game/') path = ENTRY;
    const file = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end('Forbidden'); return; }
    const info = await stat(file).catch(() => null);
    if (!info || !info.isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(`Không tìm thấy ${path}\nGợi ý: mở /game3d.html để chơi game (đã build bằng: npm run game:build)`);
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      'content-length': info.size,
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    });
    createReadStream(file).pipe(res);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Lỗi server: ' + err.message);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 Neon Defense 3D đang chạy tại http://localhost:${PORT}${ENTRY}`);
  console.log(`   gốc tĩnh: ${ROOT}`);
});
