import path from "node:path";

/** Folder names that say nothing about the fabric type. */
const COLOURS = "red|blue|green|yellow|orange|pink|purple|black|white|brown|gold|silver|grey|gray|cream|ivory|navy|maroon|burgundy|wine|teal|peach|lemon|multi|multicolou?r";
const GENERIC = new RegExp(`^((${COLOURS})( and \\w+)?|unsorted|images?|photos?|pictures?|new folder.*|whatsapp.*|img[-_ ]?\d*|camera|downloads?|misc|others?|fabrics?|fabric-import-staging|\\d+)$`, "i");

export function folderOf(relPath: string): string {
  const dir = path.posix.dirname(relPath);
  return dir === "." ? "" : dir;
}

/**
 * Best-guess category from the nearest meaningful folder name. Generic folder names
 * ("unsorted", "new folder 2", "whatsapp images") are skipped and we walk up the path.
 * e.g. "Aso Oke/IMG_1.jpg" -> "Aso Oke"; "unsorted/IMG_2.jpg" -> "".
 * It is only a suggestion; the owner confirms the real category in the review screen.
 */
export function suggestCategory(relPath: string): string {
  const segments = folderOf(relPath).split("/").filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    if (!GENERIC.test(seg)) return toTitle(seg);
  }
  return "";
}

function toTitle(s: string): string {
  return s
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
