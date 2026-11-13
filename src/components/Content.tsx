// import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNotes } from "../store/Notes";
import { UpdateNote } from "../sql/Notes";
import Editor from "./Editor";

const formatTime = (date: string) => {
  const time = date.split(/[ T]/)[1];
  return time ? time.slice(0, 5) : date;
};

export default function Content() {
  const note = useNotes((state) => state.note);
  const setNote = useNotes((state) => state.setNote);
  const updateNote = useNotes((state) => state.updateNote);
  const [edit, setEdit] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const lastEscRef = useRef(0);
  const historyRef = useRef<string[]>([]);

  useEffect(() => {
    setEdit(false);
    setValue(note?.title ?? "");
    lastEscRef.current = 0;
  }, [note?.id]);

  const persistTitle = async () => {
    if (!note) return;

    const title = value.trim() || "Untitled";
    updateNote(note.id, { title });
    setNote({ ...note, title });
    await UpdateNote(note.id, title, note.content);
  };

  const startEdit = () => {
    const title = note?.title ?? "";
    historyRef.current = [title];
    setValue(title);
    setEdit(true);
  };

  const cancelEdit = () => {
    historyRef.current = [];
    setValue(note?.title ?? "");
    setEdit(false);
  };

  const closeNote = async () => {
    await persistTitle();
    setNote(null);
  };

  useEffect(() => {
    if (!edit) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        cancelEdit();
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [edit, note]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const undo =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z";

      if (undo && edit) {
        event.preventDefault();

        if (historyRef.current.length > 1) {
          historyRef.current.pop();
          setValue(historyRef.current[historyRef.current.length - 1]);
        }
        return;
      }

      if (event.key === "Enter" && edit) {
        persistTitle();
        setEdit(false);
        return;
      }

      if (event.key !== "Escape") return;

      if (edit) {
        persistTitle();
        setEdit(false);
      }

      const now = Date.now();

      if (now - lastEscRef.current < 500) {
        lastEscRef.current = 0;
        closeNote();
      } else {
        lastEscRef.current = now;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [edit, value, note]);

  return (
    <section className="flex-1 flex items-center  justify-center gap-1 h-full bg-background">
      {note && (
        <div className="w-[90%] h-[95%] flex flex-col gap-2 shrink-0 ">
          <header className="w-full flex flex-col items-center  gap-4">
            {edit ? (
              <input
                ref={inputRef}
                autoFocus
                placeholder="Writte the new title"
                className="w-full outline-none select-none text-text-primary text-[12px]"
                value={value}
                onChange={(e) => {
                  const title = e.target.value;
                  setValue(title);

                  if (
                    historyRef.current[historyRef.current.length - 1] !== title
                  ) {
                    historyRef.current.push(title);
                  }
                }}
              />
            ) : (
              <h1
                onClick={startEdit}
                className="text-text-primary w-full shrink-0"
              >
                {note?.title}
              </h1>
            )}

            <p className="w-full text-text-secondary text-[10px]">
              Ultima actualizacion {formatTime(note.updated_at)}
            </p>
            <div className="w-full h-10 flex items-center">
              <p className="text-text-secondary text-[11px]">Tags:</p>
              <div className="flex-1 h-full flex items-center">
                <button className="text-[10px] text-text-secondary hover:text-text-primary px-2 py-0.7 cursor-pointer select-none outline-none">
                  + Add tag
                </button>
                <div className="h-full flex-1 flex shrink-0 overflow1-y-scroll items-center gap-2">
                  {
                    // <button className="w-20 gap-1 flex items-center justify-center cursor-pointer outline-none select-none">
                    //   <p className="text-[10px] text-text-primary hover:text-text-secondary">
                    //     Workspaces
                    //   </p>
                    //   <X
                    //     size={10}
                    //     className="text-icon cursor-pointer outline-none select-none"
                    //   />
                    // </button>
                  }
                </div>
              </div>
            </div>
          </header>
          <Editor />
        </div>
      )}
    </section>
  );
}
