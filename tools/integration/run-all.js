/**
 * Runs every integration scenario in order and totals them up.
 *
 * These differ from the suites in tools/: each of those exercises one module,
 * while each of these follows a business journey across several modules and
 * checks the handovers between them. Both are needed, and both run against the
 * real API and the real database.
 *
 * Needs the API up. Run: node tools/integration/run-all.js
 */
const path = require('path');

const SCENARIOS = [
  './it-01-order-journey',
  './it-02-money-integrity',
  './it-03-state-machine',
  './it-04-double-processing',
  './it-05-ownership',
  './it-06-community-journey',
];

/** Tach noi dung tep thanh tung dong, chap ca kieu xuong dong cua Windows. */
const SPLIT_LINES = new RegExp(String.fromCharCode(13) + '?' + String.fromCharCode(10));

const API = process.env.PETMORY_API ?? 'http://localhost:3000/api';

/** Waits for the API to answer, so a cold start does not look like a failure. */
async function waitForApi() {
  for (let i = 0; i < 30; i += 1) {
    try {
      const res = await fetch(`${API}/catalog/products`);
      if (res.ok) {
        return true;
      }
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

/**
 * Warns when a run would write to the real picture service.
 *
 * These scenarios upload real photographs. Pointed at the picture service they
 * cost allowance and leave files behind that nothing will ever clean up, so a
 * run is meant to happen against the disk.
 */
function warnAboutPictureStore() {
  const fs = require('fs');
  const file = path.join(__dirname, '..', '..', '.env');
  if (!fs.existsSync(file)) {
    return;
  }
  const line = fs
    .readFileSync(file, 'utf8')
    .split(SPLIT_LINES)
    .find((l) => l.trim().startsWith('STORAGE_DRIVER='));
  const driver = line ? line.slice(line.indexOf('=') + 1).trim() : 'disk';
  if (driver === 'cloudinary') {
    console.log('');
    console.log('  NOTE  Pictures are set to go to the picture service, not the disk.');
    console.log('        Every run will upload real files there and they are never removed.');
    console.log('        Set STORAGE_DRIVER=disk in .env before a long series of runs.');
  }
}

async function run() {
  warnAboutPictureStore();
  if (!(await waitForApi())) {
    console.log(`The API did not answer at ${API}. Start it first.`);
    process.exit(1);
  }

  const { runScenario } = require('./harness');
  const results = [];

  for (const file of SCENARIOS) {
    const mod = require(path.join(__dirname, file));
    console.log('');
    const report = await runScenario(mod.name.toUpperCase(), mod.scenario);
    results.push({ name: mod.name, report });
  }

  const passed = results.reduce((sum, r) => sum + r.report.passed, 0);
  const failed = results.reduce((sum, r) => sum + r.report.failed, 0);

  console.log('');
  console.log('='.repeat(70));
  console.log('INTEGRATION SUMMARY');
  console.log('='.repeat(70));
  for (const { name, report } of results) {
    const total = report.passed + report.failed;
    const state = report.failed === 0 ? 'PASS' : `FAIL ${report.failed}`;
    console.log(`  ${state.padEnd(8)} ${name.padEnd(28)} ${total} checks`);
  }
  console.log('-'.repeat(70));
  console.log(
    failed === 0
      ? `ALL ${passed} INTEGRATION CHECKS PASSED`
      : `${failed}/${passed + failed} INTEGRATION CHECKS FAILED`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error('Integration run failed:', e.message);
  process.exit(1);
});
