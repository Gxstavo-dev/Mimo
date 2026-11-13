import Database from "@tauri-apps/plugin-sql";
import { useDatabase } from "../store/Database";

async function sql(): Promise<Database> {
  const db = await useDatabase.getState().init();
  return db;
}

export const db = await sql();
