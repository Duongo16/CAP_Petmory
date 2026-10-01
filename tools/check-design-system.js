/**
 * Soat do nhat quan cua he thong thiet ke tren toan bo tep kieu dang.
 *
 * Bai soat nay khong cham dep hay xau. No chi dem: mot thuoc tinh dang duoc
 * viet bang bao nhieu gia tri khac nhau, bao nhieu cho dung bien dung chung va
 * bao nhieu cho viet thang so do vao. Mot he thong thiet ke thong nhat thi so
 * gia tri khac nhau phai nho va ti le dung bien phai cao.
 *
 * Chay: node tools/check-design-system.js
 * Them --chi-tiet o cuoi de liet ke ca noi dung tung cho.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'apps', 'web', 'src');

/** Cac thuoc tinh duoc soat, kem cach doc gia tri. */
const WATCHED = [
  { name: 'bo goc', rule: /border-radius:\s*([^;\n]+);/g },
  { name: 'khoang dem trong', rule: /padding(?:-[a-z]+)?:\s*([^;\n]+);/g },
  { name: 'khoang cach ngoai', rule: /margin(?:-[a-z]+)?:\s*([^;\n]+);/g },
  { name: 'khe giua cac o', rule: /gap:\s*([^;\n]+);/g },
  { name: 'co chu', rule: /font-size:\s*([^;\n]+);/g },
  { name: 'do bong', rule: /box-shadow:\s*([^;\n]+);/g },
  { name: 'be rong toi da', rule: /max-width:\s*([^;\n]+);/g },
];

/** Cac moc be rong man hinh, doc rieng vi day la xuong song cua phan da man hinh. */
const BREAKPOINT = /@media[^{]*?(\d+)px/g;

let detailed = process.argv.includes('--chi-tiet');

/** Liet ke moi tep kieu dang, tru tep bien dung chung. */
function sheets(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      sheets(full, out);
    } else if (name.endsWith('.scss') && name !== 'styles.scss') {
      out.push(full);
    }
  }
  return out;
}

/** Gia tri co di qua bien dung chung khong. */
function usesToken(value) {
  return value.includes('var(--pm-');
}

/**
 * Gia tri co dang mot con so do bang tay khong.
 *
 * Cac so khong, mot phan tram va cac tu khoa nhu auto khong tinh, vi chung
 * khong phai lua chon ve hinh khoi ma chi la cach viet.
 */
function isRawNumber(value) {
  const clean = value.trim();
  if (clean === '0' || clean === 'auto' || clean === 'inherit' || clean === 'none') {
    return false;
  }
  return /\d/.test(clean) && !usesToken(clean);
}

function run() {
  const files = sheets(path.join(ROOT, 'app'));
  console.log('SOAT DO NHAT QUAN CUA HE THONG THIET KE');
  console.log('='.repeat(72));
  console.log(`${files.length} tep kieu dang`);
  console.log('');

  for (const watch of WATCHED) {
    const seen = new Map();
    let token = 0;
    let raw = 0;
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      watch.rule.lastIndex = 0;
      let hit = watch.rule.exec(text);
      while (hit) {
        const value = hit[1].trim();
        if (usesToken(value)) {
          token += 1;
        } else if (isRawNumber(value)) {
          raw += 1;
          const already = seen.get(value) ?? { count: 0, where: new Set() };
          already.count += 1;
          already.where.add(path.basename(file));
          seen.set(value, already);
        }
        hit = watch.rule.exec(text);
      }
    }

    const total = token + raw;
    const share = total === 0 ? 0 : Math.round((token / total) * 100);
    console.log(
      `${watch.name.padEnd(22)} ${String(seen.size).padStart(3)} gia tri tu viet  ·  ` +
        `${String(token).padStart(3)}/${total} cho dung bien (${share}%)`,
    );
    if (detailed && seen.size > 0) {
      const top = [...seen].sort((a, b) => b[1].count - a[1].count).slice(0, 12);
      for (const [value, info] of top) {
        console.log(`      ${String(info.count).padStart(3)} lan  ${value}`);
      }
    }
  }

  // --- cac moc be rong man hinh ---
  const stops = new Map();
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    BREAKPOINT.lastIndex = 0;
    let hit = BREAKPOINT.exec(text);
    while (hit) {
      const px = Number(hit[1]);
      const already = stops.get(px) ?? new Set();
      already.add(path.basename(file));
      stops.set(px, already);
      hit = BREAKPOINT.exec(text);
    }
  }
  console.log('');
  console.log('MOC BE RONG MAN HINH');
  console.log('-'.repeat(72));
  console.log(`${stops.size} moc khac nhau:`);
  for (const [px, where] of [...stops].sort((a, b) => a[0] - b[0])) {
    console.log(`  ${String(px).padStart(4)}px  dung o ${where.size} tep`);
  }

  console.log('');
  console.log('Chay lai kem --chi-tiet de xem tung gia tri cu the.');
}

run();
