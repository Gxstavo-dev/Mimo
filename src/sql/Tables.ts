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
          idNote INTEGER,
          FOREIGN KEY (idNote) REFERENCES notes(id) ON DELETE CASCADE
        )
      `);

    // Migrate databases created with the old one-tag-per-note constraint.
    const indexes = await db.select<Array<{ name: string; unique: number }>>(
      `PRAGMA index_list(tags)`,
    );
    for (const index of indexes) {
      if (!index.unique) continue;

      const columns = await db.select<Array<{ name: string }>>(
        `PRAGMA index_info(${index.name})`,
      );
      if (columns.length !== 1 || columns[0].name !== "idNote") continue;

      await db.execute(`ALTER TABLE tags RENAME TO tags_old`);
      await db.execute(`
        CREATE TABLE tags(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL DEFAULT 'Untitled',
          idNote INTEGER,
          FOREIGN KEY (idNote) REFERENCES notes(id) ON DELETE CASCADE
        )
      `);
      await db.execute(`INSERT INTO tags(id, title, idNote) SELECT id, title, idNote FROM tags_old`);
      await db.execute(`DROP TABLE tags_old`);
      break;
    }
  } catch (error) {
    console.error(error);
    throw error;
  }
}
