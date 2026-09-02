#!/usr/bin/env node
// i18n foundation (L1) — conservative hard-coded user-facing-string
// detector, per the L1 spec's §J requirement.
//
// STRATEGY: baseline existing violations, fail only on NEW ones.
//
// This repo has substantial existing English-string technical debt
// (confirmed by the L0 audit: ~250-300 files, hundreds of Alert.alert/JSX-
// text/placeholder/accessibilityLabel literals) that predates the i18n
// foundation and is explicitly out of scope to fix in L1 ("do not attempt
// an enormous cleanup of all existing violations"). A detector that failed
// on the whole repo today would be immediately disabled/ignored by
// necessity, which defeats its purpose. Instead: scripts/hardcoded-
// strings-baseline.json records every violation this detector finds RIGHT
// NOW; every future run only fails on violations NOT already in that
// baseline. The baseline only shrinks as screens migrate to i18n (each
// migrated string's baseline entry becomes a genuine new-violation trigger
// if it's ever hardcoded again) or grows via a deliberate, reviewed
// `--update-baseline` run -- never silently/automatically.
//
// No ESLint dependency added (this repo has no ESLint config today, and
// bootstrapping one is a bigger, unrelated change) -- a plain regex-based
// line scan is intentionally simple, dependency-free, and conservative
// rather than a full AST parse. It WILL have both false positives (a
// literal that's actually fine, e.g. "SANAA" a brand name) and false
// negatives (multi-line JSX text, complex expressions) -- acceptable for a
// first version per the L1 spec; the baseline mechanism means false
// positives already in the baseline cost nothing, they just don't newly fail.

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');
const BASELINE_PATH = path.join(__dirname, 'hardcoded-strings-baseline.json');
const UPDATE_BASELINE = process.argv.includes('--update-baseline');

const IGNORED_DIRS = new Set(['node_modules', '.expo', 'android', 'ios']);

// Each pattern captures the literal text as group 1, for use only in the
// violation id/message -- files are still analyzed line by line so a
// human reading a failure can jump straight to it.
const PATTERNS = [
  { name: 'jsx-text', regex: /<Text\b[^>]*>\s*([A-Za-z][^<>{}\n]*?[a-zA-Z])\s*<\/Text>/g },
  { name: 'placeholder', regex: /\bplaceholder="([^"{}]+)"/g },
  { name: 'title-attr', regex: /\btitle="([^"{}]+)"/g },
  { name: 'accessibility-label', regex: /\baccessibilityLabel="([^"{}]+)"/g },
  { name: 'alert-alert', regex: /Alert\.alert\(\s*(['"])([^'"]+)\1/g },
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      files.push(full);
    }
  }
  return files;
}

function findViolations() {
  const violations = [];
  const files = walk(SRC_DIR);

  for (const filePath of files) {
    const relPath = path.relative(path.join(__dirname, '..'), filePath).replace(/\\/g, '/');
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      for (const { name, regex } of PATTERNS) {
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(line)) !== null) {
          const literal = (match[2] ?? match[1] ?? '').trim();
          if (!literal || !/[a-zA-Z]{2,}/.test(literal)) continue; // skip empty/symbol-only matches
          violations.push({
            id: `${relPath}:${lineIndex + 1}:${name}:${literal}`,
            file: relPath,
            line: lineIndex + 1,
            pattern: name,
            text: literal,
          });
        }
      }
    }
  }

  return violations;
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return new Set();
  const data = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  return new Set(data.violationIds || []);
}

function saveBaseline(violations) {
  const violationIds = violations.map(v => v.id).sort();
  fs.writeFileSync(
    BASELINE_PATH,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      count: violationIds.length,
      note: 'Existing hard-coded user-facing strings as of the L1 i18n foundation. Regenerate deliberately with `node scripts/check-hardcoded-strings.js --update-baseline` only when reviewing a real change (e.g. after migrating a screen, this should shrink). Never regenerate just to silence a failing check.',
      violationIds,
    }, null, 2) + '\n'
  );
}

function main() {
  const current = findViolations();

  if (UPDATE_BASELINE) {
    saveBaseline(current);
    console.log(`Baseline updated: ${current.length} known existing violation(s) recorded to scripts/hardcoded-strings-baseline.json.`);
    process.exit(0);
  }

  const baseline = loadBaseline();
  const currentIds = new Set(current.map(v => v.id));
  const newViolations = current.filter(v => !baseline.has(v.id));
  const resolvedCount = [...baseline].filter(id => !currentIds.has(id)).length;

  if (newViolations.length > 0) {
    console.error(`\nHard-coded-string check FAILED -- ${newViolations.length} NEW violation(s) not in the baseline:\n`);
    newViolations.forEach(v => console.error(`  ✗ ${v.file}:${v.line} [${v.pattern}] "${v.text}"`));
    console.error(
      '\nIf this is genuinely new user-facing copy, move it into a locales/<lang>/*.json resource and use t() instead. ' +
      'If you believe this is a false positive, review it before adding to the baseline -- ' +
      'run `node scripts/check-hardcoded-strings.js --update-baseline` only after that review.\n'
    );
    process.exit(1);
  }

  console.log(
    `Hard-coded-string check passed -- ${current.length} known baseline violation(s), 0 new` +
    (resolvedCount > 0 ? ` (${resolvedCount} resolved since the baseline was last updated -- consider running --update-baseline to shrink it)` : '') + '.'
  );
  process.exit(0);
}

main();
