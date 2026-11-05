import { MAX_BACKUP_BYTES, parseLibraryBackup } from "@/shared/libraryData";
import type { LibraryBackup } from "@/shared/libraryData";
import { downloadFile } from "./download";

export async function readBackupFile(file: File): Promise<LibraryBackup> {
  if (file.size > MAX_BACKUP_BYTES) throw new Error("Choose a backup smaller than 10 MB.");
  let value: unknown;
  try { value = JSON.parse(await file.text()); }
  catch { throw new Error("This file could not be read as JSON. Choose a SmartSeek backup."); }
  return parseLibraryBackup(value);
}

export function downloadBackup(backup: LibraryBackup): void {
  downloadFile(JSON.stringify(backup), `smartseek-backup-${new Date().toISOString().slice(0, 10)}.json`);
}
