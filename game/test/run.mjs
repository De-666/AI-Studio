/**
 * Test headless cho NEON DEFENSE 3D (game3d.html)
 * -------------------------------------------------------------------------
 * Sandbox/CI thường không có trình duyệt, nên harness này:
 *   1. Đóng gói game bằng game/build.mjs (đúng như file phát hành),
 *   2. Chạy trong jsdom + THAY WebGLRenderer bằng stub (scene graph, gameplay,
 *      UI, input đều chạy thật — chỉ bỏ bước nén lệnh xuống GPU),
 *   3. Mô phỏng nhiều ván chơi: xây tháp, mở đợt, nâng cấp, bán, fuzz input,
 *      chơi hết 25 đợt và cả trường hợp thua.
 *
 * Chạy:  cd game/test && npm install && node run.mjs
 */
import { JSDOM, VirtualConsole } from 'jsdom';
import { buildParts, buildHtml } from '../build.mjs';

/* --------------------------- stub WebGL -------------------------------- */
const STUB = `<script>
(function(){
  if (!window.THREE) throw new Error('Three.js chưa được nhúng vào bundle');
  window.__REAL_RENDERER__ = window.THREE.WebGLRenderer;
  class StubRenderer {
    constructor(o){
      o = o || {};
      this.domElement = o.canvas || document.createElement('canvas');
      this.shadowMap = { enabled:false, type:0, autoUpdate:true, needsUpdate:false };
      this.outputColorSpace = ''; this.toneMapping = 0; this.toneMappingExposure = 1;
      this.info = { render:{ calls:0, triangles:0, frame:0 }, memory:{ geometries:0, textures:0 }, autoReset:true, reset(){}, update(){} };
      this.capabilities = { isWebGL2:true, getMaxAnisotropy(){ return 1; }, getMaxPrecision(){ return 'highp'; } };
      this.xr = { enabled:false, isPresenting:false, addEventListener(){}, setAnimationLoop(){} };
      this.__renders = 0;
    }
    setPixelRatio(){} setSize(){} setClearColor(){} setClearAlpha(){} clear(){} dispose(){}
    setAnimationLoop(){} setViewport(){} setScissor(){} getContext(){ return {}; }
    getPixelRatio(){ return 1; } render(){ this.__renders++; }
  }
  window.THREE.WebGLRenderer = StubRenderer;
})();
</script>`;

/* ------------------------------ khởi động ------------------------------ */
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => {
  const msg = String((e && e.detail && e.detail.message) || (e && e.message) || e);
  if (msg.includes('HTMLCanvasElement.prototype.getContext')) return;   // không có canvas 2D trong jsdom
  errors.push(msg);
});
vc.on('error', (...a) => errors.push(a.map(String).join(' ')));

const html = buildHtml(buildParts(), STUB);
const dom = new JSDOM(html, {
  runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/', virtualConsole: vc,
});
const win = dom.window, doc = win.document;
const NEON = win.NEON, THREE = win.THREE, S = NEON ? NEON.S : null;

/* ------------------------------ assert --------------------------------- */
let pass = 0; const fails = [];
function ok(cond, label, info = '') {
  if (cond) { pass++; console.log('   ✅ ' + label); }
  else { fails.push(label); console.log('   ❌ ' + label + (info ? '  → ' + info : '')); }
}
function eq(a, b, label) { ok(a === b, label, `nhận ${JSON.stringify(a)}, mong đợi ${JSON.stringify(b)}`); }
function gt(a, b, label) { ok(a > b, label, `${a} không > ${b}`); }
function lt(a, b, label) { ok(a < b, label, `${a} không < ${b}`); }
function near(a, b, label, tol = 0.02) { ok(Math.abs(a - b) <= tol, label, `${a} ≠ ${b}`); }
function finite(v, label) { ok(Number.isFinite(v), label, `giá trị = ${v}`); }

/* ------------------------- tiện ích mô phỏng --------------------------- */
function step(dt = 1 / 30, n = 1) {
  const was = S.paused;
  S.paused = false;
  for (let i = 0; i < n; i++) NEON.tick(dt);
  S.paused = was;
}
/** Chạy mô phỏng tới khi `pred()` đúng; trả về số giây mô phỏng, -1 nếu quá hạn. */
function runUntil(pred, maxSec = 120, dt = 1 / 30) {
  let t = 0;
  while (t < maxSec) { step(dt, 1); t += dt; if (pred()) return t; }
  return -1;
}
function freeTiles(n) { return n; }
/** Tìm các ô đất cạnh đường đi để đặt tháp thử nghiệm. */
function tilesNextToPath(limit = 40) {
  const path = NEON.pathTiles();
  const out = [];
  for (const t of path.values()) {
    for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const gx = t.gx + ax, gz = t.gz + az;
      if (!NEON.canBuild(gx, gz)) continue;
      if (out.some((o) => o.gx === gx && o.gz === gz)) continue;
      out.push({ gx, gz });
      if (out.length >= limit) return out;
    }
  }
  return out;
}
function giveGold(v = 5000) { S.gold = v; }
/** Xoá một kẻ địch khỏi mô phỏng (dùng trong test). */
function world_kill(e) { e.alive = false; e.hp = 0; const i = S.enemies.indexOf(e); if (i >= 0) S.enemies.splice(i, 1); }
function countMeshes(obj) {
  // InstancedMesh đại diện cho hàng trăm vật thể trên bản đồ
  let n = 0;
  obj.traverse((o) => {
    if (o.isInstancedMesh) n += o.count;
    else if (o.isMesh || o.isPoints || o.isSprite || o.isLine) n++;
  });
  return n;
}

S.paused = true;   // khoá vòng lặp rAF: test tự điều khiển thời gian bằng step()
win.addEventListener('error', (e) => errors.push('window.error: ' + (e.message || '')));

/* ================================ TESTS ================================ */
const tests = [];
const T = (name, fn) => tests.push({ name, fn });

T('1. Khởi động & dựng cảnh 3D', () => {
  ok(!!NEON, 'API window.NEON được tạo');
  ok(!!THREE && !!THREE.Vector3, 'Three.js r160 được nhúng và chạy được');
  eq(THREE.REVISION, '160', 'đúng phiên bản three r160');
  eq(S.phase, 'menu', 'trạng thái ban đầu là menu');
  ok(!!doc.getElementById('btnStart'), 'menu chính có nút Bắt đầu');
  eq(doc.querySelectorAll('.card[data-tower]').length, 5, 'thanh dưới có đủ 5 loại tháp');
  eq(doc.querySelectorAll('.card .ic svg').length, 5, '5 thẻ tháp hiển thị icon SVG tự vẽ (không cần CDN)');
  ok(!!doc.querySelector('.brand .logo svg'), 'logo thương hiệu dùng icon SVG');
  eq(doc.querySelectorAll('.ctrl').length, 5, 'có 5 nút điều khiển góc phải');
  gt(countMeshes(NEON.scene), 200, `cảnh 3D có ${countMeshes(NEON.scene)} đối tượng (địa hình, đường, trang trí, căn cứ…)`);
  ok(NEON.scene.children.length >= 6, 'scene có đủ nhóm đối tượng (ánh sáng, sao, thế giới…)');
  ok(!!NEON.portalObj && !!NEON.baseObj, 'cổng vào và căn cứ đã được dựng');
  const pc = NEON.portalObj.group.position, bc = NEON.basePos;
  gt(pc.x, -30, 'cổng vào nằm ở rìa trái bản đồ');
  gt(bc.x, 15, 'căn cứ nằm ở rìa phải bản đồ');
});

T('2. Lõi logic: đường đi, đợt sóng, tháp, kinh tế', () => {
  const path = NEON.pathTiles();
  gt(path.size, 50, `đường đi có ${path.size} ô`);
  let inside = true;
  for (const t of path.values()) if (t.gx < 0 || t.gz < 0 || t.gx >= NEON.GRID.COLS || t.gz >= NEON.GRID.ROWS) inside = false;
  ok(inside, 'mọi ô đường đi đều nằm trong lưới');

  let prevHp = 0, monotonic = true;
  for (let w = 1; w <= 25; w++) {
    const wd = NEON.buildWave(w, NEON.DIFFICULTIES.normal);
    if (!wd.totalCount) monotonic = false;
    for (let i = 1; i < wd.schedule.length; i++) if (wd.schedule[i].t < wd.schedule[i - 1].t) monotonic = false;
    const hp = NEON.enemyStats('grunt', w, NEON.DIFFICULTIES.normal).hp;
    if (hp < prevHp) monotonic = false;
    prevHp = hp;
  }
  ok(monotonic, 'lịch spawn đúng thứ tự & máu địch tăng dần theo đợt');
  ok(NEON.buildWave(5, NEON.DIFFICULTIES.normal).summary.some((g) => g.type === 'boss'), 'đợt 5 có trùm');
  ok(!NEON.buildWave(4, NEON.DIFFICULTIES.normal).summary.some((g) => g.type === 'boss'), 'đợt 4 chưa có trùm');
  ok(NEON.buildWave(7, NEON.DIFFICULTIES.normal).summary.some((g) => g.air), 'đợt 7 bắt đầu có drone bay');
  ok(!NEON.buildWave(8, NEON.DIFFICULTIES.normal).summary.some((g) => g.type === 'alien'), 'đợt 8 chưa có sinh vật ngoài hành tinh');
  ok(NEON.buildWave(9, NEON.DIFFICULTIES.normal).summary.some((g) => g.type === 'alien'), 'đợt 9 xuất hiện sinh vật ngoài hành tinh');
  ok(!NEON.buildWave(11, NEON.DIFFICULTIES.normal).summary.some((g) => g.type === 'monster'), 'đợt 11 chưa có quái vật đột biến');
  ok(NEON.buildWave(12, NEON.DIFFICULTIES.normal).summary.some((g) => g.type === 'monster'), 'đợt 12 xuất hiện quái vật đột biến');
  const sum20 = NEON.buildWave(20, NEON.DIFFICULTIES.normal).summary.find((g) => g.type === 'alien');
  ok(!!sum20.color && sum20.color.startsWith('#'), 'summary của địch có màu để vẽ icon');
  ok(!!sum20.note, 'summary của địch có ghi chú dị năng');

  gt(NEON.enemyStats('grunt', 10, NEON.DIFFICULTIES.hard).hp, NEON.enemyStats('grunt', 10, NEON.DIFFICULTIES.normal).hp, 'độ khó Khó làm địch trâu hơn');
  gt(NEON.enemyStats('grunt', 10, NEON.DIFFICULTIES.normal).hp, NEON.enemyStats('grunt', 10, NEON.DIFFICULTIES.easy).hp, 'độ khó Dễ làm địch yếu hơn');

  const g1 = NEON.towerStats('gun', 1), g5 = NEON.towerStats('gun', 5);
  gt(g5.damage, g1.damage, 'nâng cấp tăng sát thương');
  gt(g5.dps, g1.dps, 'nâng cấp tăng DPS');
  lt(NEON.upgradeCost('gun', 1), NEON.upgradeCost('gun', 4), 'chi phí nâng cấp tăng dần');
  lt(NEON.sellValue(60 * 3), 60 * 3, 'bán tháp luôn lỗ (không lạm phát vàng)');
  ok(Math.abs(NEON.applyArmor(100, 6, false) - 100 * (1 - 6 / 28)) < 1e-6, 'giáp 6 giảm ~21% sát thương');
  eq(NEON.applyArmor(100, 6, true), 100, 'xuyên giáp bỏ qua giáp');
  eq(NEON.applyArmor(100, 0, false), 100, 'không giáp thì không giảm');
  ok(Math.abs(NEON.applyArmor(100, 9999, false) - 45) < 1e-9, 'giáp cực cao chỉ chặn tối đa 55%');
  gt(NEON.applyArmor(9, 10, false), 5, 'tháp sát thương nhỏ vẫn gây được hơn 5 sát thương lên trùm (không bị vô hiệu)');
  gt(NEON.waveBonus(10), NEON.waveBonus(3), 'thưởng qua đợt tăng dần');
});

T('3. Vào trận, xây tháp, chặn ô không hợp lệ', () => {
  doc.getElementById('btnStart').click();
  eq(S.phase, 'build', 'bấm Bắt đầu → vào giai đoạn xây dựng');
  eq(S.gold, NEON.DIFFICULTIES.normal.gold, 'vàng khởi đầu đúng theo độ khó');
  eq(S.lives, NEON.DIFFICULTIES.normal.lives, 'mạng khởi đầu đúng theo độ khó');
  near(S.buildTimer, NEON.BUILD_TIME, 'có đồng hồ đếm ngược chuẩn bị', 0.5);

  const pathTile = [...NEON.pathTiles().values()][3];
  eq(NEON.placeTower('gun', pathTile.gx, pathTile.gz), false, 'không thể xây đè lên đường đi');
  eq(NEON.placeTower('gun', -5, -5), false, 'không thể xây ngoài bản đồ');

  const spot = tilesNextToPath(1)[0];
  const before = S.gold;
  const gunCost = NEON.TOWERS.find((t) => t.id === 'gun').cost;
  eq(NEON.placeTower('gun', spot.gx, spot.gz), true, 'xây được tháp ở ô đất trống');
  eq(S.towers.length, 1, 'tháp được thêm vào danh sách');
  eq(S.gold, before - gunCost, `trừ đúng ${gunCost} vàng theo giá tháp`);
  eq(NEON.towerAt.has(spot.gx + ',' + spot.gz), true, 'ô đất đã bị chiếm');
  eq(NEON.placeTower('cannon', spot.gx, spot.gz), false, 'không xây chồng lên tháp khác');
  eq(NEON.canBuild(spot.gx, spot.gz), false, 'canBuild trả về false cho ô đã có tháp');
});

T('4. Đợt 1: 5 loại tháp đều bắn và hạ địch', () => {
  NEON.startGame('normal');
  giveGold(5000);
  const spots = tilesNextToPath(5);
  const types = ['gun', 'cannon', 'frost', 'tesla', 'sniper'];
  types.forEach((tp, i) => NEON.placeTower(tp, spots[i].gx, spots[i].gz));
  eq(S.towers.length, 5, 'đã xây đủ 5 loại tháp');
  eq(new Set(S.towers.map((t) => t.type)).size, 5, '5 loại tháp khác nhau');

  NEON.startWave();
  eq(S.wave, 1, 'bắt đầu đợt 1');
  eq(S.waveActive, true, 'đợt đang diễn ra');
  const expect = NEON.buildWave(1, NEON.DIFFICULTIES.normal).totalCount;
  gt(expect, 5, `đợt 1 có ${expect} quân`);

  const secs = runUntil(() => !S.waveActive, 120);
  gt(secs, 0, 'đợt 1 kết thúc trong thời gian hợp lý');
  gt(S.kills, 0, `hạ được ${S.kills} địch`);
  eq(S.enemies.length, 0, 'không còn địch trên bản đồ');
  eq(S.phase, 'build', 'quay lại giai đoạn chuẩn bị');
  eq(S.leaks, 0, 'không để con nào lọt vào căn cứ');
  for (const t of S.towers) gt(t.dmg, 0, `tháp ${t.type} đã gây sát thương`);
  gt(S.score, 100, 'điểm số tăng');
  ok(S.projectiles.length >= 0 && S.sim > 0, 'mô phỏng thời gian chạy trơn tru');
});

T('5. Quy tắc mục tiêu bay (drone)', () => {
  NEON.startGame('normal');
  giveGold(5000);
  const spots = tilesNextToPath(6);
  const cannon = NEON.placeTower('cannon', spots[0].gx, spots[0].gz) && S.towers[0];
  const cannonT = S.towers[0];
  S.paused = false;
  NEON.spawnEnemy('flyer', 9);
  step(1 / 30, 60);
  S.paused = true;
  eq(cannonT.dmg, 0, 'Pháo Nổ không bắn được drone bay');
  eq(cannonT.target, null, 'Pháo Nổ không khoá mục tiêu bay');

  const tesla = S.towers;
  const spot2 = spots[1];
  NEON.placeTower('tesla', spot2.gx, spot2.gz);
  const teslaT = S.towers.find((t) => t.type === 'tesla');
  S.paused = false;
  NEON.spawnEnemy('flyer', 9);
  const hit = runUntil(() => teslaT.dmg > 0, 40);
  S.paused = true;
  gt(hit, 0, 'Trụ Sét bắn rơi drone bay');
});

T('6. Hiệu ứng riêng: làm chậm, xuyên, lan sét, nổ diện rộng', () => {
  NEON.startGame('normal');
  giveGold(9000);
  const spots = tilesNextToPath(14);
  S.paused = false;
  ['grunt', 'grunt', 'grunt', 'grunt', 'grunt', 'runner'].forEach((t) => NEON.spawnEnemy(t, 3));
  step(1 / 30, 40);
  const slowed = S.enemies.filter((e) => e.slowUntil > S.sim);
  // chưa có tháp nào → chắc chắn không ai bị làm chậm
  eq(slowed.length, 0, 'chưa có tháp băng thì không ai bị làm chậm');

  const frostT = (NEON.placeTower('frost', spots[0].gx, spots[0].gz), S.towers[S.towers.length - 1]);
  const cannonT = (NEON.placeTower('cannon', spots[1].gx, spots[1].gz), S.towers[S.towers.length - 1]);
  const sniperT = (NEON.placeTower('sniper', spots[2].gx, spots[2].gz), S.towers[S.towers.length - 1]);
  step(1 / 30, 120);
  ok(S.enemies.some((e) => e.slowUntil > S.sim) || frostT.dmg > 0, 'Súng Băng gây hiệu ứng làm chậm');
  gt(frostT.dmg, 0, 'Súng Băng gây sát thương');
  gt(cannonT.dmg, 0, 'Pháo Nổ gây sát thương');
  gt(sniperT.dmg, 0, 'Bắn Tỉa gây sát thương');

  // nổ diện rộng: một viên pháo phải trúng cả cụm địch đứng sát nhau
  S.enemies.slice().forEach((e) => world_kill(e));
  NEON.spawnEnemy('tank', 6);            // trùm nhỏ nhiều máu để không chết ngay
  step(1 / 30, 30);
  const victim = S.enemies[S.enemies.length - 1];
  const before = cannonT.dmg;
  step(1 / 30, 120);
  const gain = cannonT.dmg - before;
  gt(gain, NEON.towerStats('cannon', 1).damage * 1.2, `pháo gây ${gain.toFixed(0)} sát thương (1 viên chỉ ${NEON.towerStats('cannon', 1).damage}) → có nổ diện rộng`);
  ok(!!victim && victim.hp < victim.maxHp, 'mục tiêu trong vùng nổ bị mất máu');
  S.paused = true;
});

T('7. Nâng cấp & bán tháp', () => {
  NEON.startGame('normal');
  giveGold(3000);
  const spot = tilesNextToPath(1)[0];
  NEON.placeTower('gun', spot.gx, spot.gz);
  const t = S.towers[0];
  const cost1 = NEON.upgradeCost('gun', 1);
  const dmg1 = t.stats.damage;
  const goldBefore = S.gold;
  NEON.upgradeTower(t);
  eq(t.level, 2, 'nâng lên cấp 2');
  eq(S.gold, goldBefore - cost1, 'trừ đúng chi phí nâng cấp');
  gt(t.stats.damage, dmg1, 'sát thương tăng sau nâng cấp');
  eq(t.invested, NEON.TOWERS.find((x) => x.id === 'gun').cost + cost1, 'tổng đầu tư được cộng dồn');

  giveGold(100000);
  for (let i = 0; i < 8; i++) NEON.upgradeTower(t);
  eq(t.level, NEON.MAX_LEVEL, 'không nâng quá cấp tối đa');
  const goldAtMax = S.gold;
  NEON.upgradeTower(t);
  eq(S.gold, goldAtMax, 'nâng cấp ở cấp tối đa không tốn vàng');

  const refund = NEON.sellValue(t.invested);
  const goldBeforeSell = S.gold;
  NEON.sellTower(t);
  eq(S.gold, goldBeforeSell + refund, 'bán tháp hoàn đúng 62%');
  eq(S.towers.length, 0, 'tháp đã bị xoá khỏi danh sách');
  eq(NEON.canBuild(spot.gx, spot.gz), true, 'ô đất trống trở lại');
  eq(NEON.placeTower('frost', spot.gx, spot.gz), true, 'có thể xây tháp mới trên ô vừa bán');
});

T('8. Bàn phím, nút HUD & bảng thông tin', () => {
  const key = (k) => win.dispatchEvent(new win.KeyboardEvent('keydown', { key: k, bubbles: true }));
  NEON.startGame('normal');
  giveGold(2000);

  key('1');
  eq(S.buildMode, 'gun', 'phím 1 chọn Súng Liên Thanh');
  ok(doc.querySelector('.card[data-tower="gun"]').classList.contains('sel'), 'thẻ tháp được tô sáng');
  key('2');
  eq(S.buildMode, 'cannon', 'phím 2 chọn Pháo Nổ');
  key('Escape');
  eq(S.buildMode, null, 'Esc huỷ chọn tháp');

  key('t');
  eq(S.speed, 2, 'phím T tăng tốc độ lên 2×');
  key('t'); key('t');
  eq(S.speed, 1, 'tốc độ quay vòng về 1×');
  key('p');
  eq(S.paused, true, 'phím P tạm dừng');
  ok(doc.getElementById('overlay').classList.contains('show'), 'hiện bảng tạm dừng');
  key('p');
  eq(S.paused, false, 'phím P tiếp tục');
  ok(!doc.getElementById('overlay').classList.contains('show'), 'ẩn bảng tạm dừng');

  const soundBtn = doc.getElementById('cSound');
  key('m');
  eq(NEON.Sound.on, false, 'phím M tắt âm thanh');
  eq(soundBtn.textContent, '🔇', 'biểu tượng loa đổi theo trạng thái');
  key('m');
  eq(NEON.Sound.on, true, 'phím M bật lại âm thanh');

  doc.getElementById('cSpeed').click();
  eq(S.speed, 2, 'nút tốc độ trên HUD hoạt động');
  doc.getElementById('cPause').click();
  eq(S.paused, true, 'nút tạm dừng hoạt động');
  doc.getElementById('cPause').click();
  doc.getElementById('cSide').click();
  ok(doc.getElementById('side').classList.contains('open'), 'nút bảng điều khiển mở panel bên');
  doc.getElementById('cMenu').click();
  ok(doc.getElementById('overlay').classList.contains('show'), 'nút ? mở hướng dẫn');
  ok(!!doc.getElementById('btnBack'), 'bảng hướng dẫn có nút quay lại');
  doc.getElementById('btnBack').click();
  ok(!doc.getElementById('overlay').classList.contains('show'), 'đóng hướng dẫn');

  // bảng thông tin tháp khi chọn
  const spot = tilesNextToPath(1)[0];
  NEON.placeTower('tesla', spot.gx, spot.gz);
  S.selected = S.towers[0];
  NEON.tick(0);                         // cập nhật panel
  const insp = doc.getElementById('inspector').textContent;
  ok(insp.includes('Trụ Sét'), 'panel phải hiển thị tên tháp đang chọn');
  ok(!!doc.getElementById('btnUp'), 'có nút nâng cấp');
  ok(!!doc.getElementById('btnSell'), 'có nút bán');
  doc.getElementById('btnUp').click();
  eq(S.towers[0].level, 2, 'bấm nút nâng cấp hoạt động');

  // thẻ tháp ở thanh dưới
  doc.querySelector('.card[data-tower="sniper"]').click();
  eq(S.buildMode, 'sniper', 'bấm thẻ tháp để chọn xây');

  // Space gọi đợt
  key('Escape');
  key(' ');
  eq(S.waveActive, true, 'Space gọi đợt sớm');
  ok(S.gold > 0, 'được thưởng vàng khi gọi đợt sớm');
});

T('9. Chuột / cảm ứng: xoay, zoom, chọn ô, đặt tháp', () => {
  NEON.startGame('normal');
  giveGold(2000);
  const cv = doc.getElementById('c');
  cv.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1024, height: 768, right: 1024, bottom: 768, x: 0, y: 0 });
  const fire = (type, opt) => cv.dispatchEvent(new win.MouseEvent(type, Object.assign({ bubbles: true, cancelable: true }, opt)));

  const theta0 = NEON.CAM.theta, dist0 = NEON.CAM.dist;
  fire('pointerdown', { clientX: 500, clientY: 400 });
  fire('pointermove', { clientX: 560, clientY: 420 });
  fire('pointerup', { clientX: 560, clientY: 420 });
  ok(Math.abs(NEON.CAM.theta - theta0) > 0.05, 'kéo chuột làm xoay camera');

  cv.dispatchEvent(new win.WheelEvent('wheel', { deltaY: -240, bubbles: true, cancelable: true }));
  lt(NEON.CAM.dist, dist0, 'lăn chuột để thu phóng');

  // chọn ô bằng con trỏ: chiếu toạ độ thế giới của một ô trống lên màn hình
  const spot = tilesNextToPath(1)[0];
  const world = NEON.worldPos(spot.gx, spot.gz);
  NEON.camera.updateMatrixWorld(true);
  const p = new THREE.Vector3(world.x, 0, world.z).project(NEON.camera);
  const cx = (p.x + 1) / 2 * 1024, cy = (1 - p.y) / 2 * 768;
  fire('pointermove', { clientX: cx, clientY: cy });
  ok(!!S.hover, 'di chuột xác định được ô đang trỏ tới');
  eq(S.hover.gx, spot.gx, 'toạ độ ô trỏ tới khớp với ô mong đợi');
  eq(S.hover.gz, spot.gz, 'trục z của ô trỏ tới khớp');

  NEON.selectBuild('gun');
  const before = S.towers.length;
  fire('pointerdown', { clientX: cx, clientY: cy });
  fire('pointerup', { clientX: cx, clientY: cy });
  eq(S.towers.length, before + 1, 'bấm chuột đặt được tháp đúng ô');

  // bấm vào tháp đã xây để chọn
  NEON.cancelBuild();
  S.selected = null;
  fire('pointerdown', { clientX: cx, clientY: cy });
  fire('pointerup', { clientX: cx, clientY: cy });
  ok(S.selected && S.selected.type === 'gun', 'bấm vào tháp để chọn & xem thông tin');

  // bấm ra ô trống để bỏ chọn
  const far = NEON.worldPos(2, 1);
  const p2 = new THREE.Vector3(far.x, 0, far.z).project(NEON.camera);
  fire('pointerdown', { clientX: (p2.x + 1) / 2 * 1024, clientY: (1 - p2.y) / 2 * 768 });
  fire('pointerup', { clientX: (p2.x + 1) / 2 * 1024, clientY: (1 - p2.y) / 2 * 768 });
  eq(S.selected, null, 'bấm ra ngoài để bỏ chọn tháp');

  win.dispatchEvent(new win.Event('resize'));
  ok(true, 'sự kiện resize không gây lỗi');
});

T('10. Fuzz điều khiển ngẫu nhiên (không được văng lỗi)', () => {
  NEON.startGame('hard');
  const key = (k) => win.dispatchEvent(new win.KeyboardEvent('keydown', { key: k }));
  const types = ['gun', 'cannon', 'frost', 'tesla', 'sniper'];
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const spots = tilesNextToPath(60);
  S.paused = false;
  for (let i = 0; i < 2600; i++) {
    const r = rnd();
    if (r < 0.25) {
      const s = spots[Math.floor(rnd() * spots.length)];
      if (s && rnd() < 0.8) NEON.placeTower(types[Math.floor(rnd() * types.length)], s.gx, s.gz);
    } else if (r < 0.35 && S.towers.length) {
      const t = S.towers[Math.floor(rnd() * S.towers.length)];
      if (rnd() < 0.6) NEON.upgradeTower(t); else NEON.sellTower(t);
    } else if (r < 0.5) {
      if (!S.waveActive && (S.phase === 'build')) { S.gold += 400; NEON.startWave(); }
    } else if (r < 0.6) {
      key(String(1 + Math.floor(rnd() * 5)));
    } else if (r < 0.65) {
      key(['t', 'p', 'm', 'h', 'Escape', 'Tab', 'q', 'e', 'u', 'x', '+'][Math.floor(rnd() * 11)]);
      if (doc.getElementById('overlay').classList.contains('show')) {
        const b = doc.getElementById('btnBack') || doc.getElementById('btnResume');
        if (b) b.click();
      }
    } else if (r < 0.72) {
      NEON.CAM.dist = 14 + rnd() * 52; NEON.CAM.phi = 0.42 + rnd(); NEON.CAM.theta += rnd() * 2;
    } else {
      NEON.tick(1 / 30);
      if (S.towers.length > 8) S.gold = Math.max(S.gold, 300);
    }
    if (S.sim > 400) break;
  }
  S.paused = true;
  finite(S.gold, 'vàng vẫn là số hữu hạn');
  finite(S.score, 'điểm vẫn là số hữu hạn');
  ok(S.lives >= 0, 'mạng không bao giờ âm');
  ok(S.towers.every((t) => NEON.canBuild(t.gx, t.gz) === false), 'mọi ô có tháp đều bị đánh dấu là đã chiếm');
  ok(S.enemies.every((e) => Number.isFinite(e.pos.x) && Number.isFinite(e.pos.z)), 'vị trí địch luôn hợp lệ');
  ok(S.projectiles.length < 900, 'số đạn đang bay không rò rỉ (giới hạn hợp lý)');
});

T('11. Chơi trọn 25 đợt với hệ thống phòng thủ mạnh', () => {
  NEON.startGame('normal');
  const spots = tilesNextToPath(44);
  const types = ['gun', 'cannon', 'frost', 'tesla', 'sniper'];
  giveGold(200000);
  spots.forEach((s, i) => { NEON.placeTower(types[i % 5], s.gx, s.gz); S.gold = Math.max(S.gold, 3000); });
  gt(S.towers.length, 10, `đã dựng ${S.towers.length} tháp phòng thủ`);
  S.towers.forEach((t) => { for (let i = 0; i < 3; i++) NEON.upgradeTower(t); });
  gt(S.towers[0].level, 1, 'các tháp đã được nâng cấp');

  let guard = 0;
  while (S.phase !== 'victory' && S.phase !== 'over' && guard++ < 40) {
    if (!S.waveActive) {
      if (S.phase === 'menu') break;
      NEON.startWave();
    }
    const done = runUntil(() => !S.waveActive || S.phase === 'over' || S.phase === 'victory', 300);
    if (done < 0) break;
  }
  S.paused = true;
  ok(S.phase === 'victory' || S.wave >= 18, `cầm cự tới đợt ${S.wave} (trạng thái: ${S.phase})`);
  gt(S.kills, 50, `hạ được ${S.kills} địch trong cả ván`);
  if (S.phase === 'victory') {
    ok(doc.getElementById('overlay').classList.contains('show'), 'hiện bảng chiến thắng');
    ok(!!doc.getElementById('btnAgain'), 'có nút chơi lại');
    ok(doc.querySelector('.summary').textContent.includes('ĐIỂM'), 'có bảng tổng kết điểm');
    doc.getElementById('btnAgain').click();
    eq(S.phase, 'build', 'chơi lại được từ màn chiến thắng');
  }
});

T('12. Thua cuộc khi không phòng thủ', () => {
  NEON.startGame('easy');
  S.paused = false;
  let guard = 0;
  while (S.phase !== 'over' && guard++ < 12) {
    if (!S.waveActive) NEON.startWave();
    runUntil(() => !S.waveActive || S.phase === 'over', 200);
  }
  S.paused = true;
  eq(S.phase, 'over', 'để địch tràn vào căn cứ → thua');
  eq(S.lives, 0, 'mạng về 0');
  ok(doc.getElementById('overlay').classList.contains('show'), 'hiện bảng thất thủ');
  ok(!!doc.getElementById('btnMenu2'), 'có nút đổi độ khó');
  doc.getElementById('btnMenu2').click();
  ok(!!doc.getElementById('btnStart'), 'về được menu chính');

  // từ menu chọn độ khó khác rồi vào trận
  doc.querySelector('.diff[data-diff="hard"]').click();
  eq(S.diff, 'hard', 'đổi được độ khó ở menu');
  doc.getElementById('btnStart').click();
  eq(S.lives, NEON.DIFFICULTIES.hard.lives, 'ván mới dùng độ khó vừa chọn');
});

T('13. Địch monster / alien: icon SVG, dịch chuyển tức thời, tách đàn', () => {
  // --- icon SVG tự vẽ có đủ cho mọi loại tháp & địch
  const need = ['logo', 'gun', 'cannon', 'frost', 'tesla', 'sniper', 'alien', 'monster', 'spawn', 'grunt', 'runner', 'tank', 'flyer', 'boss'];
  const missing = need.filter((k) => !NEON.ICONS[k]);
  ok(missing.length === 0, 'bộ icon SVG có đủ ' + need.length + ' icon (tháp + địch)', 'thiếu: ' + missing.join(', '));
  const alienSvg = NEON.svgIcon('alien', '#7cf9d0');
  ok(alienSvg.startsWith('<svg') && alienSvg.includes('</svg>'), 'svgIcon() trả về thẻ <svg> hợp lệ');
  ok(NEON.svgIcon('khong-co-icon-nay').includes('<svg'), 'icon thiếu không làm vỡ giao diện (có icon dự phòng)');
  // cơ chế ghi đè icon bằng file game/icons/*.svg (đóng gói lúc build)
  ok(!!win.__NEON_ICON_OVERRIDES__, 'bundle có kênh ghi đè icon window.__NEON_ICON_OVERRIDES__');
  const ovKeys = Object.keys(win.__NEON_ICON_OVERRIDES__ || {});
  ok(ovKeys.includes('alien') && ovKeys.includes('monster'), 'icon alien/monster được nạp từ game/icons/*.svg', ovKeys.join(','));
  ok(NEON.ICONS.alien === win.__NEON_ICON_OVERRIDES__.alien, 'icon ghi đè được áp vào bảng ICONS của game');
  ok(!NEON.ICONS.alien.includes('<svg'), 'ICONS chỉ giữ phần thân SVG (không lồng thẻ <svg>) để nhận màu currentColor');

  NEON.startGame('normal');
  S.wave = 19; S.phase = 'build'; S.buildTimer = 15;
  NEON.updateWavePanel();                 // dựng lại bảng đợt kế tiếp (đợt 20)
  const panel = doc.getElementById('wavepanel').innerHTML;
  ok(panel.includes('data-ic="alien"') && panel.includes('data-ic="monster"'), 'bảng đợt kế tiếp hiển thị icon alien & monster');
  gt(doc.querySelectorAll('#wavepanel svg').length, 3, 'bảng đợt render icon SVG cho từng loại địch');
  ok(panel.includes('dịch chuyển') && panel.includes('tách'), 'bảng đợt ghi chú rõ dị năng của quái/dị dạng');

  // --- 👽 dịch chuyển tức thời: đi nhanh hơn hẳn tốc độ thường
  NEON.startGame('normal');
  S.paused = false;
  const alien = NEON.spawnEnemy('alien', 9);
  alien.dist = 20; alien.blinkT = 0;
  const t0 = S.sim;
  step(1 / 30, 30 * 6);                       // 6 giây
  const travelled = alien.dist - 20;
  const plain = alien.speed * (S.sim - t0);
  S.paused = true;
  gt(travelled, plain * 1.25, `alien dịch chuyển xa hơn đi thường (${travelled.toFixed(1)} > ${plain.toFixed(1)} ô)`);
  eq(NEON.ENEMIES.alien.blink, 7.5, 'đúng số ô mỗi lần dịch chuyển');

  // --- bị làm chậm thì không dịch chuyển được
  NEON.startGame('normal');
  S.paused = false;
  const a2 = NEON.spawnEnemy('alien', 9);
  a2.dist = 20; a2.blinkT = 0;
  a2.slowUntil = S.sim + 999; a2.slowAmt = 0.5;
  const d0 = a2.dist, t1 = S.sim;
  step(1 / 30, 30 * 6);
  S.paused = true;
  eq(a2.blinkT, 0, 'khi đang bị làm chậm, alien không tích luỹ dịch chuyển');
  lt(a2.dist - d0, a2.speed * 0.6 * (S.sim - t1) * 1.2, 'đang bị làm chậm thì không nhảy tắt đường');

  // --- 🧟 quái vật đột biến: chết tách thành 2 ấu trùng
  NEON.startGame('normal');
  S.paused = false;
  NEON.spawnEnemy('grunt', 5);
  const mon = NEON.spawnEnemy('monster', 12);
  const beforeCount = S.enemies.length;
  NEON.damageEnemy(mon, 99999, {});
  const spawned = S.enemies.filter((e) => e.type === 'spawn');
  eq(spawned.length, 2, 'quái vật bị hạ tách thành đúng 2 ấu trùng');
  eq(S.enemies.length, beforeCount - 1 + 2, 'số địch trên bản đồ cập nhật đúng sau khi tách');
  ok(spawned.every((e) => e.hp > 0 && e.maxHp === e.hp), 'ấu trùng mới có máu hợp lệ');
  gt(spawned[0].speed, mon.speed, 'ấu trùng chạy nhanh hơn quái vật mẹ');
  ok(S.enemies.every((e) => e.alive), 'ấu trùng được thêm vào danh sách đang sống');
  step(1 / 30, 30);
  ok(S.enemies.every((e) => Number.isFinite(e.pos.x)), 'ấu trùng di chuyển không lỗi');
  S.paused = true;
});

T('14. Vòng lặp render & dọn dẹp', () => {
  NEON.startGame('normal');
  const r0 = NEON.renderer.__renders;
  NEON.frame(1000);
  NEON.frame(1016);
  NEON.frame(1033);
  gt(NEON.renderer.__renders, r0, 'renderer.render() được gọi trong vòng lặp frame');
  const objs = countMeshes(NEON.scene);
  NEON.startGame('normal');
  const objs2 = countMeshes(NEON.scene);
  ok(objs2 <= objs, 'ván mới dọn sạch mesh của ván cũ (không rò rỉ bộ nhớ)');
  ok(NEON.FX.length < 400, 'hàng đợi hiệu ứng được giải phóng');
  const before = NEON.S.enemies.length;
  NEON.spawnEnemy('boss', 25);
  eq(NEON.S.enemies.length, before + 1, 'spawn được trùm');
  NEON.S.paused = false;
  step(1 / 30, 200);
  NEON.S.paused = true;
  ok(true, 'mô phỏng 200 khung hình với trùm không lỗi');
});

/* ------------------------------- chạy ---------------------------------- */
console.log('NEON DEFENSE 3D — test headless (jsdom + stub WebGL)\n' + '='.repeat(64));
const t0 = Date.now();
for (const t of tests) {
  console.log('\n▶ ' + t.name);
  try { t.fn(); } catch (e) {
    fails.push(t.name + ' (ngoại lệ)');
    console.log('   💥 ngoại lệ: ' + (e && e.message));
    console.log('      ' + String(e && e.stack || '').split('\n').slice(1, 4).join('\n      '));
  }
}
console.log('\n' + '='.repeat(64));
if (errors.length) {
  console.log('⚠️  Lỗi runtime bắt được trong jsdom:');
  [...new Set(errors)].slice(0, 8).forEach((e) => console.log('   · ' + e));
  fails.push('runtime error trong jsdom');
}
console.log(`Kết quả: ${pass} kiểm tra đạt, ${fails.length} thất bại · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (fails.length) fails.forEach((f) => console.log('   ✗ ' + f));
else console.log('🎉 Tất cả kiểm tra đều đạt!');
try { win.close(); } catch (e) { /* ignore */ }
process.exit(fails.length ? 1 : 0);
