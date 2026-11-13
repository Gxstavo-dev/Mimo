import { db } from "./connection";
import Tables from "./Tables";

interface Tags {
  id: number;
  title: string;
  idNote: number;
}

export const ShowTags = async (idNote: number) => {
  await Tables();
  const rows = await db.select<Tags[]>(
    `SELECT * FROM tags WHERE idNote = $1 ORDER BY id ASC`,
    [idNote],
  );
  return rows;
};

export const CreateTag = async (title: string, idNote: number) => {
  await Tables();
  const result = await db.execute(`INSERT INTO tags(title,idNote) VALUES($1,$2)`, [
    title,
    idNote,
  ]);
  if (result.lastInsertId == null) {
    throw new Error("Could not get the new tag id");
  }
  return result.lastInsertId;
};

export const DeleteTag = async (id: number) => {
  await Tables();
  await db.execute(`DELETE FROM tags WHERE id=$1`, [id]);
};

export const UpdateTag = async (id: number, title: string) => {
  await Tables();
  const row = await db.execute(`UPDATE tags SET title=$1 WHERE id=$2`, [
    title,
    id,
  ]);
  return row;
};
