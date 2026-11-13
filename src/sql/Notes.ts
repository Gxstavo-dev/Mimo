import { db } from "./connection";
import Tables from "./Tables";

interface Note {
  id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export const ShowNotes = async () => {
  await Tables();
  const rows = await db.select<Note[]>(
    `SELECT * FROM notes ORDER BY id DESC`,
  );
  return rows;
};

export const CreateNote = async () => {
  await Tables();
  const id = await db.execute(
    `INSERT INTO notes(title,content) VALUES('Untitled',' ')`,
  );
  return id.lastInsertId;
};

export const UpdateNote = async (
  id: number,
  title?: string,
  content?: string,
) => {
  await Tables();
  const note = await db.execute(
    `
      UPDATE notes
      SET title = $1, content = $2
      WHERE id = $3
    `,
    [title, content, id],
  );
  return note;
};

export const DeleteNote = async (id: number) => {
  await Tables();
  await db.execute(`DELETE FROM notes WHERE id = $1`, [id]);
};

export const GetNote = async (id: number) => {
  await Tables();
  const row = await db.select<Note>(`SELECT * FROM notes WHERE id = $1`, [id]);
  return row;
};
