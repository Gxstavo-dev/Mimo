import { useEffect } from "react";
import { ShowNotes, DeleteNote, GetNote } from "../sql/Notes";
import { useNotes } from "../store/Notes";
import { Trash } from "lucide-react";
import { useSearchNote } from "../store/Notes";
import CustomScrollbar from "./CustomScrollbar";

export default function Body() {
  const notes = useNotes((state) => state.notes);
  const setNote = useNotes((state) => state.setNote);
  const setNotes = useNotes((state) => state.setNotes);
  const deleteNote = useNotes((state) => state.deleteNote);

  const value = useSearchNote((state) => state.value);

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
    try {
      await DeleteNote(id);
      deleteNote(id);
    } catch (error) {
      console.error("Error deleting note:", error);
    }
  };

  const handleGetData = async (idx: number) => {
    try {
      const data = await GetNote(idx);
      if (!data) return;
      setNote(data);
    } catch (error) {
      console.error("Error getting note:", error);
    }
  };

  const searchTerm = value.trim().toLowerCase();
  const visibleNotes = notes.filter((note) =>
    note.title.toLowerCase().includes(searchTerm),
  );

  const NOTES = visibleNotes.map((note) => {
    const title = note.title.trim();
    const words = title.split(/\s+/);

    const TitleCut =
      words.length > 7 ? words.slice(0, 7).join(" ") + "..." : title;

    return (
      <div
        key={note.id}
        className="w-full h-10 flex items-center justify-between pr-2"
      >
        <button
          onClick={() => handleGetData(note.id)}
          className="flex-1 h-10 flex shrink-0 items-center pl-4  outline-none select-none text-[12px] text-text-secondary hover:text-text-primary dark:text-text-secondary"
        >
          {TitleCut}
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
    <section className="flex-1 min-h-0 w-full">
      <CustomScrollbar
        direction="vertical"
        label="Notes"
        className="h-full w-full"
        contentClassName="flex min-h-full w-full flex-col items-center gap-2"
      >
        {NOTES}
      </CustomScrollbar>
    </section>
  );
}
