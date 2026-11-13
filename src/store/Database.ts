import { create } from "zustand";
import Database from "@tauri-apps/plugin-sql";

const DB_URL = "sqlite:app_mimo.db";

interface DatabaseState {
  db: Database | null;
  loading: boolean;
  error: string | null;
  init: () => Promise<Database>;
  close: () => Promise<void>;
}

let connection: Promise<Database> | null = null;

const getConnection = () => {
  if (!connection) {
    connection = Database.load(DB_URL).catch((error) => {
      connection = null;
      throw error;
    });
  }
  return connection;
};

export const useDatabase = create<DatabaseState>((set, get) => ({
  db: null,
  loading: false,
  error: null,
  init: async () => {
    const current = get().db;
    if (current) return current;

    set({ loading: true, error: null });
    try {
      const db = await getConnection();
      set({ db, loading: false });
      return db;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
        loading: false,
      });
      throw error;
    }
  },
  close: async () => {
    const { db } = get();
    if (!db) return;

    await db.close();
    connection = null;
    set({ db: null });
  },
}));
