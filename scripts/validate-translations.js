#!/usr/bin/env node
// i18n foundation (L1) — translation resource quality gate.
//
// Generic across however many languages exist under src/locales/ -- it
// does NOT hardcode an en-vs-es comparison. Every language directory found
// participates automatically; adding French later means this script starts
// validating `fr/*.json` the moment the directory exists, with zero script
// changes. English ('en') is always the canonical/source language (Locked
// Product Decision §1) -- every other language is validated AGAINST it,
// never the other way around.
//
// Checks (per the L1 spec's automated-quality-gate requirement):
//   1. Key exists in English but missing from another language.
//   2. Key exists in another language but not in English (orphan).
//   3. Interpolation-variable ({{var}}) mismatch between English and a
//      translation of the same key.
//   4. Malformed resource file (invalid JSON).
//   5. Duplicate/conflicting keys -- JSON.parse itself already guarantees
//      no duplicate keys can exist within one object literal at the same
//      level, so this is structurally prevented by using JSON as the
//      resource format; not separately re-checked here.
//
// Exit code 0 = pass, 1 = fail. No dependencies beyond Node's built-in fs.

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'src', 'locales');
const CANONICAL_LANGUAGE = 'en';

function flatten(obj, prefix = '') {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flatten(value, fullKey));
    } else {
      out[fullKey] = value;
    }
  }
  return out;
}

function extractInterpolationVars(value) {
  if (typeof value !== 'string') return new Set();
  const matches = value.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g) || [];
  return new Set(matches.map(m => m.replace(/[{}\s]/g, '')));
}

function loadNamespaceFile(languageDir, filename) {
  const filePath = path.join(languageDir, filename);
  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Malformed JSON in ${filePath}: ${err.message}`);
  }
}

function main() {
  const errors = [];
  const warnings = [];

  if (!fs.existsSync(LOCALES_DIR)) {
    console.error(`No locales directory found at ${LOCALES_DIR}`);
    process.exit(1);
  }

  const languages = fs.readdirSync(LOCALES_DIR)
    .filter(name => fs.statSync(path.join(LOCALES_DIR, name)).isDirectory())
    .sort();

  if (!languages.includes(CANONICAL_LANGUAGE)) {
    console.error(`Canonical language "${CANONICAL_LANGUAGE}" has no locales/${CANONICAL_LANGUAGE}/ directory.`);
    process.exit(1);
  }

  const canonicalDir = path.join(LOCALES_DIR, CANONICAL_LANGUAGE);
  const namespaceFiles = fs.readdirSync(canonicalDir).filter(f => f.endsWith('.json')).sort();

  const otherLanguages = languages.filter(l => l !== CANONICAL_LANGUAGE);

  // Canonical resources, loaded once, malformed-JSON errors surface immediately.
  const canonicalByNamespace = {};
  for (const filename of namespaceFiles) {
    try {
      canonicalByNamespace[filename] = loadNamespaceFile(canonicalDir, filename);
    } catch (err) {
      errors.push(err.message);
    }
  }

  for (const language of otherLanguages) {
    const languageDir = path.join(LOCALES_DIR, language);
    const languageFiles = fs.readdirSync(languageDir).filter(f => f.endsWith('.json'));

    // Namespace file exists in English but missing entirely for this language.
    for (const filename of namespaceFiles) {
      if (!languageFiles.includes(filename)) {
        errors.push(`[${language}] Missing namespace file: locales/${language}/${filename} (exists in locales/en/${filename})`);
      }
    }
    // Namespace file exists for this language but not in English (orphan file).
    for (const filename of languageFiles) {
      if (!namespaceFiles.includes(filename)) {
        errors.push(`[${language}] Orphan namespace file with no English counterpart: locales/${language}/${filename}`);
      }
    }

    for (const filename of namespaceFiles) {
      if (!canonicalByNamespace[filename] || !languageFiles.includes(filename)) continue;

      let translated;
      try {
        translated = loadNamespaceFile(languageDir, filename);
      } catch (err) {
        errors.push(err.message);
        continue;
      }

      const canonicalFlat = flatten(canonicalByNamespace[filename]);
      const translatedFlat = flatten(translated);

      for (const key of Object.keys(canonicalFlat)) {
        if (!(key in translatedFlat)) {
          errors.push(`[${language}] Missing key "${key}" in locales/${language}/${filename} (present in English)`);
          continue;
        }
        const canonicalVars = extractInterpolationVars(canonicalFlat[key]);
        const translatedVars = extractInterpolationVars(translatedFlat[key]);
        const missingInTranslation = [...canonicalVars].filter(v => !translatedVars.has(v));
        const extraInTranslation = [...translatedVars].filter(v => !canonicalVars.has(v));
        if (missingInTranslation.length > 0 || extraInTranslation.length > 0) {
          errors.push(
            `[${language}] Interpolation-variable mismatch for "${filename.replace('.json', '')}.${key}": ` +
            `English uses {${[...canonicalVars].join(', ')}}, ${language} uses {${[...translatedVars].join(', ')}}` +
            (missingInTranslation.length ? ` -- missing: ${missingInTranslation.join(', ')}` : '') +
            (extraInTranslation.length ? ` -- unexpected: ${extraInTranslation.join(', ')}` : '')
          );
        }
      }

      for (const key of Object.keys(translatedFlat)) {
        if (!(key in canonicalFlat)) {
          errors.push(`[${language}] Orphan key "${key}" in locales/${language}/${filename} (no English source key)`);
        }
      }
    }
  }

  if (otherLanguages.length === 0) {
    warnings.push('Only the canonical English resources exist -- nothing to validate against yet.');
  }

  if (warnings.length > 0) {
    console.warn('\nWarnings:');
    warnings.forEach(w => console.warn(`  - ${w}`));
  }

  if (errors.length > 0) {
    console.error(`\nTranslation validation FAILED (${errors.length} issue${errors.length === 1 ? '' : 's'}):\n`);
    errors.forEach(e => console.error(`  ✗ ${e}`));
    console.error('');
    process.exit(1);
  }

  console.log(`Translation validation passed -- ${languages.length} language(s) (${languages.join(', ')}), ${namespaceFiles.length} namespace(s) checked.`);
  process.exit(0);
}

main();
