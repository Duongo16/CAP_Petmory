/**
 * Checks every translation key used in the source against the two language files.
 * Reports both missing keys and keys present in a file that nothing refers to.
 * Run: node tools/check-i18n-keys.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'apps', 'web');
const SOURCE = path.join(ROOT, 'src');
const TRANSLATION_FILES = ['vi', 'en'].map((code) => ({
  code,
  path: path.join(ROOT, 'public', 'i18n', `${code}.json`),
}));

/** A valid key: at least two uppercase segments joined by dots. */
const KEY_PATTERN = /^[A-Z][A-Z0-9_]*(\.[A-Z][A-Z0-9_]*)+$/;

function walkFiles(dir, result = []) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      walkFiles(full, result);
    } else if (/\.(ts|html)$/.test(item.name)) {
      result.push(full);
    }
  }
  return result;
}

function flatten(object, prefix = '', out = new Set()) {
  for (const [key, value] of Object.entries(object)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') {
      flatten(value, full, out);
    } else {
      out.add(full);
    }
  }
  return out;
}

/** Picks up every quoted string shaped like a translation key. */
function collectKeys(content) {
  const out = new Set();
  const pattern = /['"`]([A-Z][A-Z0-9_]*(?:\.[A-Z][A-Z0-9_]*)+)['"`]/g;
  let match = pattern.exec(content);
  while (match !== null) {
    if (KEY_PATTERN.test(match[1])) {
      out.add(match[1]);
    }
    match = pattern.exec(content);
  }
  return out;
}

function run() {
  const sourceFiles = walkFiles(SOURCE);
  const used = new Map();
  for (const file of sourceFiles) {
    for (const key of collectKeys(fs.readFileSync(file, 'utf8'))) {
      if (!used.has(key)) {
        used.set(key, path.relative(ROOT, file));
      }
    }
  }

  let bad = 0;
  const usedKeys = new Set(used.keys());

  for (const { code, path: filePath } of TRANSLATION_FILES) {
    const declared = flatten(JSON.parse(fs.readFileSync(filePath, 'utf8')));
    const missing = [...used.keys()].filter((k) => !declared.has(k));
    const extra = [...declared].filter((k) => !usedKeys.has(k));

    console.log(`\n${code}.json  —  ${declared.size} keys`);
    if (missing.length === 0) {
      console.log('  PASS   no key is missing');
    } else {
      bad += missing.length;
      for (const k of missing) {
        console.log(`  FAIL   missing "${k}"  used in ${used.get(k)}`);
      }
    }
    if (extra.length > 0) {
      console.log(`  NOTE   ${extra.length} keys nothing refers to: ${extra.slice(0, 8).join(', ')}`);
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log(bad === 0 ? `ALL ${used.size} KEYS HAVE A TRANSLATION` : `${bad} KEYS ARE MISSING`);
  process.exit(bad === 0 ? 0 : 1);
}

run();
