import type { LabStoreSnapshot } from "../store";
import { GMB_VERSION } from "../rules/gmbVersion";

export type WorkspaceFile = {
  schemaVersion: "workspace.v1";
  appName: "Baltic Real Ship Basis Lab";
  benchmarkVersion: string;
  exportedAt: string;
  state: LabStoreSnapshot;
  analysisSnapshots: unknown[];
};

export function createWorkspaceFile(state: LabStoreSnapshot, analysisSnapshots: unknown[] = []): WorkspaceFile {
  return {
    schemaVersion: "workspace.v1",
    appName: "Baltic Real Ship Basis Lab",
    benchmarkVersion: GMB_VERSION,
    exportedAt: new Date().toISOString(),
    state,
    analysisSnapshots,
  };
}

export function serializeWorkspace(workspace: WorkspaceFile): string {
  return JSON.stringify(workspace, null, 2);
}

export function deserializeWorkspace(raw: string): WorkspaceFile {
  const parsed = JSON.parse(raw) as WorkspaceFile;
  if (parsed.schemaVersion !== "workspace.v1") {
    throw new Error("Unsupported workspace schema version.");
  }
  if (!parsed.state) {
    throw new Error("Workspace is missing state.");
  }
  return parsed;
}

export function downloadTextFile(fileName: string, contents: string): void {
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

