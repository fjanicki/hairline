// Write translation skeletons: src/story/text/<code>/{common,ch1..ch5}.js with the exact shape of the
// English files, every text leaf set to '⟦EN⟧ ' + the English (game data and character names copied
// as they are). Line objects use the speaker helpers from ../common.js.
// Usage: node scripts/i18n-skeleton.mjs <code> [--force] [--only ch3]   (never overwrites without --force)
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { NAMES } from '../src/story/text/common.js';
import { FILES, MARK, loadLang, isObj, isData, isName, isAsIs } from './i18n-lib.mjs';

const argv = process.argv.slice(2);
const code = argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--only');
const force = argv.includes('--force');
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
if (!code || code === 'en') {
  console.error('usage: node scripts/i18n-skeleton.mjs <code> [--force] [--only <file>]');
  process.exit(1);
}

const HELPERS = { hugo: NAMES.hugo, odile: NAMES.odile, sami: NAMES.sami, bastien: NAMES.bastien, ines: NAMES.ines, marco: NAMES.marco, dr: NAMES.dr };
const IDENT = /^[A-Za-z_$][\w$]*$/;

const quote = (s) => {
  const q = s.includes("'") && !s.includes('"') ? '"' : "'";
  return q + s.replace(/\\/g, '\\\\').replace(new RegExp(q, 'g'), '\\' + q).replace(/\n/g, '\\n') + q;
};
const key = (k) => (IDENT.test(k) || /^\d+$/.test(k) ? k : quote(k));

function leaf(path, v) {
  if (v === null || v === undefined || typeof v !== 'string') return String(v);
  if (isData(path, v) || isName(path, v) || isAsIs(path)) return quote(v);
  return quote(MARK + v);
}

/** A dialogue line as a helper call when one fits, else null. */
function helperCall(path, o, used) {
  const keys = Object.keys(o).sort().join(',');
  if (keys === 'inner,text,who' && o.inner === true && o.who === NAMES.hugo) return (used.add('think'), `think(${leaf(path + '.text', o.text)})`);
  if (keys === 'text,who' && o.who === null && /^\*[^*]+\*$/.test(o.text)) return (used.add('stage'), `stage(${leaf(path + '.text', o.text.slice(1, -1))})`);
  if (keys === 'text,who') for (const [h, name] of Object.entries(HELPERS)) if (o.who === name) return (used.add(h), `${h}(${leaf(path + '.text', o.text)})`);
  return null;
}

function emit(v, path, ind, used) {
  const pad = '  '.repeat(ind + 1);
  const end = '  '.repeat(ind);
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    return `[\n${v.map((x, i) => pad + emit(x, `${path}.${i}`, ind + 1, used) + ',').join('\n')}\n${end}]`;
  }
  if (isObj(v)) {
    const h = helperCall(path, v, used);
    if (h) return h;
    const ents = Object.entries(v);
    if (!ents.length) return '{}';
    return `{\n${ents.map(([k, x]) => `${pad}${key(k)}: ${emit(x, path ? `${path}.${k}` : k, ind + 1, used)},`).join('\n')}\n${end}}`;
  }
  return leaf(path, v);
}

const en = await loadLang('en');
const dir = new URL(`../src/story/text/${code}/`, import.meta.url);
mkdirSync(dir, { recursive: true });
for (const f of FILES) {
  if (only && f !== only) continue;
  const file = new URL(`${f}.js`, dir);
  if (existsSync(file) && !force) {
    console.log(`skip ${f}.js (exists; --force to overwrite)`);
    continue;
  }
  const used = new Set();
  const root = f === 'common' ? '' : f; // paths as in L: common's keys sit at the top level
  const body = emit(en[f], root, 0, used);
  const imports = used.size ? `import { ${[...used].sort().join(', ')} } from '../common.js';\n\n` : '';
  const head = `// HAIRLINE ${code.toUpperCase()} text: ${f}.js. Mirrors ../${f}.js exactly (same keys, array lengths and line flags).\n// '${MARK.trim()}' marks text not translated yet. Check with: node scripts/i18n-check.mjs ${code}\n`;
  writeFileSync(file, `${head}${imports}export default ${body};\n`);
  console.log(`wrote src/story/text/${code}/${f}.js`);
}
