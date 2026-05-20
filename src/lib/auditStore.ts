import type { AuditRun } from "../types";
import { GMB_VERSION } from "../rules/gmbVersion";

const STORAGE_KEY = "baltic-real-ship-basis-lab-audits";

export function createAuditRun(input: Omit<AuditRun, "auditId" | "timestamp" | "gmbVersion">): AuditRun {
  return {
    ...input,
    auditId: `AUD-${Date.now().toString(36).toUpperCase()}`,
    timestamp: new Date().toISOString(),
    gmbVersion: GMB_VERSION,
  };
}

export function saveAuditRun(run: AuditRun): void {
  if (typeof localStorage === "undefined") return;
  const existing = readAuditRuns();
  localStorage.setItem(STORAGE_KEY, JSON.stringify([run, ...existing].slice(0, 100)));
}

export function readAuditRuns(): AuditRun[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as AuditRun[];
  } catch {
    return [];
  }
}

