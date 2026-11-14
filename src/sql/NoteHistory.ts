import { db } from "./connection";
import Tables from "./Tables";

export interface NoteRevision {
  id: number;
  note_id: number;
  title: string;
  content: string;
  tags: string;
  summary: string;
  created_at: string;
}

function notifyHistoryChanged(noteId: number) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("mimo:note-revisions", { detail: { noteId } }));
  }
}

interface NoteSnapshot {
  id: number;
  title: string;
  content: string | null;
}

const contentSummary = (content: string) => {
  try {
    const blocks: unknown = JSON.parse(content || "[]");
    return Array.isArray(blocks) ? `${blocks.length} bloques` : "contenido actualizado";
  } catch {
    return "contenido actualizado";
  }
};

function describeChanges(previous: NoteRevision | undefined, current: NoteSnapshot, tags: string) {
  if (!previous) return "Estado guardado";
  const changes: string[] = [];
  if (previous.title !== current.title) changes.push("Cambió el título");
  if (previous.content !== (current.content ?? "")) changes.push(`Actualizó contenido · ${contentSummary(current.content ?? "")}`);
  if (previous.tags !== tags) changes.push("Cambió los tags");
  return changes.length ? changes.join(" · ") : "Actualizó la nota";
}

export async function SaveNoteRevision(noteId: number, initial = false, notify = true) {
  await Tables();
  const note = (await db.select<NoteSnapshot[]>(`SELECT id, title, content FROM notes WHERE id = $1`, [noteId]))[0];
  if (!note) return;
  const tagRows = await db.select<Array<{ title: string }>>(`SELECT title FROM tags WHERE idNote = $1 ORDER BY title COLLATE NOCASE`, [noteId]);
  const tags = JSON.stringify(tagRows.map((tag) => tag.title));
  const revisions = await db.select<NoteRevision[]>(`SELECT * FROM note_revisions WHERE note_id = $1 ORDER BY id DESC LIMIT 2`, [noteId]);
  const latest = revisions[0];
  if (latest && latest.title === note.title && latest.content === (note.content ?? "") && latest.tags === tags) return;

  const summary = initial ? "Nota creada" : describeChanges(latest, note, tags);
  if (latest && latest.summary !== "Nota creada" && !initial) {
    const ages = await db.select<Array<{ seconds: number }>>(
      `SELECT (strftime('%s','now','localtime') - strftime('%s', created_at)) AS seconds FROM note_revisions WHERE id = $1`,
      [latest.id],
    );
    if ((ages[0]?.seconds ?? Number.MAX_SAFE_INTEGER) <= 15) {
      const base = revisions[1] ?? latest;
      await db.execute(`UPDATE note_revisions SET title = $1, content = $2, tags = $3, summary = $4 WHERE id = $5`, [
        note.title, note.content ?? "", tags, describeChanges(base, note, tags), latest.id,
      ]);
      if (notify) notifyHistoryChanged(noteId);
      return;
    }
  }

  await db.execute(
    `INSERT INTO note_revisions(note_id, title, content, tags, summary) VALUES($1, $2, $3, $4, $5)`,
    [noteId, note.title, note.content ?? "", tags, summary],
  );
  if (notify) notifyHistoryChanged(noteId);
}

export async function ShowNoteRevisions(noteId: number) {
  await Tables();
  let revisions = await db.select<NoteRevision[]>(`SELECT * FROM note_revisions WHERE note_id = $1 ORDER BY id DESC`, [noteId]);
  if (!revisions.length) {
    await SaveNoteRevision(noteId, false, false);
    revisions = await db.select<NoteRevision[]>(`SELECT * FROM note_revisions WHERE note_id = $1 ORDER BY id DESC`, [noteId]);
  }
  return revisions;
}
