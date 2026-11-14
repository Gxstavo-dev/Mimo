import { PanelRight, Plus, Search } from "lucide-react";
import { useHiddeSidebar } from "../store/HiddeSidebar";
import { CreateNote, ShowNotes } from "../sql/Notes";
import { useNotes } from "../store/Notes";
import { useSearchNote } from "../store/Notes";

export default function Head() {
  const toggleHidde = useHiddeSidebar((state) => state.toggle);
  const setNotes = useNotes((state) => state.setNotes);
  const setNote = useNotes((state) => state.setNote);

  const value = useSearchNote((state) => state.value);
  const setValue = useSearchNote((state) => state.setValue);

  const handleCreate = async () => {
    try {
      const id = await CreateNote();
      const notes = await ShowNotes();
      setNotes(notes);

      const createdNote = notes.find((note) => note.id === id);
      if (createdNote) setNote(createdNote);
    } catch (error) {
      console.error("Error creating note:", error);
    }
  };

  return (
    <section className="w-full h-13 flex shrink-0 gap-2 items-center justify-between pl-2 pr-2">
      <div className="flex-1 flex items-center gap-2 pl-2">
        <PanelRight
          onClick={() => toggleHidde()}
          size={15}
          className="text-icon cursor-pointer outline-none select-none"
        />
        <div className="relative w-50 h-full flex items-center justify-center">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-icon cursor-pointer pointer-events-none outline-none select-none"
          />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Search note"
            className="w-full pl-9 outline-none select-none text-[12px] text-text-secondary"
          />
        </div>
      </div>
      <Plus
        onClick={handleCreate}
        size={15}
        className="text-icon cursor-pointer outline-none select-none"
      />
    </section>
  );
}
