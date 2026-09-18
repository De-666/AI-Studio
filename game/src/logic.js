/* =========================================================================
 * NEON DEFENSE — Lõi logic thuần (không DOM, không THREE) => test được bằng Node
 * Gồm: bản đồ/level, lưới & đường đi, chỉ số tháp, kẻ địch, công thức đợt sóng,
 *      độ khó, kinh tế, và helper xếp hạng cho bảng điểm.
 * ========================================================================= */

export const TILE = 2;
export const MAX_LEVEL = 5;
export const BUILD_TIME = 20;          // giây đếm ngược trước khi tự động mở đợt

/* =============================== BẢN ĐỒ ================================= */
/**
 * Mỗi bản đồ là một "level": kích thước lưới riêng, đường đi riêng, số đợt riêng,
 * độ khó nền riêng và trọng số quân riêng (waveBias) → chơi mỗi map thấy khác nhau.
 *
 *  - path: các mốc đường đi (toạ độ ô). Điểm đầu ở x = -1 (cổng vào bên trái),
 *          điểm cuối ở x = cols (căn cứ bên phải) để căn cứ luôn nằm trong sân.
 *  - air:  đường bay cho drone (5 mốc).
 *  - waves: số đợt tấn công của màn này.
 *  - hpMul / goldMul: hệ số máu địch & vàng nhận của màn (dùng để cân bằng).
 *  - seed: hạt giống rải trang trí (đá, tinh thể, cây…) để mỗi map một bố cục khác nhau.
 */
export const LEVELS = [
  {
    id: 'plains', name: 'Đồng Bằng Neon', icon: 'map-plains', badge: '🌱', tier: 'Khởi đầu',
    desc: 'Bãi đất phẳng, đường đi ngắn và rộng rãi — nơi lý tưởng để làm quen cơ chế.',
    cols: 18, rows: 14, waves: 20, lives: 25, gold: 270, hpMul: 0.85, goldMul: 1.18, seed: 1201,
    path: [[-1, 3], [14, 3], [14, 7], [2, 7], [2, 11], [18, 11]],
    air: [[-1, 3], [5, 11], [10, 2], [14, 11], [18, 11]],
    waveBias: {},
  },
  {
    id: 'corridor', name: 'Hành Lang Xoắn', icon: 'map-corridor', badge: '⚙️', tier: 'Tiêu chuẩn',
    desc: 'Bàn chơi kinh điển: đường zíc-zắc nhiều khúc cua, chỗ đặt tháp dày nhưng cũng dễ bị lọt.',
    cols: 22, rows: 16, waves: 25, lives: 20, gold: 220, hpMul: 1.0, goldMul: 1.0, seed: 7771,
    path: [[-1, 3], [3, 3], [3, 8], [0, 8], [0, 13], [7, 13], [7, 6], [11, 6], [11, 14], [16, 14], [16, 9], [19, 9], [19, 3], [22, 3]],
    air: [[-1, 3], [5, 13], [10, 2], [16, 13], [22, 3]],
    waveBias: {},
  },
  {
    id: 'frost', name: 'Mê Cung Băng', icon: 'map-frost', badge: '❄️', tier: 'Khó',
    desc: 'Đường dài quanh co trong giá lạnh. Drone bay xuất hiện nhiều hơn hẳn — nhớ chia tháp bắn mục tiêu bay.',
    cols: 22, rows: 16, waves: 30, lives: 18, gold: 215, hpMul: 1.06, goldMul: 1.0, seed: 3312,
    path: [[-1, 2], [18, 2], [18, 6], [3, 6], [3, 10], [19, 10], [19, 14], [22, 14]],
    air: [[-1, 2], [6, 12], [12, 3], [18, 13], [22, 14]],
    waveBias: { flyer: 1.55, runner: 1.2 },
  },
  {
    id: 'desert', name: 'Sa Mạc Plasma', icon: 'map-desert', badge: '🏜️', tier: 'Khó',
    desc: 'Bàn chơi rộng với 5 làn chạy dọc — xe tăng và quái đột biến nườm nượp, cần pháo và sét diện rộng.',
    cols: 26, rows: 16, waves: 30, lives: 18, gold: 240, hpMul: 1.18, goldMul: 0.98, seed: 5510,
    path: [[-1, 2], [23, 2], [23, 5], [2, 5], [2, 8], [23, 8], [23, 11], [2, 11], [2, 14], [26, 14]],
    air: [[-1, 2], [8, 13], [17, 3], [22, 13], [26, 14]],
    waveBias: { tank: 1.45, monster: 1.25 },
  },
  {
    id: 'orbit', name: 'Vành Đai Sao', icon: 'map-orbit', badge: '🛰️', tier: 'Rất khó',
    desc: 'Trạm ngoài quỹ đạo: sinh vật ngoài hành tinh dịch chuyển tức thời liên tục. Súng Băng gần như bắt buộc.',
    cols: 24, rows: 18, waves: 35, lives: 16, gold: 240, hpMul: 1.3, goldMul: 0.95, seed: 8802,
    path: [[-1, 3], [20, 3], [20, 7], [3, 7], [3, 11], [20, 11], [20, 15], [24, 15]],
    air: [[-1, 3], [7, 15], [14, 4], [20, 15], [24, 15]],
    waveBias: { alien: 1.6, flyer: 1.35 },
  },
  {
    id: 'core', name: 'Lõi Tử Thần', icon: 'map-core', badge: '☠️', tier: 'Ác mộng',
    desc: '40 đợt, trùm đi theo bầy, quái đột biến nở rộ. Chỉ dành cho người đã thắng mọi bản đồ khác.',
    cols: 24, rows: 18, waves: 40, lives: 14, gold: 245, hpMul: 1.45, goldMul: 0.92, seed: 9907,
    path: [[-1, 2], [21, 2], [21, 6], [2, 6], [2, 10], [21, 10], [21, 13], [3, 13], [3, 16], [24, 16]],
    air: [[-1, 2], [9, 16], [16, 3], [21, 16], [24, 16]],
    waveBias: { boss: 1.4, monster: 1.5, alien: 1.4, tank: 1.3, flyer: 1.2 },
  },
];

export const levelDef = (id) => LEVELS.find((l) => l.id === id) || LEVELS[1];
export const levelIndex = (id) => Math.max(0, LEVELS.findIndex((l) => l.id === id));

/** Bản đồ đang chơi (được `setMap` cập nhật). */
let MAP = LEVELS[1];
export const activeMap = () => MAP;
export const totalWaves = () => MAP.waves;

/** Đổi bản đồ hiện hành: cập nhật lại GRID (mọi hàm toạ độ đọc trực tiếp GRID). */
export function setMap(idOrLevel) {
  MAP = typeof idOrLevel === 'string' ? levelDef(idOrLevel) : (idOrLevel || LEVELS[1]);
  GRID.COLS = MAP.cols; GRID.ROWS = MAP.rows;
  GRID.W = MAP.cols * TILE; GRID.D = MAP.rows * TILE;
  GRID.MIN_X = -GRID.W / 2; GRID.MIN_Z = -GRID.D / 2;
  GRID.id = MAP.id; GRID.waves = MAP.waves;
  return MAP;
}

export const GRID = { TILE, COLS: MAP.cols, ROWS: MAP.rows, W: MAP.cols * TILE, D: MAP.rows * TILE, MIN_X: -(MAP.cols * TILE) / 2, MIN_Z: -(MAP.rows * TILE) / 2, id: MAP.id, waves: MAP.waves };

/* giữ tương thích với code cũ */
export const START_LIVES = 20;
export const START_GOLD = 220;
export const TOTAL_WAVES = LEVELS[1].waves;

/* ------------------------------- toạ độ -------------------------------- */
export const worldX = (gx) => (gx + 0.5) * TILE - GRID.W / 2;
export const worldZ = (gz) => (gz + 0.5) * TILE - GRID.D / 2;
export const worldPos = (gx, gz) => ({ x: worldX(gx), z: worldZ(gz) });
export const gridFromWorld = (x, z) => ({
  gx: Math.floor((x + GRID.W / 2) / TILE),
  gz: Math.floor((z + GRID.D / 2) / TILE),
});
export const inGrid = (gx, gz) => gx >= 0 && gz >= 0 && gx < GRID.COLS && gz < GRID.ROWS;
export const key = (gx, gz) => gx + ',' + gz;

/* ------------------------------- đường đi ------------------------------- */
/** Danh sách ô thuộc đường đi, kèm hướng đi của từng ô (để vẽ làn đường). */
export function pathTiles(nodes) {
  const pts = nodes || MAP.path;
  const map = new Map();
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const dx = Math.sign(bx - ax), dz = Math.sign(bz - az);
    let x = ax, z = az;
    for (;;) {
      if (inGrid(x, z) && !map.has(key(x, z))) map.set(key(x, z), { gx: x, gz: z, dx, dz, seg: i });
      if (x === bx && z === bz) break;
      x += dx; z += dz;
    }
  }
  return map;
}

export function pathWorldPoints(nodes) {
  return (nodes || MAP.path).map(([gx, gz]) => worldPos(gx, gz));
}

/** Đường bay của địch trên không (drone) của bản đồ hiện tại. */
export function airWorldPoints(nodes) {
  return (nodes || MAP.air).map(([gx, gz]) => worldPos(gx, gz));
}

/* --------------------------- random có seed ----------------------------- */
export function makeRNG(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------- độ khó -------------------------------- */
export const DIFFICULTIES = {
  easy:   { id: 'easy',   name: 'Dễ',     icon: '🌱', hpMul: 0.80, spMul: 0.94, goldMul: 1.15, gold: 275, lives: 25, desc: 'Nhẹ nhàng, làm quen cơ chế' },
  normal: { id: 'normal', name: 'Thường', icon: '⚔️', hpMul: 1.00, spMul: 1.00, goldMul: 1.00, gold: 220, lives: 20, desc: 'Cân bằng, đúng chuẩn tower defense' },
  hard:   { id: 'hard',   name: 'Khó',    icon: '💀', hpMul: 1.32, spMul: 1.07, goldMul: 0.98, gold: 195, lives: 16, desc: 'Chỉ dành cho cao thủ' },
};
export const diffOf = (id) => DIFFICULTIES[id] || DIFFICULTIES.normal;

/** Số mạng & vàng khởi đầu thực tế = độ khó × bản đồ. */
export function startState(map = MAP, diff = DIFFICULTIES.normal) {
  return {
    lives: Math.round(diff.lives * (map.lives / DIFFICULTIES.normal.lives)),
    gold: Math.round(diff.gold * (map.gold / DIFFICULTIES.normal.gold)),
  };
}

/* -------------------------------- tháp --------------------------------- */
export const TOWERS = [
  {
    id: 'gun', name: 'Súng Liên Thanh', short: 'Liên Thanh', icon: '🔫', hotkey: '1',
    cost: 65, color: 0x4fd8ff, upgradeBase: 68,
    desc: 'Bắn nhanh, sát thương đơn. Bắn được cả mục tiêu bay.',
    base: { damage: 9, range: 8.5, rate: 2.6, projectileSpeed: 42, splash: 0, chain: 0, air: true },
    growth: { damage: 1.50, range: 1.06, rate: 1.12 },
  },
  {
    id: 'cannon', name: 'Pháo Nổ', short: 'Pháo', icon: '💥', hotkey: '2',
    cost: 125, color: 0xffa63d, upgradeBase: 130,
    desc: 'Đạn nổ sát thương diện rộng, rất hiệu quả với đám đông. KHÔNG bắn được mục tiêu bay.',
    base: { damage: 32, range: 10.5, rate: 0.62, projectileSpeed: 24, splash: 4.0, chain: 0, air: false, ballistic: true },
    growth: { damage: 1.52, range: 1.05, rate: 1.06, splash: 1.05 },
  },
  {
    id: 'frost', name: 'Súng Băng', short: 'Băng', icon: '❄️', hotkey: '3',
    cost: 100, color: 0x8ee9ff, upgradeBase: 104,
    desc: 'Làm chậm kẻ địch quanh điểm nổ, giúp các tháp khác có thời gian bắn.',
    base: { damage: 6, range: 9, rate: 1.5, projectileSpeed: 30, splash: 2.4, chain: 0, air: true, slow: 0.40, slowTime: 1.8 },
    growth: { damage: 1.42, range: 1.05, rate: 1.08, splash: 1.04 },
  },
  {
    id: 'tesla', name: 'Trụ Sét', short: 'Sét', icon: '⚡', hotkey: '4',
    cost: 175, color: 0xb98cff, upgradeBase: 180,
    desc: 'Sét lan sang nhiều mục tiêu đứng gần nhau, bắn tức thời.',
    base: { damage: 22, range: 9.5, rate: 1.05, chain: 3, chainRange: 6.5, air: true },
    growth: { damage: 1.50, range: 1.05, rate: 1.08 },
  },
  {
    id: 'sniper', name: 'Bắn Tỉa', short: 'Bắn Tỉa', icon: '🎯', hotkey: '5',
    cost: 205, color: 0x9dff6b, upgradeBase: 212,
    desc: 'Tầm bắn cực xa, xuyên giáp, xuyên nhiều mục tiêu. Bắn tức thời.',
    base: { damage: 110, range: 22, rate: 0.5, pierce: 2, air: true, ignoreArmor: true },
    growth: { damage: 1.55, range: 1.06, rate: 1.05 },
  },
];

export const towerDef = (id) => TOWERS.find((t) => t.id === id) || TOWERS[0];

/** Chỉ số tháp ở cấp `level` (1..MAX_LEVEL). */
export function towerStats(id, level = 1) {
  const t = towerDef(id);
  const L = Math.max(0, Math.min(MAX_LEVEL, level) - 1);
  const s = Object.assign({}, t.base);
  for (const k in t.growth) {
    if (typeof s[k] === 'number') s[k] = s[k] * Math.pow(t.growth[k], L);
  }
  s.damage = Math.round(s.damage * 10) / 10;
  s.range = Math.round(s.range * 100) / 100;
  s.rate = Math.round(s.rate * 100) / 100;
  s.splash = s.splash ? Math.round(s.splash * 100) / 100 : 0;
  s.chain = s.chain ? s.chain + L : 0;
  s.pierce = s.pierce ? s.pierce + L : 0;
  s.slow = s.slow ? Math.min(0.72, Math.round(s.slow * Math.pow(1.05, L) * 1000) / 1000) : 0;
  s.slowTime = s.slowTime ? s.slowTime + L * 0.12 : 0;
  s.dps = Math.round(s.damage * s.rate * 10) / 10;
  return s;
}

/** Chi phí nâng cấp từ `level` lên `level+1`. */
export function upgradeCost(id, level) {
  const t = towerDef(id);
  return Math.round((t.upgradeBase * Math.pow(1.82, Math.max(0, level - 1))) / 5) * 5;
}

/** Giá bán lại = 62% tổng đã đầu tư (làm tròn xuống bội số 5). */
export function sellValue(invested) {
  return Math.floor((invested * 0.62) / 5) * 5;
}

/* ------------------------------- kẻ địch -------------------------------- */
export const ENEMIES = {
  grunt:  { id: 'grunt',  name: 'Lính Máy',    icon: '🤖', hp: 52,   speed: 3.0,  armor: 0,  reward: 7,   score: 10,  leak: 1,  air: false, color: 0x63ffc8, scale: 1.00, barW: 1.0 },
  runner: { id: 'runner', name: 'Tia Chớp',    icon: '⚡', hp: 34,   speed: 5.3,  armor: 0,  reward: 8,   score: 12,  leak: 1,  air: false, color: 0xffe066, scale: 0.85, barW: 0.9 },
  tank:   { id: 'tank',   name: 'Xe Tăng',     icon: '🛡️', hp: 240,  speed: 1.85, armor: 6,  reward: 20,  score: 30,  leak: 3,  air: false, color: 0xc084fc, scale: 1.45, barW: 1.4 },
  flyer:  { id: 'flyer',  name: 'Drone Bay',   icon: '🛸', hp: 80,   speed: 4.4,  armor: 1,  reward: 13,  score: 20,  leak: 2,  air: true,  color: 0xff8ad4, scale: 0.95, barW: 1.0 },
  boss:   { id: 'boss',   name: 'Trùm Máy',    icon: '👹', hp: 1350, speed: 1.5,  armor: 10, reward: 200, score: 400, leak: 8,  air: false, color: 0xff5470, scale: 2.10, barW: 2.4 },
  alien:  {
    id: 'alien', name: 'Sinh Vật Ngoài Hành Tinh', icon: '👽', hp: 130, speed: 3.4, armor: 2, reward: 18, score: 28, leak: 2,
    air: false, color: 0x7cf9d0, scale: 1.12, barW: 1.1,
    blink: 7.5, blinkCd: 4.6, blinkDelay: 6,        // bắt đầu dịch chuyển sau ~6s, rồi mỗi ~4.6s một lần
    note: 'Dịch chuyển tức thời — làm chậm để giữ nó trong tầm bắn',
  },
  monster: {
    id: 'monster', name: 'Quái Vật Đột Biến', icon: '🧟', hp: 420, speed: 2.05, armor: 8, reward: 34, score: 48, leak: 4,
    air: false, color: 0xa6ff5c, scale: 1.42, barW: 1.3,
    split: { type: 'spawn', count: 2 },
    note: 'Bị hạ sẽ tách thành 2 ấu trùng nhanh',
  },
  spawn: {
    id: 'spawn', name: 'Ấu Trùng', icon: '🐛', hp: 45, speed: 4.7, armor: 0, reward: 4, score: 6, leak: 1,
    air: false, color: 0xd8ff8a, scale: 0.72, barW: 0.8,
    note: 'Sinh ra từ xác quái vật, chạy rất nhanh',
  },
};

/**
 * Đường cong sức mạnh theo tiến độ màn: t = 0 (đợt đầu) → 1 (đợt cuối).
 * Dùng tiến độ thay vì số đợt tuyệt đối, nên màn 20 đợt và màn 40 đợt đều
 * có nhịp tăng hợp lý (màn dài chỉ kéo dài chứ không bùng nổ vô hạn).
 */
export function waveCurve(t) {
  const x = Math.max(0, Math.min(1, t));
  return 0.6 + 1.8 * x + 3.4 * x * x + 8.4 * x * x * x;
}

/** Chỉ số kẻ địch đã scale theo bản đồ + đợt + độ khó. */
export function enemyStats(type, wave = 1, diff = DIFFICULTIES.normal, map = MAP) {
  const e = ENEMIES[type] || ENEMIES.grunt;
  const t = map.waves > 1 ? (wave - 1) / (map.waves - 1) : 0;
  const hp = e.hp * diff.hpMul * map.hpMul * waveCurve(t);
  const speed = e.speed * diff.spMul * (1 + 0.005 * (wave - 1));
  const reward = e.reward * diff.goldMul * map.goldMul * (1 + 0.02 * (wave - 1));
  const armor = e.armor + Math.floor(wave / 8);
  return {
    ...e,
    hp: Math.max(1, Math.round(hp)),
    speed: Math.round(speed * 1000) / 1000,
    reward: Math.max(1, Math.round(reward)),
    armor,
    score: Math.round(e.score * (1 + 0.16 * t + 0.5 * t * t)),
  };
}

/**
 * Giáp giảm sát thương theo tỉ lệ (không trừ thẳng) để mọi loại tháp đều có ích:
 *   armor 6  → -21%   ·   armor 12 → -35%   ·   armor 30 → -48% (tối đa -55%)
 * Tháp "xuyên giáp" (Bắn Tỉa) bỏ qua hoàn toàn phần giảm này.
 */
export function applyArmor(dmg, armor, ignoreArmor = false) {
  if (ignoreArmor || !armor || armor < 0) return dmg;
  const mit = Math.min(0.55, armor / (armor + 22));
  return dmg * (1 - mit);
}

/* -------------------------------- đợt sóng ------------------------------ */
export function buildWave(n, diff = DIFFICULTIES.normal, map = MAP) {
  const bias = map.waveBias || {};
  const groups = [];
  const add = (type, count, gap, delay) => {
    const c = Math.round(count * (bias[type] || 1));
    if (c > 0) groups.push({ type, count: c, gap, delay });
  };
  const longMap = map.waves > 30;

  add('grunt', 7 + n * 1.5, Math.max(0.36, 0.62 - n * 0.008), 0);
  if (n >= 3) add('runner', 2 + n * 0.7, 0.42, 2.6);
  if (n >= 5) add('tank', 1 + (n - 4) / 2.5, 1.05, 5.4);
  if (n >= 7) add('flyer', 2 + n * 0.45, 0.5, 8.4);
  if (n >= 9) add('alien', 1 + Math.floor((n - 8) * 0.45), 0.95, 6.6);
  if (n >= 12) add('monster', 1 + Math.floor((n - 11) / 3), 1.7, 10.5);
  if (n % 5 === 0) add('boss', 1 + Math.floor(n / (longMap ? 15 : 12)), 2.4, 12);

  const schedule = [];
  for (const g of groups) {
    for (let i = 0; i < g.count; i++) schedule.push({ t: g.delay + i * g.gap, type: g.type, wave: n });
  }
  schedule.sort((a, b) => a.t - b.t);

  const last = schedule.length ? schedule[schedule.length - 1].t : 0;
  const summary = groups.map((g) => {
    const st = enemyStats(g.type, n, diff, map);
    return {
      type: g.type, name: st.name, icon: st.icon, count: g.count, hpEach: st.hp, air: st.air,
      color: '#' + st.color.toString(16).padStart(6, '0'), note: st.note || '',
      blink: !!st.blink, split: !!st.split,
    };
  });

  return {
    wave: n,
    groups,
    summary,
    schedule,
    duration: last + 2.0,
    totalCount: schedule.length,
    totalHp: summary.reduce((a, s) => a + s.count * s.hpEach, 0),
  };
}

export function waveBonus(n) {
  return 40 + n * 7;
}
export function callBonus(secondsLeft) {
  return Math.max(0, Math.round(secondsLeft * 2));
}
/** Số sao độ khó 1..5 của một đợt, dùng cho UI. */
export function waveThreat(n, diff = DIFFICULTIES.normal, map = MAP) {
  const w = buildWave(n, diff, map);
  const scale = 2600 + n * 900;
  return Math.max(1, Math.min(5, Math.round(w.totalHp / scale) + 1));
}
/** Cấp độ nguy hiểm tổng thể của màn (1..5) theo máu địch ở đợt cuối. */
export function mapThreat(map = MAP, diff = DIFFICULTIES.normal) {
  const last = buildWave(map.waves, diff, map);
  const ref = 40000;
  return Math.max(1, Math.min(5, Math.round(last.totalHp / ref) + 1));
}

/* ============================ BẢNG XẾP HẠNG ============================= */
/** Điểm cuối ván: thắng thì thưởng theo số mạng còn lại, thua thì giữ nguyên. */
export function finalScore(score, lives, win) {
  return Math.round(win ? score * (1 + lives * 0.06) : score);
}

/** So sánh 2 bản ghi điểm (dùng để sắp xếp bảng xếp hạng). */
export function scoreCompare(a, b) {
  return (b.score - a.score) || (b.wave - a.wave) || (b.kills - a.kills) || (a.time - b.time);
}

/**
 * Chèn một bản ghi vào bảng xếp hạng (thuần, không side-effect).
 * Trả về { board, rank, inserted } — rank là 1..maxScore (0 nếu không lọt bảng).
 */
export function insertScore(board, entry, max = 10) {
  const list = (board || []).slice();
  list.push({ ...entry });
  list.sort(scoreCompare);
  const rank = list.findIndex((e) => e.id === entry.id) + 1;
  const trimmed = list.slice(0, max);
  return { board: trimmed, rank: rank <= max ? rank : 0, inserted: rank > 0 && rank <= max };
}
/** Bản ghi có lọt bảng không (không cần chèn thử). */
export function qualifies(board, entry, max = 10) {
  const list = (board || []).slice().sort(scoreCompare);
  if (list.length < max) return true;
  return scoreCompare(entry, list[list.length - 1]) < 0;
}
export function makeEntryId(now = Date.now(), rnd = Math.random()) {
  return now.toString(36) + '-' + Math.floor(rnd * 1e6).toString(36);
}

/* ------------------------------- tiện ích ------------------------------- */
export function fmt(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1) + 'k';
  return String(Math.round(n));
}
export function stars(n) {
  const k = Math.max(1, Math.min(5, n | 0));
  return '★'.repeat(k) + '☆'.repeat(5 - k);
}
export function fmtDate(ts) {
  const d = new Date(ts);
  const p = (v) => String(v).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
