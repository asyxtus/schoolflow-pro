import { openDB, type IDBPDatabase } from "idb";
import type { AttendanceStatus } from "./attendance.functions";

export type QueuedAttendanceMark = {
  id: string;
  studentId: string;
  studentLabel: string;
  status: AttendanceStatus;
  date: string;
  subject: string | null;
  className: string;
  queuedAt: string;
};

const DB_NAME = "schoolflow-offline";
const DB_VERSION = 1;
const STORE = "attendance-queue";

let dbPromise: Promise<IDBPDatabase> | null = null;

// IndexedDB isn't available during SSR or in some restricted contexts — every
// function here degrades to a no-op rather than throwing, so the rest of the
// app never has to special-case "queueing isn't available right now."
function getDb(): Promise<IDBPDatabase> | null {
  if (typeof indexedDB === "undefined") return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

export async function queueAttendanceMark(
  entry: Omit<QueuedAttendanceMark, "id" | "queuedAt">,
): Promise<QueuedAttendanceMark | null> {
  const db = await getDb();
  if (!db) return null;
  // Replacing any existing queued mark for the same student/date/subject
  // means re-tapping a status while still offline updates the pending mark
  // instead of queuing duplicate, conflicting entries.
  const existing = await db.getAll(STORE);
  const dup = existing.find(
    (m: QueuedAttendanceMark) =>
      m.studentId === entry.studentId && m.date === entry.date && m.subject === entry.subject,
  );
  const id = dup?.id ?? crypto.randomUUID();
  const record: QueuedAttendanceMark = { ...entry, id, queuedAt: new Date().toISOString() };
  await db.put(STORE, record);
  return record;
}

export async function listQueuedMarks(): Promise<QueuedAttendanceMark[]> {
  const db = await getDb();
  if (!db) return [];
  return db.getAll(STORE);
}

export async function removeQueuedMark(id: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(STORE, id);
}

// A network-level failure (offline, connection dropped mid-request) should
// queue the mark; an application error (e.g. a real validation failure from
// the server) should surface normally — retrying it later would just fail
// the same way again. TypeError is what fetch() throws for connectivity
// failures specifically, as opposed to a resolved-but-rejected server call.
export function isLikelyOffline(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  return error instanceof TypeError;
}
