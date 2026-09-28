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

async function run() {
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
