import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import type { SessionRecord } from "@/lib/domain/session-schemas";

type TeachAiStudentDatabase = DBSchema & {
  sessions: {
    key: string;
    value: SessionRecord;
    indexes: {
      "by-updatedAt": string;
    };
  };
};

const DATABASE_NAME = "teach-ai-student-mvp";
const DATABASE_VERSION = 1;

let databasePromise: Promise<IDBPDatabase<TeachAiStudentDatabase>> | null = null;

function assertBrowser() {
  if (typeof window === "undefined") {
    throw new Error("Session persistence is only available in the browser.");
  }
}

function getDatabase() {
  assertBrowser();

  if (!databasePromise) {
    databasePromise = openDB<TeachAiStudentDatabase>(
      DATABASE_NAME,
      DATABASE_VERSION,
      {
        upgrade(database) {
          const store = database.createObjectStore("sessions", {
            keyPath: "id",
          });

          store.createIndex("by-updatedAt", "updatedAt");
        },
      },
    );
  }

  return databasePromise;
}

export async function saveSessionRecord(session: SessionRecord) {
  const database = await getDatabase();
  await database.put("sessions", session);
}

export async function getSessionRecord(id: string) {
  const database = await getDatabase();
  return database.get("sessions", id);
}

export async function listSessionRecords() {
  const database = await getDatabase();
  const sessions = await database.getAll("sessions");

  return sessions.sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}
