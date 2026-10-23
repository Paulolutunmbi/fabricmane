#!/usr/bin/env node
/**
 * verify-images.mjs: read-only pre-upload check for the Fabric Mane image staging folder.
 *
 * Usage:
 *   node verify-images.mjs "<path to fabric-import-staging>" [old-import-report.json]
 *
 * Makes no changes, uploads nothing, uses no network. Node 18+, built-ins only.
 * Writes verify-report.json to the current folder.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(process.argv[2] ?? './assets-local/fabric-import-staging');
const oldReportPath = process.argv[3];

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const MAX_MB = 10;        // set this to your Cloudinary plan's per-image limit
const MIN_SIDE_PX = 600;  // warn when the short side is smaller than this

const WRAPPER = /-\d{8}T\d{6}Z-\d+-\d+$/; // Google Drive zip wrapper suffix
const FOLDER_FLAGS = [
  [/^(mon|tue|wed|thu|thur|fri|sat|sun)_?\s*$/i, 'no product name (weekday prefix only)'],
  [/customer/i, 'looks like customer screenshots, not a fabric product'],
  [/give\s*away|\bonly\b/i, 'time-limited promo wording; do not publish its price as current'],
  [/no need to state price/i, 'folder says not to state a price'],
  [/make into video/i, 'internal instruction inside the folder name'],
];

if (!fs.existsSync(root)) {
  console.error(`Folder not found: ${root}`);
  process.exit(2);
}

// ---------- helpers ----------
const norm = (p) => p.split(path.sep).join('/').normalize('NFC');
const dirOf = (rel) => path.posix.dirname(rel);
const productFolder = (rel) => {
  const parts = dirOf(rel).split('/');
  while (parts.length > 1 && /^edited$/i.test(parts[parts.length - 1])) parts.pop();
  return parts[parts.length - 1].replace(WRAPPER, '');
};
const productKey = (rel) => productFolder(rel).toLowerCase().replace(/[^a-z0-9]/g, '');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.isFile()) out.push(full);
  }
  return out;
}

function inspect(buf, ext) {
  const out = { problems: [], width: null, height: null };
  if (buf.length === 0) {
    out.problems.push('zero bytes');
    return out;
  }
  if (ext === '.jpg' || ext === '.jpeg') {
    if (buf[0] !== 0xff || buf[1] !== 0xd8) {
      out.problems.push('not a JPEG (bad header)');
      return out;
    }
    if (buf.subarray(-4096).lastIndexOf(Buffer.from([0xff, 0xd9])) === -1) {
      out.problems.push('possibly truncated JPEG (no end marker near end of file)');
    }
    for (let i = 2; i + 9 < buf.length; ) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      if (m === 0xff) { i++; continue; }
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        out.height = buf.readUInt16BE(i + 5);
        out.width = buf.readUInt16BE(i + 7);
        break;
      }
      if (m === 0xda) break;
      i += 2 + buf.readUInt16BE(i + 2);
    }
  } else if (ext === '.png') {
    const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (buf.length < 24 || !buf.subarray(0, 8).equals(sig)) {
      out.problems.push('not a PNG (bad header)');
    } else {
      out.width = buf.readUInt32BE(16);
      out.height = buf.readUInt32BE(20);
      if (buf.subarray(-32).indexOf('IEND') === -1) out.problems.push('truncated PNG (no IEND chunk)');
    }
  } else if (ext === '.webp') {
    if (buf.subarray(0, 4).toString() !== 'RIFF' || buf.subarray(8, 12).toString() !== 'WEBP') {
      out.problems.push('not a WebP (bad header)');
    }
  } else if (ext === '.gif') {
    if (buf.subarray(0, 4).toString() !== 'GIF8') out.problems.push('not a GIF (bad header)');
  }
  return out;
}

const show = (title, items, max = 15) => {
  console.log(`\n${title} (${items.length})`);
  items.slice(0, max).forEach((x) => console.log(`  - ${x}`));
  if (items.length > max) console.log(`  ... and ${items.length - max} more (full list in verify-report.json)`);
};

// ---------- scan ----------
console.log(`Scanning: ${root}\n`);
const files = walk(root).map((full) => ({
  full,
  rel: norm(path.relative(root, full)),
  ext: path.extname(full).toLowerCase(),
  size: fs.statSync(full).size,
  problems: [],
  warnings: [],
}));
const images = files.filter((f) => IMAGE_EXTS.has(f.ext));
const others = files.filter((f) => !IMAGE_EXTS.has(f.ext));

let n = 0;
for (const f of images) {
  try {
    const buf = fs.readFileSync(f.full);
    f.hash = crypto.createHash('sha256').update(buf).digest('hex');
    const r = inspect(buf, f.ext);
    f.problems.push(...r.problems);
    f.width = r.width;
    f.height = r.height;
    if (r.width && Math.min(r.width, r.height) < MIN_SIDE_PX) f.warnings.push(`low resolution (${r.width}x${r.height})`);
    if (f.size > MAX_MB * 1024 * 1024) f.warnings.push(`large file (${(f.size / 1048576).toFixed(1)} MB)`);
  } catch (err) {
    f.problems.push(`unreadable: ${err.message}`);
  }
  if (++n % 200 === 0) console.log(`  checked ${n}/${images.length}`);
}

// ---------- duplicates ----------
const byHash = new Map();
for (const f of images.filter((x) => x.hash)) {
  if (!byHash.has(f.hash)) byHash.set(f.hash, []);
  byHash.get(f.hash).push(f);
}
const groups = [...byHash.values()].filter((g) => g.length > 1);
const kindOf = (g) => {
  if (new Set(g.map((f) => productKey(f.rel))).size > 1) return 'cross-product';
  return new Set(g.map((f) => dirOf(f.rel))).size === 1 ? 'same-folder' : 'same-product-other-copy';
};
const dup = { 'same-product-other-copy': [], 'same-folder': [], 'cross-product': [] };
for (const g of groups) dup[kindOf(g)].push(g);
const extraFiles = (list) => list.reduce((s, g) => s + g.length - 1, 0);
const hashedCount = images.filter((f) => f.hash).length;
const uniqueCount = byHash.size;
const redundant = hashedCount - uniqueCount;

// ---------- "Edited" folders ----------
const isEdited = (f) => /(^|\/)edited\//i.test(f.rel);
const stem = (rel) => path.posix.parse(rel).name.replace(/\(\d+\)$/, '').toLowerCase();
const originals = new Set(images.filter((f) => !isEdited(f)).map((f) => `${dirOf(f.rel)}|${stem(f.rel)}`));
const edited = images.filter(isEdited);
const editedPaired = edited.filter((f) => originals.has(`${dirOf(dirOf(f.rel))}|${stem(f.rel)}`));

// ---------- folder-name flags ----------
const folderImageCount = new Map();
for (const f of images) {
  const k = productFolder(f.rel);
  folderImageCount.set(k, (folderImageCount.get(k) ?? 0) + 1);
}
const folderFlags = [];
for (const [name, count] of folderImageCount) {
  for (const [re, note] of FOLDER_FLAGS) if (re.test(name)) folderFlags.push({ folder: name, images: count, note });
}

// ---------- compare with the old report ----------
let cmp = null;
if (oldReportPath) {
  const old = JSON.parse(fs.readFileSync(oldReportPath, 'utf8'));
  const clean = (p) => p.replaceAll('\\', '/').normalize('NFC');
  const oldImgs = new Set(old.results.map((r) => clean(r.relPath)));
  const nowImgs = new Set(images.map((f) => f.rel));
  cmp = {
    oldImageFiles: oldImgs.size,
    oldWouldImport: old.totals?.would_import,
    oldDuplicates: old.totals?.duplicate,
    oldSkipped: old.skippedFiles?.length ?? 0,
    missing: [...oldImgs].filter((p) => !nowImgs.has(p)),
    extra: [...nowImgs].filter((p) => !oldImgs.has(p)),
  };
}

// ---------- report ----------
const problems = images.filter((f) => f.problems.length).map((f) => `${f.rel}: ${f.problems.join('; ')}`);
const warnings = images.filter((f) => f.warnings.length).map((f) => `${f.rel}: ${f.warnings.join('; ')}`);
const totalMB = images.reduce((s, f) => s + f.size, 0) / 1048576;

console.log('\n=== Fabric Mane image check ===');
console.log(`Image files:       ${images.length}  (${totalMB.toFixed(0)} MB)`);
console.log(`Unique images:     ${uniqueCount}`);
console.log(`Redundant copies:  ${redundant}`);
const otherCounts = {};
for (const f of others) otherCounts[f.ext || '(none)'] = (otherCounts[f.ext || '(none)'] ?? 0) + 1;
console.log(`Non-image files:   ${others.length}  ${JSON.stringify(otherCounts)}`);

if (cmp) {
  const line = (label, now, then) => console.log(`${now === then ? 'OK  ' : 'DIFF'} ${label}: now ${now}, old report ${then}`);
  console.log('\n--- vs old report ---');
  line('image files', images.length, cmp.oldImageFiles);
  line('unique (would import)', uniqueCount, cmp.oldWouldImport);
  line('redundant (duplicates)', redundant, cmp.oldDuplicates);
  line('non-image files', others.length, cmp.oldSkipped);
  show('Files in the old report but MISSING now', cmp.missing);
  show('Files on disk now that the old report did not have', cmp.extra);
}

show('Integrity problems (fix before upload)', problems);
show('Warnings', warnings);

console.log('\n--- Duplicates ---');
console.log(`same product, copied to another folder: ${extraFiles(dup['same-product-other-copy'])} extra files (safe to skip)`);
console.log(`same folder, repeated:                  ${extraFiles(dup['same-folder'])} extra files (safe to skip)`);
console.log(`same image under DIFFERENT products:    ${extraFiles(dup['cross-product'])} extra files (needs a decision)`);
show(
  'Cross-product duplicates (the later product loses the image)',
  dup['cross-product'].map((g) => [...new Set(g.map((f) => productFolder(f.rel)))].join('  <->  ')),
);

console.log('\n--- "Edited" folders ---');
console.log(`${edited.length} images sit in Edited folders; ${editedPaired.length} of them have an original beside them, ${edited.length - editedPaired.length} do not.`);
console.log('If both versions are imported, those products get near-duplicate photos.');

show('Folder names that need attention', folderFlags.map((x) => `${x.folder} [${x.images} images]: ${x.note}`), 30);

const blocking = problems.length + (cmp?.missing.length ?? 0);
console.log(
  blocking
    ? `\nRESULT: ${blocking} blocking issue(s). Fix these before uploading.`
    : '\nRESULT: no integrity problems found. Review the warnings and decisions above, then upload.',
);

fs.writeFileSync(
  'verify-report.json',
  JSON.stringify(
    {
      root,
      checkedAt: new Date().toISOString(),
      counts: { images: images.length, unique: uniqueCount, redundant, nonImage: others.length, totalMB: Math.round(totalMB) },
      problems,
      warnings,
      duplicates: Object.fromEntries(
        Object.entries(dup).map(([k, v]) => [k, v.map((g) => g.map((f) => f.rel))]),
      ),
      edited: { total: edited.length, withOriginal: editedPaired.length },
      folderFlags,
      comparison: cmp,
    },
    null,
    2,
  ),
);
console.log('Wrote verify-report.json');
process.exitCode = blocking ? 1 : 0;
