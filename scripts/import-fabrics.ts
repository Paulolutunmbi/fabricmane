/**
 * Bulk fabric importer.
 *
 *   npm run import:dry                 # scan + report, uploads nothing
 *   npm run import:test                # import the first 10 new images
 *   npm run import -- --all            # import everything (after the test passes)
 *
 * Flags: --root <path>  --limit <n>  --concurrency <n>  --max-mb <n>  --dry-run  --all
 *
 * Safe to re-run: files already in MongoDB (matched by SHA-256) are skipped, Cloudinary
 * public IDs are derived from the hash, and a MongoDB record is only created after the
 * upload succeeds. Every imported image starts as status "needs_review".
 */
import path from "node:path";
import mongoose from "mongoose";
import { DEFAULT_MAX_BYTES, DEFAULT_ROOT, requireEnv } from "./lib/config";
import { scanImages, type ScannedFile } from "./lib/scan";
import { sha256File } from "./lib/hash";
import { configureCloudinary, uploadImage } from "./lib/cloudinary";
import { folderOf, suggestCategory } from "./lib/hints";
import { writeReport, type FileResult, type Report } from "./lib/report";
import { Fabric } from "../src/lib/models/Fabric";
import { nextFabricId } from "../src/lib/models/Counter";

interface Args {
  root: string;
  limit: number | null;
  concurrency: number;
  maxBytes: number;
  dryRun: boolean;
  all: boolean;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const num = (flag: string) => {
    const v = get(flag);
    if (v === undefined) return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) throw new Error(`${flag} needs a positive number`);
    return n;
  };
  return {
    root: path.resolve(process.cwd(), get("--root") ?? process.env.FABRIC_IMPORT_ROOT ?? DEFAULT_ROOT),
    limit: num("--limit"),
    concurrency: num("--concurrency") ?? 3,
    maxBytes: (num("--max-mb") ?? DEFAULT_MAX_BYTES / 1024 / 1024) * 1024 * 1024,
    dryRun: argv.includes("--dry-run"),
    all: argv.includes("--all"),
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const env = requireEnv(["MONGODB_URI"]);

  if (!args.dryRun && args.limit === null && !args.all) {
    throw new Error("Refusing to import everything by accident. Use --limit <n> for a test batch or --all for the full import.");
  }
  if (!args.dryRun) configureCloudinary();

  console.log(`Scanning ${args.root} (all subfolders)...`);
  const { files, skipped } = await scanImages(args.root);
  console.log(`Found ${files.length} images. Skipped ${skipped.length} other items.`);

  const report: Report = {
    startedAt: new Date().toISOString(),
    root: args.root,
    dryRun: args.dryRun,
    limit: args.limit,
    totals: {},
    byFolder: {},
    skippedFiles: skipped,
    results: [],
  };

  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });

  let stopping = false;
  process.on("SIGINT", () => {
    console.log("\nStopping after the current files finish...");
    stopping = true;
  });

  const seenHashes = new Set<string>();
  let reserved = 0; // slots claimed against --limit
  let cursor = 0;
  let done = 0;

  const push = (r: FileResult) => {
    report.results.push(r);
    done++;
    const tag = r.outcome.toUpperCase().padEnd(13);
    console.log(`[${done}/${files.length}] ${tag} ${r.relPath}${r.fabricId ? " -> " + r.fabricId : ""}${r.detail ? " (" + r.detail + ")" : ""}`);
  };

  async function processFile(file: ScannedFile): Promise<void> {
    const category = suggestCategory(file.relPath);
    const folder = folderOf(file.relPath);
    try {
      if (file.bytes > args.maxBytes) {
        return push({ relPath: file.relPath, outcome: "failed", detail: `file is ${(file.bytes / 1048576).toFixed(1)} MB, over the ${(args.maxBytes / 1048576).toFixed(0)} MB limit` });
      }
      if (file.bytes === 0) return push({ relPath: file.relPath, outcome: "failed", detail: "empty file" });

      const hash = await sha256File(file.absPath);
      if (seenHashes.has(hash)) return push({ relPath: file.relPath, outcome: "duplicate", detail: "same image appears twice in this run" });
      seenHashes.add(hash);

      const existing = await Fabric.findOne({ "images.contentHash": hash }).select("fabricId").lean();
      if (existing) return push({ relPath: file.relPath, outcome: "duplicate", fabricId: existing.fabricId, detail: "already imported" });

      if (args.limit !== null && reserved >= args.limit) {
        return push({ relPath: file.relPath, outcome: "not_processed", detail: "limit reached" });
      }
      reserved++;
      report.byFolder[folder || "(root)"] = (report.byFolder[folder || "(root)"] ?? 0) + 1;

      if (args.dryRun) {
        return push({ relPath: file.relPath, outcome: "would_import", suggestedCategory: category });
      }

      const upload = await uploadImage(file.absPath, hash);
      const fabricId = await nextFabricId();
      await Fabric.create({
        fabricId,
        status: "needs_review",
        suggestedCategory: category,
        sourceFolder: folder,
        images: [
          {
            url: upload.secure_url,
            publicId: upload.public_id,
            width: upload.width,
            height: upload.height,
            format: upload.format,
            bytes: upload.bytes,
            originalFilename: file.filename,
            originalPath: file.relPath,
            contentHash: hash,
          },
        ],
      });
      push({ relPath: file.relPath, outcome: "imported", fabricId, suggestedCategory: category });
    } catch (err) {
      push({ relPath: file.relPath, outcome: "failed", detail: err instanceof Error ? err.message : String(err) });
    }
  }

  async function worker(): Promise<void> {
    while (!stopping) {
      const i = cursor++;
      if (i >= files.length) return;
      await processFile(files[i]);
    }
  }

  try {
    await Promise.all(Array.from({ length: args.concurrency }, worker));
  } finally {
    await writeReport(report);
    await mongoose.disconnect();
  }

  console.log("\nDone.", JSON.stringify(report.totals));
  console.log("Folder summary (images that would be / were imported):");
  for (const [folder, n] of Object.entries(report.byFolder).sort()) console.log(`  ${String(n).padStart(4)}  ${folder}`);
  console.log("\nFull details: import-report.json");
  if (report.totals.failed) console.log(`${report.totals.failed} file(s) failed. Fix the cause and re-run the same command; finished files are skipped.`);
}

main().catch((err) => {
  console.error("\nImport aborted:", err instanceof Error ? err.message : err);
  process.exit(1);
});
