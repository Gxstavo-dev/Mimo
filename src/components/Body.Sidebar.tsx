import { useEffect } from "react";
import { ShowNotes, DeleteNote } from "../sql/Notes";
import { useNotes } from "../store/Notes";
import { Trash } from "lucide-react";

export default function Body() {
  const notes = useNotes((state) => state.notes);
  const setNotes = useNotes((state) => state.setNotes);
  const deleteNote = useNotes((state) => state.deleteNote);

  useEffect(() => {
    const loadNotes = async () => {
      try {
        const rows = await ShowNotes();
        setNotes(rows);
      } catch (error) {
        console.error("Error loading notes:", error);
      }
    };

    loadNotes();
  }, [setNotes]);

  const handleDeleteNote = async (id: number) => {
    deleteNote(id);
    await DeleteNote(id);
  };

  const NOTES = notes.map((note) => {
    return (
      <div
        key={note.id}
        className="w-full h-10 flex items-center justify-between pr-2"
      >
        <button className="flex-1 h-10 flex shrink-0 items-center pl-4  outline-none select-none text-[12px] text-text-secondary hover:text-text-primary dark:text-text-secondary">
          {note.title}
        </button>
        <Trash
          onClick={() => handleDeleteNote(note.id)}
          size={15}
          color="red"
          className="cursor-pointer outline-none select-none"
        />
      </div>
    );
  });

  return (
    <section className="flex-1 min-h-0 w-full overflow-y-auto flex items-center flex-col gap-2">
      {NOTES}
    </section>
  );
}
