import { useEffect, useRef, useState } from "react";
import Render, { type Component, type tagHtml } from "./Components";
import { UpdateContent } from "../sql/Notes";
import { useNotes } from "../store/Notes";

const options: {
  type: tagHtml;
  label: string;
  content?: string;
  items?: string[];
  className: string;
}[] = [
  {
    type: "h1",
    label: "H1 - Titulo Grande",
    content: "Texto con h1",
    className: "text-text-primary text-4xl",
  },
  {
    type: "h2",
    label: "H2 - Titulo Mediano",
    content: "Texto con h2",
    className: "text-text-primary text-2xl",
  },
  {
    type: "h3",
    label: "H3 - Titulo Pequeño",
    content: "Texto con h3",
    className: "text-text-primary text-xl",
  },
  {
    type: "p",
    label: "P - Texto normal",
    content: "Texto con p",
    className: "text-text-primary text-[12px]",
  },
  {
    type: "span",
    label: "Span - Texto fuerte",
    content: "Texto con span",
    className: "text-text-primary text-[12px] font-bold",
  },
  {
    type: "ul",
    label: "UL - Lista de puntos",
    items: [""],
    className: "text-text-primary text-[12px]",
  },
  {
    type: "ol",
    label: "OL - Lista numerada",
    items: [""],
    className: "text-text-primary text-[12px]",
  },
];

export default function Editor() {
  const note = useNotes((state) => state.note);
  const [showMenu, setShowMenu] = useState(false);
  const slashRef = useRef<HTMLParagraphElement>(null);
  const [bounds, setBounds] = useState({ top: 0, left: 0 });
  const [items, setItems] = useState<Component[]>([]);
  const [loadedNoteId, setLoadedNoteId] = useState<number | null>(null);
  const loadedContentRef = useRef("[]");
  const [focusId, setFocusId] = useState<string | null>(null);
  const updateNote = useNotes((state) => state.updateNote);
  const setNote = useNotes((state) => state.setNote);

  useEffect(() => {
    if (!note) {
      setItems([]);
      setLoadedNoteId(null);
      loadedContentRef.current = "[]";
      return;
    }

    let loadedItems: Component[];
    try {
      loadedItems = note.content ? JSON.parse(note.content) : [];
    } catch {
      loadedItems = [];
    }

    setItems(loadedItems);
    loadedContentRef.current = JSON.stringify(loadedItems);
    setLoadedNoteId(note.id);
  }, [note?.id]);

  useEffect(() => {
    if (!note?.id || loadedNoteId !== note.id) return;

    const serializedItems = JSON.stringify(items);
    if (serializedItems === loadedContentRef.current) return;

    const timeout = setTimeout(async () => {
      try {
        const savedNote = await UpdateContent(note.id, items);
        if (!savedNote) return;

        updateNote(savedNote.id, {
          content: savedNote.content,
          updated_at: savedNote.updated_at,
        });
        if (useNotes.getState().note?.id === savedNote.id) {
          loadedContentRef.current = serializedItems;
          setNote(savedNote);
        }
      } catch (error) {
        console.error("Error saving note content:", error);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [items, note?.id, loadedNoteId, setNote, updateNote]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "/") {
        if (slashRef.current) {
          const rect = slashRef.current.getBoundingClientRect();
          setBounds({ top: rect.top, left: rect.left });
        }
        setShowMenu(true);
      }
      if (e.key === "Escape") setShowMenu(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const addItem = (opt: (typeof options)[number]) => {
    const id = crypto.randomUUID();
    setItems((prev) => [
      ...prev,
      {
        id,
        type: opt.type,
        content: opt.content,
        items: opt.items,
        className: opt.className, // quita "autofocus" de las clases
      },
    ]);
    setFocusId(id);
    setShowMenu(false);
  };

  const updateList = (id: string, items: string[]) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, items } : item)),
    );
  };

  const updateItem = (id: string, content: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, content } : item)),
    );
  };

  const deleteItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="flex-1 flex flex-col gap-5">
      {showMenu && (
        <article
          style={{ top: bounds.top, left: bounds.left }}
          className="w-50 bg-background border border-border fixed flex flex-col gap-2 pt-3 pb-3 rounded-[14px]"
        >
          {options.map((opt) => (
            <button
              key={opt.type}
              onClick={() => addItem(opt)}
              className="flex items-center pl-2 w-full h-7 text-[12px] text-text-secondary hover:text-text-primary"
            >
              {opt.label}
            </button>
          ))}
        </article>
      )}
      <Render
        items={items}
        focusId={focusId}
        onChange={updateItem}
        onDelete={deleteItem}
        onListChange={updateList}
      />
      {!showMenu && (
        <p ref={slashRef} className="text-[12px] text-text-secondary mt-5">
          /
        </p>
      )}
    </div>
  );
}
