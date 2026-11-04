import { requestLibrary } from "@/shared/libraryProtocol";
import { parseLibraryBackup } from "@/shared/libraryData";
import type { ImportMode } from "@/shared/libraryData";

export function exportLibrary() { return requestLibrary({ type: "library.export" }); }
export async function previewLibraryImport(backup: unknown, mode: ImportMode, includeSettings = false) {
  return requestLibrary({ type: "library.import.preview", backup: parseLibraryBackup(backup), mode, includeSettings });
}
export function applyLibraryImport(previewId: string) { return requestLibrary({ type: "library.import.apply", previewId }); }
export async function cancelLibraryImport(previewId: string): Promise<void> { await requestLibrary({ type: "library.import.cancel", previewId }); }
