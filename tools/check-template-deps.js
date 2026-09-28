/**
 * Checks the directives used in a template against the component's imports.
 *
 * Angular reports no error when a template binds an event that the component has not
 * declared the matching module for: the compiler treats it as an ordinary browser event
 * and it simply never fires. The failure is silent, so it has to be scanned for.
 *
 * Run: node tools/check-template-deps.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'apps', 'web');
const SOURCE = path.join(ROOT, 'src');

/** One rule: seeing this marker in a template requires one of these modules. */
const RULES = [
  {
    name: 'ngSubmit',
    pattern: /\(ngSubmit\)/,
    requiresOneOf: ['FormsModule', 'ReactiveFormsModule'],
  },
  {
    name: 'ngModel',
    pattern: /\[?\(?ngModel\)?\]?\s*=/,
    requiresOneOf: ['FormsModule'],
  },
  {
    name: 'formGroup',
    pattern: /\[formGroup\]|formControlName\s*=/,
    requiresOneOf: ['ReactiveFormsModule'],
  },
  {
    name: 'routerLink',
    pattern: /\[?routerLink\]?\s*=/,
    requiresOneOf: ['RouterLink', 'RouterModule'],
  },
  {
    name: 'translate pipe',
    pattern: /\|\s*translate/,
    requiresOneOf: ['TranslatePipe', 'TranslateModule'],
  },
  {
    name: 'date pipe',
    pattern: /\|\s*date\s*[:}]/,
    requiresOneOf: ['DatePipe', 'CommonModule'],
  },
  {
    name: 'amount pipe',
    pattern: /\|\s*amount/,
    requiresOneOf: ['MoneyPipe'],
  },
  {
    name: 'mat-spinner',
    pattern: /<mat-spinner/,
    requiresOneOf: ['MatProgressSpinnerModule'],
  },
  {
    name: 'mat-checkbox',
    pattern: /<mat-checkbox/,
    requiresOneOf: ['MatCheckboxModule'],
  },
  {
    name: 'cdkTrapFocus',
    pattern: /cdkTrapFocus/,
    requiresOneOf: ['A11yModule', 'CdkTrapFocus'],
  },
];

function walkFiles(dir, suffix, result = []) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      walkFiles(full, suffix, result);
    } else if (item.name.endsWith(suffix)) {
      result.push(full);
    }
  }
  return result;
}

/** Reads the list of imports from the component's decorator. */
function readImports(source) {
  const match = source.match(/imports:\s*\[([\s\S]*?)\]/);
  if (!match) {
    return [];
  }
  return match[1]
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

function run() {
  const tsFiles = walkFiles(SOURCE, '.ts');
  let checkCount = 0;
  let bad = 0;

  for (const tsFile of tsFiles) {
    const source = fs.readFileSync(tsFile, 'utf8');
    const urlMatch = source.match(/templateUrl:\s*'([^']+)'/);
    if (!urlMatch) {
      continue;
    }
    const htmlFile = path.resolve(path.dirname(tsFile), urlMatch[1]);
    if (!fs.existsSync(htmlFile)) {
      console.log(`  FAIL   missing template ${urlMatch[1]}  for ${path.relative(ROOT, tsFile)}`);
      bad += 1;
      continue;
    }

    const html = fs.readFileSync(htmlFile, 'utf8');
    const declared = readImports(source);

    for (const rule of RULES) {
      if (!rule.pattern.test(html)) {
        continue;
      }
      checkCount += 1;
      if (!rule.requiresOneOf.some((m) => declared.includes(m))) {
        console.log(
          `  FAIL   ${path.relative(ROOT, htmlFile)} uses "${rule.name}" ` +
            `but ${path.basename(tsFile)} does not declare ${rule.requiresOneOf.join(' or ')}`,
        );
        bad += 1;
      }
    }
  }

  console.log('='.repeat(72));
  console.log(
    bad === 0
      ? `ALL ${checkCount} TEMPLATE DEPENDENCIES HAVE THEIR MODULE DECLARED`
      : `${bad}/${checkCount} TEMPLATE DEPENDENCIES ARE MISSING A MODULE`,
  );
  process.exit(bad === 0 ? 0 : 1);
}

run();
