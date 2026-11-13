import { useEffect } from "react";
import { ShowNotes } from "../sql/Notes";
import { useNotes } from "../store/Notes";

export default function Body() {
  const notes = useNotes((state) => state.notes);
  const setNotes = useNotes((state) => state.setNotes);

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

  const NOTES = notes.map((note) => {
    return (
      <button
        key={note.id}
        className="w-full h-10  flex shrink-0 items-center pl-4 outline-none select-none text-[12px] text-text-secondary hover:text-text-primary dark:text-text-secondary"
      >
        {note.title}
      </button>
    );
  });

  return (
    <section className="flex-1 min-h-0 w-full overflow-y-auto flex items-center flex-col gap-2">
      {NOTES}
    </section>
  );
}
