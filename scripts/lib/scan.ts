import fs from "node:fs/promises";
import path from "node:path";
import { IGNORED_DIRS, IGNORED_FILES, IMAGE_EXTENSIONS, UNSUPPORTED_IMAGE_EXTENSIONS } from "./config";

export interface ScannedFile {
  absPath: string;
  relPath: string; // forward slashes, relative to root
  filename: string;
  bytes: number;
}
export interface SkippedFile {
  relPath: string;
  reason: string;
}
export interface ScanResult {
  files: ScannedFile[];
  skipped: SkippedFile[];
}

/** Recursively finds every supported image under `root`, at any folder depth. */
export async function scanImages(root: string): Promise<ScanResult> {
  const files: ScannedFile[] = [];
  const skipped: SkippedFile[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      const rel = path.relative(root, abs).split(path.sep).join("/");
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name.toLowerCase())) {
          skipped.push({ relPath: rel + "/", reason: "ignored folder" });
          continue;
        }
        await walk(abs);
      } else if (entry.isFile()) {
        const lower = entry.name.toLowerCase();
        if (IGNORED_FILES.has(lower) || lower.startsWith("._")) continue;
        const ext = path.extname(lower);
        if (IMAGE_EXTENSIONS.has(ext)) {
          const stat = await fs.stat(abs);
          files.push({ absPath: abs, relPath: rel, filename: entry.name, bytes: stat.size });
        } else if (UNSUPPORTED_IMAGE_EXTENSIONS.has(ext)) {
          skipped.push({ relPath: rel, reason: `unsupported image format (${ext})` });
        } else {
          skipped.push({ relPath: rel, reason: "not an image" });
        }
      }
    }
  }

  await walk(root);
  files.sort((a, b) => a.relPath.localeCompare(b.relPath, undefined, { numeric: true }));
  return { files, skipped };
}
