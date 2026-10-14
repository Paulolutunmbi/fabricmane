import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });
dotenv.config({ quiet: true }); // fallback to .env

export const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);
/** Known image-like formats we deliberately do not import; reported so nothing is silently lost. */
export const UNSUPPORTED_IMAGE_EXTENSIONS = new Set([".heic", ".heif", ".gif", ".bmp", ".tif", ".tiff", ".svg", ".psd"]);
/** Directory names skipped during the scan (case-insensitive). */
export const IGNORED_DIRS = new Set(["node_modules", "logos", "__macosx", ".git"]);
export const IGNORED_FILES = new Set([".ds_store", "thumbs.db", "desktop.ini"]);

export const CLOUDINARY_FOLDER = "fabricmane/fabrics";
/** Cloudinary free plans reject images over 10 MB. */
export const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
export const DEFAULT_ROOT = path.join("assets-local", "fabric-import-staging");
export const REPORT_PATH = path.resolve(process.cwd(), "import-report.json");

export function requireEnv(names: string[]): Record<string, string> {
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(", ")} (set them in .env.local)`);
  }
  return Object.fromEntries(names.map((n) => [n, process.env[n] as string]));
}
