/**
 * Chay lan luot moi bo kiem thu tren trinh duyet va tong ket lai.
 *
 * Tung bo chay trong mot tien trinh rieng, vi chung deu mo trinh duyet that
 * va deu goi den may chu that; chay chung trong cung mot tien trinh thi mot
 * bo chet se keo theo ca luot.
 *
 * Can may chu API va may chu web dang chay.
 * Chay: node tools/run-ui-tests.js
 *       node tools/run-ui-tests.js admin photo   (chi chay bo co ten khop)
 */
const { spawn } = require('child_process');
const path = require('path');

const SUITES = [
  { name: 'auth', file: 'test-auth-ui.js' },
  { name: 'roles', file: 'test-roles-ui.js' },
  { name: 'theme', file: 'test-theme-ui.js' },
  { name: 'pets', file: 'test-pets-ui.js' },
  { name: 'photo-edit', file: 'test-photo-edit.js' },
  { name: 'diary', file: 'test-diary-ui.js' },
  { name: 'diary-book', file: 'test-diary-book-ui.js' },
  { name: 'restore', file: 'test-restore-ui.js' },
  { name: 'restore-ai', file: 'test-restore-ai-ui.js' },
  { name: 'restore-quota', file: 'test-restore-quota-ui.js' },
  { name: 'studio', file: 'test-studio-ui.js' },
  { name: 'studio-full', file: 'test-studio-full-ui.js' },
  { name: 'shopping', file: 'test-shopping-ui.js' },
  { name: 'checkout', file: 'test-checkout-ui.js' },
  { name: 'packaging', file: 'test-packaging-ui.js' },
  { name: 'goods', file: 'test-goods-ui.js' },
  { name: 'goods-flow', file: 'test-goods-flow-ui.js' },
  { name: 'community', file: 'test-community-ui.js' },
  { name: 'assistant', file: 'test-assistant-ui.js' },
  { name: 'admin', file: 'test-admin-ui.js' },
  { name: 'reports', file: 'test-reports-ui.js' },
  { name: 'ai', file: 'test-ai-ui.js' },
  { name: 'mobile', file: 'test-mobile-ui.js' },
];

/** Chay mot bo va tra ve ma ket thuc cua no. */
function runOne(file) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, file)], {
      stdio: 'inherit',
    });
    child.on('close', (code) => resolve(code ?? 1));
  });
}

async function run() {
  const asked = process.argv.slice(2).map((one) => one.toLowerCase());
  const chosen =
    asked.length === 0
      ? SUITES
      : SUITES.filter((one) => asked.some((word) => one.name.includes(word)));

  if (chosen.length === 0) {
    console.log('Khong co bo kiem thu nao khop voi ten da nhap.');
    process.exit(1);
  }

  const result = [];
  for (const suite of chosen) {
    console.log('');
    console.log('#'.repeat(70));
    console.log(`# ${suite.name}`);
    console.log('#'.repeat(70));
    result.push({ name: suite.name, code: await runOne(suite.file) });
  }

  console.log('');
  console.log('='.repeat(70));
  console.log('TONG KET KIEM THU GIAO DIEN');
  console.log('='.repeat(70));
  for (const one of result) {
    console.log(`  ${(one.code === 0 ? 'PASS' : 'FAIL').padEnd(6)} ${one.name}`);
  }
  const broken = result.filter((one) => one.code !== 0).length;
  console.log('-'.repeat(70));
  console.log(broken === 0 ? `CA ${result.length} BO DEU PASS` : `${broken} BO HONG`);
  process.exit(broken === 0 ? 0 : 1);
}

run().catch((trouble) => {
  console.error('Khong chay duoc:', trouble.message);
  process.exit(1);
});
