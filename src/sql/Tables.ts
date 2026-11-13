import { db } from "./connection";

export default async function Tables() {
  try {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS notes(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT DEFAULT 'Untitled',
          content TEXT,
          created_at TEXT DEFAULT (datetime('now', 'localtime')),
          updated_at TEXT DEFAULT (datetime('now', 'localtime'))
        )
      `);

    await db.execute(`
        CREATE TABLE IF NOT EXISTS tags(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL DEFAULT 'Untitled',
          idNote INTEGER UNIQUE,
          FOREIGN KEY (idNote) REFERENCES notes(id) ON DELETE CASCADE
        )
      `);
  } catch (error) {
    console.error(error);
    throw error;
  }
}
