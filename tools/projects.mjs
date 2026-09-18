#!/usr/bin/env node
/**
 * Quản lý repo theo quy ước "1 DỰ ÁN = 1 BRANCH" cho Arena.ai.
 *
 *   node tools/projects.mjs list                      # bảng dự án hiện có
 *   node tools/projects.mjs check                     # kiểm tra branch/entry có thật không
 *   node tools/projects.mjs hub                       # sinh lại trang hub projects.html
 *   node tools/projects.mjs new "Tên dự án" [tuỳ chọn] # tạo branch + khung dự án mới
 *
 * Tuỳ chọn của `new`:
 *   --slug neon-runner    đặt mã dự án (mặc định: tự sinh từ tên)
 *   --type game|webapp|tool|test   (mặc định: tool)
 *   --branch <tên>        đặt tên branch (mặc định: proj/<slug>)
 *   --no-switch           chỉ tạo branch, không checkout sang branch đó
 *   --push                push branch mới lên origin
 *
 * Script KHÔNG tự push trừ khi bạn truyền --push.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const args = process.argv.slice(2);
const cmd = (args[0] || 'list').toLowerCase();
const opt = (name, def = undefined) => {
  const i = args.indexOf('--' + name);
  if (i === -1) return def;
  const next = args[i + 1];
  return next && !next.startsWith('--') ? next : true;
};
const has = (name) => args.includes('--' + name);

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
/** Như git() nhưng trả '' thay vì ném lỗi (dùng cho các lệnh có thể thất bại). */
const gitTry = (...a) => { try { return git(...a); } catch { return ''; } };
const ROOT = git('rev-parse', '--show-toplevel');
const REGISTRY = join(ROOT, 'projects.json');

const TYPES = {
  game: { label: '🎮 Game', color: '#3ddcff', tag: 'game' },
  webapp: { label: '🖥️ Web app', color: '#b98cff', tag: 'webapp' },
  tool: { label: '🔧 Công cụ', color: '#5cffa8', tag: 'tool' },
  test: { label: '🧪 Thí nghiệm', color: '#ffd166', tag: 'test' },
};
const STATUS = {
  active: { label: 'đang làm', color: '#5cffa8' },
  shipped: { label: 'đã xong', color: '#3ddcff' },
  archived: { label: 'lưu trữ', color: '#8ea5c9' },
};

function readRegistry() { return JSON.parse(readFileSync(REGISTRY, 'utf8')); }
function writeRegistry(data) { writeFileSync(REGISTRY, JSON.stringify(data, null, 2) + '\n'); }

function slugify(name) {
  return String(name)
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'du-an';
}

function branchExists(branch) {
  try { git('rev-parse', '--verify', '--quiet', 'refs/heads/' + branch); return true; } catch { return false; }
}
function currentBranch() { return git('rev-parse', '--abbrev-ref', 'HEAD'); }

/* ------------------------------- list ---------------------------------- */
function list() {
  const reg = readRegistry();
  const cur = currentBranch();
  const w = (s, n) => String(s).padEnd(n).slice(0, n - 1) + ' ';
  console.log('\n📦  ' + reg.hub.title);
  console.log('    ' + '─'.repeat(96));
  console.log('    ' + w('MÃ', 16) + w('LOẠI', 12) + w('BRANCH', 32) + w('ENTRY', 28) + 'TRẠNG THÁI');
  console.log('    ' + '─'.repeat(96));
  for (const p of reg.projects) {
    const t = TYPES[p.type] || TYPES.tool, st = STATUS[p.status] || STATUS.active;
    const mark = p.branch === cur ? ' ◀ đang đứng' : '';
    console.log('    ' + w(p.id, 16) + w(t.label, 12) + w(p.branch, 32) + w(p.entry, 28) + st.label + mark);
  }
  console.log('    ' + '─'.repeat(96));
  console.log(`    ${reg.projects.length} dự án · branch hiện tại: ${cur}`);
  console.log('    Quy ước: 1 dự án = 1 branch. Tạo dự án mới → npm run project:new -- "Tên dự án"\n');
}

/* ------------------------------- check --------------------------------- */
function check() {
  const reg = readRegistry();
  let bad = 0;
  console.log('\n🔎  Kiểm tra tính nhất quán của repo\n');
  for (const p of reg.projects) {
    const dir = resolve(ROOT, p.dir);          // thư mục dự án (tính từ gốc repo)
    const entry = resolve(ROOT, p.entry);      // tệp entry (cũng tính từ gốc repo)
    const hasDir = existsSync(dir);
    const hasEntry = existsSync(entry);
    const hasBranch = branchExists(p.branch);
    const hasBranchRemote = (() => {
      try { return !!git('ls-remote', '--heads', 'origin', p.branch).split('\n').filter(Boolean).length; } catch { return false; }
    })();
    const okAll = hasDir && hasEntry && (hasBranch || hasBranchRemote);
    if (!okAll) bad++;
    console.log(`  ${okAll ? '✅' : '⚠️ '} ${p.name}`);
    console.log(`     thư mục : ${p.dir} ${hasDir ? '' : '→ KHÔNG TỒN TẠI'}`);
    console.log(`     entry   : ${p.entry} ${hasEntry ? '' : '→ KHÔNG TỒN TẠI'}`);
    console.log(`     branch  : ${p.branch} ${hasBranch ? '(local)' : hasBranchRemote ? '(chỉ ở origin)' : '→ KHÔNG TỒN TẠI'}`);
  }
  const locals = git('branch', '--format=%(refname:short)').split('\n').filter(Boolean);
  const known = new Set(reg.projects.map((p) => p.branch));
  const extra = locals.filter((b) => !known.has(b) && b !== 'main');
  if (extra.length) {
    console.log('\n  ℹ️  Branch chưa có trong projects.json (có thể là dự án chưa đăng ký):');
    extra.forEach((b) => console.log('     · ' + b));
  }
  console.log(`\n  ${bad === 0 ? '🎉 Mọi dự án trong registry đều hợp lệ.' : `⚠️  ${bad} dự án đang lệch registry.`}\n`);
  return bad;
}

/* -------------------------------- new ---------------------------------- */
function scaffold(slug, name, type, branch) {
  const dir = join(ROOT, slug);
  if (existsSync(dir)) { console.error(`❌ Thư mục ${slug}/ đã tồn tại.`); process.exit(1); }
  mkdirSync(join(dir, 'src'), { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  const icon = type === 'game' ? '🎮' : type === 'webapp' ? '🖥️' : type === 'test' ? '🧪' : '🔧';

  writeFileSync(join(dir, 'README.md'), `# ${icon} ${name}

> Dự án tạo ngày ${today} · mã dự án \`${slug}\` · branch \`${branch}\` · loại **${type}**

## Quy ước
Repo theo mô hình **1 dự án = 1 branch** cho Arena.ai:
branch \`${branch}\` là "phòng làm việc" của dự án này (code + lịch sử + preview).
\`main\` chỉ giữ trang hub và lõi AI Studio chung.

## Chạy / mở
\`\`\`bash
npm run game        # nếu là game tĩnh (xem serve.mjs)
npm run dev         # nếu là web app Vite
\`\`\`
Entry tĩnh: \`${slug}/index.html\` — mở trực tiếp hoặc qua server tĩnh cũng được.

## Ghi chú
- [ ] Việc cần làm 1
- [ ] Việc cần làm 2
`);

  writeFileSync(join(dir, 'index.html'), `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${name}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: radial-gradient(circle at 50% 30%, #101a30, #05080f 70%);
         color: #dce8ff; font: 15px/1.6 ui-sans-serif, system-ui, sans-serif; text-align: center; padding: 24px; }
  .card { border: 1px solid rgba(122,190,255,.22); background: rgba(11,17,30,.75); border-radius: 18px; padding: 26px 28px; max-width: 620px;
          box-shadow: 0 20px 60px rgba(0,0,0,.5); }
  h1 { margin: 0 0 6px; font-size: 22px; }
  code { background: rgba(255,255,255,.07); padding: 2px 7px; border-radius: 6px; font-size: 12.5px; }
  p { color: #8ea5c9; margin: 8px 0; }
  canvas { margin-top: 14px; border-radius: 12px; border: 1px solid rgba(122,190,255,.2); max-width: 100%; }
</style>
</head>
<body>
  <div class="card">
    <h1>${name}</h1>
    <p>Khung dự án đã sẵn sàng · branch <code>${branch}</code></p>
    <p>Sửa tệp <code>${slug}/src/main.js</code> và reload để bắt đầu.</p>
    <canvas id="c" width="480" height="180"></canvas>
  </div>
  <script type="module" src="./src/main.js"></script>
</body>
</html>
`);

  writeFileSync(join(dir, 'src', 'main.js'), `/**
 * ${name} — điểm khởi đầu.
 * Chạy: mở ${slug}/index.html (hoặc qua server tĩnh).
 */
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let t = 0;

function frame() {
  requestAnimationFrame(frame);
  t += 0.02;
  ctx.fillStyle = '#05080f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 3; i++) {
    const x = canvas.width / 2 + Math.sin(t + i) * 120;
    const y = canvas.height / 2 + Math.cos(t * 1.3 + i) * 45;
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, Math.PI * 2);
    ctx.fillStyle = ['rgba(61,220,255,.35)', 'rgba(185,140,255,.35)', 'rgba(255,79,216,.3)'][i];
    ctx.fill();
  }
  ctx.fillStyle = '#dce8ff';
  ctx.font = '13px ui-monospace, monospace';
  ctx.fillText('${slug} · khung dự án Arena', 14, 22);
}
frame();
`);

  writeFileSync(join(dir, 'notes.md'), `# Ghi chú — ${name}\n\n- Ngày tạo: ${today}\n- Branch: \`${branch}\`\n- Loại: ${type}\n\n## Ý tưởng\n\n## Việc đang làm\n\n## Kết quả / số liệu\n`);
  return { dir, slug };
}

function createNew() {
  const name = args[1] && !args[1].startsWith('--') ? args[1] : null;
  if (!name) { console.error('❌ Thiếu tên dự án. Ví dụ: node tools/projects.mjs new "Game bắn máy bay" --type game'); process.exit(1); }
  const type = String(opt('type', 'tool'));
  if (!TYPES[type]) { console.error(`❌ --type không hợp lệ (${type}). Chọn: ${Object.keys(TYPES).join(', ')}`); process.exit(1); }
  const slug = slugify(opt('slug', name));
  const branch = String(opt('branch', 'proj/' + slug));
  const reg = readRegistry();
  if (reg.projects.some((p) => p.id === slug)) { console.error(`❌ Đã có dự án mã ${slug} trong projects.json.`); process.exit(1); }

  console.log(`\n🚧  Tạo dự án "${name}"`);
  console.log(`    mã: ${slug} · loại: ${type} · branch: ${branch}`);

  // kiểm tra TRƯỚC khi tạo branch (nếu để trong scaffold thì branch vừa tạo sẽ bị coi là trùng)
  if (branchExists(branch)) { console.error(`❌ Branch ${branch} đã tồn tại.`); process.exit(1); }
  if (existsSync(join(ROOT, slug))) { console.error(`❌ Thư mục ${slug}/ đã tồn tại.`); process.exit(1); }

  const switchTo = !has('no-switch');
  const dirty = git('status', '--porcelain').length > 0;
  if (switchTo && dirty) {
    console.error('❌ Còn thay đổi chưa commit. Hãy commit/stash trước, hoặc dùng --no-switch để chỉ tạo branch.');
    process.exit(1);
  }

  // branch mới từ HEAD hiện tại
  git('checkout', '-b', branch);
  scaffold(slug, name, type, branch);

  reg.projects.push({
    id: slug, name, type, icon: TYPES[type].tag, branch, dir: slug,
    entry: slug + '/index.html', run: type === 'game' ? 'npm run game' : 'npm run dev', status: 'active',
    desc: 'Khung dự án mới tạo bằng tools/projects.mjs — cập nhật mô tả trong projects.json.',
  });
  writeRegistry(reg);

  git('add', '-A');
  const authorName = gitTry('config', 'user.name') || 'Arena Agent';
  const authorMail = gitTry('config', 'user.email') || 'agent@arena.ai';
  git('-c', 'user.name=' + authorName, '-c', 'user.email=' + authorMail,
    'commit', '-m', `chore(${slug}): khởi tạo dự án "${name}" trên branch ${branch}`);

  console.log(`\n✅ Đã tạo và commit trên branch ${branch}`);
  if (has('push')) { git('push', '-u', 'origin', branch); console.log('🚀 Đã push lên origin'); }
  else console.log(`   Push khi sẵn sàng: git push -u origin ${branch}`);
  if (!switchTo) console.log('   (đang ở branch cũ vì có --no-switch)');
  console.log(`   Đăng ký đã thêm vào projects.json — sinh lại hub: npm run hub\n`);
}

/* -------------------------------- hub ---------------------------------- */
function hub() {
  const reg = readRegistry();
  const cur = currentBranch();
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const icon = (t) => (TYPES[t] || TYPES.tool).label.split(' ')[0];

  const cards = reg.projects.map((p) => {
    const t = TYPES[p.type] || TYPES.tool, st = STATUS[p.status] || STATUS.active;
    return `  <article class="card" style="--accent:${t.color}">
    <header>
      <span class="ico">${icon(p.type)}</span>
      <div>
        <h3>${esc(p.name)}</h3>
        <span class="tag">${esc(t.tag)}</span>
        <span class="st" style="--c:${st.color}">${esc(st.label)}</span>
      </div>
    </header>
    <p>${esc(p.desc)}</p>
    <div class="branch"><code>${esc(p.branch)}</code>${p.branch === cur ? '<span class="here">◀ branch hiện tại</span>' : ''}
      <button class="copy" data-branch="${esc(p.branch)}" title="Sao chép tên branch">⧉</button></div>
    <div class="acts">
      <a class="btn" href="./${esc(p.entry)}">Mở dự án</a>
      <span class="run"><code>${esc(p.run)}</code></span>
    </div>
  </article>`;
  }).join('\n');

  const html = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(reg.hub.title)}</title>
<style>
  :root{--bg:#05080f;--panel:rgba(11,17,30,.78);--line:rgba(122,190,255,.16);--line2:rgba(122,190,255,.34);
    --text:#dce8ff;--dim:#8ea5c9;--cyan:#3ddcff;--mag:#ff4fd8}
  *{box-sizing:border-box}
  body{margin:0;background:radial-gradient(circle at 50% -10%,#101c33,#05080f 60%),var(--bg);color:var(--text);
    font:15px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:34px 18px 60px;min-height:100vh}
  .wrap{max-width:1080px;margin:0 auto}
  header.top{text-align:center;margin-bottom:26px}
  .kicker{display:inline-block;font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:var(--dim);
    border:1px solid var(--line2);border-radius:99px;padding:4px 12px;margin-bottom:12px}
  h1{margin:0 0 8px;font-size:clamp(24px,4vw,38px);letter-spacing:.5px;
    background:linear-gradient(92deg,var(--cyan),#b98cff 55%,var(--mag));-webkit-background-clip:text;background-clip:text;color:transparent}
  .sub{color:var(--dim);font-size:13.5px;max-width:760px;margin:0 auto}
  .stats{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:18px 0 6px}
  .stat{border:1px solid var(--line);background:var(--panel);border-radius:12px;padding:7px 14px;font-size:12.5px}
  .stat b{color:var(--cyan)}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px;margin:22px 0 30px}
  .card{border:1px solid var(--line);background:var(--panel);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:10px;
    box-shadow:0 14px 40px rgba(0,0,0,.35);position:relative;overflow:hidden}
  .card::before{content:'';position:absolute;inset:0 0 auto 0;height:3px;background:linear-gradient(90deg,var(--accent),transparent)}
  .card header{display:flex;gap:11px;align-items:flex-start}
  .ico{width:38px;height:38px;flex:0 0 38px;display:grid;place-items:center;border-radius:11px;font-size:19px;
    background:color-mix(in srgb,var(--accent) 16%,transparent);border:1px solid var(--line2)}
  .card h3{margin:0 0 4px;font-size:15.5px}
  .tag{font-size:10.5px;letter-spacing:.6px;text-transform:uppercase;color:var(--accent);border:1px solid var(--line);
    border-radius:99px;padding:1px 8px;margin-right:6px}
  .st{font-size:10.5px;color:var(--c);border:1px solid color-mix(in srgb,var(--c) 40%,transparent);border-radius:99px;padding:1px 8px}
  .card p{margin:0;color:var(--dim);font-size:13px}
  .branch{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;background:rgba(255,255,255,.035);
    border:1px solid var(--line);border-radius:10px;padding:6px 9px}
  .branch .here{color:var(--cyan);font-size:11px}
  code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px}
  .copy{margin-left:auto;background:rgba(255,255,255,.06);border:1px solid var(--line2);color:var(--text);border-radius:8px;
    padding:2px 7px;cursor:pointer;font-size:12px}
  .copy:hover{background:rgba(255,255,255,.12)}
  .acts{display:flex;align-items:center;gap:10px;margin-top:2px}
  .btn{display:inline-block;text-decoration:none;color:#04121c;font-weight:700;font-size:12.5px;padding:8px 14px;border-radius:10px;
    background:linear-gradient(135deg,var(--cyan),#7fe9ff)}
  .btn:hover{filter:brightness(1.08)}
  .run{color:var(--dim);font-size:11.5px}
  .howto{border:1px solid var(--line);background:var(--panel);border-radius:16px;padding:18px 20px}
  .howto h2{margin:0 0 10px;font-size:15px}
  .howto ol{margin:0 0 12px;padding-left:20px;color:var(--dim);font-size:13px}
  .howto li{margin-bottom:6px}
  .howto pre{margin:0;background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:10px;padding:11px 13px;overflow:auto;
    font-size:12px;color:#cfe6ff}
  .badge{display:inline-block;margin-left:8px;font-size:10.5px;color:var(--mag);border:1px solid color-mix(in srgb,var(--mag) 45%,transparent);
    border-radius:99px;padding:1px 8px}
  footer{margin-top:26px;text-align:center;color:#5d719a;font-size:11.5px}
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <span class="kicker">Arena.ai · repo hub</span>
    <h1>${esc(reg.hub.title)}</h1>
    <p class="sub">Repo này là kho chứa game &amp; dự án thử nghiệm. Quy ước: <b>1 dự án = 1 branch</b> — mỗi phiên Arena.ai tự sinh một branch
      <code>arena/&lt;id&gt;</code> làm "phòng làm việc" riêng cho dự án đó, nên các dự án không giẫm chân nhau.</p>
    <div class="stats">
      <div class="stat"><b>${reg.projects.length}</b> dự án</div>
      <div class="stat"><b>${new Set(reg.projects.map((p) => p.branch)).size}</b> branch</div>
      <div class="stat">branch hiện tại: <b>${esc(cur)}</b></div>
      <div class="stat">cập nhật: <b>${new Date().toISOString().slice(0, 10)}</b></div>
    </div>
  </header>

  <div class="grid">
${cards}
  </div>

  <section class="howto">
    <h2>Tạo dự án mới thế nào?<span class="badge">1 dự án = 1 branch</span></h2>
    <ol>
${reg.hub.howto.map((s) => '      <li>' + esc(s) + '</li>').join('\n')}
    </ol>
    <pre>npm run project:new -- "Game bắn máy bay" --type game   # tạo branch + khung dự án
npm run projects                                       # xem bảng dự án
npm run projects:check                                 # kiểm tra branch/entry có thật không
npm run hub                                            # sinh lại trang này</pre>
  </section>

  <footer>Sinh tự động từ <code>projects.json</code> · <code>npm run hub</code> · ${esc(reg.hub.note)}</footer>
</div>
<script>
  document.querySelectorAll('.copy').forEach((b) => {
    b.addEventListener('click', async () => {
      const text = b.dataset.branch;
      try { await navigator.clipboard.writeText(text); b.textContent = '✓'; }
      catch { window.prompt('Tên branch:', text); }
      setTimeout(() => (b.textContent = '⧉'), 1200);
    });
  });
</script>
</body>
</html>
`;
  const out = join(ROOT, 'projects.html');
  writeFileSync(out, html);
  console.log(`✅ Đã sinh ${out} (${reg.projects.length} dự án)`);
}

/* ------------------------------ dispatch -------------------------------- */
switch (cmd) {
  case 'list': list(); break;
  case 'check': process.exitCode = check() ? 1 : 0; break;
  case 'hub': hub(); break;
  case 'new': createNew(); break;
  default:
    console.log(readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\n/, ''));
    process.exitCode = 1;
}
