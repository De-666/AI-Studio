/* =========================================================================
 * NEON DEFENSE 3D — engine + gameplay
 * File này được nhúng vào game3d.html bởi game/build.mjs
 * Dùng: biến toàn cục `THREE` + các hàm trong logic.js (nối cùng một scope)
 * ========================================================================= */

/* ------------------------------- DOM ----------------------------------- */
const $ = (id) => document.getElementById(id);
const el = {
  canvas: $('c'), stats: $('stats'), ctrls: $('ctrls'), cards: $('cards'),
  inspector: $('inspector'), wavepanel: $('wavepanel'), overlay: $('overlay'),
  toasts: $('toasts'), wavefill: $('wavefill'), hint: $('hint'), side: $('side'), fatal: $('fatal'),
};
const IS_SMALL = () => window.innerWidth < 900;

/* ----------------------------- tiện ích -------------------------------- */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const rndInt = (a, b) => Math.floor(rnd(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const _dm = new THREE.Object3D();
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _c1 = new THREE.Color(), _c2 = new THREE.Color();

function iPlace(im, idx, x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0) {
  _dm.position.set(x, y, z); _dm.rotation.set(rx, ry, 0); _dm.scale.set(sx, sy, sz);
  _dm.updateMatrix(); im.setMatrixAt(idx, _dm.matrix);
}
function dist2d(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }
function fmtTime(s) { s = Math.max(0, Math.ceil(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }

/* ----------------------------- vật liệu -------------------------------- */
function smat(color, o = {}) {
  return new THREE.MeshStandardMaterial({
    color, flatShading: o.flat !== false, roughness: o.rough ?? 0.55, metalness: o.metal ?? 0.35,
    emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1, transparent: !!o.transparent,
    opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide,
  });
}
function bmat(color, opacity = 1, additive = false, side) {
  return new THREE.MeshBasicMaterial({
    color, transparent: opacity < 1 || additive, opacity,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: !(additive || opacity < 1), side: side ?? THREE.FrontSide, fog: true,
  });
}
function glowMat(color, opacity = 0.85) { return bmat(color, opacity, true); }

const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sph: new THREE.SphereGeometry(1, 14, 10),
  sphLo: new THREE.SphereGeometry(1, 8, 6),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 14),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cylLo: new THREE.CylinderGeometry(1, 1, 1, 8),
  cone: new THREE.ConeGeometry(1, 1, 6),
  coneLo: new THREE.ConeGeometry(1, 1, 4),
  oct: new THREE.OctahedronGeometry(1, 0),
  ico: new THREE.IcosahedronGeometry(1, 0),
  torus: new THREE.TorusGeometry(1, 0.09, 8, 30),
  disc: new THREE.CircleGeometry(1, 48),
  ring: new THREE.RingGeometry(0.975, 1, 64),
  plate: new THREE.CylinderGeometry(1, 1, 1, 6),
  plane: new THREE.PlaneGeometry(1, 1),
};
function part(geo, mat, o = {}) {
  const m = new THREE.Mesh(geo, mat);
  if (o.s) m.scale.set(o.s[0], o.s[1], o.s[2]);
  if (o.p) m.position.set(o.p[0], o.p[1], o.p[2]);
  if (o.r) m.rotation.set(o.r[0], o.r[1], o.r[2]);
  m.castShadow = o.shadow !== false; m.receiveShadow = false;
  return m;
}

/* ------------------------- âm thanh (WebAudio) ------------------------- */
const Sound = {
  ctx: null, master: null, on: true, ready: false, _last: {},
  init() {
    if (this.ready) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.42;
      this.master.connect(this.ctx.destination);
      this.ready = true;
    } catch (e) { /* không có audio cũng không sao */ }
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  tone({ freq = 440, type = 'square', dur = 0.1, vol = 0.2, slide = 0, delay = 0, attack = 0.004 }) {
    if (!this.on || !this.ready) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(24, freq * slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master); o.start(t0); o.stop(t0 + dur + 0.03);
  },
  noise({ dur = 0.2, vol = 0.25, freq = 900, q = 1, type = 'lowpass', delay = 0, slide = 0.35 }) {
    if (!this.on || !this.ready) return;
    const ctx = this.ctx, t0 = ctx.currentTime + delay;
    const len = Math.max(64, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(50, freq * slide), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master); src.start(t0);
  },
  play(kind) {
    if (!this.on || !this.ready) return;
    const now = this.ctx.currentTime;
    if (this._last[kind] && now - this._last[kind] < 0.045) return;
    this._last[kind] = now;
    switch (kind) {
      case 'gun': this.tone({ freq: 1150, type: 'square', dur: 0.055, vol: 0.055, slide: 0.45 }); break;
      case 'cannon': this.noise({ dur: 0.3, vol: 0.16, freq: 420, slide: 0.25 }); this.tone({ freq: 130, type: 'sine', dur: 0.22, vol: 0.13, slide: 0.5 }); break;
      case 'frost': this.tone({ freq: 1500, type: 'triangle', dur: 0.14, vol: 0.06, slide: 1.9 }); break;
      case 'tesla': this.noise({ dur: 0.16, vol: 0.11, freq: 3200, type: 'highpass', slide: 0.6 }); this.tone({ freq: 260, type: 'sawtooth', dur: 0.12, vol: 0.05, slide: 2.4 }); break;
      case 'sniper': this.tone({ freq: 1900, type: 'square', dur: 0.08, vol: 0.07, slide: 0.15 }); this.noise({ dur: 0.22, vol: 0.08, freq: 2600, type: 'highpass', slide: 0.3 }); break;
      case 'hit': this.tone({ freq: 320, type: 'triangle', dur: 0.05, vol: 0.035, slide: 0.6 }); break;
      case 'blink': this.tone({ freq: 620, type: 'sine', dur: 0.18, vol: 0.07, slide: 2.6 }); this.tone({ freq: 940, type: 'triangle', dur: 0.12, vol: 0.04, slide: 0.5, delay: 0.05 }); break;
      case 'split': this.noise({ dur: 0.24, vol: 0.12, freq: 500, slide: 0.35 }); this.tone({ freq: 300, type: 'square', dur: 0.16, vol: 0.06, slide: 1.8 }); break;
      case 'death': this.noise({ dur: 0.26, vol: 0.13, freq: 900, slide: 0.2 }); this.tone({ freq: 220, type: 'sawtooth', dur: 0.18, vol: 0.06, slide: 0.35 }); break;
      case 'coin': this.tone({ freq: 1180, type: 'triangle', dur: 0.07, vol: 0.05 }); this.tone({ freq: 1760, type: 'triangle', dur: 0.09, vol: 0.045, delay: 0.05 }); break;
      case 'place': this.tone({ freq: 300, type: 'sine', dur: 0.1, vol: 0.12, slide: 1.6 }); this.noise({ dur: 0.14, vol: 0.08, freq: 700, slide: 0.6 }); break;
      case 'upgrade': [523, 659, 784, 1046].forEach((f, i) => this.tone({ freq: f, type: 'triangle', dur: 0.12, vol: 0.06, delay: i * 0.055 })); break;
      case 'sell': [700, 500].forEach((f, i) => this.tone({ freq: f, type: 'square', dur: 0.1, vol: 0.05, delay: i * 0.07 })); break;
      case 'wave': [330, 415, 494, 659].forEach((f, i) => this.tone({ freq: f, type: 'sawtooth', dur: 0.3, vol: 0.055, delay: i * 0.12, slide: 1.01 })); break;
      case 'clear': [523, 659, 880].forEach((f, i) => this.tone({ freq: f, type: 'triangle', dur: 0.24, vol: 0.07, delay: i * 0.1 })); break;
      case 'leak': this.tone({ freq: 180, type: 'sawtooth', dur: 0.34, vol: 0.13, slide: 0.5 }); this.noise({ dur: 0.3, vol: 0.12, freq: 600, slide: 0.3 }); break;
      case 'error': this.tone({ freq: 150, type: 'square', dur: 0.13, vol: 0.1, slide: 0.8 }); break;
      case 'win': [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone({ freq: f, type: 'triangle', dur: 0.5, vol: 0.09, delay: i * 0.15 })); break;
      case 'lose': [440, 392, 330, 262].forEach((f, i) => this.tone({ freq: f, type: 'sawtooth', dur: 0.55, vol: 0.09, delay: i * 0.2, slide: 0.98 })); break;
    }
  },
};

/* ----------------------------- scene ----------------------------------- */
let renderer = null, scene = null, camera = null;
const world = new THREE.Group();            // chứa tất cả
const staticWorld = new THREE.Group();      // phần tĩnh theo bản đồ (địa hình, đường, trang trí, căn cứ, cổng)
staticWorld.name = 'static';
world.add(staticWorld);
const ownedGeos = [];                       // geometry tạo riêng cho từng bản đồ (cần dispose khi dựng lại)
const FX = [];              // hiệu ứng có vòng đời
const animGroups = [];      // nhóm mesh cần animate (cổng, căn cứ, trang trí)
let baseObj = null, portalObj = null, basePos = new THREE.Vector3();

const CAM = { target: new THREE.Vector3(0, 0, 0.5), theta: -0.72, phi: 0.86, dist: 36, shake: 0 };

function initRenderer() {
  renderer = new THREE.WebGLRenderer({ canvas: el.canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05080f);
  scene.fog = new THREE.FogExp2(0x060a14, 0.0115);
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 420);
  scene.add(world);

  buildLights();
  buildStars();
  buildStaticWorld(S.level);
}

/* ------------------- thế giới tĩnh theo từng bản đồ -------------------- */
/** Dựng (hoặc dựng lại) toàn bộ phần tĩnh của bản đồ `mapId`. */
function buildStaticWorld(mapId) {
  clearStaticWorld();
  setMap(mapId);
  pathMap = pathTiles();          // dữ liệu đường đi dùng chung cho nền, làn đường và luật xây
  markNoBuild(activeMap());
  buildGround();
  buildPath();
  buildDecor();
  buildBase();
  buildPortal();
  buildPathData();                // đường đi cho địch (độ dài, điểm bẻ lái, đường bay)
}

/** Xoá sạch thế giới tĩnh cũ (giải phóng material & geometry riêng của bản đồ cũ). */
function clearStaticWorld() {
  for (let i = staticWorld.children.length - 1; i >= 0; i--) {
    const child = staticWorld.children[i];
    staticWorld.remove(child);
    child.traverse((o) => {
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => m && m.dispose && m.dispose());
      }
      if (o.geometry && ownedGeos.includes(o.geometry)) {
        o.geometry.dispose();
        ownedGeos.splice(ownedGeos.indexOf(o.geometry), 1);
      }
    });
  }
  blocked.clear();
  animGroups.length = 0;
}

/** Ô đất cấm xây quanh cổng vào và căn cứ (khác cho từng bản đồ). */
function markNoBuild(map) {
  noBuild.clear();
  const [, pz] = map.path[0];
  for (let gx = 0; gx <= 1; gx++) for (let gz = pz - 2; gz <= pz + 2; gz++) if (inGrid(gx, gz)) noBuild.add(key(gx, gz));
  const [, bz] = map.path[map.path.length - 1];
  for (let gx = GRID.COLS - 3; gx < GRID.COLS; gx++) for (let gz = bz - 2; gz <= bz + 2; gz++) if (inGrid(gx, gz)) noBuild.add(key(gx, gz));
}

/** Canh camera vừa tầm bản đồ hiện hành. */
function fitCamera(reset) {
  if (reset) { CAM.target.set(0, 0, 0); CAM.theta = -0.7; CAM.phi = 0.82; }
  CAM.dist = clamp(Math.max(GRID.W, GRID.D) * 1.02, 26, 62);
  clampTarget();
}

function buildLights() {
  scene.add(new THREE.HemisphereLight(0x6d8dd8, 0x0a1020, 1.05));
  const dir = new THREE.DirectionalLight(0xd7e6ff, 1.85);
  dir.position.set(18, 32, 14);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  const sc = dir.shadow.camera;
  sc.left = -32; sc.right = 32; sc.top = 28; sc.bottom = -28; sc.near = 2; sc.far = 95;
  dir.shadow.bias = -0.0007; dir.shadow.normalBias = 0.035;
  scene.add(dir);

  const pl = [
    [0x2ad4ff, 260, -19, 10, -13], [0xff4fd8, 220, 20, 10, 14],
    [0x9d7bff, 190, 0, 12, 0],
  ];
  for (const [c, i, x, y, z] of pl) {
    const p = new THREE.PointLight(c, i, 75, 2);
    p.position.set(x, y, z); scene.add(p);
  }
}

function buildStars() {
  const n = 780, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, r = 55 + Math.random() * 80, y = 6 + Math.random() * 75;
    pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = y; pos[i * 3 + 2] = Math.sin(a) * r;
    c.setHSL(0.53 + Math.random() * 0.16, 0.75, 0.55 + Math.random() * 0.4);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({ size: 1.15, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const p = new THREE.Points(g, m); p.frustumCulled = false; world.add(p);
}

const blocked = new Set();      // ô không thể xây (đường đi + vật trang trí)
const noBuild = new Set();      // ô cấm xây quanh cổng vào / căn cứ
const towerAt = new Map();      // 'gx,gz' -> tower
let pathMap = null;

function buildGround() {
  const groundGeo = new THREE.PlaneGeometry(GRID.W + 46, GRID.D + 46);
  ownedGeos.push(groundGeo);
  const ground = new THREE.Mesh(groundGeo, smat(0x080d16, { rough: 1, metal: 0, flat: false }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.26; ground.receiveShadow = true;
  staticWorld.add(ground);

  // vành sáng quanh bản đồ
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 6, 4), glowMat(0x1f7fbf, 0.5));
  rim.scale.set(GRID.W / 2 + 4, GRID.D / 2 + 4, 1);
  rim.rotation.x = -Math.PI / 2; rim.rotation.z = Math.PI / 4; rim.position.y = -0.22;
  staticWorld.add(rim);

  const tileGeo = new THREE.BoxGeometry(TILE * 0.97, 0.24, TILE * 0.97);
  ownedGeos.push(tileGeo);
  const tileMat = smat(0xffffff, { rough: 0.95, metal: 0.04 });
  const tiles = new THREE.InstancedMesh(tileGeo, tileMat, GRID.COLS * GRID.ROWS);
  tiles.receiveShadow = true;
  const rng = makeRNG(activeMap().seed);
  let i = 0;
  for (let gz = 0; gz < GRID.ROWS; gz++) {
    for (let gx = 0; gx < GRID.COLS; gx++) {
      iPlace(tiles, i, worldX(gx), -0.12, worldZ(gz));
      const k = key(gx, gz);
      if (pathMap.has(k)) { _c1.setHex(0x2c4166).offsetHSL(0, 0, rng() * 0.035 - 0.012); blocked.add(k); }
      else _c1.setHex(0x151d2e).offsetHSL(rng() * 0.04 - 0.02, 0, rng() * 0.04 - 0.014);
      tiles.setColorAt(i, _c1); i++;
    }
  }
  tiles.instanceMatrix.needsUpdate = true;
  if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
  staticWorld.add(tiles);
}

function buildPath() {
  const tiles = [...pathMap.values()];
  const laneMat = smat(0x0a2540, { emissive: 0x27c8ff, ei: 1.5, rough: 0.4, metal: 0.25 });
  const laneGeo = new THREE.BoxGeometry(1.72, 0.06, 0.5);
  ownedGeos.push(laneGeo);
  const lanes = new THREE.InstancedMesh(laneGeo, laneMat, tiles.length);
  tiles.forEach((t, i) => iPlace(lanes, i, worldX(t.gx), 0.02, worldZ(t.gz), t.dx !== 0 ? 0 : Math.PI / 2));
  lanes.instanceMatrix.needsUpdate = true;
  staticWorld.add(lanes);
  animGroups.push({ obj: lanes, kind: 'lane' });

  // viền neon hai bên đường
  const strips = [];
  for (const t of tiles) {
    const x = worldX(t.gx), z = worldZ(t.gz);
    for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!inGrid(t.gx + ax, t.gz + az)) continue;
      if (pathMap.has(key(t.gx + ax, t.gz + az))) continue;
      strips.push({ x: x + ax * (TILE / 2 - 0.05), z: z + az * (TILE / 2 - 0.05), ry: az !== 0 ? Math.PI / 2 : 0 });
    }
  }
  const sGeo = new THREE.BoxGeometry(0.13, 0.14, TILE * 0.96);
  ownedGeos.push(sGeo);
  const sm = new THREE.InstancedMesh(sGeo, glowMat(0x37dcff, 0.72), strips.length);
  strips.forEach((s, i) => iPlace(sm, i, s.x, 0.03, s.z, s.ry));
  sm.instanceMatrix.needsUpdate = true;
  staticWorld.add(sm);
}

function buildDecor() {
  const rng = makeRNG(activeMap().seed + 17);
  // mọi ngẫu nhiên trang trí đều lấy từ seed của bản đồ → bản đồ trông y hệt nhau ở mọi ván
  const drnd = (a, b) => a + rng() * (b - a);
  const dpick = (arr) => arr[Math.floor(rng() * arr.length)];
  const drndInt = (a, b) => a + Math.floor(rng() * (b - a + 1));
  const rockMat = smat(0x2a3346, { rough: 0.95, metal: 0.1 });
  const rockMat2 = smat(0x3d4964, { rough: 0.9, metal: 0.15 });
  const plantMat = smat(0x14352c, { rough: 0.9, metal: 0.05, emissive: 0x0d5c46, ei: 0.7 });
  const cryColors = [0x35e0ff, 0xff4fd8, 0x9d7bff, 0x5cffa8];
  const cryMats = cryColors.map((c) => smat(0x0d2030, { emissive: c, ei: 1.5, rough: 0.25, metal: 0.4 }));
  const postMat = smat(0x1b2436, { metal: 0.6, rough: 0.45 });

  const rocks = [], rocks2 = [], plants = [], posts = [], trunks = [];
  const crys = cryColors.map(() => []), discs = cryColors.map(() => []);
  let hero = 0;

  /* ---- rải trang trí trên các ô trống ---- */
  for (let gz = 0; gz < GRID.ROWS; gz++) {
    for (let gx = 0; gx < GRID.COLS; gx++) {
      if (pathMap.has(key(gx, gz))) continue;
      if (noBuild.has(key(gx, gz))) continue;                     // chừa chỗ cho cổng vào / căn cứ
      const r = rng();
      if (r > 0.24) continue;
      const x = worldX(gx), z = worldZ(gz);
      blocked.add(key(gx, gz));

      if (r < 0.09) {                                             // cụm đá
        const n = drndInt(2, 4);
        for (let j = 0; j < n; j++) {
          const o = { x: x + drnd(-0.6, 0.6), z: z + drnd(-0.6, 0.6), s: drnd(0.34, 0.8), ry: rng() * 6.28 };
          (rng() < 0.5 ? rocks : rocks2).push(o);
        }
      } else if (r < 0.16) {                                      // mỏ tinh thể phát sáng
        const kind = drndInt(0, cryColors.length - 1);
        const s = drnd(0.6, 1.1);
        crys[kind].push({ x, z, s, ry: rng() * 6.28 });
        discs[kind].push({ x, z, s: s * 1.9 });
        if (rng() < 0.22 && hero < 6) {
          hero++;
          const g = new THREE.Group(); g.position.set(x, 0, z);
          const h = drnd(0.9, 1.5);
          g.add(part(GEO.oct, cryMats[kind], { s: [0.3, h, 0.3], p: [0, h * 0.8, 0], shadow: false }));
          for (let j = 0; j < 2; j++) g.add(part(GEO.oct, cryMats[kind], { s: [0.15, drnd(0.3, 0.5), 0.15], p: [drnd(-0.45, 0.45), 0.35, drnd(-0.45, 0.45)], r: [0.25, rng() * 3, -0.3], shadow: false }));
          staticWorld.add(g);
          animGroups.push({ obj: g, kind: 'crystal', ph: rng() * 6.28 });
        }
      } else if (r < 0.21) {                                      // bụi cây
        for (let j = 0, n = drndInt(2, 4); j < n; j++) {
          const px = x + drnd(-0.6, 0.6), pz = z + drnd(-0.6, 0.6), h = drnd(0.6, 1.3);
          trunks.push({ x: px, z: pz, h });
          plants.push({ x: px, z: pz, h, ry: rng() * 6.28 });
        }
      } else {                                                    // cột đèn neon ven đấu trường
        const kind = drndInt(0, cryColors.length - 1);
        posts.push({ x, z, h: drnd(1.9, 2.5), ry: rng() * 6.28 });
        discs[kind].push({ x, z, s: 1.5 });
      }
    }
  }

  /* ---- vành núi + tháp sáng quanh đấu trường (tạo khung cảnh) ---- */
  const ringRocks = [], spires = [];
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2 + rng() * 0.05;
    const rx = GRID.W / 2 + 5 + rng() * 12, rz = GRID.D / 2 + 5 + rng() * 12;
    ringRocks.push({ x: Math.cos(a) * rx, z: Math.sin(a) * rz, s: drnd(0.9, 3.1), ry: rng() * 6.28 });
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rng() * 0.3;
    const rx = GRID.W / 2 + 16 + rng() * 16, rz = GRID.D / 2 + 16 + rng() * 16;
    spires.push({ x: Math.cos(a) * rx, z: Math.sin(a) * rz, h: drnd(3, 8), s: drnd(0.4, 0.9), c: cryColors[i % cryColors.length] });
  }

  /* ---- gộp thành các InstancedMesh (nhẹ draw call) ---- */
  const mk = (geo, mat, list, place) => {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((o, i) => place(im, i, o));
    im.instanceMatrix.needsUpdate = true;
    staticWorld.add(im);
    return im;
  };
  mk(GEO.ico, rockMat, rocks, (im, i, o) => iPlace(im, i, o.x, o.s * 0.34, o.z, o.ry, o.s * 1.2, o.s * 0.9, o.s * 1.1, drnd(-0.12, 0.12)));
  mk(GEO.ico, rockMat2, rocks2, (im, i, o) => iPlace(im, i, o.x, o.s * 0.3, o.z, o.ry, o.s * 1.1, o.s * 0.8, o.s, drnd(-0.12, 0.12)));
  mk(GEO.ico, rockMat2, ringRocks, (im, i, o) => iPlace(im, i, o.x, o.s * 0.28, o.z, o.ry, o.s * 1.35, o.s, o.s * 1.25, drnd(-0.15, 0.15)));
  mk(GEO.cyl6, plantMat, trunks, (im, i, o) => iPlace(im, i, o.x, o.h * 0.22, o.z, 0, 0.07, o.h * 0.45, 0.07));
  mk(GEO.coneLo, plantMat, plants, (im, i, o) => iPlace(im, i, o.x, o.h * 0.68, o.z, o.ry, o.h * 0.5, o.h, o.h * 0.5));
  mk(GEO.cylLo, postMat, posts, (im, i, o) => iPlace(im, i, o.x, o.h * 0.5, o.z, o.ry, 0.075, o.h, 0.075));
  crys.forEach((list, k) => {
    mk(GEO.oct, cryMats[k], list, (im, i, o) => iPlace(im, i, o.x, o.s * 0.62, o.z, o.ry, o.s * 0.42, o.s * 1.5, o.s * 0.42, 0));
  });
  discs.forEach((list, k) => {
    mk(GEO.disc, bmat(cryColors[k], 0.16, true), list, (im, i, o) => iPlace(im, i, o.x, 0.035, o.z, 0, o.s, o.s, 1, -Math.PI / 2));
  });
  for (const sp of spires) {
    const g = new THREE.Group(); g.position.set(sp.x, 0, sp.z);
    const m = smat(0x101a2c, { emissive: sp.c, ei: 0.9, rough: 0.4, metal: 0.3 });
    g.add(part(GEO.cone, m, { s: [sp.s, sp.h, sp.s], p: [0, sp.h * 0.5, 0], shadow: false }));
    g.add(part(GEO.oct, glowMat(sp.c, 0.55), { s: [sp.s * 0.4, sp.s * 0.7, sp.s * 0.4], p: [0, sp.h + sp.s * 0.3, 0], shadow: false }));
    staticWorld.add(g);
    animGroups.push({ obj: g, kind: 'crystal', ph: rng() * 6.28 });
  }
}

function buildBase() {
  const pts = pathWorldPoints();
  const end = pts[pts.length - 1];
  basePos.set(end.x - 1.1, 0, end.z);
  const g = new THREE.Group(); g.position.copy(basePos); staticWorld.add(g);

  const shell = smat(0x1d2739, { metal: 0.65, rough: 0.42 });
  const accent = smat(0x0b3348, { emissive: 0x35e0ff, ei: 1.5, metal: 0.5, rough: 0.3 });
  g.add(part(GEO.plate, shell, { s: [3.5, 0.6, 3.5], p: [0, 0.3, 0] }));
  g.add(part(GEO.plate, smat(0x0d1421, { metal: 0.6, rough: 0.5 }), { s: [2.9, 0.35, 2.9], p: [0, 0.72, 0] }));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const px = Math.cos(a) * 2.45, pz = Math.sin(a) * 2.45;
    g.add(part(GEO.box, shell, { s: [0.34, 1.7, 0.34], p: [px, 1.15, pz] }));
    g.add(part(GEO.oct, accent, { s: [0.2, 0.3, 0.2], p: [px, 2.15, pz] }));
  }
  const ring = part(GEO.torus, glowMat(0x35e0ff, 0.85), { s: [2.2, 2.2, 2.2], r: [-Math.PI / 2, 0, 0], p: [0, 1.72, 0], shadow: false });
  g.add(ring);
  const core = part(GEO.oct, new THREE.MeshStandardMaterial({ color: 0x0a3a52, emissive: 0x6ff0ff, emissiveIntensity: 1.9, flatShading: true, metalness: 0.5, roughness: 0.2 }), { s: [0.85, 1.2, 0.85], p: [0, 2.5, 0] });
  g.add(core);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(3.9, 26, 14, 0, Math.PI * 2, 0, Math.PI / 2), bmat(0x35e0ff, 0.09, true, THREE.DoubleSide));
  dome.position.y = 0.3; g.add(dome);
  const light = new THREE.PointLight(0x5ce8ff, 90, 34, 2); light.position.set(0, 3.2, 0); g.add(light);
  baseObj = { group: g, ring, core, dome, light };
}

function buildPortal() {
  const pts = pathWorldPoints();
  const start = pts[0];
  const g = new THREE.Group(); g.position.set(start.x - 0.9, 0, start.z); staticWorld.add(g);

  const frame = part(GEO.plate, smat(0x241536, { metal: 0.6, rough: 0.4, emissive: 0x6b1a5c, ei: 0.5 }), { s: [1.9, 0.4, 1.9], p: [0, 0.2, 0] });
  g.add(frame);
  const spin = new THREE.Group(); spin.rotation.y = Math.PI / 2; spin.position.y = 1.3; g.add(spin);
  const ring1 = part(GEO.torus, glowMat(0xff4fd8, 0.9), { s: [1.35, 1.35, 1.35], shadow: false });
  const ring2 = part(GEO.torus, glowMat(0xb98cff, 0.7), { s: [1.0, 1.0, 1.0], shadow: false });
  spin.add(ring1, ring2);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(1.25, 32), bmat(0xff4fd8, 0.16, true, THREE.DoubleSide));
  hole.position.y = 1.3; hole.rotation.y = Math.PI / 2; g.add(hole);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.5, 9, 18, 1, true), bmat(0xff4fd8, 0.075, true, THREE.DoubleSide));
  beam.position.y = 4.6; g.add(beam);
  const light = new THREE.PointLight(0xff5ad8, 120, 30, 2); light.position.set(0, 2.2, 0); g.add(light);
  const pGlow = new THREE.Mesh(new THREE.CircleGeometry(1.9, 32), bmat(0xff4fd8, 0.2, true));
  pGlow.rotation.x = -Math.PI / 2; pGlow.position.y = 0.03; g.add(pGlow);
  portalObj = { group: g, ring1, ring2, hole, beam, light };
}

/* --------------------------- model tháp -------------------------------- */
function makePips(g, color, radius = 0.9, y = 0.36) {
  const arr = [];
  const m = smat(0x0a1a24, { emissive: color, ei: 1.8, rough: 0.3, metal: 0.2 });
  for (let i = 0; i < MAX_LEVEL - 1; i++) {
    const a = (i / (MAX_LEVEL - 1)) * Math.PI * 2 - Math.PI / 2;
    const p = part(GEO.box, m, { s: [0.11, 0.075, 0.11], p: [Math.cos(a) * radius, y, Math.sin(a) * radius], shadow: false });
    p.visible = false; g.add(p); arr.push(p);
  }
  return arr;
}

function modelGun() {
  const g = new THREE.Group();
  const dark = smat(0x1b2434, { metal: 0.6, rough: 0.4 });
  const accent = smat(0x0d3a4d, { emissive: 0x4fd8ff, ei: 1.35, metal: 0.5, rough: 0.3 });
  g.add(part(GEO.plate, dark, { s: [0.76, 0.3, 0.76], p: [0, 0.15, 0] }));
  g.add(part(GEO.cyl, accent, { s: [0.6, 0.09, 0.6], p: [0, 0.33, 0] }));
  g.add(part(GEO.box, dark, { s: [0.42, 0.48, 0.42], p: [0, 0.56, 0] }));
  const turret = new THREE.Group(); turret.position.y = 0.84; g.add(turret);
  turret.add(part(GEO.box, accent, { s: [0.46, 0.3, 0.56], p: [0, 0, 0.02] }));
  turret.add(part(GEO.box, dark, { s: [0.09, 0.09, 0.72], p: [-0.12, 0.03, 0.44] }));
  turret.add(part(GEO.box, dark, { s: [0.09, 0.09, 0.72], p: [0.12, 0.03, 0.44] }));
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.03, 0.82); turret.add(muzzle);
  const glow = part(GEO.box, glowMat(0x7ff0ff, 0.55), { s: [0.22, 0.07, 0.22], p: [0, 0.17, 0.06], shadow: false });
  turret.add(glow);
  return { g, turret, muzzle, glow };
}

function modelCannon() {
  const g = new THREE.Group();
  const dark = smat(0x241d16, { metal: 0.55, rough: 0.5 });
  const accent = smat(0x3a2408, { emissive: 0xffa63d, ei: 1.2, metal: 0.5, rough: 0.35 });
  g.add(part(GEO.plate, dark, { s: [0.88, 0.34, 0.88], p: [0, 0.17, 0] }));
  g.add(part(GEO.cyl, accent, { s: [0.66, 0.1, 0.66], p: [0, 0.37, 0] }));
  const turret = new THREE.Group(); turret.position.y = 0.5; g.add(turret);
  turret.add(part(GEO.plate, dark, { s: [0.62, 0.44, 0.62], p: [0, 0.22, 0] }));
  turret.add(part(GEO.cyl, smat(0x120e0a, { metal: 0.7, rough: 0.35 }), { s: [0.17, 0.98, 0.17], p: [0, 0.32, 0.52], r: [Math.PI / 2, 0, 0] }));
  turret.add(part(GEO.torus, accent, { s: [0.24, 0.24, 0.24], p: [0, 0.32, 0.44], r: [Math.PI / 2, 0, 0], shadow: false }));
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.32, 1.06); turret.add(muzzle);
  const glow = part(GEO.sphLo, glowMat(0xffc46b, 0.8), { s: [0.17, 0.17, 0.17], p: [0, 0.32, 1.04], shadow: false });
  turret.add(glow);
  return { g, turret, muzzle, glow };
}

function modelFrost() {
  const g = new THREE.Group();
  const dark = smat(0x16242e, { metal: 0.55, rough: 0.45 });
  const accent = smat(0x0c3b4a, { emissive: 0x8ee9ff, ei: 1.3, metal: 0.5, rough: 0.3 });
  g.add(part(GEO.plate, dark, { s: [0.72, 0.28, 0.72], p: [0, 0.14, 0] }));
  g.add(part(GEO.cyl, accent, { s: [0.62, 0.09, 0.62], p: [0, 0.31, 0] }));
  const turret = new THREE.Group(); turret.position.y = 0.44; g.add(turret);
  turret.add(part(GEO.plate, dark, { s: [0.4, 0.3, 0.4], p: [0, 0.15, 0] }));
  const spin = new THREE.Group(); spin.position.y = 0.42; turret.add(spin);
  const cry = smat(0x0e2a3c, { emissive: 0x8ee9ff, ei: 1.7, rough: 0.2, metal: 0.45 });
  spin.add(part(GEO.oct, cry, { s: [0.28, 0.6, 0.28], p: [0, 0.5, 0], shadow: false }));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    spin.add(part(GEO.oct, cry, { s: [0.14, 0.28, 0.14], p: [Math.cos(a) * 0.34, 0.26, Math.sin(a) * 0.34], r: [0.35, a, -0.4], shadow: false }));
  }
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.95, 0.15); turret.add(muzzle);
  const glow = part(GEO.sphLo, glowMat(0xa8f2ff, 0.5), { s: [0.52, 0.52, 0.52], p: [0, 0.9, 0], shadow: false });
  turret.add(glow);
  return { g, turret, muzzle, glow, extras: { spin } };
}

function modelTesla() {
  const g = new THREE.Group();
  const dark = smat(0x1d1730, { metal: 0.6, rough: 0.4 });
  const accent = smat(0x2a1450, { emissive: 0xb98cff, ei: 1.5, metal: 0.5, rough: 0.3 });
  g.add(part(GEO.plate, dark, { s: [0.8, 0.3, 0.8], p: [0, 0.15, 0] }));
  g.add(part(GEO.cyl, accent, { s: [0.68, 0.1, 0.68], p: [0, 0.32, 0] }));
  const turret = new THREE.Group(); turret.position.y = 0.36; g.add(turret);
  turret.add(part(GEO.cylLo, dark, { s: [0.21, 1.05, 0.21], p: [0, 0.52, 0] }));
  for (let i = 0; i < 3; i++) {
    turret.add(part(GEO.torus, glowMat(0xc9a4ff, 0.5), { s: [0.36 - i * 0.05, 0.36 - i * 0.05, 0.36 - i * 0.05], p: [0, 0.3 + i * 0.3, 0], r: [Math.PI / 2, 0, 0], shadow: false }));
  }
  const glow = part(GEO.sph, new THREE.MeshStandardMaterial({ color: 0x2a1450, emissive: 0xc9a4ff, emissiveIntensity: 2.1, flatShading: true, metalness: 0.5, roughness: 0.2 }),
    { s: [0.34, 0.34, 0.34], p: [0, 1.16, 0] });
  turret.add(glow);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 1.16, 0); turret.add(muzzle);
  return { g, turret, muzzle, glow };
}

function modelSniper() {
  const g = new THREE.Group();
  const dark = smat(0x182018, { metal: 0.6, rough: 0.4 });
  const accent = smat(0x1b3a14, { emissive: 0x9dff6b, ei: 1.2, metal: 0.5, rough: 0.3 });
  g.add(part(GEO.plate, dark, { s: [0.68, 0.26, 0.68], p: [0, 0.13, 0] }));
  g.add(part(GEO.cyl, accent, { s: [0.44, 0.09, 0.44], p: [0, 0.36, 0] }));
  g.add(part(GEO.box, dark, { s: [0.34, 1.2, 0.34], p: [0, 0.8, 0] }));
  const turret = new THREE.Group(); turret.position.y = 1.44; g.add(turret);
  turret.add(part(GEO.box, accent, { s: [0.36, 0.32, 0.52], p: [0, 0, 0] }));
  turret.add(part(GEO.cylLo, smat(0x0d1410, { metal: 0.75, rough: 0.3 }), { s: [0.075, 1.5, 0.075], p: [0, 0.05, 0.78], r: [Math.PI / 2, 0, 0] }));
  turret.add(part(GEO.box, dark, { s: [0.15, 0.14, 0.46], p: [0, 0.24, 0.06] }));
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.05, 1.56); turret.add(muzzle);
  const glow = part(GEO.sphLo, glowMat(0xd6ffb0, 0.7), { s: [0.1, 0.1, 0.1], p: [0, 0.05, 1.5], shadow: false });
  turret.add(glow);
  return { g, turret, muzzle, glow };
}

const TOWER_MODELS = { gun: modelGun, cannon: modelCannon, frost: modelFrost, tesla: modelTesla, sniper: modelSniper };

function buildTowerModel(typeId) {
  const m = (TOWER_MODELS[typeId] || modelGun)();
  const def = towerDef(typeId);
  const pips = makePips(m.g, def.color, def.id === 'cannon' ? 1.0 : 0.9);
  m.g.userData = { turret: m.turret, muzzle: m.muzzle, glow: m.glow, pips, extras: m.extras || null };
  return m.g;
}

/* ------------------- con trỏ xây dựng + vòng tầm bắn ------------------- */
const ghostOk = bmat(0x5cffa8, 0.5, true);
const ghostBad = bmat(0xff5d73, 0.5, true);
let ghost = null, ghostType = null, indicator = null;

function buildIndicator() {
  const grp = new THREE.Group();
  const disc = new THREE.Mesh(GEO.disc, bmat(0x35e0ff, 0.07, true));
  disc.rotation.x = -Math.PI / 2; disc.position.y = 0.055; grp.add(disc);
  const ring = new THREE.Mesh(GEO.ring, bmat(0x35e0ff, 0.7, true));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.065; grp.add(ring);
  const tile = new THREE.Mesh(new THREE.PlaneGeometry(TILE * 0.94, TILE * 0.94), bmat(0x5cffa8, 0.13, true));
  tile.rotation.x = -Math.PI / 2; tile.position.y = 0.05; grp.add(tile);
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(TILE * 0.9, 0.06, TILE * 0.9)),
    new THREE.LineBasicMaterial({ color: 0x9dffc8, transparent: true, opacity: 0.85 })
  );
  grp.add(outline);
  grp.visible = false; world.add(grp);
  indicator = { grp, disc, ring, tile, outline };
}

function makeGhost(typeId) {
  if (ghost) { world.remove(ghost); ghost = null; }
  if (!typeId) return;
  ghost = buildTowerModel(typeId);
  ghost.traverse((o) => { if (o.isMesh) { o.material = ghostOk; o.castShadow = false; } });
  ghostType = typeId;
  world.add(ghost);
}

function updateGhost() {
  if (!ghost) return;
  const h = S.hover, bm = S.buildMode;
  if (!h) { ghost.visible = false; return; }
  const p = worldPos(h.gx, h.gz);
  const ok = canBuild(h.gx, h.gz);
  ghost.visible = true;
  ghost.position.set(p.x, 0.02, p.z);
  const mat = ok ? ghostOk : ghostBad;
  ghost.traverse((o) => { if (o.isMesh) o.material = mat; });
  ghost.rotation.y += 0.012;
  if (bm) {
    const st = towerStats(bm, 1);
    indicator.grp.visible = true;
    indicator.grp.position.set(p.x, 0, p.z);
    indicator.disc.scale.set(st.range, 1, st.range);
    indicator.ring.scale.set(st.range, 1, st.range);
    _c1.setHex(ok ? 0x35e0ff : 0xff5d73);
    indicator.disc.material.color.copy(_c1);
    indicator.ring.material.color.copy(_c1);
    indicator.tile.material.color.copy(_c1);
  }
}

/* ------------------------------ hiệu ứng ------------------------------- */
function addFX(fx) { FX.push(fx); }

function burst(o) {
  const {
    pos, color = 0xffffff, count = 14, speed = 7, size = 0.16, life = 0.5,
    gravity = -16, shape = 'box', spread = 1, power = 1,
  } = o;
  const geo = shape === 'sph' ? GEO.sphLo : shape === 'oct' ? GEO.oct : GEO.box;
  const inst = new THREE.InstancedMesh(geo, bmat(color, 0.95, true), count);
  inst.frustumCulled = false;
  const vel = [];
  for (let i = 0; i < count; i++) {
    const v = new THREE.Vector3(rnd(-1, 1), rnd(-0.35, 1) * spread, rnd(-1, 1)).normalize().multiplyScalar(speed * rnd(0.45, 1.15));
    vel.push(v);
    iPlace(inst, i, pos.x, pos.y, pos.z, rnd(0, 3), size, size, size, rnd(0, 3));
  }
  inst.instanceMatrix.needsUpdate = true;
  world.add(inst);
  addFX({
    t: 0, life,
    update(dt) {
      this.t += dt;
      if (this.t >= this.life) { world.remove(inst); return false; }
      for (let i = 0; i < count; i++) {
        const v = vel[i];
        v.y += gravity * dt;
        _dm.position.set(0, 0, 0); _dm.rotation.set(0, 0, 0); _dm.scale.set(1, 1, 1);
        // lấy vị trí hiện tại từ matrix
        inst.getMatrixAt(i, _dm.matrix);
        const m = _dm.matrix.elements;
        const x = m[12] + v.x * dt, y = m[13] + v.y * dt, z = m[14] + v.z * dt;
        iPlace(inst, i, x, y, z, 0, size, size, size);
      }
      inst.instanceMatrix.needsUpdate = true;
      inst.material.opacity = 0.95 * (1 - this.t / this.life);
      return true;
    },
  });
}

function ringFx(pos, color, radius = 3, life = 0.45, y = 0.12) {
  const m = new THREE.Mesh(GEO.ring, bmat(color, 0.85, true));
  m.rotation.x = -Math.PI / 2; m.position.set(pos.x, y, pos.z);
  m.scale.set(0.3, 0.3, 1); world.add(m);
  addFX({
    t: 0, life,
    update(dt) {
      this.t += dt;
      const k = this.t / this.life;
      if (k >= 1) { world.remove(m); return false; }
      const s = lerp(0.3, radius, Math.pow(k, 0.45));
      m.scale.set(s, s, 1);
      m.material.opacity = 0.85 * (1 - k);
      return true;
    },
  });
}

function beamFx(a, b, color, life = 0.14, thick = 0.1) {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(GEO.box, bmat(color, 0.9, true));
  m.scale.set(thick, thick, len);
  m.position.copy(a).lerp(b, 0.5);
  m.lookAt(b); m.castShadow = false; world.add(m);
  addFX({
    t: 0, life,
    update(dt) {
      this.t += dt;
      const k = this.t / this.life;
      if (k >= 1) { world.remove(m); return false; }
      m.material.opacity = 0.9 * (1 - k);
      m.scale.set(thick * (1 - k * 0.5), thick * (1 - k * 0.5), len);
      return true;
    },
  });
}

function chainFx(points, color, life = 0.18) {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    if (Math.random() < 0.5) { // vẽ 2 tia gấp khúc cho giống sét
      const mid = _v1.copy(a).lerp(b, 0.5);
      mid.x += rnd(-0.5, 0.5); mid.y += rnd(-0.4, 0.5); mid.z += rnd(-0.5, 0.5);
      beamFx(a, mid, color, life, 0.075);
      beamFx(mid, b, color, life, 0.075);
    } else beamFx(a, b, color, life, 0.075);
  }
}

function spinFx(pos, color, size = 1.2, life = 0.35) {
  const m = new THREE.Mesh(GEO.oct, bmat(color, 0.9, true));
  m.position.copy(pos); m.scale.setScalar(size); world.add(m);
  addFX({
    t: 0, life,
    update(dt) {
      this.t += dt;
      const k = this.t / this.life;
      if (k >= 1) { world.remove(m); return false; }
      m.rotation.x += dt * 9; m.rotation.y += dt * 12;
      m.scale.setScalar(size * (1 + k * 1.4));
      m.material.opacity = 0.9 * (1 - k);
      return true;
    },
  });
}

function updateFX(dt) {
  for (let i = FX.length - 1; i >= 0; i--) {
    const alive = FX[i].update(dt);
    if (!alive) FX.splice(i, 1);
  }
}

/* ---------------------------- trạng thái ------------------------------- */
const S = {
  phase: 'menu', speed: 1, diff: 'normal', level: LEVELS[0].id, map: null,
  gold: 0, lives: 0, wave: 0, score: 0, kills: 0, leaks: 0, built: 0,
  buildTimer: 0, waveTimer: 0, waveData: null, spawnIdx: 0, waveActive: false,
  buildMode: null, selected: null, hover: null,
  enemies: [], towers: [], projectiles: [],
  pathPts: null, airPts: null, pathLen: 0, airLen: 0, sim: 0, best: 0,
};
S.map = levelDef(S.level);
let lastEntryId = null;          // bản ghi vừa ghi vào bảng xếp hạng (để tô sáng)

/* ------------------------------ lưu trữ -------------------------------- */
const KEYS = {
  prog: 'neon-defense-progress',
  name: 'neon-defense-name',
  board: (id) => 'neon-defense-board:' + id,
  legacyBest: 'neon-defense-best',       // khoá của bản cũ, chỉ để chuyển dữ liệu
  legacyName: 'neon-defense-player',
};
const PROG = { unlocked: [], cleared: {}, name: '', last: null };
const LAST_KEY = 'neon-defense-last';
const BOARD_CACHE = new Map();

function lsGet(k, def) { try { const v = localStorage.getItem(k); return v === null ? def : v; } catch (e) { return def; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* chế độ riêng tư */ } }

function saveProgress() {
  lsSet(KEYS.prog, JSON.stringify({ unlocked: PROG.unlocked, cleared: PROG.cleared }));
}
function loadProgress() {
  try {
    const raw = lsGet(KEYS.prog, null);
    if (raw) {
      const o = JSON.parse(raw) || {};
      PROG.unlocked = Array.isArray(o.unlocked) ? o.unlocked.filter((id) => LEVELS.some((l) => l.id === id)) : [];
      PROG.cleared = o.cleared && typeof o.cleared === 'object' ? o.cleared : {};
    }
  } catch (e) { PROG.unlocked = []; PROG.cleared = {}; }
  PROG.name = String(lsGet(KEYS.name, '') || lsGet(KEYS.legacyName, '') || '').slice(0, 14);
  const last = lsGet(LAST_KEY, null);
  if (last && LEVELS.some((l) => l.id === last)) { PROG.last = last; S.level = last; S.map = levelDef(last); }
  // chuyển điểm cao nhất của bản cũ sang bảng xếp hạng bản đồ mặc định
  const legacy = Number(lsGet(KEYS.legacyBest, 0) || 0);
  if (legacy > 0 && !boardOf(LEVELS[1].id).length) {
    writeBoard(LEVELS[1].id, [{ id: 'legacy', name: PROG.name || 'Người chơi', score: legacy, wave: LEVELS[1].waves, kills: 0, lives: 0, difficulty: 'normal', win: true, time: Date.now() }]);
  }
}
function isUnlocked(levelId) { return levelId === LEVELS[0].id || PROG.unlocked.includes(levelId); }
/** Ghi nhớ bản đồ vừa chơi để lần sau vào thẳng màn đó. */
function rememberLevel(levelId) {
  PROG.last = levelId;
  lsSet(LAST_KEY, levelId);
}
/** Mở khoá toàn bộ bản đồ (dùng cho chế độ tự do / gỡ lỗi / kiểm thử). */
function unlockAll(save = true) {
  PROG.unlocked = LEVELS.map((l) => l.id);
  if (save) saveProgress();
  return PROG.unlocked.length;
}
/** Đổi bản đồ đang hoạt động: cập nhật lưới, đường đi, trang trí, căn cứ, camera.
 *  Dùng cho màn chọn bản đồ / bảng xếp hạng / API gỡ lỗi. */
function applyLevelMap(levelId) {
  const l = setMap(levelId);
  S.level = l.id; S.map = l;
  buildStaticWorld(l.id);
  buildPathData();
  return l;
}
/** Xoá tiến độ + điểm (dùng trong màn cài đặt / kiểm thử). */
function resetProgress() {
  PROG.unlocked = [];
  PROG.cleared = {};
  PROG.last = null;
  saveProgress();
  try { localStorage.removeItem(LAST_KEY); } catch (e) { /* ignore */ }
  for (const l of LEVELS) clearBoard(l.id);
}
function unlockNext(levelId) {
  const nxt = LEVELS[levelIndex(levelId) + 1];
  if (!nxt) return null;
  if (PROG.unlocked.includes(nxt.id)) return null;
  PROG.unlocked.push(nxt.id);
  saveProgress();
  toast(`🔓 Mở khoá bản đồ mới: ${nxt.badge} ${nxt.name}`, 'good');
  return nxt;
}
function bestOf(levelId) { return PROG.cleared[levelId] || null; }
function recordResult(levelId, diffId, entry) {
  const cur = PROG.cleared[levelId];
  const better = !cur || (entry.win && !cur.win) || entry.score > (cur.score || 0);
  if (better) PROG.cleared[levelId] = { score: entry.score, wave: entry.wave, difficulty: diffId, win: !!entry.win, time: entry.time };
  saveProgress();
}
function clearedCount() { return LEVELS.filter((l) => bestOf(l.id) && bestOf(l.id).win).length; }

/* --------------------------- bảng xếp hạng ----------------------------- */
function boardOf(levelId) {
  if (!BOARD_CACHE.has(levelId)) {
    let arr = [];
    try {
      const raw = lsGet(KEYS.board(levelId), null);
      if (raw) { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) arr = parsed.filter((e) => e && Number.isFinite(e.score)); }
    } catch (e) { arr = []; }
    arr.sort(scoreCompare);
    BOARD_CACHE.set(levelId, arr.slice(0, 10));
  }
  return BOARD_CACHE.get(levelId);
}
function writeBoard(levelId, arr) {
  BOARD_CACHE.set(levelId, arr.slice(0, 10));
  lsSet(KEYS.board(levelId), JSON.stringify(arr.slice(0, 10)));
}
function clearBoard(levelId) {
  BOARD_CACHE.set(levelId, []);
  try { localStorage.removeItem(KEYS.board(levelId)); } catch (e) { /* ignore */ }
}
function boardCount() { let n = 0; for (const l of LEVELS) n += boardOf(l.id).length; return n; }
function topScoreAll() {
  let top = 0;
  for (const l of LEVELS) { const b = boardOf(l.id); if (b.length) top = Math.max(top, b[0].score); }
  return top;
}
function playerName() { return PROG.name || 'Người chơi'; }
function setPlayerName(n) { PROG.name = String(n || '').trim().slice(0, 14); lsSet(KEYS.name, PROG.name); }
/** Ghi điểm vào bảng xếp hạng của bản đồ; trả về { rank, inserted, entry }. */
function submitScore(data) {
  const levelId = data.levelId || S.map.id;
  const rec = {
    id: data.id || makeEntryId(),
    name: (data.name || playerName()).slice(0, 14),
    score: Math.round(data.score),
    wave: data.wave | 0,
    kills: data.kills | 0,
    lives: data.lives | 0,
    difficulty: data.difficulty || S.diff,
    win: !!data.win,
    time: data.time || Date.now(),
  };
  const res = insertScore(boardOf(levelId), rec, 10);
  writeBoard(levelId, res.board);
  S.best = res.board.length ? res.board[0].score : rec.score;
  lastEntryId = rec.id;
  return { rank: res.rank, inserted: res.inserted, entry: rec };
}
function renameEntry(levelId, entryId, name) {
  const clean = String(name || '').trim().slice(0, 14) || 'Người chơi';
  writeBoard(levelId, boardOf(levelId).map((e) => (e.id === entryId ? { ...e, name: clean } : e)));
}
function escapeHtml(v) {
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
let nid = 1;

/* ---------------------- chuẩn bị dữ liệu đường đi ---------------------- */
function buildPathData() {
  const ground = pathWorldPoints().map((p) => ({ x: p.x, z: p.z }));
  const air = airWorldPoints().map((p) => ({ x: p.x, z: p.z }));
  S.pathPts = withLengths(ground); S.pathLen = S.pathPts[S.pathPts.length - 1].len;
  S.airPts = withLengths(air); S.airLen = S.airPts[S.airPts.length - 1].len;
}
function withLengths(pts) {
  const out = [{ x: pts[0].x, z: pts[0].z, len: 0 }];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    acc += dist2d(pts[i - 1].x, pts[i - 1].z, pts[i].x, pts[i].z);
    out.push({ x: pts[i].x, z: pts[i].z, len: acc });
  }
  return out;
}
function pointAtDist(pts, total, d) {
  const last = pts[pts.length - 1];
  if (d >= total) return { x: last.x, z: last.z, dx: 1, dz: 0, done: true };
  let i = 0;
  while (i < pts.length - 2 && d > pts[i + 1].len) i++;
  const a = pts[i], b = pts[i + 1];
  const seg = Math.max(0.0001, b.len - a.len);
  const k = clamp((d - a.len) / seg, 0, 1);
  return { x: lerp(a.x, b.x, k), z: lerp(a.z, b.z, k), dx: b.x - a.x, dz: b.z - a.z, done: false };
}

/* ------------------------------ kẻ địch -------------------------------- */
function makeBar(w, color) {
  const g = new THREE.Group();
  const bg = new THREE.Mesh(GEO.plane, bmat(0x0a0611, 0.72));
  bg.scale.set(w, w * 0.15, 1); g.add(bg);
  const fill = new THREE.Mesh(GEO.plane, bmat(color, 0.95));
  fill.scale.set(w * 0.96, w * 0.1, 1); fill.position.z = 0.012; g.add(fill);
  g.userData = { fill, w };
  return g;
}

function buildEnemyMesh(st) {
  const g = new THREE.Group();          // chỉ giữ vị trí
  g.name = 'enemy:' + st.id;
  const inner = new THREE.Group();      // xoay theo hướng đi
  inner.name = 'enemy-body';
  g.add(inner);
  const body = smat(st.color, { metal: 0.5, rough: 0.45, emissive: st.color, ei: 0.26 });
  const dark = smat(0x121824, { metal: 0.65, rough: 0.5 });
  const eye = glowMat(0xffffff, 0.9);
  let rotor = null;

  if (st.air) {
    inner.add(part(GEO.cylLo, dark, { s: [0.46, 0.13, 0.46] }));
    inner.add(part(GEO.oct, body, { s: [0.26, 0.32, 0.26], p: [0, 0.2, 0] }));
    rotor = new THREE.Group(); rotor.position.y = 0.14; inner.add(rotor);
    for (let i = 0; i < 2; i++) rotor.add(part(GEO.box, dark, { s: [1.45, 0.035, 0.12], r: [0, (i * Math.PI) / 2, 0], shadow: false }));
    inner.add(part(GEO.torus, glowMat(st.color, 0.7), { s: [0.42, 0.42, 0.42], p: [0, -0.07, 0], r: [Math.PI / 2, 0, 0], shadow: false }));
    inner.add(part(GEO.sphLo, eye, { s: [0.085, 0.085, 0.085], p: [0, 0.2, -0.3], shadow: false }));
  } else if (st.id === 'tank') {
    inner.add(part(GEO.box, dark, { s: [0.95, 0.42, 1.25], p: [0, 0.42, 0] }));
    inner.add(part(GEO.box, dark, { s: [0.23, 0.3, 1.4], p: [-0.54, 0.3, 0] }));
    inner.add(part(GEO.box, dark, { s: [0.23, 0.3, 1.4], p: [0.54, 0.3, 0] }));
    inner.add(part(GEO.plate, body, { s: [0.52, 0.36, 0.52], p: [0, 0.78, 0] }));
    inner.add(part(GEO.cylLo, body, { s: [0.12, 0.85, 0.12], p: [0, 0.8, 0.55], r: [Math.PI / 2, 0, 0] }));
    inner.add(part(GEO.sphLo, eye, { s: [0.07, 0.07, 0.07], p: [0, 0.88, 0.4], shadow: false }));
    inner.add(part(GEO.box, body, { s: [0.08, 0.5, 0.08], p: [0, 1.05, -0.3], r: [0.3, 0, 0] }));
    inner.add(part(GEO.sphLo, glowMat(st.color, 0.85), { s: [0.11, 0.11, 0.11], p: [0, 1.28, -0.42], shadow: false }));
  } else if (st.id === 'boss') {
    inner.add(part(GEO.ico, dark, { s: [0.85, 0.9, 0.75], p: [0, 0.9, 0] }));
    inner.add(part(GEO.plate, body, { s: [0.55, 0.5, 0.55], p: [0, 1.85, 0] }));
    for (let i = 0; i < 2; i++) {
      const sx = i === 0 ? -1 : 1;
      inner.add(part(GEO.box, dark, { s: [0.24, 0.95, 0.24], p: [sx * 0.85, 0.85, 0], r: [0, 0, sx * -0.22] }));
      inner.add(part(GEO.cone, body, { s: [0.2, 0.5, 0.2], p: [sx * 1.0, 0.3, 0], r: [Math.PI, 0, 0] }));
      inner.add(part(GEO.cone, body, { s: [0.17, 0.42, 0.17], p: [sx * 0.42, 2.28, 0], r: [0, 0, sx * 0.5] }));
      inner.add(part(GEO.sphLo, glowMat(st.color, 0.95), { s: [0.13, 0.13, 0.13], p: [sx * 0.28, 1.88, 0.42], shadow: false }));
    }
    inner.add(part(GEO.torus, glowMat(0xff4fd8, 0.8), { s: [0.7, 0.7, 0.7], p: [0, 2.5, 0], r: [Math.PI / 2, 0, 0], shadow: false }));
    inner.add(part(GEO.oct, glowMat(st.color, 0.9), { s: [0.2, 0.34, 0.2], p: [0, 2.95, 0], shadow: false }));
  } else if (st.id === 'alien') {                     // 👽 sinh vật ngoài hành tinh: thân giọt nước, mắt to
    const head = new THREE.Group(); head.position.y = 0.92; inner.add(head);
    head.add(part(GEO.sph, body, { s: [0.3, 0.36, 0.34] }));
    head.add(part(GEO.sph, dark, { s: [0.34, 0.16, 0.34], p: [0, 0.24, 0], shadow: false }));
    for (let i = 0; i < 2; i++) {
      const sx = i === 0 ? -1 : 1;
      head.add(part(GEO.sphLo, glowMat(0x0a2a22, 0.95), { s: [0.15, 0.19, 0.08], p: [sx * 0.15, 0, 0.27], r: [0, 0, sx * 0.32], shadow: false }));
      head.add(part(GEO.sphLo, glowMat(0xff5ad8, 0.85), { s: [0.055, 0.075, 0.04], p: [sx * 0.13, 0, 0.34], shadow: false }));
    }
    // tua cảm giác
    for (let i = 0; i < 3; i++) {
      const a = -0.5 + i * 0.5;
      head.add(part(GEO.coneLo, dark, { s: [0.05, 0.34, 0.05], p: [Math.sin(a) * 0.22, 0.3, Math.cos(a) * -0.06], r: [0.35, 0, Math.sin(a) * 0.7], shadow: false }));
      head.add(part(GEO.sphLo, glowMat(st.color, 0.8), { s: [0.04, 0.04, 0.04], p: [Math.sin(a) * 0.3, 0.46, Math.cos(a) * -0.1], shadow: false }));
    }
    inner.add(part(GEO.cylLo, dark, { s: [0.17, 0.62, 0.17], p: [0, 0.34, 0] }));
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1;
      inner.add(part(GEO.box, body, { s: [0.09, 0.4, 0.09], p: [Math.sin(a) * 0.24, 0.34, Math.cos(a) * 0.24], r: [Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5] }));
    }
    inner.add(part(GEO.torus, glowMat(st.color, 0.72), { s: [0.3, 0.3, 0.3], p: [0, 0.92, 0], r: [Math.PI / 2, 0, 0], shadow: false }));
  } else if (st.id === 'monster') {                   // 🧟 quái vật đột biến: thân to, nhiều gai, mắt đỏ
    inner.add(part(GEO.ico, body, { s: [0.48, 0.55, 0.42], p: [0, 0.72, 0] }));
    inner.add(part(GEO.ico, dark, { s: [0.56, 0.62, 0.34], p: [0, 0.72, 0], shadow: false }));
    inner.add(part(GEO.plate, dark, { s: [0.3, 0.3, 0.34], p: [0, 1.2, 0.02] }));
    for (let i = 0; i < 5; i++) {                     // gai trên lưng
      const a = -1.1 + i * 0.55;
      inner.add(part(GEO.coneLo, body, { s: [0.09, 0.3 + Math.cos(a) * 0.1, 0.09], p: [Math.sin(a) * 0.42, 1.2 + Math.cos(a) * 0.12, -0.06], r: [-0.5, 0, Math.sin(a) * 0.9] }));
    }
    for (let i = 0; i < 2; i++) {                     // chi trên
      const sx = i === 0 ? -1 : 1;
      inner.add(part(GEO.box, dark, { s: [0.15, 0.7, 0.15], p: [sx * 0.44, 0.72, 0.06], r: [0, 0, sx * -0.42] }));
      inner.add(part(GEO.cylLo, body, { s: [0.14, 0.42, 0.14], p: [sx * 0.55, 0.4, 0.16], r: [0.5, 0, sx * -0.2] }));
    }
    inner.add(part(GEO.sphLo, glowMat(0xff3b3b, 0.95), { s: [0.1, 0.1, 0.1], p: [-0.12, 1.2, 0.3], shadow: false }));
    inner.add(part(GEO.sphLo, glowMat(0xff3b3b, 0.95), { s: [0.1, 0.1, 0.1], p: [0.12, 1.2, 0.3], shadow: false }));
    for (let i = 0; i < 2; i++) {                     // chân
      const sx = i === 0 ? -1 : 1;
      inner.add(part(GEO.box, dark, { s: [0.18, 0.42, 0.2], p: [sx * 0.2, 0.22, 0], r: [0.1, 0, sx * 0.1] }));
    }
  } else if (st.id === 'spawn') {                     // 🐛 ấu trùng: nhỏ, nhiều đốt, chạy nhanh
    for (let i = 0; i < 3; i++) {
      const t2 = i / 2;
      inner.add(part(GEO.sph, body, { s: [0.2 - t2 * 0.05, 0.17 - t2 * 0.04, 0.2 - t2 * 0.05], p: [0, 0.2 - t2 * 0.02, -0.16 + t2 * 0.18] }));
    }
    inner.add(part(GEO.sphLo, glowMat(0x2a3a10, 0.9), { s: [0.13, 0.12, 0.12], p: [0, 0.22, -0.28], shadow: false }));
    inner.add(part(GEO.sphLo, glowMat(0x111111, 1), { s: [0.045, 0.045, 0.045], p: [-0.05, 0.3, -0.3], shadow: false }));
    inner.add(part(GEO.sphLo, glowMat(0x111111, 1), { s: [0.045, 0.045, 0.045], p: [0.05, 0.3, -0.3], shadow: false }));
    for (let i = 0; i < 2; i++) {
      const sx = i === 0 ? -1 : 1;
      inner.add(part(GEO.box, dark, { s: [0.06, 0.1, 0.3], p: [sx * 0.2, 0.2, -0.1], r: [0, sx * 0.35, 0], shadow: false }));
      inner.add(part(GEO.cylLo, dark, { s: [0.04, 0.22, 0.04], p: [sx * 0.16, 0.06, 0.14], r: [0.5, 0, sx * 0.3], shadow: false }));
    }
    inner.add(part(GEO.torus, glowMat(st.color, 0.6), { s: [0.26, 0.26, 0.26], p: [0, 0.2, -0.04], r: [Math.PI / 2, 0, 0], shadow: false }));
  } else if (st.id === 'runner') {
    inner.add(part(GEO.cone, body, { s: [0.3, 0.9, 0.3], p: [0, 0.5, 0] }));
    inner.add(part(GEO.oct, dark, { s: [0.2, 0.26, 0.2], p: [0, 1.05, 0] }));
    inner.add(part(GEO.sphLo, glowMat(0xffffff, 0.95), { s: [0.09, 0.09, 0.09], p: [0, 1.08, 0.2], shadow: false }));
    for (let i = 0; i < 2; i++) {
      const sx = i === 0 ? -1 : 1;
      inner.add(part(GEO.box, dark, { s: [0.08, 0.5, 0.08], p: [sx * 0.26, 0.28, 0], r: [0, 0, sx * 0.35] }));
    }
    inner.add(part(GEO.box, dark, { s: [0.34, 0.26, 0.24], p: [0, 0.16, 0.08] }));
  } else { // grunt
    inner.add(part(GEO.box, dark, { s: [0.52, 0.62, 0.42], p: [0, 0.62, 0] }));
    inner.add(part(GEO.box, body, { s: [0.42, 0.2, 0.36], p: [0, 0.95, 0] }));
    inner.add(part(GEO.box, dark, { s: [0.12, 0.42, 0.12], p: [-0.35, 0.62, 0] }));
    inner.add(part(GEO.box, dark, { s: [0.12, 0.42, 0.12], p: [0.35, 0.62, 0] }));
    inner.add(part(GEO.box, dark, { s: [0.16, 0.34, 0.16], p: [-0.16, 0.24, 0] }));
    inner.add(part(GEO.box, dark, { s: [0.16, 0.34, 0.16], p: [0.16, 0.24, 0] }));
    inner.add(part(GEO.box, body, { s: [0.34, 0.22, 0.2], p: [0, 0.92, 0.22] }));
    inner.add(part(GEO.sphLo, eye, { s: [0.055, 0.055, 0.055], p: [-0.1, 0.96, 0.32], shadow: false }));
    inner.add(part(GEO.sphLo, eye, { s: [0.055, 0.055, 0.055], p: [0.1, 0.96, 0.32], shadow: false }));
  }

  // vòng sáng dưới chân: giúp nhận ra địch ngay trên nền tối (bay thì để vòng mờ dưới mặt đất)
  const marker = new THREE.Mesh(GEO.disc, bmat(st.color, st.air ? 0.15 : 0.24, true));
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = st.air ? 0.07 : 0.04;
  marker.scale.set(st.air ? 0.55 : 0.66, st.air ? 0.55 : 0.66, 1);
  marker.castShadow = false;
  marker.name = 'enemy-marker';
  g.add(marker);

  const bar = makeBar(1.05, st.color);
  bar.position.y = st.air ? 1.1 : (st.id === 'boss' ? 3.5 : st.id === 'tank' ? 1.75 : 1.4);
  g.add(bar);

  const aura = new THREE.Mesh(GEO.sph, bmat(0x8ee9ff, 0.18, true));
  aura.scale.setScalar(st.id === 'boss' ? 2.1 : st.id === 'tank' ? 1.1 : 0.75);
  aura.position.y = st.id === 'boss' ? 1.4 : 0.6;
  aura.visible = false; g.add(aura);

  g.scale.setScalar(st.scale);
  return { g, inner, bar, rotor, aura };
}

function spawnEnemy(type, wave, opts = {}) {
  const diff = diffOf(S.diff);
  const st = enemyStats(type, wave, diff);
  if (opts.hpMul) st.hp = Math.max(1, Math.round(st.hp * opts.hpMul));
  if (opts.rewardMul) st.reward = Math.max(1, Math.round(st.reward * opts.rewardMul));
  const parts = buildEnemyMesh(st);
  const e = {
    id: nid++, type: st.id, st, name: st.name, air: st.air, color: st.color,
    hp: st.hp, maxHp: st.hp, speed: st.speed, armor: st.armor,
    g: parts.g, inner: parts.inner, bar: parts.bar, rotor: parts.rotor, aura: parts.aura,
    dist: 0, alive: true, slowUntil: -99, slowAmt: 0, flash: 0,
    pos: new THREE.Vector3(), ph: Math.random() * 6.28, pts: st.air ? S.airPts : S.pathPts,
    len: st.air ? S.airLen : S.pathLen, baseY: st.air ? 2.6 : 0, bob: st.air ? 0.4 : 0.05,
  };
  const start = pointAtDist(e.pts, e.len, opts.fromDist || 0);
  e.dist = opts.fromDist || 0;
  e.pos.set(start.x, e.baseY, start.z);
  e.g.position.copy(e.pos);
  world.add(e.g);        // ⚠️ bắt buộc: thiếu dòng này thì địch vẫn chạy trong logic nhưng VÔ HÌNH trên bản đồ
  S.enemies.push(e);

  if (!opts.silent) {
    const portal = portalObj.group.position;
    ringFx(_v1.set(portal.x, 0, portal.z), st.air ? 0xff4fd8 : st.color, st.air ? 4 : 2.4, 0.5, st.air ? 0.5 : 0.14);
    if (!st.air) burst({ pos: _v2.set(start.x, 0.35, start.z), color: st.color, count: 8, speed: 5, size: 0.12, life: 0.4 });
  }
  return e;
}

function enemyRadius(e) { return 0.5 * e.st.scale; }

function damageEnemy(e, dmg, opt = {}) {
  if (!e.alive) return 0;
  const d = applyArmor(dmg, e.armor, !!opt.ignoreArmor);
  e.hp -= d;
  e.flash = 0.12;
  if (e.hp <= 0) { killEnemy(e, opt.source); return d; }
  if (Math.random() < 0.35) Sound.play('hit');
  return d;
}

function killEnemy(e, source) {
  if (!e.alive) return;
  e.alive = false;
  // 🧟 quái vật đột biến: bị hạ sẽ tách thành các ấu trùng nhỏ
  if (e.st.split && !e.spawned) {
    const { type, count } = e.st.split;
    for (let i = 0; i < count; i++) {
      spawnEnemy(type, S.wave, { fromDist: Math.max(0, e.dist - i * 0.9), hpMul: 0.75, silent: true });
    }
    burst({ pos: e.pos, color: 0xa6ff5c, count: 12, speed: 6, size: 0.14, life: 0.45, shape: 'sph' });
  }
  S.kills++;
  const rw = e.st.reward;
  S.gold += rw; S.score += e.st.score;
  if (source) source.kills++;
  burst({ pos: e.pos, color: e.color, count: e.st.id === 'boss' ? 34 : 14, speed: e.st.id === 'boss' ? 12 : 7, size: e.st.id === 'boss' ? 0.3 : 0.16, life: 0.6, shape: 'oct' });
  ringFx(e.pos, e.color, e.st.id === 'boss' ? 6 : 2.2, 0.5, 0.14);
  if (e.st.id === 'boss') { ringFx(e.pos, 0xff4fd8, 9, 0.8, 0.1); CAM.shake = Math.max(CAM.shake, 0.6); }
  Sound.play('death'); Sound.play('coin');
  floatGold(e.pos, rw);
  world.remove(e.g);
  const i = S.enemies.indexOf(e); if (i >= 0) S.enemies.splice(i, 1);
  if (rw >= 20) toast(`+${rw} vàng · hạ ${e.name}`, 'good');
}

const floaters = [];
function floatGold(pos, amount) {
  if (amount < 12) return;
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64;
  const ctx = cv.getContext && cv.getContext('2d');
  if (!ctx) return;
  const tex = new THREE.CanvasTexture(cv);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  spr.scale.set(2.2, 1.1, 1); spr.position.copy(pos); spr.position.y += 1.2;
  world.add(spr);
  floaters.push({ spr, tex, ctx, cv, t: 0, life: 0.9, amount });
  ctx.font = 'bold 42px ui-monospace, Menlo, monospace';
  ctx.fillStyle = '#ffd166'; ctx.textAlign = 'center';
  ctx.fillText('+' + amount, 64, 44);
  tex.needsUpdate = true;
}
function updateFloaters(dt) {
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.t += dt;
    const k = f.t / f.life;
    if (k >= 1) { world.remove(f.spr); f.tex.dispose(); f.spr.material.dispose(); floaters.splice(i, 1); continue; }
    f.spr.position.y += dt * 1.6;
    f.spr.material.opacity = 1 - k * k;
  }
}

function leakEnemy(e) {
  e.alive = false;
  S.leaks++;
  S.lives -= e.st.leak;
  CAM.shake = Math.max(CAM.shake, 0.5);
  Sound.play('leak');
  burst({ pos: _v1.set(basePos.x, 1.4, basePos.z), color: 0xff5d73, count: 18, speed: 8, size: 0.2, life: 0.5 });
  ringFx(_v1.set(basePos.x, 0, basePos.z), 0xff5d73, 6, 0.6, 0.14);
  toast(`-${e.st.leak} mạng! ${e.name} lọt vào căn cứ`, 'bad');
  world.remove(e.g);
  const i = S.enemies.indexOf(e); if (i >= 0) S.enemies.splice(i, 1);
  if (S.lives <= 0) { S.lives = 0; gameOver(); }
}

function updateEnemies(dt) {
  for (let i = S.enemies.length - 1; i >= 0; i--) {
    const e = S.enemies[i];
    if (!e.alive) continue;
    const slow = S.sim < e.slowUntil;
    const spd = e.speed * (slow ? 1 - e.slowAmt : 1);
    // 👽 dịch chuyển tức thời: bỏ qua một đoạn đường, nhưng bị làm chậm thì không nhảy
    if (e.st.blink && !slow) {
      e.blinkT = (e.blinkT || 0) + dt;
      if (e.blinkT >= e.st.blinkCd) {
        e.blinkT = 0;
        e.dist += e.st.blink;
        ringFx(e.pos, e.st.color, 2.6, 0.35, 0.16);
        spinFx(e.pos, 0xff5ad8, 0.5, 0.3);
        Sound.play('blink');
      }
    }
    e.dist += spd * dt;
    const p = pointAtDist(e.pts, e.len, e.dist);
    if (p.done) { leakEnemy(e); continue; }
    const y = e.baseY + Math.sin(S.sim * (e.air ? 2.4 : 7) + e.ph) * e.bob;
    e.pos.set(p.x, y, p.z);
    e.g.position.copy(e.pos);
    e.inner.rotation.y = Math.atan2(p.dx, p.dz);
    if (e.rotor) e.rotor.rotation.y += dt * 26;
    if (e.inner && !e.air && e.type !== 'spawn') {
      e.inner.position.y = Math.abs(Math.sin(S.sim * 8 + e.ph)) * 0.09;
      e.inner.rotation.z = Math.sin(S.sim * 8 + e.ph) * 0.05;
    }
    // thanh máu + aura làm chậm
    e.bar.quaternion.copy(camera.quaternion);
    const f = clamp(e.hp / e.maxHp, 0, 1);
    const fill = e.bar.userData.fill, w = e.bar.userData.w * 0.96;
    fill.scale.x = Math.max(0.001, w * f);
    fill.position.x = -(w * (1 - f)) / 2;
    _c1.setHSL(lerp(0.0, 0.33, f), 0.85, 0.55);
    fill.material.color.copy(_c1);
    e.aura.visible = slow;
    if (slow) e.aura.material.opacity = 0.14 + Math.sin(S.sim * 12) * 0.05;
    if (e.flash > 0) { e.flash -= dt; e.g.scale.setScalar(e.st.scale * (1 + Math.max(0, e.flash) * 0.6)); }
    else e.g.scale.setScalar(e.st.scale);
    if (S.lives <= 0) break;
  }
}

/* -------------------------------- tháp --------------------------------- */
function canBuild(gx, gz) {
  if (!inGrid(gx, gz)) return false;
  const k = key(gx, gz);
  if (blocked.has(k) || towerAt.has(k) || noBuild.has(k)) return false;
  return true;
}

function makeTower(typeId, gx, gz, level = 1) {
  const def = towerDef(typeId);
  const group = buildTowerModel(typeId);
  group.name = 'tower:' + typeId;
  group.position.set(worldX(gx), 0.02, worldZ(gz));
  world.add(group);
  const t = {
    id: nid++, type: typeId, def, gx, gz, level, invested: def.cost, cd: rnd(0, 0.25),
    group, turret: group.userData.turret, muzzle: group.userData.muzzle, glow: group.userData.glow,
    pips: group.userData.pips, extras: group.userData.extras, stats: towerStats(typeId, level),
    target: null, kills: 0, dmg: 0, recoil: 0, aim: 0,
    pos: new THREE.Vector3(worldX(gx), 0.9, worldZ(gz)), mz: new THREE.Vector3(),
  };
  towerAt.set(key(gx, gz), t);
  S.towers.push(t);
  applyTowerLevel(t);
  return t;
}

function applyTowerLevel(t) {
  t.stats = towerStats(t.type, t.level);
  t.pips.forEach((p, i) => { p.visible = i < t.level - 1; });
  t.group.scale.setScalar(1 + (t.level - 1) * 0.05);
}

function placeTower(typeId, gx, gz) {
  const def = towerDef(typeId);
  if (!canBuild(gx, gz)) { Sound.play('error'); toast('Ô này không thể xây', 'bad'); return false; }
  if (S.gold < def.cost) { Sound.play('error'); toast(`Thiếu ${fmt(def.cost - S.gold)} vàng`, 'bad'); return false; }
  S.gold -= def.cost;
  const t = makeTower(typeId, gx, gz);
  S.built++;
  Sound.play('place');
  burst({ pos: _v1.set(t.pos.x, 0.4, t.pos.z), color: def.color, count: 12, speed: 6, size: 0.14, life: 0.45 });
  ringFx(t.pos, def.color, 2.6, 0.4, 0.12);
  S.selected = t;
  if (S.gold < def.cost) S.buildMode = null, makeGhost(null), indicator.grp.visible = false;
  toast(`${def.icon} ${def.name} đã triển khai`, 'good');
  updateHUD(); updateCards();
  return true;
}

function upgradeTower(t) {
  if (!t) return;
  if (t.level >= MAX_LEVEL) { Sound.play('error'); toast('Đã đạt cấp tối đa', 'bad'); return; }
  const cost = upgradeCost(t.type, t.level);
  if (S.gold < cost) { Sound.play('error'); toast(`Thiếu ${fmt(cost - S.gold)} vàng để nâng cấp`, 'bad'); return; }
  S.gold -= cost; t.invested += cost; t.level++;
  applyTowerLevel(t);
  Sound.play('upgrade');
  burst({ pos: _v1.set(t.pos.x, 0.6, t.pos.z), color: t.def.color, count: 16, speed: 5, size: 0.13, life: 0.5, shape: 'oct' });
  ringFx(t.pos, t.def.color, 3.2, 0.45, 0.14);
  spinFx(_v1.set(t.pos.x, 1.5, t.pos.z), t.def.color, 0.5, 0.4);
  toast(`⬆️ ${t.def.name} lên cấp ${t.level}`, 'good');
  updateHUD(); updateInspector();
}

function sellTower(t) {
  if (!t) return;
  const v = sellValue(t.invested);
  S.gold += v;
  towerAt.delete(key(t.gx, t.gz));
  world.remove(t.group);
  const i = S.towers.indexOf(t); if (i >= 0) S.towers.splice(i, 1);
  if (S.selected === t) S.selected = null;
  Sound.play('sell');
  burst({ pos: _v1.set(t.pos.x, 0.5, t.pos.z), color: 0xffd166, count: 12, speed: 5, size: 0.12, life: 0.4 });
  toast(`Bán tháp, thu về ${v} vàng`, '');
  updateHUD(); updateInspector(); updateCards();
}

/* ------------------------------ tấn công ------------------------------- */
function acquireTarget(t) {
  const st = t.stats;
  let best = null, bestD = -1;
  for (const e of S.enemies) {
    if (!e.alive) continue;
    if (e.air && st.air === false) continue;
    const d = dist2d(t.pos.x, t.pos.z, e.pos.x, e.pos.z);
    if (d > st.range) continue;
    // ưu tiên mục tiêu đi xa nhất (gần căn cứ nhất), ưu tiên nhẹ cho trùm
    const score = e.dist + (e.type === 'boss' ? 6 : 0);
    if (score > bestD) { bestD = score; best = e; }
  }
  return best;
}

function muzzleWorld(t) {
  t.muzzle.getWorldPosition(_v3);
  return _v3;
}

function fire(t, st) {
  const def = t.def;
  const e = t.target;
  if (!e) return;
  const from = muzzleWorld(t).clone();
  const aimY = e.pos.y + 0.45 * e.st.scale;
  const to = _v2.set(e.pos.x, aimY, e.pos.z);

  switch (t.type) {
    case 'gun': {
      spawnProjectile({ type: 'gun', from, target: e, damage: st.damage, speed: st.projectileSpeed || 42, color: 0x9ff0ff, size: 0.13, tower: t });
      break;
    }
    case 'cannon': {
      const d = Math.max(1, dist2d(from.x, from.z, to.x, to.z));
      spawnProjectile({
        type: 'cannon', from, target: e, damage: st.damage, speed: st.projectileSpeed || 24,
        color: 0xffc46b, size: 0.24, tower: t, ballistic: true,
        splash: st.splash, arcH: clamp(d * 0.16, 1.2, 5), aim: to.clone(),
      });
      CAM.shake = Math.max(CAM.shake, 0.12);
      break;
    }
    case 'frost': {
      spawnProjectile({ type: 'frost', from, target: e, damage: st.damage, speed: st.projectileSpeed || 30, color: 0xa8f2ff, size: 0.2, tower: t, splash: st.splash, slow: st.slow, slowTime: st.slowTime });
      break;
    }
    case 'tesla': {
      const pts = [from.clone()];
      let cur = e, hitList = [e];
      pts.push(_v1.set(e.pos.x, e.pos.y + 0.4, e.pos.z).clone());
      let chain = Math.round(st.chain);
      while (chain-- > 1) {
        let nxt = null, nd = 1e9;
        for (const o of S.enemies) {
          if (!o.alive || hitList.includes(o)) continue;
          const d = o.pos.distanceTo(cur.pos);
          if (d < nd && d <= (st.chainRange || 6)) { nd = d; nxt = o; }
        }
        if (!nxt) break;
        hitList.push(nxt);
        pts.push(_v1.set(nxt.pos.x, nxt.pos.y + 0.4, nxt.pos.z).clone());
        cur = nxt;
      }
      chainFx(pts, 0xd6b4ff, 0.16);
      for (const o of hitList) { const d = damageEnemy(o, st.damage, { source: t }); t.dmg += d; }
      t.glow.material.opacity = 0.9;
      break;
    }
    case 'sniper': {
      const dir = to.clone().sub(from).normalize();
      const hitList = [];
      for (const o of S.enemies) {
        if (!o.alive) continue;
        if (o.air && st.air === false) continue;
        const rel = _v1.copy(o.pos).sub(from);
        const along = rel.dot(dir);
        if (along < 0 || along > st.range * 1.15) continue;
        const perp = rel.clone().addScaledVector(dir, -along).length();
        if (perp > 0.85 * o.st.scale + 0.25) continue;
        hitList.push({ o, along });
      }
      hitList.sort((a, b) => a.along - b.along);
      const use = hitList.slice(0, Math.max(1, Math.round(st.pierce)));
      const end = use.length ? _v1.copy(use[use.length - 1].o.pos).setY(use[use.length - 1].o.pos.y + 0.4) : to.clone();
      beamFx(from, end.clone(), 0xd6ffb0, 0.16, 0.06);
      for (const h of use) { const d = damageEnemy(h.o, st.damage, { source: t, ignoreArmor: true }); t.dmg += d; }
      burst({ pos: from, color: 0xd6ffb0, count: 6, speed: 4, size: 0.08, life: 0.2 });
      break;
    }
  }
  if (t.type === 'tesla' || t.type === 'sniper') Sound.play(t.type);
  else Sound.play(t.type);
  if (t.glow) { t.glow.material.opacity = 0.95; }
  t.recoil = 1;
  t.cd = 1 / Math.max(0.05, st.rate);
}

function updateTowers(dt) {
  for (const t of S.towers) {
    const st = t.stats;
    if (t.extras && t.extras.spin) t.extras.spin.rotation.y += dt * 1.4;
    t.cd -= dt;
    if (t.type !== 'tesla') {
      if (!t.target || !t.target.alive || dist2d(t.pos.x, t.pos.z, t.target.pos.x, t.target.pos.z) > st.range * 1.02) t.target = acquireTarget(t);
      if (t.target) {
        const want = Math.atan2(t.target.pos.x - t.pos.x, t.target.pos.z - t.pos.z);
        let diff = want - t.turret.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        t.turret.rotation.y += diff * Math.min(1, dt * 11);
        t.aim = Math.abs(diff);
      }
    } else {
      t.target = acquireTarget(t);
    }
    if (t.recoil > 0) {
      t.recoil = Math.max(0, t.recoil - dt * 6);
      if (t.turret) t.turret.position.z = -0.07 * t.recoil;
    }
    if (t.glow && t.glow.material.opacity > 0.6) t.glow.material.opacity = Math.max(0.5, t.glow.material.opacity - dt * 1.2);
    if (t.target && t.cd <= 0 && (t.type === 'tesla' || t.aim < 0.5)) fire(t, st);
  }
}

/* -------------------------------- đạn ---------------------------------- */
function spawnProjectile(o) {
  const geo = o.type === 'cannon' ? GEO.sphLo : GEO.oct;
  const m = new THREE.Mesh(geo, glowMat(o.color, 0.95));
  m.name = 'projectile:' + o.type;
  m.scale.setScalar(o.size);
  m.position.copy(o.from);
  m.castShadow = false;
  world.add(m);
  const dir = new THREE.Vector3(0, 0, 1);
  if (o.target) dir.copy(_v1.set(o.target.pos.x, o.target.pos.y + 0.4, o.target.pos.z)).sub(o.from).normalize();
  const p = {
    type: o.type, g: m, target: o.target, damage: o.damage, speed: o.speed, color: o.color,
    size: o.size, pos: o.from.clone(), dir, life: 3.2, tower: o.tower || null,
    splash: o.splash || 0, slow: o.slow || 0, slowTime: o.slowTime || 0,
    ballistic: !!o.ballistic, arcH: o.arcH || 0, aim: o.aim || null, t: 0, spin: rnd(0, 6),
  };
  if (p.ballistic) {
    p.T = Math.max(0.18, dist2d(p.pos.x, p.pos.z, p.aim.x, p.aim.z) / p.speed);
  }
  S.projectiles.push(p);
}

function explode(pos, radius, damage, opt = {}) {
  ringFx(pos, opt.color || 0xffc46b, radius, 0.45, 0.14);
  burst({ pos, color: opt.color || 0xffc46b, count: 20, speed: 9, size: 0.2, life: 0.45, shape: 'sph', spread: 0.8 });
  CAM.shake = Math.max(CAM.shake, 0.22);
  Sound.play('cannon');
  for (const e of S.enemies.slice()) {
    if (!e.alive) continue;
    if (e.air && opt.air === false) continue;
    const d = dist2d(pos.x, pos.z, e.pos.x, e.pos.z);
    const eff = radius + enemyRadius(e);
    if (d > eff) continue;
    const falloff = lerp(1, 0.45, clamp(d / eff, 0, 1));
    const dm = damage * falloff;
    const dealt = damageEnemy(e, dm, { source: opt.source, ignoreArmor: !!opt.ignoreArmor });
    if (opt.source) opt.source.dmg += dealt;
    if (opt.slow && e.alive) { e.slowAmt = Math.max(e.slowAmt, opt.slow); e.slowUntil = S.sim + opt.slowTime; }
  }
}

function updateProjectiles(dt) {
  for (let i = S.projectiles.length - 1; i >= 0; i--) {
    const p = S.projectiles[i];
    let done = false;
    if (p.ballistic) {
      // nội suy từ điểm bắn tới điểm ngắm theo cung parabol
      if (!p.from0) { p.from0 = p.pos.clone(); p.from0y = p.pos.y; }
      p.t += dt;
      const k = clamp(p.t / p.T, 0, 1);
      const px = lerp(p.from0.x, p.aim.x, k), pz = lerp(p.from0.z, p.aim.z, k);
      const py = lerp(p.from0y, p.aim.y, k) + p.arcH * 4 * k * (1 - k);
      p.pos.set(px, py, pz);
      p.g.position.copy(p.pos);
      p.g.rotation.x += dt * 8; p.g.rotation.z += dt * 5;
      if (k >= 1) {
        explode(_v1.copy(p.pos).setY(Math.max(0.3, p.pos.y)), p.splash || 3.5, p.damage, { source: p.tower, color: p.color, air: true });
        done = true;
      }
    } else {
      // đạn bay có bám mục tiêu
      if (!p.target || !p.target.alive) {
        p.target = null;
        let best = null, bd = 9;
        for (const e of S.enemies) { if (!e.alive) continue; const d = e.pos.distanceTo(p.pos); if (d < bd) { bd = d; best = e; } }
        if (best) p.target = best;
        p.life -= dt;
        if (p.life <= 0) done = true;
      }
      if (!done) {
        if (p.target) {
          const tp = _v1.set(p.target.pos.x, p.target.pos.y + 0.42 * p.target.st.scale, p.target.pos.z);
          const want = _v2.copy(tp).sub(p.pos).normalize();
          p.dir.lerp(want, clamp(dt * 9, 0, 1)).normalize();
        }
        p.pos.addScaledVector(p.dir, p.speed * dt);
        p.g.position.copy(p.pos);
        if (p.type === 'gun') p.g.lookAt(_v2.copy(p.pos).add(p.dir));
        else { p.spin += dt * 12; p.g.rotation.set(p.spin, p.spin * 0.7, 0); }
        if (p.target) {
          const tp = _v1.set(p.target.pos.x, p.target.pos.y + 0.42 * p.target.st.scale, p.target.pos.z);
          const hitR = 0.55 * p.target.st.scale + p.size + 0.15;
          if (p.pos.distanceTo(tp) <= hitR) {
            if (p.splash > 0) {
              explode(p.pos, p.splash, p.damage, { source: p.tower, color: p.color, slow: p.slow, slowTime: p.slowTime, air: true });
            } else {
              const dealt = damageEnemy(p.target, p.damage, { source: p.tower });
              if (p.tower) p.tower.dmg += dealt;
              burst({ pos: tp, color: p.color, count: 5, speed: 4, size: 0.09, life: 0.25, shape: 'oct' });
            }
            done = true;
          }
        }
      }
    }
    if (done) { world.remove(p.g); p.g.material.dispose(); S.projectiles.splice(i, 1); }
  }
}

/* -------------------------------- sóng --------------------------------- */
function startWave(auto = false) {
  if (S.phase === 'over' || S.phase === 'victory' || S.phase === 'menu') return;
  if (S.waveActive) return;
  S.wave++;
  S.waveData = buildWave(S.wave, diffOf(S.diff));
  S.spawnIdx = 0; S.waveTimer = 0; S.waveActive = true; S.phase = 'wave';
  if (auto && S.buildTimer > 0) {
    const bonus = callBonus(S.buildTimer);
    S.gold += bonus;
    toast(`⚡ Gọi đợt sớm: +${bonus} vàng`, 'good');
  }
  S.buildTimer = 0;
  Sound.play('wave');
  toast(`🌊 Đợt ${S.wave}/${S.map.waves} bắt đầu!`, 'bad');
  updateHUD(); updateWavePanel(); updateCards();
}

function updateSpawner(dt) {
  if (!S.waveActive) return;
  S.waveTimer += dt;
  const sch = S.waveData.schedule;
  while (S.spawnIdx < sch.length && sch[S.spawnIdx].t <= S.waveTimer) {
    spawnEnemy(sch[S.spawnIdx].type, sch[S.spawnIdx].wave);
    S.spawnIdx++;
  }
  if (S.spawnIdx >= sch.length && S.enemies.length === 0) endWave();
}

function endWave() {
  S.waveActive = false;
  const bonus = waveBonus(S.wave);
  S.gold += bonus;
  S.score += 120 + S.wave * 18;
  Sound.play('clear');
  toast(`✅ Thủ thành công đợt ${S.wave}! +${bonus} vàng`, 'good');
  if (S.wave >= S.map.waves) { victory(); return; }
  S.phase = 'build';
  S.buildTimer = BUILD_TIME;
  updateHUD(); updateWavePanel(); updateCards(); updateInspector();
}

function updateWaveUi() {
  const pctTotal = clamp(S.wave / Math.max(1, S.map.waves), 0, 1) * 100;
  el.wavefill.style.width = pctTotal + '%';
}

/* =============================== GIAO DIỆN ============================== */
const hud = {};

/* ------------------- bộ icon SVG tự vẽ (offline, không CDN) --------------
 * Mỗi icon là một chuỗi <path> trong khung 24x24, dùng màu `currentColor`.
 * Muốn thay bằng icon Flaticon: tải .svg về `game/icons/<key>.svg` rồi dán
 * nội dung vào bảng ICONS bên dưới (hướng dẫn ở game/README.md).
 * ----------------------------------------------------------------------- */
const ICONS = {
  logo: `<path d="M12 2.4l7.6 4.4v8.8L12 20l-7.6-4.4V6.8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 7.4l3.8 2.2v4.4L12 16.2l-3.8-2.2v-4.4z" fill="currentColor"/>`,
  gun: `<path d="M2.6 8.6h9.2l7.6 1.9v3.1h-2.6l-.9 2.9h-2l-.7-2.9h-1.5v3.2H8.9v-3.2H2.6z" fill="currentColor" opacity=".92"/><rect x="10.4" y="13" width="3.1" height="6.6" rx="1.1" fill="currentColor" opacity=".5"/><circle cx="15.8" cy="13.2" r="1.2" fill="#0b1020"/><path d="M19.6 12.6h2.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`,
  cannon: `<path d="M12.4 2.6l1.7 3.7 3.9-1-1.2 3.8 3.9.8-3.1 2.5 2.4 3.3-4-.3-.6 4-3-2.7-2.9 2.7-.6-4-4 .3 2.4-3.3-3.1-2.5 3.9-.8-1.2-3.8 3.9 1z" fill="currentColor"/><circle cx="12.4" cy="12" r="2.2" fill="#0b1020"/>`,
  frost: `<g stroke="currentColor" stroke-width="1.7" stroke-linecap="round" fill="none"><path d="M12 2.6v18.8M4.1 7.2l15.8 9.2M4.1 16.4l15.8-9.2"/><path d="M12 2.6 10 4.8M12 2.6l2 2.2M12 21.4l-2-2.2M12 21.4l2-2.2M4.1 7.2l2.7.5M4.1 7.2l1.1-2.6M19.9 16.8l-2.7-.5M19.9 16.8l-1.1 2.6M4.1 16.4l2.7-.5M4.1 16.4l1.1 2.6M19.9 7.2l-2.7.5M19.9 7.2l-1.1-2.6"/></g>`,
  tesla: `<circle cx="12" cy="12" r="9.4" fill="none" stroke="currentColor" stroke-width="1.3" opacity=".45"/><path d="M13.9 2.4 5.4 13.2h4.9L9.1 21.6l8.7-11h-5z" fill="currentColor"/>`,
  sniper: `<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="7.2"/><circle cx="12" cy="12" r="2.7"/><path d="M12 1.8v4M12 18.2v4M1.8 12h4M18.2 12h4"/></g><circle cx="12" cy="12" r="1.1" fill="currentColor"/>`,
  alien: `<path d="M12 3.4c4.9 0 8.4 3.5 8.4 7.7 0 5-4.4 9.5-8.4 9.5s-8.4-4.5-8.4-9.5c0-4.2 3.5-7.7 8.4-7.7z" fill="currentColor" opacity=".92"/><ellipse cx="8.7" cy="11.7" rx="2.6" ry="1.7" transform="rotate(-22 8.7 11.7)" fill="#0b1020"/><ellipse cx="15.3" cy="11.7" rx="2.6" ry="1.7" transform="rotate(22 15.3 11.7)" fill="#0b1020"/><path d="M9.2 3l-.8-2.4M14.8 3l.8-2.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`,
  monster: `<path d="M4.6 20.6c-1.5-3.5-.5-6.7 1.4-8.9C4.2 8.6 5.4 4.4 8.7 3.3c1.7-.6 3.3-.1 4.7.9 1.2-.7 3.1-.7 4.6.2 3.1 1.9 3.7 6.2 1.9 9.1 1.6 2.2 2 5.1.7 7.1z" fill="currentColor" opacity=".9"/><path d="M6.5 6.3 4.3 2.6l3.8 1.5zM17.5 6.3l2.2-3.7-3.8 1.5z" fill="currentColor"/><circle cx="9.5" cy="12.2" r="1.6" fill="#0b1020"/><circle cx="14.5" cy="12.2" r="1.6" fill="#0b1020"/><path d="M9.4 16.6c1.7 1.4 3.5 1.4 5.2 0" stroke="#0b1020" stroke-width="1.2" fill="none" stroke-linecap="round"/>`,
  spawn: `<path d="M3.6 17.4c0-5.3 3.8-9.4 8.9-9.4 3.6 0 7 2.1 7 5.5 0 3.6-3.2 6.1-7.9 6.1H3.6z" fill="currentColor" opacity=".9"/><g fill="#0b1020" opacity=".5"><circle cx="8.2" cy="13.6" r="1.6"/><circle cx="12" cy="12.6" r="1.7"/><circle cx="15.6" cy="13.2" r="1.5"/></g><circle cx="6.4" cy="10.4" r="1.2" fill="#0b1020"/><path d="M6.6 9.6 5.4 6.8M10.6 8.6l.5-2.9" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>`,
  grunt: `<rect x="4.6" y="5.2" width="14.8" height="12.4" rx="3.2" fill="currentColor" opacity=".9"/><rect x="8.4" y="8.6" width="2.8" height="2.8" rx=".9" fill="#0b1020"/><rect x="12.8" y="8.6" width="2.8" height="2.8" rx=".9" fill="#0b1020"/><rect x="9" y="17.6" width="6" height="2.8" rx="1.1" fill="currentColor" opacity=".55"/><path d="M12 5.2V2.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="12" cy="2.2" r="1" fill="currentColor"/>`,
  runner: `<path d="M13.8 2.4 6.2 12.6h4.5L9.4 21.6l7.8-10.2h-4.6z" fill="currentColor"/><path d="M1.6 9h3.1M1.6 13.4h3.1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity=".6"/>`,
  tank: `<path d="M12 2.6l7.4 2.8v6.4c0 4.4-3.1 7.7-7.4 9.6-4.3-1.9-7.4-5.2-7.4-9.6V5.4z" fill="currentColor" opacity=".92"/><path d="M12 8.2l1.2 2.4 2.6.3-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.3z" fill="#0b1020"/><path d="M4.6 18.8h14.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>`,
  flyer: `<ellipse cx="12" cy="14" rx="9.2" ry="3.4" fill="currentColor" opacity=".9"/><path d="M8.2 12.8c1-3.6 2.5-5.3 3.8-5.3s2.8 1.7 3.8 5.3z" fill="currentColor" opacity=".6"/><circle cx="6.6" cy="14.2" r="1" fill="#0b1020"/><circle cx="12" cy="15" r="1.2" fill="#0b1020"/><circle cx="17.4" cy="14.2" r="1" fill="#0b1020"/><path d="M6.8 18.6 5.4 21M17.2 18.6 18.6 21" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity=".55"/>`,
  boss: `<path d="M6.2 4.4 3.1 1.5l.4 4.8zM17.8 4.4l3.1-3.1-.4 4.8z" fill="currentColor"/><path d="M12 4.8c4.6 0 7.8 3.2 7.8 7.4 0 3.1-1.5 4.9-2.6 6-.6.6-.9 1.3-.9 2.1v1.9c0 .9-.8 1.7-1.7 1.7H9.4c-.9 0-1.7-.8-1.7-1.7v-1.9c0-.8-.3-1.5-.9-2.1-1.1-1.1-2.6-2.9-2.6-6C4.2 8 7.4 4.8 12 4.8z" fill="currentColor" opacity=".92"/><path d="M8.3 11.6c0-1.1.9-1.9 1.9-1.9s1.9.8 1.9 1.9c0 1.5-1.3 2.7-1.9 2.7s-1.9-1.2-1.9-2.7zM13.8 11.6c0-1.1.9-1.9 1.9-1.9s1.9.8 1.9 1.9c0 1.5-1.3 2.7-1.9 2.7s-1.9-1.2-1.9-2.7z" fill="#0b1020"/>`,
  'map-plains': `<path d="M1.6 18.4h20.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M4 18.2c1.8-4.6 4.3-6.9 7.5-6.9 3.3 0 5.7 2.3 7.5 6.9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="17.6" cy="5.6" r="2.6" fill="currentColor" opacity=".55"/><path d="M2.4 9.4c1.4-2.4 3-3.6 4.8-3.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".5"/>`,
  'map-corridor': `<path d="M2 6.6h9.2v5.4H6.4v5.4h11.2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M17.6 6.6h4.4v10.8h-4.2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/><circle cx="2" cy="6.6" r="1.8" fill="currentColor"/><path d="M19.4 17.4h3.2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M9.6 9.2h1.6M9.6 12h3.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity=".5"/>`,
  'map-frost': `<path d="M12 2.6v18.8M4.1 7.2l15.8 9.2M4.1 16.4l15.8-9.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/><path d="M12 2.6 10.1 4.9M12 2.6l1.9 2.3M12 21.4l-1.9-2.3M12 21.4l1.9-2.3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity=".75"/><path d="M2.6 17.4 8 10.8l3.4 4.6 2.6-3.2 5.4 5.2z" fill="currentColor" opacity=".35"/>`,
  'map-desert': `<circle cx="18.2" cy="6.2" r="3" fill="currentColor" opacity=".6"/><path d="M1.6 17.6h20.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M3.4 17.4c2.6-5.6 5-5.6 7.6 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M11.6 17.4c2.8-4.6 5.2-4.6 8 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" opacity=".7"/><path d="M15.6 10.2c1.2-1.4 2.4-1.4 3.6 0" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity=".5"/>`,
  'map-orbit': `<circle cx="12" cy="12" r="5.6" fill="currentColor" opacity=".85"/><ellipse cx="12" cy="12" rx="10.4" ry="4" fill="none" stroke="currentColor" stroke-width="1.5" transform="rotate(-22 12 12)"/><circle cx="20.4" cy="7.6" r="1.5" fill="currentColor"/><circle cx="9.6" cy="10.2" r="1.2" fill="#0b1020" opacity=".5"/><circle cx="14.2" cy="13.6" r="1.8" fill="#0b1020" opacity=".4"/>`,
  'map-core': `<path d="M12 2.4 20 6.8v9.4L12 20.6 4 16.2V6.8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 7 16 9.4v4.6L12 16.4 8 14V9.4z" fill="currentColor" opacity=".9"/><path d="M12 16.4v5.4M12 2.4v4.6" stroke="currentColor" stroke-width="1.3" stroke-opacity=".5"/><circle cx="12" cy="12" r="1.5" fill="#0b1020"/>`,
  'map': `<path d="M3 6.4l6-2.4 6 2.4 6-2.4v13.6l-6 2.4-6-2.4-6 2.4z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9 4v13.6M15 6.4V20" stroke="currentColor" stroke-width="1.5" stroke-opacity=".65"/><circle cx="12" cy="11.6" r="1.7" fill="currentColor"/>`,
};
// Cho phép thay icon bằng file ngoài: đặt ảnh vào game/icons/<key>.svg rồi chạy npm run game:build
if (window.__NEON_ICON_OVERRIDES__) {
  for (const k in window.__NEON_ICON_OVERRIDES__) ICONS[k] = window.__NEON_ICON_OVERRIDES__[k];
}
const iconWarned = new Set();
/** Trả về chuỗi <svg> cho một icon; tự vẽ icon dự phòng nếu thiếu để UI không bao giờ vỡ. */
function svgIcon(name, color) {
  const body = ICONS[name];
  if (!body) {
    if (!iconWarned.has(name)) { iconWarned.add(name); console.warn('[NeonDefense] thiếu icon:', name); }
    return '<svg viewBox="0 0 24 24" width="100%" height="100%"><circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="3 3"/></svg>';
  }
  return '<svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true"' + (color ? ' style="color:' + color + '"' : '') + '>' + body + '</svg>';
}
/** Vẽ mọi phần tử có [data-ic] bên trong `root`. */
function renderIcons(root) {
  if (!root) return;
  root.querySelectorAll('[data-ic]').forEach((node) => {
    node.innerHTML = svgIcon(node.dataset.ic, node.dataset.icColor || '');
    node.classList.add('has-ic');
  });
}
let overlayAction = null, overlayShown = false, overlayPrimary = null, overlaySecondary = null;

function hex(c) { return '#' + c.toString(16).padStart(6, '0'); }

function toast(msg, kind = '') {
  const d = document.createElement('div');
  d.className = 'toast ' + kind;
  d.textContent = msg;
  el.toasts.appendChild(d);
  while (el.toasts.children.length > 4) el.toasts.removeChild(el.toasts.firstChild);
  setTimeout(() => {
    d.style.transition = 'opacity .3s ease, transform .3s ease';
    d.style.opacity = '0'; d.style.transform = 'translateY(-6px)';
    setTimeout(() => d.remove(), 340);
  }, 1900);
}

function buildHud() {
  el.stats.innerHTML = [
    '<div class="chip map" id="hMap" title="Bản đồ đang chơi"><span class="eic" id="vMapIcon"></span><span id="vMap">—</span></div>',
    '<div class="chip lives" id="hLives"><i>❤️</i><span id="vLives">0</span></div>',
    '<div class="chip gold" id="hGold"><i>🪙</i><span id="vGold">0</span></div>',
    '<div class="chip wave" id="hWave"><i>🌊</i><span id="vWave">0</span></div>',
    '<div class="chip score" id="hScore"><i>⭐</i><span id="vScore">0</span></div>',
    '<div class="chip" id="hKills"><i>☠️</i><span id="vKills">0</span></div>',
    '<div class="chip" id="hTowers"><i>🏗️</i><span id="vTowers">0</span></div>',
    '<div class="chip" id="hTimer"><i>⏱️</i><span id="vTimer">--</span></div>',
  ].join('');
  hud.Map = $('hMap'); hud.vMap = $('vMap'); hud.vMapIcon = $('vMapIcon');
  for (const k of ['Lives', 'Gold', 'Wave', 'Score', 'Kills', 'Towers', 'Timer']) {
    hud[k] = $('h' + k); hud['v' + k] = $('v' + k);
  }
  el.hint.innerHTML = '<b>Chạm/kéo</b> để xoay · <b>cuộn</b> để thu phóng · <b>chọn tháp</b> dưới thanh dưới → bấm vào ô đất để xây · <b>Space</b> gọi đợt · <b>T</b> tăng tốc';
}

function pulse(node) {
  if (!node) return;
  node.classList.remove('pulse');
  void node.offsetWidth;
  node.classList.add('pulse');
}
let _lastHud = {};
function updateHUD(force) {
  const vals = {
    Lives: S.lives, Gold: Math.floor(S.gold), Wave: `${S.wave}/${S.map.waves}`, Score: S.score,
    Kills: S.kills, Towers: S.towers.length,
    Timer: S.waveActive ? `${S.spawnIdx}/${S.waveData ? S.waveData.totalCount : 0}` : (S.phase === 'build' ? fmtTime(S.buildTimer) : '--'),
  };
  for (const k in vals) {
    if (!hud['v' + k]) continue;
    if (_lastHud[k] === vals[k] && !force) continue;
    hud['v' + k].textContent = typeof vals[k] === 'string' ? vals[k] : fmt(vals[k]);
    if (k === 'Lives' || k === 'Gold') pulse(hud['h' + k]);
    _lastHud[k] = vals[k];
  }
  if (hud.vMap && (_lastHud.Map !== S.map.id || force)) {
    _lastHud.Map = S.map.id;
    hud.vMap.textContent = `${S.map.name}`;
    if (hud.vMapIcon) { hud.vMapIcon.innerHTML = svgIcon(S.map.icon); hud.vMapIcon.classList.add('has-ic'); }
    if (hud.Map) hud.Map.title = `Bản đồ: ${S.map.name} · ${S.map.waves} đợt · kích thước ${S.map.cols}×${S.map.rows}`;
  }
  if (hud.Lives) hud.Lives.classList.toggle('low', S.lives <= 5);
  updateWaveUi();
}

function updateCards() {
  const sig = S.buildMode + '|' + TOWERS.map((t) => (S.gold >= t.cost ? 1 : 0)).join('') + '|' + S.towers.length;
  if (sig === updateCards._sig) return;
  updateCards._sig = sig;
  el.cards.innerHTML = TOWERS.map((t) => {
    const afford = S.gold >= t.cost;
    return `<div class="card ${S.buildMode === t.id ? 'sel' : ''} ${afford ? '' : 'poor'}" data-tower="${t.id}" title="${t.desc}">
      <span class="hk"><kbd>${t.hotkey}</kbd></span>
      <div class="ic" style="color:${hex(t.color)}" data-ic="${t.id}">${t.icon}</div>
      <div class="nm">${t.short}</div>
      <div class="cost">🪙 ${t.cost}</div>
    </div>`;
  }).join('');
  renderIcons(el.cards);
}

function statBox(v, label) { return `<div class="stat"><b>${v}</b><small>${label}</small></div>`; }

function updateInspector(force) {
  const t = S.selected || S.hoverTower || null;
  const sig = [t ? t.id + ':' + t.level : 'none', S.buildMode, S.hoverTower ? 'h' : '', S.towers.length, S.phase].join('|');
  if (!force && sig === updateInspector._sig && performance.now() - (updateInspector._t || 0) < 480) return;
  updateInspector._sig = sig; updateInspector._t = performance.now();

  if (t) {
    const st = t.stats, def = t.def;
    const upCost = t.level < MAX_LEVEL ? upgradeCost(t.type, t.level) : 0;
    const extra = [];
    if (st.splash) extra.push(`<div class="row"><span>Bán kính nổ</span><span>${st.splash.toFixed(1)}</span></div>`);
    if (st.slow) extra.push(`<div class="row"><span>Làm chậm</span><span>-${Math.round(st.slow * 100)}% / ${st.slowTime.toFixed(1)}s</span></div>`);
    if (st.chain) extra.push(`<div class="row"><span>Lan sét</span><span>${st.chain} mục tiêu</span></div>`);
    if (st.pierce) extra.push(`<div class="row"><span>Xuyên</span><span>${st.pierce} mục tiêu</span></div>`);
    if (st.ignoreArmor) extra.push(`<div class="row"><span>Xuyên giáp</span><span>Có</span></div>`);
    if (st.splash && !st.slow) extra.push(`<div class="row"><span>Kiểu đạn</span><span>Nổ diện rộng</span></div>`);
    if (!st.air) extra.push(`<div class="row"><span>Mục tiêu bay</span><span style="color:var(--red)">Không bắn được</span></div>`);
    el.inspector.innerHTML = `
      <h3>${def.icon} ${def.name} <span class="badge">CẤP ${t.level}/${MAX_LEVEL}</span></h3>
      <div class="grid2">
        ${statBox(fmt(st.dps), 'DPS')}
        ${statBox(fmt(st.damage), 'SÁT THƯƠNG')}
        ${statBox(st.range.toFixed(1), 'TẦM BẮN')}
        ${statBox(st.rate.toFixed(2) + '/s', 'NHỊP BẮN')}
      </div>
      ${extra.join('')}
      <div class="row"><span>Đã hạ</span><span>${t.kills} mục tiêu</span></div>
      <div class="row"><span>Tổng sát thương</span><span>${fmt(t.dmg)}</span></div>
      <div class="row"><span>Tổng đầu tư</span><span>🪙 ${t.invested}</span></div>
      ${t.level < MAX_LEVEL
        ? `<button class="btn gold" id="btnUp">⬆️ Nâng cấp · 🪙 ${upCost}</button>`
        : `<button class="btn ghost" disabled>⭐ Đã tối đa cấp ${MAX_LEVEL}</button>`}
      <button class="btn danger" id="btnSell">💰 Bán tháp · +🪙 ${sellValue(t.invested)}</button>`;
    renderIcons(el.inspector);
    const bu = $('btnUp'); if (bu) bu.onclick = () => upgradeTower(t);
    $('btnSell').onclick = () => sellTower(t);
  } else if (S.buildMode) {
    const def = towerDef(S.buildMode), st = towerStats(S.buildMode, 1);
    el.inspector.innerHTML = `
      <h3>${def.icon} ${def.name} <span class="badge">ĐANG XÂY</span></h3>
      <div class="grid2">
        ${statBox(fmt(st.dps), 'DPS')}
        ${statBox(fmt(st.damage), 'SÁT THƯƠNG')}
        ${statBox(st.range.toFixed(1), 'TẦM BẮN')}
        ${statBox(st.rate.toFixed(2) + '/s', 'NHỊP BẮN')}
      </div>
      <div class="row"><span>Giá xây</span><span>🪙 ${def.cost}</span></div>
      <button class="btn ghost" id="btnCancel">✖️ Huỷ chọn tháp (Esc)</button>`;
    $('btnCancel').onclick = () => cancelBuild();
  } else {
    el.inspector.innerHTML = `
      <h3>🛠️ Bảng điều khiển</h3>
      <div class="row"><span>Bản đồ</span><span>${S.map.badge} ${S.map.name} (${S.map.waves} đợt)</span></div>
      <div class="row"><span>Đợt</span><span>${S.wave}/${S.map.waves}</span></div>
      <div class="row"><span>Tháp đang có</span><span>${S.towers.length}</span></div>
      <div class="row"><span>Địch đã hạ</span><span>${S.kills}</span></div>
      <div class="row"><span>Địch lọt lưới</span><span>${S.leaks}</span></div>
      <div class="help" style="margin-top:8px">
        Chọn một loại tháp ở thanh dưới, sau đó bấm vào <b style="display:inline">ô đất trống</b> để xây.
        Bấm vào tháp đã xây để nâng cấp hoặc bán.
      </div>`;
  }
}

function waveSummaryHtml(w, active) {
  return w.summary.map((g) => {
    const tags = [];
    if (g.air) tags.push('✈ bay');
    if (g.blink) tags.push('⚡ dịch chuyển');
    if (g.split) tags.push('🐛 tách đàn');
    const noteLine = (tags.length || g.note)
      ? `<div class="note">${tags.join(' · ')}${g.note ? (tags.length ? ' — ' : '') + g.note : ''}</div>` : '';
    return `<div class="enemy ${g.air ? 'air' : ''}">
      <span class="eic" data-ic="${g.type}" data-ic-color="${g.color}"></span>
      <span class="c">${g.count}×</span>
      <span class="n">${g.name}</span>
      <span class="tag">${fmt(g.hpEach)} HP</span>
    </div>${noteLine}`;
  }).join('');
}

function updateWavePanel() {
  const diff = diffOf(S.diff);
  let html = '';
  if (S.phase === 'menu') {
    el.wavepanel.innerHTML = '<h3>🌊 Thông tin đợt</h3><div class="help">Bấm <b style="display:inline">Bắt đầu</b> để chọn độ khó và vào trận.</div>';
    return;
  }
  if (S.waveActive && S.waveData) {
    const w = S.waveData;
    html += `<h3>🌊 Đợt ${S.wave}/${S.map.waves} · <span class="stars">${stars(waveThreat(S.wave, diff, S.map))}</span></h3>`;
    html += `<div class="row"><span>Đã vào trận</span><span id="wSpawn">${S.spawnIdx}/${w.totalCount}</span></div>`;
    html += `<div class="row"><span>Còn sống</span><span id="wAlive">${S.enemies.length}</span></div>`;
    html += `<div class="row"><span>Sát thương cần</span><span>${fmt(w.totalHp)} HP</span></div>`;
    html += '<div class="enemylist" style="margin-top:8px">' + waveSummaryHtml(w, true) + '</div>';
    html += `<button class="btn ghost" id="btnSpeed">${S.speed}× tốc độ (T)</button>`;
  } else {
    const n = Math.min(S.map.waves, S.wave + 1);
    const w = buildWave(n, diff, S.map);
    html += `<h3>🔮 Đợt kế tiếp · ${n}/${S.map.waves} · <span class="stars">${stars(waveThreat(n, diff, S.map))}</span></h3>`;
    html += `<div class="row"><span>Tổng quân</span><span>${w.totalCount}</span></div>`;
    html += '<div class="enemylist">' + waveSummaryHtml(w, false) + '</div>';
    html += `<div class="row"><span>Tự động mở đợt</span><span id="wTime">${Math.ceil(S.buildTimer)}s</span></div>`;
    html += `<button class="btn green" id="btnCall">⚡ Gọi đợt ngay · +🪙 <span id="wBonus">${callBonus(S.buildTimer)}</span></button>`;
    html += `<button class="btn ghost" id="btnAuto">${S.autoStart ? '🔁 Tự động mở: BẬT' : '⏸️ Tự động mở: TẮT'}</button>`;
  }
  el.wavepanel.innerHTML = html;
  renderIcons(el.wavepanel);
  const bc = $('btnCall'); if (bc) bc.onclick = () => startWave();
  const bs = $('btnSpeed'); if (bs) bs.onclick = () => cycleSpeed();
  const ba = $('btnAuto');
  if (ba) ba.onclick = () => {
    S.autoStart = !S.autoStart;
    toast(S.autoStart ? 'Bật tự động mở đợt' : 'Tắt tự động mở đợt — bạn tự bấm gọi đợt', '');
    updateWavePanel();
  };
}

/** Cập nhật nhanh phần số của panel đợt (không dựng lại DOM). */
let _wpT = 0;
function tickWavePanel(dt) {
  _wpT += dt;
  if (_wpT < 0.15) return;
  _wpT = 0;
  const s = $('wSpawn'); if (s && S.waveData) s.textContent = `${S.spawnIdx}/${S.waveData.totalCount}`;
  const a = $('wAlive'); if (a) a.textContent = String(S.enemies.length);
  const t = $('wTime');
  if (t) { t.textContent = Math.ceil(S.buildTimer) + 's'; const b = $('wBonus'); if (b) b.textContent = String(callBonus(S.buildTimer)); }
}

function updateControls() {
  const sp = $('cSpeed'); if (sp) sp.textContent = S.speed + '×';
  const pw = $('cPause'); if (pw) pw.textContent = S.paused ? '▶' : '⏸';
}

function buildControls() {
  el.ctrls.innerHTML = [
    '<button class="ctrl wide" id="cSpeed" title="Tốc độ bay của thời gian (T)">1×</button>',
    '<button class="ctrl" id="cPause" title="Tạm dừng / tiếp tục (P)">⏸</button>',
    '<button class="ctrl on" id="cSound" title="Bật / tắt âm thanh (M)">🔊</button>',
    '<button class="ctrl" id="cSide" title="Ẩn / hiện bảng bên (Tab)">📊</button>',
    '<button class="ctrl" id="cMenu" title="Hướng dẫn &amp; menu (H)">❓</button>',
  ].join('');
  $('cSpeed').onclick = () => cycleSpeed();
  $('cPause').onclick = () => togglePause();
  $('cSound').onclick = (e) => {
    Sound.on = !Sound.on;
    e.currentTarget.classList.toggle('on', Sound.on);
    e.currentTarget.textContent = Sound.on ? '🔊' : '🔇';
    if (Sound.on) { Sound.init(); Sound.resume(); }
  };
  $('cSide').onclick = (e) => {
    el.side.classList.toggle('open');
    e.currentTarget.classList.toggle('on', el.side.classList.contains('open'));
  };
  $('cMenu').onclick = () => showHelp();
}

/* ------------------------------ overlay -------------------------------- */
/**
 * Hiện một màn hình overlay.
 * @param html  nội dung
 * @param opts  { action, primary, secondary, onRender } — primary: hành động khi
 *              nhấn Space/Enter, secondary: khi nhấn Escape.
 */
function showOverlay(html, opts = {}) {
  el.overlay.innerHTML = html;
  el.overlay.classList.add('show');
  overlayShown = true;
  overlayAction = opts.action || null;
  overlayPrimary = typeof opts.primary === 'function' ? opts.primary : null;
  overlaySecondary = typeof opts.secondary === 'function' ? opts.secondary : null;
  renderIcons(el.overlay);
  if (typeof opts.onRender === 'function') opts.onRender(el.overlay);
}
function hideOverlay() {
  el.overlay.classList.remove('show');
  el.overlay.innerHTML = '';
  overlayShown = false;
  overlayAction = null; overlayPrimary = null; overlaySecondary = null;
}
/** Chọn nhanh một phần tử trong overlay hiện hành. */
const ovq = (sel) => el.overlay.querySelector(sel);
const ovqa = (sel) => [...el.overlay.querySelectorAll(sel)];

function diffChipsHtml(activeId) {
  return Object.values(DIFFICULTIES).map((d) => `
    <button class="dchip ${d.id === activeId ? 'sel' : ''}" data-diff="${d.id}" title="${d.desc}">
      <b>${d.icon} ${d.name}</b><small>Mạng ×${(d.lives / DIFFICULTIES.normal.lives).toFixed(2)} · Vàng ×${(d.gold / DIFFICULTIES.normal.gold).toFixed(2)}</small>
    </button>`).join('');
}

function levelCardHtml(l, i) {
  const unlocked = isUnlocked(l.id);
  const best = bestOf(l.id);
  const board = boardOf(l.id);
  const st = startState(l, diffOf(S.diff));
  return `<article class="lvl ${unlocked ? '' : 'locked'} ${l.id === S.level ? 'sel' : ''}" data-level="${l.id}" title="${escapeHtml(l.desc)}">
    <div class="lvl-top">
      <span class="lvl-icon" data-ic="${l.icon}"></span>
      <div class="lvl-name">
        <b>${l.name}</b>
        <small>${l.badge} ${l.tier} · ${l.cols}×${l.rows} ô</small>
      </div>
      ${unlocked ? '' : '<span class="lvl-lock">🔒</span>'}
    </div>
    <p class="lvl-desc">${escapeHtml(l.desc)}</p>
    <div class="lvl-pills">
      <span class="pill">🌊 ${l.waves} đợt</span>
      <span class="pill">❤️ ${st.lives}</span>
      <span class="pill">🪙 ${st.gold}</span>
      <span class="pill" title="Độ nguy hiểm của bản đồ">${stars(mapThreat(l, diffOf(S.diff)))}</span>
    </div>
    <div class="lvl-best">${best
      ? `🏅 Kỷ lục: <b>${fmt(best.score)}</b> · đợt ${best.wave}/${l.waves} · ${diffOf(best.difficulty).name}`
      : '<span class="dim">Chưa có điểm — hãy là người đầu tiên</span>'}
      ${board[0] ? `<span class="dim"> · 🥇 ${escapeHtml(board[0].name)}</span>` : ''}
    </div>
    ${unlocked ? '' : `<div class="lvl-foot">🔒 Hạ <b>${LEVELS[i - 1].name}</b> để mở khoá</div>`}
  </article>`;
}

function showMenu() {
  const totalWavesAll = LEVELS.reduce((a, l) => a + l.waves, 0);
  showOverlay(`
    <div class="modal">
      <span class="badge">THREE.JS · WEBGL · 1 FILE HTML</span>
      <h1>NEON DEFENSE 3D</h1>
      <p class="sub">Chiến dịch gồm <b>${LEVELS.length} bản đồ</b> với bố cục đường đi, số đợt và độ khó riêng
        (${LEVELS.map((l) => l.waves).join(' · ')} đợt). Xây tháp, nâng cấp, giữ căn cứ — rồi leo bảng xếp hạng.</p>
      <div class="summary">
        <div class="sumbox"><b>${clearedCount()}/${LEVELS.length}</b><small>BẢN ĐỒ ĐÃ HẠ</small></div>
        <div class="sumbox"><b>${totalWavesAll}</b><small>TỔNG SỐ ĐỢT</small></div>
        <div class="sumbox"><b>${fmt(topScoreAll())}</b><small>KỶ LỤC CAO NHẤT</small></div>
        <div class="sumbox"><b>${boardCount()}</b><small>ĐIỂM ĐÃ GHI</small></div>
      </div>
      <div class="nameRow">
        <label for="nameInput">Tên của bạn trên bảng xếp hạng</label>
        <input id="nameInput" maxlength="14" placeholder="Người chơi" value="${escapeHtml(PROG.name)}" />
      </div>
      <div class="helpgrid">
        <div class="help"><b>🗺️ Nhiều bản đồ</b>Mỗi bản đồ có đường đi, kích thước lưới và số đợt khác nhau — hạ màn này để mở khoá màn kế tiếp.</div>
        <div class="help"><b>🏆 Bảng xếp hạng</b>Mỗi bản đồ có top 10 riêng. Thắng càng nhiều mạng, điểm cuối càng cao; hạ địch và sống sót đều được tính.</div>
        <div class="help"><b>🎯 Mục tiêu</b>Địch đi từ <span class="k">cổng tím</span> tới <span class="k">căn cứ</span>. Mỗi con lọt lưới trừ mạng theo độ nguy hiểm của nó.</div>
        <div class="help"><b>🏗️ Xây dựng</b>Chọn tháp ở thanh dưới (<span class="k">1–5</span>) rồi bấm vào ô đất trống; bấm vào tháp để nâng cấp (tối đa cấp 5) hoặc bán.</div>
        <div class="help"><b>👽 Quái vật &amp; dị dạng</b>Sinh vật ngoài hành tinh <span class="k">dịch chuyển tức thời</span>, quái vật đột biến <span class="k">tách thành 2 ấu trùng</span>, drone bay đi <span class="k">đường trên không</span>.</div>
        <div class="help"><b>🎮 Điều khiển</b>Kéo để xoay, cuộn để zoom, <span class="k">Space</span> gọi đợt, <span class="k">T</span> tốc độ, <span class="k">P</span> tạm dừng, <span class="k">M</span> âm thanh.</div>
      </div>
      <div class="actions">
        <button class="btn" id="btnPlay">🎮 Chơi — chọn bản đồ</button>
        <button class="btn ghost" id="btnBoard">🏆 Bảng xếp hạng</button>
        <button class="btn ghost" id="btnHelp">📖 Hướng dẫn</button>
      </div>
      <div class="foot">Bản dựng: <b>${window.__NEON_BUILD__ || 'dev'}</b> · Nhấn <b>Space</b> để vào màn chọn bản đồ</div>
    </div>`, {
    action: 'menu',
    primary: showLevelSelect,
    onRender() {
      $('btnPlay').onclick = () => showLevelSelect();
      $('btnBoard').onclick = () => showLeaderboard(S.level, showMenu);
      $('btnHelp').onclick = () => showHelp();
      const inp = $('nameInput');
      inp.oninput = () => setPlayerName(inp.value);
      inp.onchange = () => { setPlayerName(inp.value); inp.value = PROG.name; toast('Đã lưu tên: ' + playerName(), ''); };
    },
  });
}

function showLevelSelect() {
  if (!isUnlocked(S.level)) { S.level = LEVELS[0].id; S.map = LEVELS[0]; }
  showOverlay(`
    <div class="modal wide">
      <span class="badge">CHỌN BẢN ĐỒ &amp; ĐỘ KHÓ</span>
      <h1>Chiến dịch</h1>
      <p class="sub">Mỗi bản đồ có bố cục đường đi và số đợt riêng. Hạ một bản đồ (thắng ở bất kỳ độ khó nào) để mở khoá bản đồ kế tiếp.</p>
      <div class="diffrow" id="diffs">${diffChipsHtml(S.diff)}</div>
      <div class="nameRow">
        <label for="nameInput">Tên của bạn trên bảng xếp hạng</label>
        <input id="nameInput" maxlength="14" placeholder="Người chơi" value="${escapeHtml(PROG.name)}" />
        <small>Mỗi bản đồ có top 10 riêng — thắng càng nhiều mạng, điểm càng cao.</small>
      </div>
      <div class="levels" id="levels">${LEVELS.map(levelCardHtml).join('')}</div>
      <div class="row" style="margin:0 0 12px"><span>Tiến độ</span><span>${clearedCount()}/${LEVELS.length} bản đồ đã hạ · 🏆 ${boardCount()} điểm đã ghi · Kỷ lục ${fmt(topScoreAll())}</span></div>
      <div class="actions">
        <button class="btn" id="btnStart">▶️ Bắt đầu: ${levelDef(S.level).badge} ${levelDef(S.level).name} (${levelDef(S.level).waves} đợt)</button>
        <button class="btn gold" id="btnBoard">🏆 Bảng xếp hạng</button>
        <button class="btn ghost" id="btnHelp">📖 Hướng dẫn</button>
        <button class="btn ghost" id="btnMenu">◀️ Menu</button>
      </div>
    </div>`, {
    action: 'levels',
    primary: () => startGame(S.level, S.diff),
    secondary: showMenu,
    onRender() {
      ovqa('.dchip').forEach((n) => {
        n.onclick = () => {
          S.diff = n.dataset.diff;
          ovqa('.dchip').forEach((m) => m.classList.toggle('sel', m === n));
        };
      });
      ovqa('.lvl').forEach((card) => {
        card.onclick = () => {
          const id = card.dataset.level;
          if (!isUnlocked(id)) {
            Sound.play('error');
            toast(`Bản đồ ${levelDef(id).name} còn khoá — hạ màn trước để mở`, 'bad');
            return;
          }
          S.level = id; S.map = levelDef(id);
          ovqa('.lvl').forEach((c) => c.classList.toggle('sel', c === card));
          const l = levelDef(id);
          $('btnStart').innerHTML = `▶️ Bắt đầu: ${l.badge} ${l.name} (${l.waves} đợt)`;
          Sound.play('coin');
        };
      });
      $('btnStart').onclick = () => {
        if (!isUnlocked(S.level)) { toast('Bản đồ này còn khoá', 'bad'); return; }
        startGame(S.level, S.diff);
      };
      $('btnBoard').onclick = () => showLeaderboard(S.level, showLevelSelect);
      $('btnHelp').onclick = () => showHelp();
      $('btnMenu').onclick = () => showMenu();
      const inp = $('nameInput');
      if (inp) {
        inp.oninput = () => setPlayerName(inp.value);
        inp.onchange = () => { setPlayerName(inp.value); inp.value = PROG.name; toast('Đã lưu tên: ' + playerName(), ''); };
      }
      const sel = ovq('.lvl.sel');
      if (sel && sel.scrollIntoView) { try { sel.scrollIntoView({ block: 'nearest' }); } catch (e) { /* ignore */ } }
    },
  });
}

function showLeaderboard(levelId = S.level, onBack = showLevelSelect) {
  const lv = levelDef(levelId);
  const board = boardOf(lv.id);
  const mine = bestOf(lv.id);
  const tabs = LEVELS.map((l) => `<button class="ltab ${l.id === lv.id ? 'sel' : ''} ${isUnlocked(l.id) ? '' : 'locked'}" data-lb="${l.id}">
      <span>${l.badge} ${l.name}</span><small>${boardOf(l.id).length}</small>
    </button>`).join('');
  const rows = board.length
    ? board.map((e, i) => `<tr class="${e.id === lastEntryId ? 'me' : ''}">
        <td class="rank">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1)}</td>
        <td class="nm">${escapeHtml(e.name || 'Người chơi')}${e.win ? ' 🏁' : ''}</td>
        <td class="sc">${fmt(e.score)}</td>
        <td class="wv">${e.wave}/${lv.waves}</td>
        <td class="df">${diffOf(e.difficulty).icon} ${diffOf(e.difficulty).name}</td>
        <td class="dt">${fmtDate(e.time)}</td>
      </tr>`).join('')
    : `<tr><td colspan="6" class="empty">Chưa có ai ghi điểm ở bản đồ này — chơi một ván để mở màn nhé!</td></tr>`;
  showOverlay(`
    <div class="modal wide">
      <span class="badge">BẢNG XẾP HẠNG</span>
      <h1>🏆 Kỷ lục ${lv.badge} ${lv.name}</h1>
      <p class="sub">${lv.waves} đợt · ${lv.cols}×${lv.rows} ô · độ nguy hiểm ${stars(mapThreat(lv, diffOf(S.diff)))}${mine ? ` · kỷ lục của bạn: <b>${fmt(mine.score)}</b> (đợt ${mine.wave}/${lv.waves}${mine.win ? ', đã hạ' : ''})` : ''}</p>
      <div class="ltabs">${tabs}</div>
      <div class="tablewrap">
        <table class="board">
          <thead><tr><th>HẠNG</th><th>NGƯỜI CHƠI</th><th>ĐIỂM</th><th>ĐỢT</th><th>ĐỘ KHÓ</th><th>LÚC</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="nameRow">
        <label for="nameInput">Tên của bạn</label>
        <input id="nameInput" maxlength="14" placeholder="Người chơi" value="${escapeHtml(PROG.name)}" />
      </div>
      <div class="actions">
        <button class="btn" id="btnPlay">🎮 Chơi bản đồ này</button>
        <button class="btn ghost" id="btnBoardBack">◀️ Quay lại</button>
        <button class="btn ghost" id="btnLevels">🗺️ Chọn bản đồ khác</button>
        <button class="btn danger" id="btnReset">🗑️ Xoá bảng của bản đồ này</button>
      </div>
      <div class="foot">Điểm = điểm trong ván × (1 + 6% × số mạng còn lại) khi thắng · mỗi bản đồ giữ top 10</div>
    </div>`, {
    action: 'board',
    primary: () => { if (isUnlocked(lv.id)) startGame(lv.id, S.diff); else showLevelSelect(); },
    secondary: showLevelSelect,
    onRender() {
      ovqa('.ltab').forEach((t) => { t.onclick = () => showLeaderboard(t.dataset.lb, onBack); });
      $('btnPlay').onclick = () => {
        if (!isUnlocked(lv.id)) { toast('Bản đồ này còn khoá', 'bad'); return; }
        S.level = lv.id; S.map = lv; startGame(lv.id, S.diff);
      };
      $('btnLevels').onclick = () => showLevelSelect();
      $('btnBoardBack').onclick = () => onBack();
      $('btnReset').onclick = () => {
        clearBoard(lv.id);
        toast(`Đã xoá bảng xếp hạng của ${lv.name}`, '');
        showLeaderboard(lv.id, onBack);
      };
      const inp = $('nameInput');
      inp.oninput = () => setPlayerName(inp.value);
      inp.onchange = () => {
        setPlayerName(inp.value);
        if (lastEntryId) { renameEntry(lv.id, lastEntryId, PROG.name); showLeaderboard(lv.id, onBack); }
      };
    },
  });
}
function showHelp() {
  const wasPlaying = S.phase !== 'menu';
  if (wasPlaying) { S.paused = true; updateControls(); }
  showOverlay(`
    <div class="modal">
      <span class="badge">HƯỚNG DẪN</span>
      <h1>Chơi thế nào?</h1>
      <p class="sub">Chiến dịch có <b>${LEVELS.length} bản đồ</b> (${LEVELS.map((l) => l.waves).join(' · ')} đợt). Giữ căn cứ đến hết số đợt của bản đồ để hạ màn và mở khoá màn kế tiếp.</p>
      <div class="helpgrid">
        <div class="help"><b>1. Chọn bản đồ</b>Vào <span class="k">Chơi</span> → bấm thẻ bản đồ → chọn độ khó → <span class="k">Bắt đầu</span>. Bản đồ khoá 🔒 sẽ mở sau khi bạn hạ màn trước.</div>
        <div class="help"><b>2. Chọn tháp</b>Bấm thẻ tháp ở thanh dưới hoặc phím <span class="k">1–5</span>. Di chuột lên bản đồ để xem trước tầm bắn.</div>
        <div class="help"><b>3. Xây &amp; nâng cấp</b>Bấm vào ô đất trống viền xanh để xây. Bấm vào tháp đã xây → <span class="k">⬆️ Nâng cấp</span> (tối đa cấp 5) hoặc bán (thu hồi 62%).</div>
        <div class="help"><b>4. Gọi đợt</b>Hết đợt có ${BUILD_TIME}s chuẩn bị. Bấm <span class="k">⚡ Gọi đợt ngay</span> để nhận thêm vàng.</div>
        <div class="help"><b>🛸 Drone</b>Bay theo đường riêng trên không, bỏ qua địa hình. Cần tháp bắn được mục tiêu bay (Liên Thanh, Băng, Sét, Bắn Tỉa).</div>
        <div class="help"><b>👽 Sinh vật ngoài hành tinh</b>Từ đợt 9. Cứ ~4.6 giây <span class="k">dịch chuyển tức thời</span> về phía trước — nhưng khi đang bị Súng Băng làm chậm thì không nhảy được.</div>
        <div class="help"><b>🧟 Quái vật đột biến</b>Từ đợt 12. Bị hạ sẽ <span class="k">tách thành 2 ấu trùng</span> chạy rất nhanh — chừa tháp bắn nhanh cho đoạn cuối.</div>
        <div class="help"><b>🏆 Bảng xếp hạng</b>Mỗi bản đồ giữ top 10 điểm. Thắng với nhiều mạng còn lại sẽ được cộng thêm 6% mỗi mạng. Đổi tên ở ô <span class="k">Tên của bạn</span>.</div>
        <div class="help"><b>🎮 Camera</b>Kéo chuột / 1 ngón để xoay, cuộn / chụm 2 ngón để zoom, kéo chuột phải hoặc <span class="k">Shift</span>+kéo để di chuyển tầm nhìn.</div>
        <div class="help"><b>⌨️ Phím tắt</b><span class="k">Space</span> gọi đợt/tiếp tục · <span class="k">T</span> tốc độ · <span class="k">P</span> tạm dừng · <span class="k">U</span> nâng cấp · <span class="k">X</span> bán · <span class="k">Q/E</span> xoay · <span class="k">M</span> âm thanh · <span class="k">H</span> hướng dẫn</div>
      </div>
      <div class="actions">
        <button class="btn" id="btnBack">${wasPlaying ? '▶️ Tiếp tục chơi' : '🗺️ Về màn chọn bản đồ'}</button>
      </div>
    </div>`, {
    action: wasPlaying ? 'resume' : 'levels',
    primary: () => (wasPlaying ? resumeGame() : showLevelSelect()),
    secondary: () => (wasPlaying ? resumeGame() : showMenu()),
    onRender() {
      $('btnBack').onclick = () => (wasPlaying ? resumeGame() : showLevelSelect());
    },
  });
}
function showPause() {
  const lv = S.map;
  showOverlay(`
    <div class="modal" style="width:min(560px,92vw)">
      <span class="badge">TẠM DỪNG</span>
      <h1>Đang tạm dừng</h1>
      <p class="sub">${lv.badge} <b>${lv.name}</b> · đợt ${S.wave}/${lv.waves} · ${S.enemies.length} kẻ địch trên bản đồ · ⭐ ${fmt(S.score)}</p>
      <div class="summary">
        <div class="sumbox"><b>❤️ ${S.lives}</b><small>MẠNG</small></div>
        <div class="sumbox"><b>🪙 ${fmt(S.gold)}</b><small>VÀNG</small></div>
        <div class="sumbox"><b>🏗️ ${S.towers.length}</b><small>THÁP</small></div>
        <div class="sumbox"><b>☠️ ${S.kills}</b><small>ĐÃ HẠ</small></div>
      </div>
      <div class="actions">
        <button class="btn" id="btnResume">▶️ Tiếp tục</button>
        <button class="btn ghost" id="btnHelp2">📖 Hướng dẫn</button>
        <button class="btn ghost" id="btnBoard2">🏆 Bảng xếp hạng</button>
        <button class="btn danger" id="btnQuit">🏳️ Chọn bản đồ khác</button>
      </div>
    </div>`, {
    action: 'resume',
    primary: () => resumeGame(),
    secondary: () => resumeGame(),
    onRender() {
      $('btnResume').onclick = () => resumeGame();
      $('btnHelp2').onclick = () => showHelp();
      $('btnBoard2').onclick = () => showLeaderboard(S.level, showPause);
      $('btnQuit').onclick = () => { S.paused = false; S.phase = 'menu'; updateControls(); showLevelSelect(); };
    },
  });
}
function showEnd(win) {
  const lv = S.map;
  const score = finalScore(S.score, S.lives, win);
  const entry = {
    levelId: lv.id, name: playerName(), score, wave: S.wave, kills: S.kills, lives: S.lives,
    difficulty: S.diff, win, time: Date.now(), id: makeEntryId(),
  };
  const res = submitScore(entry);
  recordResult(lv.id, S.diff, entry);
  const nextLevel = win ? LEVELS[levelIndex(lv.id) + 1] : null;
  unlockNext(lv.id);
  const rankLine = res.inserted
    ? `🏆 Bạn xếp <b>hạng #${res.rank}</b> trong bảng xếp hạng ${lv.badge} ${lv.name}!`
    : (win ? `Bảng xếp hạng ${lv.name} đã đầy 10 suất — chưa lọt top lần này.` : `Chưa lọt top 10 của ${lv.name} — cố thêm chút nữa nhé!`);
  Sound.play(win ? 'win' : 'lose');

  showOverlay(`
    <div class="modal">
      <span class="badge">${win ? 'CHIẾN THẮNG' : 'THẤT THỦ'} · ${lv.badge} ${lv.name}</span>
      <h1>${win ? '🏆 Căn cứ an toàn!' : '💀 Căn cứ đã thất thủ'}</h1>
      <p class="sub">${win
        ? `Bạn đã đẩy lùi toàn bộ <b>${lv.waves} đợt</b> ở độ khó ${diffOf(S.diff).name}. Điểm thưởng thêm nhờ giữ được ${S.lives} mạng.`
        : `Bạn cầm cự được <b>${S.wave}/${lv.waves} đợt</b> ở độ khó ${diffOf(S.diff).name}. Thử trộn thêm loại tháp và ưu tiên vị trí gần khúc cua nhé!`}</p>
      <div class="rankline ${res.inserted ? 'good' : ''}">${rankLine}</div>
      <div class="summary">
        <div class="sumbox"><b>⭐ ${fmt(score)}</b><small>ĐIỂM</small></div>
        <div class="sumbox"><b>🌊 ${S.wave}/${lv.waves}</b><small>ĐỢT ĐÃ QUA</small></div>
        <div class="sumbox"><b>☠️ ${S.kills}</b><small>ĐỊCH ĐÃ HẠ</small></div>
        <div class="sumbox"><b>❤️ ${S.lives}</b><small>MẠNG CÒN LẠI</small></div>
        <div class="sumbox"><b>🏗️ ${S.built}</b><small>THÁP ĐÃ XÂY</small></div>
        <div class="sumbox"><b>🪙 ${fmt(S.gold)}</b><small>VÀNG CUỐI VÁN</small></div>
      </div>
      <div class="nameRow">
        <label for="nameInput">Ghi tên vào bảng xếp hạng</label>
        <input id="nameInput" maxlength="14" placeholder="Người chơi" value="${escapeHtml(PROG.name)}" />
        <small id="nameHint">Đang lưu với tên: <b>${escapeHtml(playerName())}</b></small>
      </div>
      <div class="actions">
        <button class="btn" id="btnAgain">🔄 Chơi lại ${lv.name}</button>
        ${nextLevel ? `<button class="btn gold" id="btnNext">➡️ Màn kế: ${nextLevel.badge} ${nextLevel.name} (${nextLevel.waves} đợt)</button>` : ''}
        <button class="btn ghost" id="btnBoardEnd">🏆 Bảng xếp hạng</button>
        <button class="btn ghost" id="btnLevels">🗺️ Chọn bản đồ</button>
      </div>
    </div>`, {
    action: 'end',
    primary: () => startGame(lv.id, S.diff),
    secondary: () => showLevelSelect(),
    onRender() {
      $('btnAgain').onclick = () => startGame(lv.id, S.diff);
      const bn = $('btnNext');
      if (bn) bn.onclick = () => startGame(nextLevel.id, S.diff);
      $('btnBoardEnd').onclick = () => showLeaderboard(lv.id);
      $('btnLevels').onclick = () => showLevelSelect();
      const inp = $('nameInput');
      const hint = $('nameHint');
      inp.oninput = () => {
        setPlayerName(inp.value);
        if (hint) hint.innerHTML = `Đang lưu với tên: <b>${escapeHtml(playerName())}</b>`;
      };
      inp.onchange = () => {
        setPlayerName(inp.value);
        renameEntry(lv.id, entry.id, PROG.name);
        toast('Đã cập nhật tên trên bảng xếp hạng', '');
      };
    },
  });
}

function gameOver() {
  if (S.phase === 'over' || S.phase === 'victory') return;
  S.phase = 'over'; S.paused = false; S.waveActive = false;
  CAM.shake = 1.1;
  burst({ pos: _v1.set(basePos.x, 2, basePos.z), color: 0xff5d73, count: 40, speed: 13, size: 0.32, life: 0.9, shape: 'oct' });
  updateControls(); updateHUD(true);
  showEnd(false);
}
function victory() {
  S.phase = 'victory'; S.paused = false; S.waveActive = false;
  burst({ pos: _v1.set(basePos.x, 4, basePos.z), color: 0x6ff0ff, count: 40, speed: 12, size: 0.3, life: 1.1, shape: 'oct' });
  updateControls(); updateHUD(true);
  showEnd(true);
}

/* -------------------------------- menu --------------------------------- */
function resumeGame() {
  hideOverlay();
  S.paused = false;
  updateControls();
  Sound.resume();
}
function togglePause() {
  if (S.phase === 'menu' || S.phase === 'over' || S.phase === 'victory') return;
  if (overlayShown) { resumeGame(); return; }
  S.paused = true;
  updateControls();
  showPause();
}
function cycleSpeed() {
  if (S.phase === 'menu' || S.phase === 'over' || S.phase === 'victory') return;
  S.speed = S.speed === 1 ? 2 : S.speed === 2 ? 3 : 1;
  updateControls(); updateWavePanel();
  toast(`Tốc độ ${S.speed}×`, '');
}

/* ============================== ĐIỀU KHIỂN ============================== */
const ray = new THREE.Raycaster();
const ptrNdc = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hitPoint = new THREE.Vector3();
const pointers = new Map();
let drag = { mode: null, moved: false };

function towerTile(gx, gz) { return towerAt.get(key(gx, gz)) || null; }

function pickTile(cx, cy) {
  const r = el.canvas.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  ptrNdc.x = ((cx - r.left) / r.width) * 2 - 1;
  ptrNdc.y = -((cy - r.top) / r.height) * 2 + 1;
  ray.setFromCamera(ptrNdc, camera);
  if (!ray.ray.intersectPlane(groundPlane, hitPoint)) return null;
  const g = gridFromWorld(hitPoint.x, hitPoint.z);
  return { gx: g.gx, gz: g.gz, x: hitPoint.x, z: hitPoint.z, outside: !inGrid(g.gx, g.gz) };
}

function selectBuild(id) {
  if (S.phase === 'menu') return;
  if (S.buildMode === id) { cancelBuild(); return; }
  S.buildMode = id;
  S.selected = null;
  makeGhost(id);
  updateCards(); updateInspector(true);
  const def = towerDef(id);
  if (S.gold < def.cost) toast(`Chưa đủ vàng cho ${def.name} (cần 🪙 ${def.cost})`, 'bad');
  else toast(`Đã chọn ${def.icon} ${def.name} — bấm vào ô đất để xây`, '');
  if (IS_SMALL()) el.side.classList.add('open');
}

function cancelBuild() {
  S.buildMode = null;
  makeGhost(null);
  if (indicator) indicator.grp.visible = false;
  updateCards(); updateInspector(true);
}

function panCamera(dx, dy) {
  const scale = CAM.dist * 0.0017;
  const st = Math.sin(CAM.theta), ct = Math.cos(CAM.theta);
  CAM.target.x -= ct * dx * scale;
  CAM.target.z += st * dx * scale;
  CAM.target.x -= st * dy * scale;
  CAM.target.z -= ct * dy * scale;
  clampTarget();
}
function clampTarget() {
  CAM.target.x = clamp(CAM.target.x, -GRID.W / 2 - 6, GRID.W / 2 + 6);
  CAM.target.z = clamp(CAM.target.z, -GRID.D / 2 - 6, GRID.D / 2 + 6);
  CAM.target.y = 0;
}

function onDown(e) {
  Sound.init(); Sound.resume();
  if (overlayShown) return;
  if (e.target !== el.canvas) return;
  if (e.pointerType === 'mouse' && e.button === 2) drag = { mode: 'pan', moved: false, id: e.pointerId };
  else if (e.pointerType === 'mouse' && e.shiftKey) drag = { mode: 'pan', moved: false, id: e.pointerId };
  else drag = { mode: 'orbit', moved: false, id: e.pointerId };
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
  try { el.canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
}

function onMove(e) {
  const p = pointers.get(e.pointerId);
  if (p) {
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (Math.abs(e.clientX - p.sx) + Math.abs(e.clientY - p.sy) > 7) drag.moved = true;
    if (pointers.size >= 2) {
      const pts = [...pointers.values()];
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (drag.pinch) {
        const k = drag.pinch / Math.max(1, d);
        CAM.dist = clamp(CAM.dist * (1 + (k - 1) * 0.9), 14, 66);
      }
      drag.pinch = d;
      drag.moved = true;
    } else if (drag.mode === 'orbit') {
      CAM.theta -= dx * 0.0062;
      CAM.phi = clamp(CAM.phi - dy * 0.005, 0.42, 1.35);
    } else if (drag.mode === 'pan' && (e.buttons || e.pointerType === 'touch')) {
      panCamera(dx, dy);
    }
  }
  const t = pickTile(e.clientX, e.clientY);
  if (t && !t.outside) { S.hover = t; S.hoverTower = towerTile(t.gx, t.gz); }
  else { S.hover = null; S.hoverTower = null; }
}

function onUp(e) {
  const p = pointers.get(e.pointerId);
  pointers.delete(e.pointerId);
  if (drag.pinch && pointers.size < 2) drag.pinch = null;
  if (overlayShown || !p) return;
  const quick = !drag.moved && performance.now() - p.t < 600;
  const tile = quick ? pickTile(e.clientX, e.clientY) : null;
  if (tile && !tile.outside) {
    if (S.buildMode) {
      if (canBuild(tile.gx, tile.gz)) placeTower(S.buildMode, tile.gx, tile.gz);
      else { Sound.play('error'); toast('Ô này không thể xây (đường đi / vật cản)', 'bad'); }
    } else {
      const t = towerTile(tile.gx, tile.gz);
      S.selected = t || null;
      if (t) S.hoverTower = t;
      updateInspector(true);
    }
  } else if (quick && !S.buildMode && S.selected) {
    S.selected = null; updateInspector(true);
  }
  if (pointers.size === 0) drag = { mode: null, moved: false };
}

function onWheel(e) {
  if (overlayShown) return;
  e.preventDefault();
  const k = Math.exp(clamp(e.deltaY, -220, 220) * 0.0011);
  CAM.dist = clamp(CAM.dist * k, 14, 66);
}

function onKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key;
  if (overlayShown) {
    // khi đang mở bảng (menu/chọn bản đồ/BXH/tạm dừng/kết ván)
    if ((k === 'p' || k === 'P') && overlayAction === 'resume') { resumeGame(); return; }
    if (k === 'm' || k === 'M') { toggleSoundKey(); return; }
    if (k === 'Escape') { (overlaySecondary || overlayPrimary || showMenu)(); return; }
    if (k === ' ' || k === 'Enter') {
      e.preventDefault();
      if (overlayPrimary) overlayPrimary();
      return;
    }
    if (k === 'Tab') { e.preventDefault(); el.side.classList.toggle('open'); }
    return;
  }
  if (k >= '1' && k <= '5') { const t = TOWERS[Number(k) - 1]; if (t) selectBuild(t.id); }
  else if (k === 'Escape') { if (S.buildMode) cancelBuild(); else { S.selected = null; updateInspector(true); } }
  else if (k === ' ') { e.preventDefault(); if (S.phase === 'build') startWave(); else togglePause(); }
  else if (k === 't' || k === 'T') cycleSpeed();
  else if (k === 'p' || k === 'P') togglePause();
  else if (k === 'm' || k === 'M') toggleSoundKey();
  else if (k === 'h' || k === 'H' || k === '?') showHelp();
  else if (k === 'Tab') { e.preventDefault(); el.side.classList.toggle('open'); }
  else if (k === 'u' || k === 'U') { if (S.selected) upgradeTower(S.selected); }
  else if (k === 'x' || k === 'X') { if (S.selected) sellTower(S.selected); }
  else if (k === 'q' || k === 'Q') CAM.theta -= 0.22;
  else if (k === 'e' || k === 'E') CAM.theta += 0.22;
  else if (k === 'ArrowLeft') { CAM.target.x -= 2.2; clampTarget(); }
  else if (k === 'ArrowRight') { CAM.target.x += 2.2; clampTarget(); }
  else if (k === 'ArrowUp') { CAM.target.z -= 2.2; clampTarget(); }
  else if (k === 'ArrowDown') { CAM.target.z += 2.2; clampTarget(); }
  else if (k === '+' || k === '=') CAM.dist = clamp(CAM.dist * 0.9, 14, 66);
  else if (k === '-' || k === '_') CAM.dist = clamp(CAM.dist * 1.1, 14, 66);
}
function toggleSoundKey() {
  Sound.init();
  Sound.on = !Sound.on;
  const b = $('cSound');
  if (b) { b.classList.toggle('on', Sound.on); b.textContent = Sound.on ? '🔊' : '🔇'; }
  toast(Sound.on ? 'Âm thanh: BẬT' : 'Âm thanh: TẮT', '');
  if (Sound.on) Sound.resume();
}

function bindInput() {
  const cv = el.canvas;
  cv.addEventListener('pointerdown', onDown);
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  window.addEventListener('keydown', onKey);
  window.addEventListener('blur', () => { if (S.phase !== 'menu' && !overlayShown && S.phase !== 'over' && S.phase !== 'victory') togglePause(); });
  el.cards.addEventListener('click', (e) => {
    const card = e.target.closest('[data-tower]');
    if (card) selectBuild(card.dataset.tower);
  });
}

/* -------------------------------- camera ------------------------------- */
function updateCamera(dt) {
  CAM.phi = clamp(CAM.phi, 0.42, 1.35);
  CAM.dist = clamp(CAM.dist, 14, 66);
  const sp = Math.sin(CAM.phi);
  camera.position.set(
    CAM.target.x + Math.sin(CAM.theta) * CAM.dist * sp,
    Math.max(3.5, Math.cos(CAM.phi) * CAM.dist + 2.5),
    CAM.target.z + Math.cos(CAM.theta) * CAM.dist * sp
  );
  camera.lookAt(CAM.target.x, CAM.target.y, CAM.target.z);
  if (CAM.shake > 0.002) {
    camera.position.x += rnd(-1, 1) * CAM.shake * 0.42;
    camera.position.y += rnd(-1, 1) * CAM.shake * 0.3;
    camera.position.z += rnd(-1, 1) * CAM.shake * 0.42;
    CAM.shake = Math.max(0, CAM.shake - dt * 1.9);
  } else CAM.shake = 0;
}

function updateHoverVisuals() {
  if (ghost && S.buildMode) {
    if (!S.hover) { ghost.visible = false; indicator.grp.visible = false; }
    else updateGhost();
  } else if (indicator && !S.buildMode) {
    // hiện tầm bắn của tháp đang chọn / đang trỏ tới
    const t = S.selected || S.hoverTower;
    if (t) {
      indicator.grp.visible = true;
      indicator.grp.position.set(t.pos.x, 0, t.pos.z);
      const r = t.stats.range;
      indicator.disc.scale.set(r, 1, r);
      indicator.ring.scale.set(r, 1, r);
      _c1.setHex(t.def.color);
      indicator.disc.material.color.copy(_c1);
      indicator.ring.material.color.copy(_c1);
      indicator.tile.material.color.copy(_c1);
      indicator.tile.scale.set(t === S.hoverTower ? 1 : 0.001, 1, t === S.hoverTower ? 1 : 0.001);
      indicator.outline.material.color.copy(_c1);
    } else indicator.grp.visible = false;
  } else if (indicator) indicator.grp.visible = false;
}

/* ------------------------------ vòng lặp ------------------------------- */
let lastT = 0;

function tick(realDt) {
  const running = !S.paused && S.phase !== 'menu' && S.phase !== 'over' && S.phase !== 'victory';
  const dt = running ? realDt * S.speed : 0;
  const amb = realDt;

  // hiệu ứng nền luôn sống động
  if (portalObj) {
    portalObj.ring1.rotation.z += amb * 0.8;
    portalObj.ring2.rotation.z -= amb * 1.3;
    portalObj.hole.material.opacity = 0.13 + Math.sin(S.sim * 2.6) * 0.06;
    portalObj.light.intensity = 105 + Math.sin(S.sim * 3.4) * 40;
  }
  if (baseObj) {
    baseObj.ring.rotation.z += amb * 0.45;
    baseObj.core.rotation.y += amb * 0.85;
    baseObj.core.position.y = 2.5 + Math.sin(S.sim * 1.5) * 0.18;
    baseObj.dome.material.opacity = 0.075 + Math.sin(S.sim * 1.1) * 0.022;
    baseObj.light.intensity = 85 + Math.sin(S.sim * 2.1) * 25;
  }
  for (const a of animGroups) {
    if (a.kind === 'crystal') {
      a.obj.rotation.y += amb * 0.35;
      const s = 1 + Math.sin(S.sim * 1.8 + a.ph) * 0.06;
      a.obj.scale.set(s, s, s);
    }
  }

  if (running) {
    S.sim += dt;
    if (S.phase === 'build') {
      S.buildTimer -= dt;
      if (S.buildTimer <= 0) {
        S.buildTimer = 0;
        if (S.autoStart) startWave(true);
      }
    }
    updateSpawner(dt);
    updateEnemies(dt);
    updateTowers(dt);
    updateProjectiles(dt);
    updateFX(dt);
  } else if (FX.length && S.phase !== 'menu') {
    updateFX(realDt * 0.4);
  }

  updateFloaters(realDt);
  updateCamera(realDt);
  updateHoverVisuals();
  updateHUD();
  tickWavePanel(realDt);
  updateInspector();
}

function frame(now) {
  requestAnimationFrame(frame);
  if (!lastT) lastT = now;
  let dt = (now - lastT) / 1000;
  lastT = now;
  if (!(dt > 0)) dt = 1 / 60;
  dt = Math.min(dt, 0.05);
  tick(dt);
  try { renderer.render(scene, camera); } catch (e) { /* tránh treo vòng lặp */ }
}

function resize() {
  if (!renderer) return;
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
}

/* ------------------------------ bắt đầu game --------------------------- */
/**
 * Bắt đầu một ván.
 * @param levelArg id bản đồ (hoặc id độ khó để tương thích cách gọi cũ)
 * @param diffArg  id độ khó
 */
function startGame(levelArg, diffArg) {
  let levelId = S.level, diffId = diffArg;
  if (typeof levelArg === 'string' && LEVELS.some((l) => l.id === levelArg)) levelId = levelArg;
  else if (typeof levelArg === 'string' && DIFFICULTIES[levelArg]) diffId = levelArg;
  diffId = diffId || S.diff;
  const level = levelDef(levelId);
  const d = diffOf(diffId);
  if (!isUnlocked(level.id)) { Sound.play('error'); toast(`${level.name} còn khoá — hạ màn trước để mở`, 'bad'); showLevelSelect(); return; }
  S.level = level.id; S.map = level; S.diff = d.id;
  rememberLevel(level.id);

  // dựng lại thế giới tĩnh theo bản đồ (địa hình, đường đi, trang trí, căn cứ, cổng)
  buildStaticWorld(level.id);

  const st = startState(level, d);
  S.gold = st.gold; S.lives = st.lives; S.wave = 0; S.score = 0; S.kills = 0; S.leaks = 0; S.built = 0;
  S.waveActive = false; S.waveData = null; S.spawnIdx = 0; S.waveTimer = 0;
  S.buildTimer = BUILD_TIME; S.buildMode = null; S.selected = null; S.hover = null; S.hoverTower = null;
  S.paused = false; S.speed = 1; S.autoStart = true; S.sim = 0; CAM.shake = 0;
  S.best = 0;
  { const b = boardOf(level.id); if (b.length) S.best = b[0].score; }
  { const c = bestOf(level.id); if (c && c.score > S.best) S.best = c.score; }

  for (const e of S.enemies) world.remove(e.g);
  for (const t of S.towers) world.remove(t.group);
  for (const p of S.projectiles) world.remove(p.g);
  S.enemies.length = 0; S.towers.length = 0; S.projectiles.length = 0;
  towerAt.clear();
  cancelBuild();
  makeGhost(null);
  FX.length = 0;
  if (indicator) indicator.grp.visible = false;

  fitCamera(true);
  Sound.init(); Sound.resume();
  hideOverlay();
  S.phase = 'build';
  _lastHud = {}; updateCards._sig = null; updateInspector._sig = null;
  updateHUD(true); updateCards(); updateWavePanel(); updateInspector(true); updateControls();
  toast(`${level.badge} ${level.name} · ${level.waves} đợt · độ khó ${d.name} — xây tháp rồi bấm ⚡ Gọi đợt`, 'good');
}
function boot() {
  try {
    initRenderer();
    buildIndicator();
    buildPathData();
    buildHud();
    renderIcons(document);        // icon SVG cho cả những chỗ tĩnh trong template (logo…)
    buildControls();
    bindInput();
    resize();
    loadProgress();
    S.phase = 'menu';
    updateCards(); updateWavePanel(); updateInspector(true); updateHUD(true); updateControls();
    window.addEventListener('resize', resize);
    requestAnimationFrame(frame);
    console.log('%c🎮 Neon Defense 3D', 'color:#3ddcff;font-weight:700', '· bản dựng', window.__NEON_BUILD__ || 'dev');
    window.NEON = {
      S, TOWERS, ENEMIES, DIFFICULTIES, GRID, MAX_LEVEL, BUILD_TIME, totalWaves,
      LEVELS, levelDef, levelIndex, setMap: applyLevelMap, activeMap, totalWaves, startState, mapThreat,
      finalScore, insertScore, scoreCompare, makeEntryId,
      qualifies: (levelId, score, wave = 0, kills = 0) => qualifies(boardOf(levelId), { score, wave, kills, time: Date.now() }, 10),
      PROG, PROGRESS: PROG, isUnlocked, bestOf, boardOf, writeBoard, clearBoard, submitScore, renameEntry,
      setPlayerName, setPlayer: setPlayerName, playerName, clearedCount, boardCount, topScoreAll,
      unlockAll, resetProgress, rememberLevel, loadProgress, startWaveAt: null,
      showMenu, showLevelSelect, showLeaderboard, showEnd, showHelp, showPause, fitCamera,
      startGame, startWave, placeTower, upgradeTower, sellTower, buildWave, towerStats,
      upgradeCost, sellValue, selectBuild, cancelBuild, tick, frame, Sound, canBuild,
      spawnEnemy, damageEnemy, explode, diffOf, pathTiles, worldPos, enemyStats,
      pathWorldPoints, airWorldPoints, buildPathData,
      enemyStatsOf: enemyStats, applyArmor, waveBonus, callBonus, waveThreat, stars, fmt,
      scene, camera, renderer, CAM, FX, blocked, towerAt, basePos, portalObj, baseObj,
      ICONS, svgIcon, renderIcons, TILE, updateWavePanel, updateInspector, updateCards, updateHUD, renderIconsIn: renderIcons,
      world, countInScene: (prefix) => { let n = 0; scene.traverse((o) => { if (o.name && o.name.startsWith(prefix)) n++; }); return n; },
    };
    showMenu();
  } catch (err) {
    console.error(err);
    el.fatal.style.display = 'grid';
    el.fatal.innerHTML = '<div><h2 style="margin:0 0 8px">⚠️ Không khởi động được WebGL</h2>'
      + '<p style="color:#8ea5c9;font-size:13px;max-width:520px;margin:0 auto">Trình duyệt của bạn có thể đã tắt WebGL hoặc thiết bị quá cũ. '
      + 'Hãy thử Chrome/Edge/Firefox bản mới, hoặc bật tăng tốc phần cứng trong cài đặt trình duyệt.</p>'
      + '<pre style="margin-top:14px;font-size:11px;color:#5d719a;white-space:pre-wrap">' + String(err && err.message || err) + '</pre></div>';
  }
}
boot();
