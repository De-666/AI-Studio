/* =========================================================================
 * NEON DEFENSE — Lõi logic thuần (không DOM, không THREE) => test được bằng Node
 * ========================================================================= */

export const TILE = 2, COLS = 22, ROWS = 16;

export const GRID = {
  TILE, COLS, ROWS,
  W: COLS * TILE, D: ROWS * TILE,
  MIN_X: -(COLS * TILE) / 2, MIN_Z: -(ROWS * TILE) / 2,
};

export const START_LIVES = 20;
export const START_GOLD = 220;
export const TOTAL_WAVES = 25;
export const MAX_LEVEL = 5;
export const BUILD_TIME = 20;          // giây đếm ngược trước khi tự động mở đợt

/* ------------------------------- toạ độ -------------------------------- */
export const worldX = (gx) => (gx + 0.5) * TILE - GRID.W / 2;
export const worldZ = (gz) => (gz + 0.5) * TILE - GRID.D / 2;
export const worldPos = (gx, gz) => ({ x: worldX(gx), z: worldZ(gz) });
export const gridFromWorld = (x, z) => ({
  gx: Math.floor((x + GRID.W / 2) / TILE),
  gz: Math.floor((z + GRID.D / 2) / TILE),
});
export const inGrid = (gx, gz) => gx >= 0 && gz >= 0 && gx < COLS && gz < ROWS;
export const key = (gx, gz) => gx + ',' + gz;

/* ------------------------------- đường đi ------------------------------- */
/* Đường đi uốn lượn từ mép trái (cổng vào) tới mép phải (căn cứ) */
export const PATH_NODES = [
  [-1, 3], [3, 3], [3, 8], [0, 8], [0, 13], [7, 13], [7, 6],
  [11, 6], [11, 14], [16, 14], [16, 9], [19, 9], [19, 3], [22, 3],
];

/** Danh sách ô thuộc đường đi, kèm hướng đi của từng ô (để vẽ làn đường). */
export function pathTiles() {
  const map = new Map();
  for (let i = 0; i < PATH_NODES.length - 1; i++) {
    const [ax, az] = PATH_NODES[i];
    const [bx, bz] = PATH_NODES[i + 1];
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

export function pathWorldPoints() {
  return PATH_NODES.map(([gx, gz]) => worldPos(gx, gz));
}

/** Đường bay của địch trên không: vòng cung mềm từ cổng vào tới căn cứ. */
export function airWorldPoints() {
  return [
    worldPos(-1, 3),
    worldPos(5, 13),
    worldPos(10, 2),
    worldPos(16, 13),
    worldPos(22, 3),
  ];
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
};

/** Chỉ số kẻ địch đã scale theo đợt + độ khó. */
export function enemyStats(type, wave = 1, diff = DIFFICULTIES.normal) {
  const e = ENEMIES[type] || ENEMIES.grunt;
  const n = Math.max(0, wave - 1);
  const late = n > 14 ? 1 + 0.055 * (n - 14) : 1;            // từ đợt 15 trở đi địch trâu lên rõ rệt
  const hp = e.hp * diff.hpMul * (1 + 0.14 * n + 0.0122 * n * n) * late;
  const speed = e.speed * diff.spMul * (1 + 0.005 * n);
  const reward = e.reward * diff.goldMul * (1 + 0.02 * n);
  const armor = e.armor + Math.floor(wave / 8);
  return {
    ...e,
    hp: Math.max(1, Math.round(hp)),
    speed: Math.round(speed * 1000) / 1000,
    reward: Math.max(1, Math.round(reward)),
    armor,
    score: Math.round(e.score * (1 + 0.08 * n)),
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
export function buildWave(n, diff = DIFFICULTIES.normal) {
  const groups = [];
  const add = (type, count, gap, delay) => {
    if (count > 0) groups.push({ type, count: Math.round(count), gap, delay });
  };

  add('grunt', 7 + n * 1.5, Math.max(0.36, 0.62 - n * 0.008), 0);
  if (n >= 3) add('runner', 2 + n * 0.7, 0.42, 2.6);
  if (n >= 5) add('tank', 1 + (n - 4) / 2.5, 1.05, 5.4);
  if (n >= 7) add('flyer', 2 + n * 0.45, 0.5, 8.4);
  if (n % 5 === 0) add('boss', 1 + Math.floor(n / 12), 2.4, 12);

  const schedule = [];
  for (const g of groups) {
    for (let i = 0; i < g.count; i++) schedule.push({ t: g.delay + i * g.gap, type: g.type, wave: n });
  }
  schedule.sort((a, b) => a.t - b.t);

  const last = schedule.length ? schedule[schedule.length - 1].t : 0;
  const summary = groups.map((g) => {
    const st = enemyStats(g.type, n, diff);
    return { type: g.type, name: st.name, icon: st.icon, count: g.count, hpEach: st.hp, air: st.air };
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
export function waveThreat(n, diff = DIFFICULTIES.normal) {
  const w = buildWave(n, diff);
  const scale = 2600 + n * 900;
  return Math.max(1, Math.min(5, Math.round(w.totalHp / scale) + 1));
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
