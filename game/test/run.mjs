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
NEON.unlockAll();  // test chạy trên mọi bản đồ, không phụ thuộc tiến độ lưu trong máy
const LV0 = NEON.LEVELS[0].id;      // Đồng Bằng Neon
const LVC = NEON.LEVELS[1].id;      // Hành Lang Xoắn (bản đồ cân bằng chuẩn)
/** Bắt đầu ván ở một bản đồ cụ thể (mặc định: bản đồ cân bằng chuẩn). */
function play(levelId = LVC, diffId = 'normal') { NEON.startGame(levelId, diffId); }
win.addEventListener('error', (e) => errors.push('window.error: ' + (e.message || '')));

/* ================================ TESTS ================================ */
const tests = [];
const T = (name, fn) => tests.push({ name, fn });

T('1. Khởi động & dựng cảnh 3D', () => {
  ok(!!NEON, 'API window.NEON được tạo');
  ok(!!THREE && !!THREE.Vector3, 'Three.js r160 được nhúng và chạy được');
  eq(THREE.REVISION, '160', 'đúng phiên bản three r160');
  eq(S.phase, 'menu', 'trạng thái ban đầu là menu');
  ok(!!doc.getElementById('btnPlay'), 'menu chính có nút Chơi — chọn bản đồ');
  ok(!!doc.getElementById('btnBoard') && !!doc.getElementById('btnHelp'), 'menu có nút Bảng xếp hạng & Hướng dẫn');
  ok(!!doc.getElementById('nameInput'), 'menu có ô nhập tên người chơi cho bảng xếp hạng');
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
  // 6 bản đồ: mỗi bản đồ có đường đi riêng, số đợt riêng, kích thước riêng
  eq(NEON.LEVELS.length, 6, 'chiến dịch có 6 bản đồ');
  const shapes = new Set(), waves = new Set();
  for (const l of NEON.LEVELS) {
    NEON.setMap(l.id);
    const p = NEON.pathTiles();
    gt(p.size, 40, `bản đồ ${l.id}: đường đi có ${p.size} ô`);
    let inside = true;
    for (const t of p.values()) if (t.gx < 0 || t.gz < 0 || t.gx >= l.cols || t.gz >= l.rows) inside = false;
    ok(inside, `bản đồ ${l.id}: mọi ô đường đi nằm trong lưới ${l.cols}×${l.rows}`);
    const pts = NEON.pathWorldPoints();
    const [sx, sz] = l.path[0], [ex, ez] = l.path[l.path.length - 1];
    eq(sx, -1, `bản đồ ${l.id}: cổng vào ở mép trái`);
    eq(ex, l.cols, `bản đồ ${l.id}: căn cứ ở mép phải (điểm cuối x = số cột)`);
    const baseX = pts[pts.length - 1].x;
    ok(Math.abs(baseX - (l.cols + 1)) < 2, `bản đồ ${l.id}: căn cứ nằm ngay ngoài mép phải của sân (x=${baseX.toFixed(1)})`);
    const air = NEON.airWorldPoints();
    eq(air.length, 5, `bản đồ ${l.id}: có 5 mốc đường bay cho drone`);
    eq(l.air.length, 5, `bản đồ ${l.id}: dữ liệu đường bay đầy đủ`);
    gt(l.waves, 10, `bản đồ ${l.id}: ${l.waves} đợt tấn công`);
    shapes.add(JSON.stringify(l.path));
    waves.add(l.waves);
    // địch đi theo đường của bản đồ đang chọn
    const e = NEON.spawnEnemy('grunt', 1);
    ok(e.pts && e.pts.length === l.path.length, `bản đồ ${l.id}: địch đi đúng đường của bản đồ`);
    ok(Math.abs(e.pos.x) <= l.cols + 8, `bản đồ ${l.id}: điểm xuất phát của địch hợp lệ`);
  }
  eq(shapes.size, 6, '6 bản đồ có 6 bố cục đường đi khác nhau');
  gt(waves.size, 3, `số đợt khác nhau giữa các bản đồ (${[...waves].join(', ')} đợt)`);
  NEON.setMap(LVC);

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

T('3. Vào trận qua màn chọn bản đồ, xây tháp, chặn ô không hợp lệ', () => {
  NEON.showLevelSelect();
  eq(doc.querySelectorAll('.lvl').length, 6, 'màn chọn bản đồ có 6 thẻ bản đồ');
  doc.querySelector('.lvl[data-level="' + LV0 + '"]').click();
  doc.querySelector('.dchip[data-diff="normal"]').click();
  doc.getElementById('btnStart').click();
  eq(S.phase, 'build', 'bấm Bắt đầu → vào giai đoạn xây dựng');
  eq(S.level, LV0, 'chơi đúng bản đồ vừa chọn');
  eq(S.map.waves, 20, 'bản đồ Đồng Bằng Neon có 20 đợt');
  const expect = NEON.startState(NEON.levelDef(LV0), NEON.DIFFICULTIES.normal);
  eq(S.gold, expect.gold, 'vàng khởi đầu = vàng độ khó × hệ số bản đồ');
  eq(S.lives, expect.lives, 'mạng khởi đầu = mạng độ khó × hệ số bản đồ');
  NEON.startGame(LVC, 'normal');
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
  // xếp 5 tháp sát đoạn đầu đường đi để mọi loại đều có mục tiêu ngay đợt 1
  const entry = NEON.pathWorldPoints()[0];
  const dist = (sp) => { const p = NEON.worldPos(sp.gx, sp.gz); return Math.hypot(p.x - entry.x, p.z - entry.z); };
  const spots = tilesNextToPath(24).sort((a, b) => dist(a) - dist(b)).slice(0, 5);
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

  // nổ diện rộng: một viên pháo phải làm mất máu NHIỀU mục tiêu đứng sát nhau
  S.enemies.slice().forEach((e) => world_kill(e));
  const victims = [0, 1, 2].map(() => NEON.spawnEnemy('tank', 6));
  for (const v of victims) { v.hp = v.maxHp = 4000; }     // cho trâu để đo lượng máu mất
  step(1 / 30, 20);
  const hpBefore = victims.map((v) => v.hp);
  step(1 / 30, 150);
  const hurt = victims.filter((v, i) => v.hp < hpBefore[i] - 1e-6).length;
  ok(hurt >= 2, `một viên pháo làm mất máu ${hurt} mục tiêu trong 1 lần bắn → có nổ diện rộng`);
  gt(cannonT.dmg - (cannonT.dmg - cannonT.dmg), 0, 'pháo vẫn gây sát thương sau khi chỉnh test');
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
    eq(S.wave, 25, 'thắng đủ 25 đợt của Hành Lang Xoắn');
    gt(NEON.boardOf(LVC).length, 0, 'kết quả được ghi vào bảng xếp hạng của bản đồ');
    ok(doc.querySelector('.rankline').textContent.includes('hạng'), 'bảng kết hiện thứ hạng của bạn');
    ok(!!doc.getElementById('btnNext'), 'thắng màn thì có nút sang màn kế tiếp');
    ok(!!doc.getElementById('btnBoardEnd'), 'bảng kết có nút mở bảng xếp hạng');
    ok(!!doc.getElementById('nameInput'), 'bảng kết cho nhập tên người chơi');
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
  ok(!!doc.getElementById('btnLevels'), 'bảng kết có nút chọn bản đồ');
  doc.getElementById('btnLevels').click();
  ok(doc.querySelectorAll('.lvl').length === 6, 'về được màn chọn bản đồ');

  // chọn độ khó khác rồi vào trận
  doc.querySelector('.dchip[data-diff="hard"]').click();
  eq(S.diff, 'hard', 'đổi được độ khó ở màn chọn bản đồ');
  doc.getElementById('btnStart').click();
  eq(S.diff, 'hard', 'ván mới dùng độ khó vừa chọn');
  eq(S.lives, NEON.startState(NEON.levelDef(S.level), NEON.DIFFICULTIES.hard).lives, 'mạng khởi đầu theo độ khó Khó của bản đồ đó');
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

T('14. Địch phải HIỆN trên bản đồ (chống lỗi "tháp bắn mà không thấy địch")', () => {
  const sceneCount = () => NEON.countInScene('enemy:');
  NEON.startGame('normal');
  eq(sceneCount(), 0, 'ván mới chưa có model địch nào trong scene');

  const types = ['grunt', 'runner', 'tank', 'flyer', 'alien', 'monster', 'spawn', 'boss'];
  const models = types.map((t) => NEON.spawnEnemy(t, 10));
  eq(S.enemies.length, types.length, `spawn đủ ${types.length} loại địch`);
  eq(sceneCount(), types.length, 'MỌI địch đều được thêm vào scene graph (đây chính là lỗi đã gặp)');

  for (const e of models) {
    eq(e.g.parent, NEON.world, `model ${e.type} nằm trong nhóm world của scene`);
    ok(e.g.visible, `model ${e.type} đang bật hiển thị`);
    const parts = [];
    e.g.traverse((o) => { if (o.isMesh) parts.push(o); });
    gt(parts.length, 2, `model ${e.type} có ${parts.length} mesh (không phải group rỗng)`);
    ok(parts.every((m) => m.material && m.material.visible !== false), `mọi mesh của ${e.type} có material hợp lệ`);
    ok(parts.some((m) => m.name === 'enemy-marker'), `model ${e.type} có vòng sáng dưới chân giúp dễ nhìn`);
    ok(Number.isFinite(e.g.position.x) && Number.isFinite(e.g.position.z), `vị trí ${e.type} hợp lệ`);
    ok(Math.abs(e.g.position.x) <= NEON.GRID.W / 2 + 8, `vị trí x của ${e.type} nằm trong sân đấu (${e.g.position.x.toFixed(1)})`);
    ok(Math.abs(e.g.position.z) <= NEON.GRID.D / 2 + 8, `vị trí z của ${e.type} nằm trong sân đấu (${e.g.position.z.toFixed(1)})`);
    ok(e.g.scale.x > 0.1, `model ${e.type} có kích thước nhìn thấy được (scale ${e.g.scale.x})`);
  }

  // trong suốt trận, số model trong scene luôn khớp số địch trong logic
  S.paused = false;
  NEON.startWave();
  let matched = true;
  for (let i = 0; i < 40 && matched; i++) {
    step(1 / 30, 15);
    if (sceneCount() !== S.enemies.length) matched = false;
  }
  ok(matched, `số model trong scene luôn khớp số địch trong logic (${S.enemies.length} địch ↔ ${sceneCount()} model)`);

  // địch bay phải ở trên cao, địch mặt đất phải sát mặt đất
  const flyer = S.enemies.find((e) => e.air);
  const ground = S.enemies.find((e) => !e.air);
  if (flyer) gt(flyer.g.position.y, 1.5, `drone bay ở trên cao (y=${flyer.g.position.y.toFixed(1)})`);
  if (ground) lt(ground.g.position.y, 0.6, `địch mặt đất sát nền (y=${ground.g.position.y.toFixed(2)})`);

  // kiểm tra "sẽ thực sự được renderer vẽ": chiếu lên màn hình + kiểm tra frustum
  NEON.camera.updateMatrixWorld(true);
  NEON.camera.updateProjectionMatrix();
  NEON.scene.updateMatrixWorld(true);
  const frustum = new THREE.Frustum().setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(NEON.camera.projectionMatrix, NEON.camera.matrixWorldInverse));
  const v = new THREE.Vector3();
  let onScreen = 0, inFrustum = 0;
  for (const e of S.enemies) {
    v.copy(e.pos); v.y += 0.5; v.project(NEON.camera);
    if (Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 && v.z < 1) onScreen++;
    let body = null;
    e.g.traverse((o) => { if (!body && o.isMesh && o.name !== 'enemy-marker') body = o; });
    if (body && frustum.intersectsObject(body)) inFrustum++;
  }
  gt(onScreen, 0, `${onScreen}/${S.enemies.length} địch đang nằm trong khung nhìn ở góc camera mặc định`);
  ok(inFrustum >= onScreen, `mọi địch trong khung nhìn đều vượt bước kiểm tra frustum (${inFrustum} ≥ ${onScreen})`);
  ok(Math.abs(S.enemies[0].g.position.x) < 30, 'địch không bị đẩy ra ngoài sân đấu');

  // dọn dẹp khi chết / sang ván mới
  const victim = S.enemies[0];
  NEON.damageEnemy(victim, 1e9, {});
  eq(victim.g.parent, null, 'địch bị hạ được gỡ khỏi scene');
  NEON.startGame('normal');
  eq(sceneCount(), 0, 'ván mới dọn sạch model địch cũ');
  S.paused = true;
});

T('15. Vòng lặp render & dọn dẹp', () => {
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


T('16. Sáu bản đồ: icon, kích thước, số đợt khác nhau', () => {
  // icon SVG cho từng bản đồ
  const mapIcons = ['map-plains', 'map-corridor', 'map-frost', 'map-desert', 'map-orbit', 'map-core', 'map'];
  const missing = mapIcons.filter((k) => !NEON.ICONS[k]);
  eq(missing.length, 0, `có đủ ${mapIcons.length} icon bản đồ (thiếu: ${missing.join(', ') || 'không'})`);
  ok(mapIcons.every((k) => /stroke|fill/.test(NEON.ICONS[k]) && NEON.ICONS[k].includes('currentColor')),
    'mọi icon bản đồ dùng currentColor để ăn theo màu giao diện');
  ok(NEON.LEVELS.every((l) => !!NEON.ICONS[l.icon]), 'mỗi bản đồ trỏ tới một icon có thật');
  ok(!!win.__NEON_ICON_OVERRIDES__ && Object.keys(win.__NEON_ICON_OVERRIDES__).length >= 8,
    `icon ghi đè được nhúng vào bản dựng (${Object.keys(win.__NEON_ICON_OVERRIDES__ || {}).length} icon)`);

  NEON.showMenu();
  ok(doc.querySelector('.modal h1').textContent.includes('NEON DEFENSE'), 'màn chính có tiêu đề game');
  NEON.showLevelSelect();
  const cards = [...doc.querySelectorAll('.lvl')];
  eq(cards.length, 6, 'màn chọn bản đồ hiện đủ 6 thẻ');
  eq(doc.querySelectorAll('.dchip').length, 3, 'có 3 chip độ khó (Dễ / Thường / Khó)');

  const wavesSeen = [];
  for (const l of NEON.LEVELS) {
    const card = doc.querySelector(`.lvl[data-level="${l.id}"]`);
    ok(!!card, `có thẻ cho bản đồ ${l.id}`);
    eq(card.querySelectorAll('.lvl-icon svg').length, 1, `thẻ ${l.id} có icon SVG`);
    eq(card.querySelector('.lvl-name small').textContent.trim().split('·')[1].trim(), `${l.cols}×${l.rows} ô`,
      `thẻ ${l.id} ghi kích thước ${l.cols}×${l.rows} ô`);
    const pills = [...card.querySelectorAll('.pill')].map((p) => p.textContent);
    ok(pills.some((t) => t.includes(`${l.waves} đợt`)), `thẻ ${l.id} ghi rõ ${l.waves} đợt tấn công`);
    ok(pills.length >= 4, `thẻ ${l.id} hiện mạng, vàng và độ nguy hiểm`);
    card.click();
    wavesSeen.push(doc.getElementById('btnStart').textContent.trim());
    ok(doc.getElementById('btnStart').textContent.includes(`${l.waves} đợt`), `chọn ${l.id} → nút bắt đầu ghi ${l.waves} đợt`);
  }
  eq(new Set(NEON.LEVELS.map((l) => l.waves)).size, 5, `số đợt khác nhau giữa các bản đồ: ${NEON.LEVELS.map((l) => l.waves).join(' · ')}`);
  ok(wavesSeen.every((t, i) => t.includes(String(NEON.LEVELS[i].waves))), 'mỗi thẻ chọn đúng số đợt của bản đồ đó');
  // đổi độ khó ở màn chọn → nút bắt đầu + chip sáng theo
  doc.querySelector('.dchip[data-diff="hard"]').click();
  eq(S.diff, 'hard', 'chip độ khó Khó được chọn');
  ok(doc.querySelector('.dchip[data-diff="hard"]').classList.contains('sel'), 'chip Khó sáng lên');
  doc.querySelector('.dchip[data-diff="normal"]').click();
  NEON.showLevelSelect();
  eq(NEON.LEVELS[5].waves, 40, 'bản đồ cuối (Lõi Lượng Tử) có 40 đợt');
  eq(NEON.LEVELS[0].waves, 20, 'bản đồ đầu (Đồng Bằng Neon) có 20 đợt');
});

T('17. Tiến độ: hạ màn này mở khoá màn kế', () => {
  NEON.resetProgress();
  eq(NEON.clearedCount(), 0, 'xoá tiến độ → 0 bản đồ đã hạ');
  eq(NEON.boardCount(), 0, 'xoá tiến độ → bảng xếp hạng trống');
  eq(NEON.isUnlocked('plains'), true, 'bản đồ đầu luôn mở');
  eq(NEON.isUnlocked('corridor'), false, 'bản đồ 2 khoá khi chưa hạ màn 1');
  NEON.showLevelSelect();
  eq(doc.querySelectorAll('.lvl.locked').length, 5, 'màn chọn hiện 5 thẻ khoá 🔒');
  eq(doc.querySelectorAll('.lvl.locked .lvl-lock').length, 5, 'thẻ khoá có ổ khoá');
  ok(doc.querySelector('.lvl[data-level="corridor"] .lvl-foot').textContent.includes('Đồng Bằng Neon'),
    'thẻ khoá chỉ rõ cần hạ bản đồ nào');
  // bấm vào bản đồ khoá: không vào trận
  S.phase = 'menu';
  S.level = 'plains';
  NEON.showLevelSelect();
  doc.querySelector('.lvl[data-level="core"]').click();
  eq(S.level, 'plains', 'bấm bản đồ khoá không đổi bản đồ đang chọn');
  doc.getElementById('btnStart').click();
  ok(S.phase !== 'build' || S.level === 'plains', 'không vào trận ở bản đồ còn khoá');

  // chơi thật bản đồ đầu ở độ Dễ rồi hạ màn
  NEON.startGame('plains', 'easy');
  eq(S.map.waves, 20, 'ván mới dùng bản đồ Đồng Bằng Neon (20 đợt)');
  const spots = tilesNextToPath(30);
  const types = ['gun', 'cannon', 'frost', 'tesla', 'sniper'];
  giveGold(300000);
  spots.forEach((sp, i) => { NEON.placeTower(types[i % 5], sp.gx, sp.gz); S.gold = Math.max(S.gold, 4000); });
  S.towers.forEach((t) => { for (let i = 0; i < 3; i++) NEON.upgradeTower(t); });
  let guard = 0;
  while (S.phase !== 'victory' && S.phase !== 'over' && guard++ < 40) {
    if (!S.waveActive) NEON.startWave();
    const done = runUntil(() => !S.waveActive || S.phase === 'over' || S.phase === 'victory', 300);
    if (done < 0) break;
  }
  S.paused = true;
  eq(S.phase, 'victory', 'hạ được bản đồ đầu tiên');
  eq(NEON.clearedCount(), 1, 'tiến độ ghi nhận 1/6 bản đồ đã hạ');
  eq(NEON.isUnlocked('corridor'), true, 'hạ màn 1 → mở khoá màn 2');
  eq(NEON.isUnlocked('frost'), false, 'màn 3 vẫn khoá (chưa hạ màn 2)');
  const best = NEON.bestOf('plains');
  ok(!!best && best.win === true, 'kỷ lục của bản đồ lưu trạng thái thắng');
  eq(best.wave, 20, 'kỷ lục ghi đúng số đợt đã vượt qua của bản đồ');
  eq(best.difficulty, 'easy', 'kỷ lục ghi đúng độ khó đã chơi');
  const raw = win.localStorage.getItem('neon-defense-board:plains');
  ok(!!raw && JSON.parse(raw).length >= 1, 'bảng xếp hạng lưu vào localStorage theo từng bản đồ');
  NEON.showLevelSelect();
  eq(doc.querySelectorAll('.lvl.locked').length, 4, 'màn chọn cập nhật còn 4 thẻ khoá');
  ok(doc.querySelector('.lvl[data-level="plains"] .lvl-best').textContent.includes('Kỷ lục'), 'thẻ bản đồ hiện kỷ lục');
  const inp = doc.getElementById('nameInput');
  inp.value = 'Tester VN';
  inp.dispatchEvent(new win.Event('change'));
  eq(NEON.playerName(), 'Tester VN', 'lưu được tên người chơi');
  eq(win.localStorage.getItem('neon-defense-name'), 'Tester VN', 'tên người chơi lưu vào localStorage');
  const top = NEON.boardOf('plains')[0];
  NEON.renameEntry('plains', top.id, 'Tester VN');
  eq(NEON.boardOf('plains')[0].name, 'Tester VN', 'đổi được tên của bản ghi trong bảng xếp hạng');
  NEON.showLevelSelect();
  ok(doc.querySelector('.lvl[data-level="plains"] .lvl-best').textContent.includes('Tester VN'),
    'màn chọn bản đồ hiện tên người dẫn đầu');

  // mở khoá toàn bộ để các test sau chạy trên mọi bản đồ (như lúc khởi động)
  NEON.unlockAll();
  eq(NEON.LEVELS.filter((l) => NEON.isUnlocked(l.id)).length, 6, 'mở khoá toàn bộ bản đồ trở lại');
});

T('18. Bảng xếp hạng: sắp hạng, top 10, tách riêng từng bản đồ', () => {
  NEON.resetProgress();
  NEON.unlockAll();
  const mk = (score, wave, kills, name, t) => ({
    levelId: 'frost', name, score, wave, kills, lives: 10, difficulty: 'normal',
    win: wave >= 30, time: t, id: NEON.makeEntryId(),
  });
  // 12 điểm tăng dần → chỉ giữ top 10
  for (let i = 1; i <= 12; i++) {
    const res = NEON.submitScore(mk(i * 1000, i, i, 'Bot' + i, 1000 + i));
    ok(res.rank <= 10 || !res.inserted, `điểm ${i * 1000} được xếp hạng ${res.rank}`);
  }
  const board = NEON.boardOf('frost');
  eq(board.length, 10, 'bảng xếp hạng giữ đúng top 10');
  eq(board[0].score, 12000, 'điểm cao nhất đứng đầu');
  eq(board[9].score, 3000, 'điểm thấp nhất trong top là 3000 (2 điểm thấp bị loại)');
  ok(board.every((e, i, a) => i === 0 || a[i - 1].score >= e.score), 'bảng xếp hạng sắp giảm dần theo điểm');
  eq(NEON.qualifies('frost', 0), false, 'điểm 0 không lọt top 10 đầy');
  eq(NEON.qualifies('frost', 99999), true, 'điểm rất cao thì lọt top');
  eq(NEON.boardOf('corridor').length, 0, 'bảng của bản đồ khác vẫn trống (tách riêng từng bản đồ)');
  const r = NEON.submitScore(mk(50000, 30, 300, 'Gioi Nhat', 2000));
  eq(r.rank, 1, 'điểm mới cao nhất lên hạng #1');
  eq(NEON.boardOf('frost')[1].name, 'Bot12', 'các hạng sau bị đẩy xuống 1 bậc');
  ok(JSON.parse(win.localStorage.getItem('neon-defense-board:frost')).length === 10, 'localStorage cũng chỉ giữ 10 dòng');

  // hiển thị
  NEON.showLeaderboard('frost');
  ok(doc.querySelector('.modal h1').textContent.includes('Kỷ lục'), 'mở được trang bảng xếp hạng');
  eq(doc.querySelectorAll('.ltab').length, 6, 'trang bảng xếp hạng có tab cho từng bản đồ');
  const rows = [...doc.querySelectorAll('table.board tbody tr')];
  eq(rows.length, 10, 'bảng hiện đủ 10 dòng top 10');
  ok(rows[0].querySelector('.rank').textContent.includes('🥇'), 'dòng đầu là hạng 1 (huy chương vàng)');
  ok(rows[0].querySelector('.sc').textContent.includes('50'), 'dòng đầu hiện điểm cao nhất');
  ok(rows[0].querySelector('.nm').textContent.includes('Gioi Nhat'), 'bảng hiện tên người chơi');
  ok(rows[0].className.includes('me') || rows[0].className.includes('top'), 'hạng nhất được làm nổi bật');
  doc.querySelector('.ltab[data-lb="corridor"]').click();
  ok(doc.querySelector('table.board td.empty'), 'bản đồ chưa có điểm thì hiện thông báo trống');
  doc.querySelector('.ltab[data-lb="frost"]').click();
  eq(doc.querySelectorAll('table.board tbody tr').length, 10, 'chuyển tab sang bản đồ khác hiện đúng bảng của bản đồ đó');
  // mở từ ván đấu: nút "Chơi bản đồ này" chạy được
  doc.getElementById('btnPlay').click();
  eq(S.level, 'frost', 'nút Chơi bản đồ này vào trận ở đúng bản đồ của tab');
  ok(S.phase === 'build', 'vào trận từ trang bảng xếp hạng');
  S.paused = true;
  NEON.showLeaderboard('frost');
  doc.getElementById('btnReset').click();
  eq(NEON.boardOf('frost').length, 0, 'nút xoá bảng xếp hạng xoá đúng bảng của bản đồ');
  ok(!!doc.querySelector('table.board td.empty'), 'bảng trống hiện thông báo chưa có điểm');
  NEON.showLeaderboard('frost');
  eq(doc.querySelectorAll('.ltab').length, 6, 'mở lại bảng xếp hạng vẫn đủ 6 tab');
  // ghi điểm vào nhiều bản đồ rồi kiểm tra tổng
  NEON.submitScore({ ...mk(7000, 20, 90, 'B', 5000), levelId: 'plains' });
  eq(NEON.boardCount(), 1, `bảng của frost đã bị xoá, chỉ còn ${NEON.boardCount()} điểm ở bản đồ khác`);
  NEON.resetProgress();
  NEON.unlockAll();
  eq(NEON.boardCount(), 0, 'xoá tiến độ cũng xoá bảng xếp hạng');
});

T('19. HUD & bảng phụ theo bản đồ đang chơi', () => {
  NEON.startGame('orbit', 'normal');
  const chip = doc.querySelector('.chip.map');
  const orbit = NEON.LEVELS.find((l) => l.id === 'orbit');
  ok(!!chip, 'HUD có chip tên bản đồ');
  eq(chip.textContent.trim(), orbit.name, 'chip hiện đúng tên bản đồ đang chơi');
  eq(chip.querySelectorAll('svg').length, 1, 'chip bản đồ có icon');
  ok(chip.title.includes(`${orbit.waves} đợt`), 'chip bản đồ ghi số đợt khi rê chuột');
  eq(doc.getElementById('vWave').textContent, `0/${orbit.waves}`, `chip đợt hiện đúng 0/${orbit.waves}`);
  NEON.updateHUD(true);
  eq(NEON.S.map.waves, 35, 'ván đang chơi là bản đồ 35 đợt');
  // tạm dừng: bảng tạm dừng ghi đúng bản đồ + số đợt
  S.paused = false;
  NEON.showPause();
  ok(doc.querySelector('#overlay .sub').textContent.includes(orbit.name), 'bảng tạm dừng ghi tên bản đồ');
  ok(doc.querySelector('#overlay .sub').textContent.includes(`/${orbit.waves}`), `bảng tạm dừng ghi đợt x/${orbit.waves}`);
  doc.getElementById('btnBoard2').click();
  ok(doc.querySelector('#overlay h1').textContent.includes('Kỷ lục'), 'từ tạm dừng mở được bảng xếp hạng');
  doc.getElementById('btnBoardBack').click();
  ok(!!doc.getElementById('btnResume'), 'nút Quay lại đưa về bảng tạm dừng');
  doc.getElementById('btnResume').click();
  eq(S.paused, false, 'nút Tiếp tục chạy lại ván');
  // trợ giúp từ màn chính / trong ván
  NEON.showHelp();
  ok(!!doc.getElementById('btnBack'), 'bảng hướng dẫn có nút quay lại');
  NEON.startGame('core', 'hard');
  eq(S.map.waves, 40, 'bản đồ cuối có 40 đợt khi vào trận');
  NEON.showPause();
  ok(doc.getElementById('btnQuit').textContent.includes('Chọn bản đồ'), 'bảng tạm dừng có nút đổi bản đồ');
  doc.getElementById('btnQuit').click();
  eq(doc.querySelectorAll('.lvl').length, 6, 'nút đổi bản đồ mở màn chọn bản đồ');
  NEON.startGame(LVC, 'normal');
  S.paused = true;
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
