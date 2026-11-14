import { Component } from "../components/Components";
import { db } from "./connection";
import Tables from "./Tables";
import { SaveNoteRevision } from "./NoteHistory";

interface Note {
  id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export const ShowNotes = async () => {
  await Tables();
  const rows = await db.select<Note[]>(`SELECT * FROM notes ORDER BY id DESC`);
  return rows;
};

export const CreateNote = async () => {
  await Tables();
  const id = await db.execute(
    `INSERT INTO notes(title,content) VALUES('Untitled',' ')`,
  );
  if (id.lastInsertId != null) {
    try { await SaveNoteRevision(id.lastInsertId, true); }
    catch (error) { console.error("Could not save initial note revision:", error); }
  }
  return id.lastInsertId;
};

export const UpdateNote = async (
  id: number,
  title?: string,
  content?: string,
) => {
  await Tables();
  await db.execute(
    `
      UPDATE notes
      SET title = $1,
          content = $2,
          updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now', 'localtime')
      WHERE id = $3
    `,
    [title, content, id],
  );
  const rows = await db.select<Note[]>(`SELECT * FROM notes WHERE id = $1`, [
    id,
  ]);
  try { await SaveNoteRevision(id); }
  catch (error) { console.error("Could not save note revision:", error); }
  return rows[0] ?? null;
};

export const UpdateContent = async (id: number, content: Component[]) => {
  await Tables();
  await db.execute(
    `
      UPDATE notes
      SET content = $1,
          updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now', 'localtime')
      WHERE id = $2
    `,
    [JSON.stringify(content), id],
  );
  const rows = await db.select<Note[]>(`SELECT * FROM notes WHERE id = $1`, [
    id,
  ]);
  try { await SaveNoteRevision(id); }
  catch (error) { console.error("Could not save note revision:", error); }
  return rows[0] ?? null;
};

export const DeleteNote = async (id: number) => {
  await Tables();
  await db.execute(`DELETE FROM notes WHERE id = $1`, [id]);
};

export const GetNote = async (id: number): Promise<Note | null> => {
  await Tables();
  const row = await db.select<Note[]>(`SELECT * FROM notes WHERE id = $1`, [
    id,
  ]);
  return row[0] ?? null;
};
