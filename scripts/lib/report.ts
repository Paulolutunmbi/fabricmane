import fs from "node:fs/promises";
import { REPORT_PATH } from "./config";

export type Outcome = "imported" | "would_import" | "duplicate" | "failed" | "not_processed";

export interface FileResult {
  relPath: string;
  outcome: Outcome;
  fabricId?: string;
  suggestedCategory?: string;
  detail?: string;
}

export interface Report {
  startedAt: string;
  finishedAt?: string;
  root: string;
  dryRun: boolean;
  limit: number | null;
  totals: Record<string, number>;
  byFolder: Record<string, number>;
  skippedFiles: { relPath: string; reason: string }[];
  results: FileResult[];
}

export async function writeReport(report: Report): Promise<void> {
  report.finishedAt = new Date().toISOString();
  const totals: Record<string, number> = {};
  for (const r of report.results) totals[r.outcome] = (totals[r.outcome] ?? 0) + 1;
  report.totals = totals;
  await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
}
