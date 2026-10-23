#!/usr/bin/env node
/**
 * import-fabrics.js  (v2)
 *
 *   node import-fabrics.js "<path to fabric-import-staging>"                  dry run: scan + reports only
 *   node import-fabrics.js "<path>" --upload --limit 10                       upload just 10 images (test)
 *   node import-fabrics.js "<path>" --upload                                  upload everything that is "ready"
 *
 * Writes (in the folder you run it from):
 *   manifest.json       every image: ID, fabric name, price, unit, status, Cloudinary URL
 *   folders-report.csv  one row per folder: open it in Excel to check names/prices
 *
 * Never changes or deletes anything on your drive. Duplicates are skipped, not deleted.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
try { require("dotenv").config(); } catch { /* dotenv is only needed for --upload */ }

const [src, ...flags] = process.argv.slice(2);
if (!src || !fs.existsSync(src)) {
  console.error(`Folder not found: ${src ?? "(none given)"}\nUsage: node import-fabrics.js "D:\\incase\\assets-local\\fabric-import-staging"`);
  process.exit(1);
}
const UPLOAD = flags.includes("--upload");
const li = flags.indexOf("--limit");
const LIMIT = li >= 0 ? Number(flags[li + 1]) : Infinity;

const IMG = /\.(jpe?g|png|webp)$/i;
const VIDEO = /\.(mp4|mov|avi|mkv|3gp)$/i;
const MANIFEST = "manifest.json";
const REPORT = "folders-report.csv";

// ---------------------------------------------------------------- settings
const EXCLUDE_FOLDERS = [/customer/i];   // skipped completely (customer screenshots, not fabrics)

// Unit to assume when a folder shows a price but no unit (you confirmed: 5 yards).
const DEFAULT_UNIT = "5yards";

// Fix a folder by hand. Key = folder name WITHOUT the "-2026...Z-1-001" ending.
const OVERRIDES = {
  "Thur_Etherelle Bloom Lace N156-5 yards": { price: 156000 },          // confirmed: 156k
  "Fri_ Timeless Embroidered Lace 99-5yards": { price: 99000 },         // confirmed: 99k
  "Tue_Sego Head-tie 2 piece set_ N40,000": { priceUnit: "set" },       // price is for the 2-piece set
  "Sat_Glazed Quality Wax_N60k_give away price_Feb only": { price: null, priceUnit: null }, // promo -> Enquire for Price
};

// Folders you renamed to "too long..." because Windows could not handle the real name.
// Key = the short folder name on your drive. Value = the real folder name it stands for
// (without the "-2026...Z-1-001" ending). Sub-folders like "Edited" follow automatically.
const ALIASES = {
  "too long": "Sun_ Butterfly design - beaded and sequinned  embroidered with pearl fabrics _109k for 5 yards",
};
const seenFolders = new Set();

// ---------------------------------------------------------------- folder-name parsing
const WRAPPER = /-\d{8}T\d{6}Z-\d+-\d+$/i;                       // Google Drive zip ending
const DAY = /^(?:mon|tues?|wed|thur?s?|fri|sat|sun)(?:[_\s-]+|$)/i; // Mon_, Thur_, "thur ", Fri_ ...
const YARD = "yards?|yrds?|yrads?|yds?";
const PRICE_RE = new RegExp(
  "((?:price\\s+)?(?:starts?|starting)\\s+(?:at|from)\\s+)?" +                  // 1 "starting at"
  "(?:₦|NGN|N)?\\s*(\\d[\\d,]*(?:\\.\\d+)?)\\s*(k)?(?:\\s*(?:one|only))?" +      // 2 number, 3 k
  "\\s*(per|for|/|-)?\\s*(\\d+)?\\s*(" + YARD + "|sets?|pieces?|pcs?)(?![a-z])",  // 4 sep, 5 count, 6 unit
  "gi"
);
const BARE_PRICE = /^(?:₦|NGN|N)?\s*(\d{1,3}(?:,\d{3})+|\d+\s*k|\d{5,})$/i;       // "N143,000", "N60k"
const NOISE = /make into video|give\s*away|\bonly\b|no need to state price/i;

const baseName = (raw) => raw.replace(WRAPPER, "").replace(/[_\s\u00a0]+$/, "").trim();
const tidy = (s) => s.replace(/[\u00a0\u200b]/g, " ").replace(/\s+/g, " ").replace(/^[\s,.\-–_]+|[\s,.\-–_]+$/g, "");

function normalise(raw) {
  let s = raw.replace(WRAPPER, "").replace(/[\u00a0\u200b]/g, " ").trim();
  s = s.replace(DAY, "").replace(/(\w)_s\b/g, "$1's");           // Mon_ removed, Men_s -> Men's
  return s.trim();
}

const isGeneric = (s) =>
  !s ||
  /^(?:\d+\s*)?(?:yards?|yrds?|yrads?|yds?)$/i.test(s) ||        // "5yards", "5 yard", "Yard", "5yrds"
  /^drive[-\s]?download$/i.test(s) ||
  /^edited$/i.test(s) ||
  /^too\s*long\s*\d*$/i.test(s);

function parseFolder(raw) {
  let s = normalise(raw);
  if (isGeneric(s)) return { generic: true };

  const out = { generic: false, price: null, priceUnit: null, priceRaw: null, priceFrom: false, flags: [], notes: [] };

  for (const m of s.matchAll(PRICE_RE)) {
    const unit = m[6].toLowerCase();
    const isYard = unit.startsWith("y");
    const sep = (m[4] || "").toLowerCase();
    const digits = m[2].replace(/\D/g, "").length;
    if (!isYard && sep !== "per") continue;      // "2 Piece" in a name is not a price
    if (!m[3] && digits < 2) continue;           // single digit without k is not a price
    const value = parseFloat(m[2].replace(/,/g, "")) * (m[3] ? 1000 : 1);

    if (isYard) {
      const count = m[5] ? Number(m[5]) : null;
      if (count) out.priceUnit = count === 1 ? "yard" : `${count}yards`;
      else if (sep === "per") out.priceUnit = "yard";
      else out.flags.push("yard-count-missing");
    } else out.priceUnit = unit.startsWith("set") ? "set" : "piece";

    out.priceRaw = m[0].trim();
    out.priceFrom = !!m[1];
    if (!m[3] && value < 1000) { out.flags.push("price-check"); }   // "N156-5 yards": 156 or 156k? do not guess
    else out.price = value;
    s = s.slice(0, m.index) + " " + s.slice(m.index + m[0].length);
    break;
  }

  let segs = s.split("_").map(tidy).filter(Boolean);

  if (out.price == null && !out.priceRaw) {                       // "N143,000" with no unit
    const i = segs.findIndex((x) => BARE_PRICE.test(x));
    if (i >= 0) {
      const b = segs[i].match(BARE_PRICE)[1].replace(/,/g, "");
      out.price = /k$/i.test(b) ? parseFloat(b) * 1000 : Number(b);
      out.priceRaw = segs[i];
      segs.splice(i, 1);
    }
  }

  for (const x of segs.filter((x) => NOISE.test(x))) {
    out.notes.push(x);
    if (/give\s*away|\bonly\b/i.test(x)) out.flags.push("promo");
    if (/no need to state price/i.test(x)) out.flags.push("no-price-stated");
  }
  out.fabric = tidy(segs.filter((x) => !NOISE.test(x)).join(" ")) || null;
  if (!out.fabric) return { generic: true };

  out.flags = [...new Set(out.flags)];
  if (out.price != null && !out.priceUnit && !out.flags.includes("yard-count-missing")) out.priceUnit = DEFAULT_UNIT;
  const ov = OVERRIDES[baseName(raw)];
  if (ov) {
    Object.assign(out, ov);
    if ("price" in ov) out.flags = out.flags.filter((f) => f !== "price-check");
  }
  return out;
}

// ---------------------------------------------------------------- scan
const hashFile = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
const all = [];
let videos = 0, excludedImages = 0;

function countImages(dir) {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) n += countImages(full);
    else if (IMG.test(e.name)) n++;
  }
  return n;
}

function walk(dir, inherited, depth) {
  const rawDisk = path.basename(dir);
  if (depth > 0) seenFolders.add(baseName(rawDisk));
  if (depth > 0 && EXCLUDE_FOLDERS.some((r) => r.test(rawDisk))) { excludedImages += countImages(dir); return; }
  const raw = ALIASES[baseName(rawDisk)] ?? rawDisk;   // "too long" -> the real name

  const p = depth === 0 ? { generic: true } : parseFolder(raw);
  const mk = (q, r) => ({
    fabric: q.fabric, price: q.price, priceUnit: q.priceUnit, priceRaw: q.priceRaw,
    priceFrom: q.priceFrom, flags: q.flags, notes: q.notes, folder: baseName(r),
  });
  let ctx = p.generic ? inherited : mk(p, raw);

  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));

  // A folder like "Fri_" with loose photos and ONE named sub-folder: the sub-folder's name/price apply to the loose photos too.
  if (p.generic && depth > 0 && !ctx.fabric && entries.some((e) => e.isFile() && IMG.test(e.name))) {
    const named = entries.filter((e) => e.isDirectory())
      .map((e) => { const r = ALIASES[baseName(e.name)] ?? e.name; return { r, q: parseFolder(r) }; })
      .filter((x) => !x.q.generic);
    if (named.length === 1) ctx = mk(named[0].q, named[0].r);
  }

  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { walk(full, ctx, depth + 1); continue; }
    if (VIDEO.test(e.name)) { videos++; continue; }
    if (!IMG.test(e.name)) continue;
    const rel = path.relative(src, full);
    all.push({
      original: full, rel, hash: hashFile(full),
      fabric: ctx.fabric ?? null, price: ctx.price ?? null, priceUnit: ctx.priceUnit ?? null,
      priceRaw: ctx.priceRaw ?? null, priceFrom: !!ctx.priceFrom,
      flags: [...(ctx.flags || [])], notes: ctx.notes || [],
      folder: ctx.fabric ? ctx.folder : `(no name) ${path.dirname(rel)}`,
      edited: rel.split(path.sep).some((x) => /^edited$/i.test(x)),
    });
  }
}
walk(path.resolve(src), { fabric: null }, 0);

for (const k of Object.keys(ALIASES)) {
  if (!seenFolders.has(k)) console.log(`WARNING: ALIASES has "${k}" but no folder with that name exists on the drive.`);
}

// ---------------------------------------------------------------- duplicates + stable IDs
const prev = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : [];
const prevByHash = new Map(prev.filter((x) => x.id && x.hash && x.status !== "duplicate").map((x) => [x.hash, x]));
let nextNum = Math.max(0, ...prev.map((x) => Number((x.id || "").replace("FB-", "")) || 0)) + 1;

const groups = new Map();
for (const it of all) { if (!groups.has(it.hash)) groups.set(it.hash, []); groups.get(it.hash).push(it); }

const keepers = [];
for (const g of groups.values()) {
  const keep = g.find((x) => x.fabric) ?? g[0];          // prefer the copy that has a fabric name
  keepers.push(keep);
  keep._dups = g.filter((x) => x !== keep);
}
keepers.sort((a, b) => a.rel.localeCompare(b.rel));
for (const k of keepers) {
  const old = prevByHash.get(k.hash);
  k.id = old ? old.id : "FB-" + String(nextNum++).padStart(6, "0");
  if (old?.url) { k.url = old.url; k.publicId = old.publicId; }
  k.status = k.fabric ? "ready" : "needs-review";
}
const items = [];
for (const k of keepers) {
  const dups = k._dups; delete k._dups;
  k.alsoIn = [...new Set(dups.map((d) => d.folder).filter((f) => f !== k.folder))];
  items.push(k);
  for (const d of dups) items.push({ status: "duplicate", duplicateOf: k.id, original: d.original, rel: d.rel, hash: d.hash, folder: d.folder });
}

// ---------------------------------------------------------------- reports
for (const f of seenFolders) {
  if (/^too\s*long/i.test(f) && !(f in ALIASES) && items.some((i) => i.status === "needs-review" && i.folder.includes(f)))
    console.log(`WARNING: folder "${f}" still has images with no name. Add it to ALIASES.`);
}
const ready = items.filter((i) => i.status === "ready");
const review = items.filter((i) => i.status === "needs-review");
const dups = items.filter((i) => i.status === "duplicate");
const withPrice = ready.filter((i) => i.price != null);

const rowFlags = (i) => {
  const f = [...(i.flags || [])];
  if (i.status === "needs-review") f.push("needs-name");
  if (i.status === "ready" && i.price == null && !i.priceRaw) f.push("no-price");
  if (i.price != null && i.priceUnit && i.priceUnit !== "5yards") f.push(`unit:${i.priceUnit}`);
  if (i.price != null && !i.priceUnit) f.push("unit-unclear");
  if (i.priceFrom) f.push("starting-price");
  return [...new Set(f)];
};

const rows = new Map();
for (const i of items) {
  const key = i.folder;
  if (!rows.has(key)) rows.set(key, { folder: key, fabric: i.fabric ?? "", price: i.price ?? "", priceUnit: i.priceUnit ?? "", ready: 0, review: 0, dup: 0, flags: new Set() });
  const r = rows.get(key);
  if (i.status === "duplicate") { r.dup++; continue; }
  if (i.status === "ready") r.ready++; else r.review++;
  rowFlags(i).forEach((f) => r.flags.add(f));
}
const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
const csv = ["folder,fabric,price,priceUnit,imagesReady,needReview,duplicatesSkipped,flags"]
  .concat([...rows.values()].map((r) => [r.folder, r.fabric, r.price, r.priceUnit, r.ready, r.review, r.dup, [...r.flags].join(" ")].map(q).join(",")));
fs.writeFileSync(REPORT, "\ufeff" + csv.join("\n"));

const unitCount = {};
withPrice.forEach((i) => { unitCount[i.priceUnit ?? "unclear"] = (unitCount[i.priceUnit ?? "unclear"] || 0) + 1; });
console.log(`Images scanned: ${all.length}  |  excluded folders: ${excludedImages}  |  videos skipped: ${videos}`);
console.log(`Unique: ${ready.length + review.length}  |  Duplicates skipped: ${dups.length}`);
console.log(`Ready: ${ready.length}  |  Need a name: ${review.length}`);
console.log(`Ready with price: ${withPrice.length} ${JSON.stringify(unitCount)}  |  Ready without price: ${ready.length - withPrice.length}`);
const flagged = [...rows.values()].filter((r) => r.flags.size);
const interesting = flagged.filter((r) => [...r.flags].some((f) => !["no-price", "starting-price"].includes(f)));
if (interesting.length) {
  console.log(`\nFolders to look at (${interesting.length}):`);
  interesting.slice(0, 40).forEach((r) => console.log(`  - ${r.folder}  [${[...r.flags].join(", ")}]`));
}
console.log(`\nWrote ${REPORT} and ${MANIFEST}`);

// ---------------------------------------------------------------- upload (optional)
async function upload() {
  const cloudinary = require("cloudinary").v2;
  if (!process.env.CLOUDINARY_URL) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }
  cloudinary.config({ secure: true });
  const c = cloudinary.config();
  if (!c.cloud_name || !c.api_key || !c.api_secret) {
    console.error("Cloudinary keys not found. Fill CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env");
    process.exit(1);
  }
  const todo = ready.filter((i) => !i.url).slice(0, LIMIT);
  console.log(`\nUploading ${todo.length} image(s)...`);
  for (const it of todo) {
    try {
      const r = await cloudinary.uploader.upload(it.original, {
        public_id: `fabric-mane/fabrics/${it.id}`, overwrite: false, resource_type: "image",
      });
      it.url = r.secure_url; it.publicId = r.public_id; delete it.error;
      console.log("uploaded", it.id, "-", it.fabric);
    } catch (err) {
      it.error = String(err.message || err);
      console.log("FAILED  ", it.id, it.error);
    }
    fs.writeFileSync(MANIFEST, JSON.stringify(items, null, 2));      // save progress after every image
  }
}

(async () => {
  fs.writeFileSync(MANIFEST, JSON.stringify(items, null, 2));
  if (UPLOAD) { await upload(); fs.writeFileSync(MANIFEST, JSON.stringify(items, null, 2)); }
  else console.log("Dry run only. Nothing was uploaded.");
})();