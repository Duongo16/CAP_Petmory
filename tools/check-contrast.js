/**
 * Kiem do tuong phan giua chu va nen cua bang mau giao dien.
 *
 * Hop dong thiet ke giao dien doi ca che do sang lan che do toi deu doc duoc
 * va khong co chu trung mau nen. Bai kiem nay doc thang cac bien mau trong tep
 * kieu dang chung roi do tung cap chu tren nen theo cong thuc cua chuan noi
 * dung web, nen khong phu thuoc vao viec nhin bang mat.
 *
 * Nguong: chu thuong phai dat 4.5, chu to va vien phai dat 3.
 *
 * Chay: node tools/check-contrast.js
 */
const fs = require('fs');
const path = require('path');

const SHEET = path.join(__dirname, '..', 'apps', 'web', 'src', 'styles.scss');

/** Nguong cho chu thuong. */
const NEED_TEXT = 4.5;

/** Nguong cho vien cua o nhap lieu va cac thanh phan bam duoc. */
const NEED_CONTROL = 3;

/**
 * Nguong cho duong ke giua hai mat phang.
 *
 * Duong ke cua mot the chi de tach mat phang chu khong phai thu duy nhat cho
 * biet co mot o bam duoc o day, nen no khong bi doi muc ba nhu vien o nhap
 * lieu. Muc nay chi doi duong ke nhin thay duoc.
 */
const NEED_EDGE = 1.4;

let failed = 0;
let passed = 0;

/** Doc mot ma mau sau chu sang ba so. */
function asRgb(hex) {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.slice(0, 6);
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** Do sang tuong doi theo chuan noi dung web. */
function luminance(hex) {
  const part = asRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * part[0] + 0.7152 * part[1] + 0.0722 * part[2];
}

/** Ti so tuong phan giua hai mau. */
function ratio(front, back) {
  const a = luminance(front);
  const b = luminance(back);
  const high = Math.max(a, b);
  const low = Math.min(a, b);
  return (high + 0.05) / (low + 0.05);
}

/**
 * Doc cac bien mau trong mot khoi.
 *
 * Doc thang tu tep kieu dang chung de bai kiem khong bao gio le pha voi thu
 * dang that su chay tren trinh duyet.
 */
function readTokens(text, from, to) {
  const part = text.slice(from, to);
  const out = {};
  const rule = /--(pm-[a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g;
  let hit = rule.exec(part);
  while (hit) {
    out[hit[1]] = hit[2];
    hit = rule.exec(part);
  }
  return out;
}

function check(name, front, back, need, tokens) {
  const a = tokens[front];
  const b = tokens[back];
  if (!a || !b) {
    failed += 1;
    console.log(`  FAIL  ${name}  thieu bien ${!a ? front : back}`);
    return;
  }
  const got = ratio(a, b);
  const good = got >= need;
  if (good) {
    passed += 1;
  } else {
    failed += 1;
  }
  console.log(
    `  ${good ? 'PASS  ' : 'FAIL  '}${name.padEnd(46)}${got.toFixed(2)} / ${need}  ${a} tren ${b}`,
  );
}

/** Cac cap chu tren nen that su xuat hien tren giao dien. */
function checkAll(label, tokens) {
  console.log('');
  console.log(label);
  console.log('-'.repeat(78));

  check('Chu chinh tren nen trang', 'pm-text', 'pm-bg', NEED_TEXT, tokens);
  check('Chu chinh tren the', 'pm-text', 'pm-bg-card', NEED_TEXT, tokens);
  check('Chu than bai tren nen trang', 'pm-text-body', 'pm-bg', NEED_TEXT, tokens);
  check('Chu than bai tren the', 'pm-text-body', 'pm-bg-card', NEED_TEXT, tokens);
  check('Chu mo tren nen trang', 'pm-text-muted', 'pm-bg', NEED_TEXT, tokens);
  check('Chu mo tren the', 'pm-text-muted', 'pm-bg-card', NEED_TEXT, tokens);
  check('Chu mo tren nen chim', 'pm-text-muted', 'pm-bg-sunken', NEED_TEXT, tokens);

  check('Mau nhan lam chu tren nen trang', 'pm-accent', 'pm-bg', NEED_TEXT, tokens);
  check('Mau nhan lam chu tren the', 'pm-accent', 'pm-bg-card', NEED_TEXT, tokens);
  check('Mau nhan lam chu tren nen mo', 'pm-accent', 'pm-bg-muted', NEED_TEXT, tokens);
  check('Chu tren nut mau nhan', 'pm-on-accent', 'pm-accent', NEED_TEXT, tokens);
  check('Chu tren nut mau nhan dam', 'pm-on-accent', 'pm-accent-dark', NEED_TEXT, tokens);
  check('Mau nhan tren nen nhan nhat', 'pm-accent', 'pm-accent-soft', NEED_TEXT, tokens);
  check('Mau nhan dam lam chu tren nen trang', 'pm-accent-dark', 'pm-bg', NEED_TEXT, tokens);

  check('Chu bao loi tren nen trang', 'pm-danger', 'pm-bg', NEED_TEXT, tokens);
  check('Chu bao loi tren nen bao loi', 'pm-on-danger-soft', 'pm-danger-soft', NEED_TEXT, tokens);
  check('Chu bao tot tren nen trang', 'pm-success', 'pm-bg', NEED_TEXT, tokens);
  check('Chu bao tot tren nen bao tot', 'pm-on-success-soft', 'pm-success-soft', NEED_TEXT, tokens);
  check('Chu tren nen mau ho phach', 'pm-on-amber', 'pm-amber-soft', NEED_TEXT, tokens);
  check('Mau ho phach lam chu tren nen trang', 'pm-amber', 'pm-bg', NEED_TEXT, tokens);
  check('Mau tuong nho lam chu tren nen trang', 'pm-memorial', 'pm-bg', NEED_TEXT, tokens);

  check('Chu tren giay mau kem', 'pm-ink', 'pm-paper-cream', NEED_TEXT, tokens);
  check('Chu tren giay mau bia', 'pm-ink', 'pm-paper-kraft', NEED_TEXT, tokens);

  check('Duong ke cua the tren nen trang', 'pm-border', 'pm-bg', NEED_EDGE, tokens);
  check('Vien o nhap lieu tren nen trang', 'pm-border-strong', 'pm-bg', NEED_CONTROL, tokens);
  check('Vien o nhap lieu tren the', 'pm-border-strong', 'pm-bg-card', NEED_CONTROL, tokens);
}

function run() {
  const text = fs.readFileSync(SHEET, 'utf8');

  const lightAt = text.indexOf(':root {');
  const darkAt = text.indexOf('@mixin pm-dark-tokens');
  const darkEnd = text.indexOf(":root[data-theme='dark']");
  if (lightAt < 0 || darkAt < 0) {
    console.error('Khong tim thay khoi bien mau trong tep kieu dang chung.');
    process.exit(1);
  }

  const light = readTokens(text, lightAt, darkAt);
  /* Che do toi chi khai lai mot phan, phan con lai lay tiep tu che do sang. */
  const dark = { ...light, ...readTokens(text, darkAt, darkEnd) };

  console.log('DO TUONG PHAN CUA BANG MAU GIAO DIEN');
  console.log('='.repeat(78));
  checkAll('CHE DO SANG', light);
  checkAll('CHE DO TOI', dark);

  console.log('');
  console.log('='.repeat(78));
  console.log(failed === 0 ? `CA ${passed} CAP DEU DAT` : `${failed} CAP CHUA DAT, ${passed} CAP DAT`);
  process.exit(failed === 0 ? 0 : 1);
}

run();
