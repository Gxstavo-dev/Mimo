import { useEffect, useRef, useState } from "react";
import { useNotes } from "../store/Notes";
import { UpdateNote } from "../sql/Notes";
import { useTags } from "../store/Tags";
import { ShowTags, CreateTag, DeleteTag, UpdateTag } from "../sql/Tags";
import { X } from "lucide-react";
import CustomScrollbar from "./CustomScrollbar";
import Editor from "./Editor";

const formatTime = (date: string) => {
  const time = date.split(/[ T]/)[1];
  return time ? time.slice(0, 5) : date;
};

export default function Content() {
  const note = useNotes((state) => state.note);
  const notes = useNotes((state) => state.notes);
  const setNote = useNotes((state) => state.setNote);
  const updateNote = useNotes((state) => state.updateNote);

  const tags = useTags((state) => state.tags);
  const setTags = useTags((state) => state.setTags);
  const deleteTag = useTags((state) => state.deleteTag);
  const updateTag = useTags((state) => state.updateTag);

  const [edit, setEdit] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const lastEscRef = useRef(0);
  const historyRef = useRef<string[]>([]);

  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [newTagId, setNewTagId] = useState<number | null>(null);
  const [valueTag, setValueTag] = useState("");

  const selectedNote = notes.find((item) => item.id === note?.id);

  useEffect(() => {
    if (!selectedNote) {
      setTags([]);
      return;
    }

    ShowTags(selectedNote.id)
      .then(setTags)
      .catch((error) => console.error("Error loading tags:", error));
  }, [selectedNote?.id, setTags]);

  const handleAddTag = async (idNote: number, title: string) => {
    try {
      const id = await CreateTag(title, idNote);
      setTags(await ShowTags(idNote));
      setValueTag("");
      setEditingTagId(id);
      setNewTagId(id);
    } catch (error) {
      console.error("Error creating tag:", error);
    }
  };

  const handleDeleteTag = async (id: number) => {
    if (editingTagId === id) setEditingTagId(null);
    await DeleteTag(id);
    deleteTag(id);
  };

  const handleUpdateTag = async (id: number, title: string) => {
    const savedTitle = title.trim() || "Untitled";
    setEditingTagId((currentId) => (currentId === id ? null : currentId));
    updateTag(id, { title: savedTitle });
    try {
      await UpdateTag(id, savedTitle);
    } catch (error) {
      console.error("Error updating tag:", error);
    }
  };

  const handleAddTagFromButton = async (idNote: number) => {
    if (editingTagId !== null) {
      await handleUpdateTag(editingTagId, valueTag);
    }
    await handleAddTag(idNote, "");
  };

  const TAGS = tags.map((tag) => {
    return (
      <div
        key={tag.id}
        className={`w-fit shrink-0 gap-1 flex items-center justify-center outline-none select-none ${newTagId === tag.id ? "tag-appear" : ""}`}
        onAnimationEnd={() => {
          setNewTagId((currentId) => (currentId === tag.id ? null : currentId));
        }}
      >
        {editingTagId === tag.id ? (
          <input
            autoFocus
            value={valueTag}
            onChange={(e) => setValueTag(e.target.value)}
            placeholder="Writte the title tag"
            className="text-text-primary text-[12px] w-28 min-w-0 outline-none select-none"
            onBlur={() => handleUpdateTag(tag.id, valueTag)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
        ) : (
          <p className="text-[12px] text-text-primary hover:text-text-secondary">
            {tag.title}
          </p>
        )}
        <X
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => handleDeleteTag(tag.id)}
          size={10}
          className="text-icon cursor-pointer outline-none select-none"
        />
      </div>
    );
  });

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
      {selectedNote && (
        <div className="w-[90%] h-[95%] flex flex-col gap-5 shrink-0">
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
                {selectedNote.title}
              </h1>
            )}

            <p className="w-full text-text-secondary text-[10px]">
              Ultima actualizacion {formatTime(selectedNote.updated_at)}
            </p>
            <div className="w-full h-10 flex items-center ">
              <p className="text-text-secondary text-[12px]">Tags:</p>
              <div className="flex-1 min-w-0 h-full flex  items-center gap-2 pl-2">
                <CustomScrollbar
                  direction="horizontal"
                  label="Tags"
                  className="h-full w-fit min-w-0 max-w-[calc(100%-6rem)] flex-none"
                >
                  {TAGS}
                </CustomScrollbar>
                <button
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleAddTagFromButton(selectedNote.id)}
                  className="shrink-0 text-[12px] text-text-secondary hover:text-text-primary px-2 py-0.7 cursor-pointer select-none outline-none"
                >
                  + Add tag
                </button>
              </div>
            </div>
          </header>
          <Editor />
        </div>
      )}
    </section>
  );
}
