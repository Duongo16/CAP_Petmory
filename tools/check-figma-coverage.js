/**
 * Tracks how far the interface has been brought in line with the design file.
 *
 * The frame list is read from the design file itself rather than copied out, so
 * a frame added or renamed there shows up here as soon as this is run, instead
 * of the table quietly going stale.
 *
 * Three states are reported per frame:
 *   DONE     the screen was rebuilt against the design, layout and all
 *   TOKENS   the screen picks up the colours, fonts and corners, but its
 *            layout is still the old one
 *   MISSING  there is no screen for this frame at all
 *
 * Run: node tools/check-figma-coverage.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/** Cuts a file into lines, whichever ending it uses. */
const SPLIT_LINES = new RegExp('\r?\n');

/**
 * What has actually been built for each frame.
 *
 * The state is recorded by hand because no machine can tell a faithful rebuild
 * from a screen that merely picked up the new colours. The route beside it is
 * checked against the routing table, so a wrong or removed route is caught.
 */
const PLAN = [
  { id: '1:2', route: 'today', state: 'DONE', note: 'Trang cua ngay, bo phan suc khoe' },
  { id: '1:213', route: 'pets/:id/journal', state: 'DONE', note: 'Quyen ky niem, chua co ghi am' },
  { id: '1:484', route: null, state: 'SKIPPED', note: 'Da thong nhat bo phan suc khoe' },
  { id: '1:760', route: 'pets/:id', state: 'DONE', note: 'Ho so mo rong, bo can nang va nhom mau' },

  { id: '1:1048', route: 'admin/orders/:orderCode', state: 'DONE', note: 'Co bon chang va lich su' },
  { id: '1:1439', route: 'admin/customers/:id', state: 'DONE', note: 'Co ba con so va muc chi tieu' },
  { id: '1:1862', route: 'admin/payment-log', state: 'DONE', note: 'Co tom tat, loc va phan trang' },
  { id: '1:2428', route: 'admin/settings', state: 'DONE', note: 'Nhom tham so co mo ta va so dem' },
  { id: '1:2818', route: 'admin/orders', state: 'DONE', note: 'Co thanh ben, o dem va cot san pham' },

  { id: '1:3600', route: 'checkout', state: 'DONE', note: 'Co thanh ba chang va tom tat don' },
  { id: '1:3876', route: 'payments/:orderCode', state: 'DONE', note: 'Trang thai da thanh toan' },
  { id: '1:4065', route: 'payments/:orderCode', state: 'DONE', note: 'Co dem nguoc va o sao chep' },
  { id: '1:4372', route: 'orders', state: 'DONE', note: 'Co loc theo trang thai va tien do xuong' },

  { id: '1:10179', route: 'community', state: 'DONE' },
  { id: '1:10743', route: 'community', state: 'DONE', note: 'Khung soan bai, toi da 5 anh' },
  { id: '1:11404', route: 'community/users/:id', state: 'DONE' },
  { id: '1:11844', route: 'community/posts/:id', state: 'DONE' },

  { id: '1:12296', route: 'pets/:id/photos', state: 'DONE', note: 'Thanh thu vien anh, bo luoi goc chup' },
  { id: '1:12698', route: 'pets/:id/photos', state: 'DONE', note: 'Cham diem anh tu du lieu that' },
  { id: '1:13182', route: 'restore', state: 'DONE', note: 'Man phuc hoi rieng, co thanh truot chia doi' },
  { id: '1:13440', route: 'pets/:id/photos', state: 'DONE', note: 'Bang tro ly ben canh album' },

  { id: '1:13864', route: 'home', state: 'DONE' },
  { id: '1:14410', route: 'products/:code', state: 'DONE' },
  { id: '1:14815', route: 'cart', state: 'DONE', note: 'Co bon buoc che tac va goi y mua kem' },
  { id: '1:15243', route: 'products', state: 'DONE' },

  { id: '1:38192', route: 'studio', state: 'DONE', note: 'Buoc phoi mau' },
  { id: '1:38642', route: 'studio', state: 'DONE', note: 'Buoc chon mau dang' },
  { id: '1:39082', route: 'studio', state: 'DONE', note: 'Buoc khac ten va dat hang' },
  { id: '1:39508', route: 'admin/orders/:orderCode/production-file', state: 'DONE', note: 'Co day lich xuong' },
];

/** Screens built from pictures sent outside the design file. */
const EXTRA = [
  { name: 'Petmory - Dang nhap', route: 'login', state: 'DONE' },
  { name: 'Petmory - Dang ky tai khoan', route: 'register', state: 'DONE' },
];

const MARK = {
  DONE: '[x]',
  TOKENS: '[~]',
  MISSING: '[ ]',
  SKIPPED: '[-]',
};

/**
 * Every path the routing table declares, written out in full.
 *
 * Routes nest: a screen inside a frame carries only the tail of its address,
 * and the head comes from the route it sits in. The reader keeps a stack of
 * those heads so what it reports is the address a browser would use.
 */
function routesDeclared() {
  const file = path.join(ROOT, 'apps', 'web', 'src', 'app', 'app.routes.ts');
  const lines = fs.readFileSync(file, 'utf8').split(SPLIT_LINES);
  const found = new Set();
  const stack = [];
  let depth = 0;
  let latest = '';

  for (const line of lines) {
    const hit = /path:\s*'([^']*)'/.exec(line);
    if (hit) {
      latest = hit[1];
      const head = stack.map((one) => one.head).filter(Boolean).join('/');
      found.add([head, latest].filter(Boolean).join('/'));
    }

    const nests = /children:\s*\[/.test(line);
    for (const letter of line) {
      if (letter === '[') {
        depth += 1;
      } else if (letter === ']') {
        depth -= 1;
        while (stack.length > 0 && stack[stack.length - 1].depth > depth) {
          stack.pop();
        }
      }
    }
    if (nests) {
      stack.push({ head: latest, depth });
    }
  }
  return found;
}

/** Reads the environment file without pulling in a library. */
function readEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) {
    return {};
  }
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      out[trimmed.slice(0, trimmed.indexOf('=')).trim()] = trimmed
        .slice(trimmed.indexOf('=') + 1)
        .trim();
    }
  }
  return out;
}

/** Where the last good frame list is kept, so a busy design service is survivable. */
const CACHE = path.join(ROOT, 'test-screenshots', 'figma-frames.json');

async function fetchFrames(env) {
  const answer = await fetch(
    `https://api.figma.com/v1/files/${env.FIGMA_FILE_KEY}?depth=2`,
    { headers: { 'X-Figma-Token': env.FIGMA_TOKEN } },
  );
  if (!answer.ok) {
    throw new Error(`Design file answered ${answer.status}`);
  }
  const file = await answer.json();
  const frames = [];
  for (const page of file.document.children) {
    for (const frame of page.children ?? []) {
      const box = frame.absoluteBoundingBox;
      frames.push({
        id: frame.id,
        name: frame.name,
        width: box ? Math.round(box.width) : 0,
        height: box ? Math.round(box.height) : 0,
      });
    }
  }
  return { name: file.name, changed: file.lastModified, frames };
}

/**
 * The frame list, from the design service when it answers and from the last
 * good copy when it does not. The design service limits how often it may be
 * asked, and a refusal there should not stop the tracking table being read.
 */
async function frameList(env) {
  try {
    const fresh = await fetchFrames(env);
    fs.mkdirSync(path.dirname(CACHE), { recursive: true });
    fs.writeFileSync(CACHE, JSON.stringify({ ...fresh, readAt: new Date().toISOString() }, null, 2));
    return { ...fresh, fromCache: false };
  } catch (trouble) {
    if (!fs.existsSync(CACHE)) {
      throw trouble;
    }
    const kept = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
    return { ...kept, fromCache: true, why: trouble.message };
  }
}

async function run() {
  const env = { ...readEnv(), ...process.env };
  if (!env.FIGMA_TOKEN || !env.FIGMA_FILE_KEY) {
    console.log('No design file credentials in .env, so nothing to compare against.');
    process.exit(1);
  }

  const design = await frameList(env);
  const routes = routesDeclared();
  const plan = new Map(PLAN.map((p) => [p.id, p]));

  console.log('DESIGN FILE COVERAGE');
  console.log('='.repeat(96));
  console.log(`  File     : ${design.name}`);
  console.log(`  Changed  : ${design.changed}`);
  console.log(`  Frames   : ${design.frames.length}`);
  if (design.fromCache) {
    console.log(`  Note     : read from the copy kept on ${design.readAt} (${design.why})`);
  }
  console.log('');
  console.log(`  ${'    '} ${'FRAME'.padEnd(46)} ${'SIZE'.padEnd(7)} ROUTE`);
  console.log('  ' + '-'.repeat(94));

  const tally = { DONE: 0, TOKENS: 0, MISSING: 0, SKIPPED: 0 };
  const problems = [];

  for (const frame of design.frames) {
    const row = plan.get(frame.id);
    if (!row) {
      problems.push(`Frame ${frame.id} "${frame.name}" is new and has no entry in the plan`);
      tally.MISSING += 1;
      console.log(`  ${MARK.MISSING} ${frame.name.slice(0, 46).padEnd(46)} ` +
        `${(frame.width + 'w').padEnd(7)} (chua xep)`);
      continue;
    }
    tally[row.state] += 1;
    if (row.route && !routes.has(row.route)) {
      problems.push(`Frame "${frame.name}" points at route "${row.route}", which is not declared`);
    }
    const tail = row.note ? `${row.route ?? '-'}  · ${row.note}` : (row.route ?? '-');
    console.log(`  ${MARK[row.state]} ${frame.name.slice(0, 46).padEnd(46)} ` +
      `${(frame.width + 'w').padEnd(7)} ${tail}`);
  }

  console.log('');
  console.log('  Built from pictures sent outside the design file');
  console.log('  ' + '-'.repeat(94));
  for (const row of EXTRA) {
    tally[row.state] += 1;
    if (!routes.has(row.route)) {
      problems.push(`"${row.name}" points at route "${row.route}", which is not declared`);
    }
    console.log(`  ${MARK[row.state]} ${row.name.padEnd(46)} ${''.padEnd(7)} ${row.route}`);
  }

  const total = tally.DONE + tally.TOKENS + tally.MISSING + tally.SKIPPED;
  const counted = total - tally.SKIPPED;

  console.log('');
  console.log('='.repeat(96));
  console.log(`  [x] rebuilt against the design   ${String(tally.DONE).padStart(3)}`);
  console.log(`  [~] colours only, layout is old  ${String(tally.TOKENS).padStart(3)}`);
  console.log(`  [ ] no screen yet                ${String(tally.MISSING).padStart(3)}`);
  console.log(`  [-] agreed to leave out          ${String(tally.SKIPPED).padStart(3)}`);
  console.log(`      ${'-'.repeat(30)}`);
  console.log(`      of ${counted} to do, ${tally.DONE} done ` +
    `(${Math.round((tally.DONE / counted) * 100)} per cent)`);

  if (problems.length > 0) {
    console.log('');
    console.log('  PROBLEMS');
    for (const line of problems) {
      console.log(`   - ${line}`);
    }
  }
  process.exitCode = problems.length === 0 ? 0 : 1;
}

run().catch((e) => {
  console.error('Coverage check failed:', e.message);
  process.exit(1);
});
