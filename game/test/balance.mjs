/**
 * Thăm dò cân bằng độ khó: cho một "bot người chơi" chơi tự nhiên
 * (chỉ tiêu vàng đang có, xây tháp cạnh đường, nâng cấp khi dư dả, gọi đợt ngay)
 * rồi xem đi được tới đợt nào ở mỗi độ khó.
 * Chạy: cd game/test && node balance.mjs
 */
import { JSDOM, VirtualConsole } from 'jsdom';
import { buildParts, buildHtml } from '../build.mjs';
const STUB = `<script>(function(){ const T=window.THREE; T.WebGLRenderer = class { constructor(o){ o=o||{}; this.domElement=o.canvas||document.createElement('canvas'); this.shadowMap={enabled:false,type:0}; this.info={render:{},memory:{}}; } setPixelRatio(){} setSize(){} setClearColor(){} render(){} }; })();</script>`;
const vc = new VirtualConsole();
const dom = new JSDOM(buildHtml(buildParts(), STUB), { runScripts:'dangerously', pretendToBeVisual:true, url:'http://localhost/', virtualConsole: vc });
const N = dom.window.NEON, S = N.S;
N.unlockAll();                       // thăm dò mọi bản đồ, không phụ thuộc tiến độ lưu
const argv = process.argv.slice(2);
const ALL = argv.includes('--all');
const LEVEL = (argv.find((a) => N.LEVELS.some((l) => l.id === a)) || 'corridor');
const LEVELS = ALL ? N.LEVELS.map((l) => l.id) : [LEVEL];
function step(dt=1/30,n=1){ const was=S.paused; S.paused=false; for(let i=0;i<n;i++) N.tick(dt); S.paused=was; }
function runUntil(p,maxSec=300){ let t=0; while(t<maxSec){ step(); t+=1/30; if(p()) return t; } return -1; }
function tilesNearPath(){
  const path=N.pathTiles(), out=[];
  for(const t of path.values()) for(const [ax,az] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){
    const gx=t.gx+ax, gz=t.gz+az;
    if(N.canBuild(gx,gz) && !out.some(o=>o.gx===gx&&o.gz===gz)) out.push({gx,gz});
  }
  return out;
}
function play(diffId, opts={}){
  const maxTowers = opts.maxTowers || 999;
  const maxLevel = opts.maxLevel || 3;
  const early = opts.early !== false;
  N.startGame(opts.level || LEVEL, diffId); S.paused=true;
  if (!early) S.autoStart = true;   // để đồng hồ tự mở đợt thay vì gọi sớm
  const spots = tilesNearPath();
  const mix = ['gun','gun','cannon','frost','tesla','sniper','gun','cannon','tesla','sniper','frost','gun'];
  let si = 0, guard = 0;
  while(S.phase!=='over' && S.phase!=='victory' && guard++ < 60){
    // 1) tiêu vàng: xây khi có ô + đủ tiền, ngược lại nâng cấp tháp yếu nhất
    let acted = true;
    while(acted){
      acted = false;
      if (si < spots.length && S.towers.length < maxTowers){
        const type = mix[si % mix.length];
        if (S.gold >= N.TOWERS.find(t=>t.id===type).cost){ N.placeTower(type, spots[si].gx, spots[si].gz); si++; acted = true; }
      }
      const weakest = S.towers.filter(t=>t.level<maxLevel).sort((a,b)=>a.level-b.level)[0];
      if (weakest && S.gold >= N.upgradeCost(weakest.type, weakest.level) + 150){
        N.upgradeTower(weakest); acted = true;
      }
    }
    // 2) mở đợt và chạy tới hết đợt
    if (!S.waveActive){
      if (S.phase==='menu') break;
      if (early) N.startWave();
      else { S.autoStart = true; step(1/30, 60); if (!S.waveActive && S.phase==='build') N.startWave(); }
    }
    if (runUntil(()=>!S.waveActive, 400) < 0) break;
  }
  return { level: S.map.id, waves: S.map.waves, diff: diffId, wave: S.wave, phase: S.phase,
           lives: S.lives, kills: S.kills, towers: S.towers.length, leaks: S.leaks, score: S.score };
}
console.log('\n=== KẾT QUẢ THĂM DÒ CÂN BẰNG ===');
const scen = [
  ['bot tối ưu (không giới hạn)', {}],
  ['người chơi thật (~26 tháp, cấp ≤3)', { maxTowers: 26, maxLevel: 3, early: false }],
];
for (const [label, opts] of scen){
  console.log('\n' + '=== ' + label + ' ===');
  for (const lv of LEVELS){
    if (ALL) console.log('  [' + lv + ']');
    for (const d of ['easy','normal','hard']){
      const r = play(d, Object.assign({ level: lv }, opts));
      console.log('  ' + r.diff.padEnd(7) + ' → đợt ' + String(r.wave).padStart(2) + '/' + r.waves
        + ' · ' + r.phase.padEnd(8) + ' · mạng ' + r.lives + ' · tháp ' + r.towers
        + ' · hạ ' + r.kills + ' · lọt ' + r.leaks + ' · điểm ' + r.score);
    }
  }
}
if (!ALL) console.log('\n(gợi ý: node balance.mjs --all để thăm dò cả 6 bản đồ)');
dom.window.close(); process.exit(0);
