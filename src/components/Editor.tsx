import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Render, { type BlockType, type Component } from "./Components";
import { UpdateContent } from "../sql/Notes";
import { useNotes } from "../store/Notes";

const options: {
  type: BlockType;
  label: string;
  content?: string;
  items?: string[];
  url?: string;
  src?: string;
  language?: string;
  className: string;
}[] = [
  {
    type: "h1",
    label: "H1 - Titulo Grande",
    content: "Texto con h1",
    className: "text-text-primary text-3xl font-semibold leading-tight",
  },
  {
    type: "h2",
    label: "H2 - Titulo Mediano",
    content: "Texto con h2",
    className: "text-text-primary text-2xl font-semibold leading-snug",
  },
  {
    type: "h3",
    label: "H3 - Titulo Pequeño",
    content: "Texto con h3",
    className: "text-text-primary text-xl font-semibold leading-snug",
  },
  {
    type: "p",
    label: "P - Texto normal",
    content: "Texto con p",
    className: "text-text-primary text-sm leading-6",
  },
  {
    type: "span",
    label: "Span - Texto fuerte",
    content: "Texto con span",
    className: "text-text-primary text-sm leading-6 font-bold",
  },
  {
    type: "ul",
    label: "UL - Lista de puntos",
    items: [""],
    className: "text-text-primary text-sm leading-6",
  },
  {
    type: "ol",
    label: "OL - Lista numerada",
    items: [""],
    className: "text-text-primary text-sm leading-6",
  },
  {
    type: "link",
    label: "Enlace",
    content: "Enlace",
    url: "",
    className: "",
  },
  {
    type: "image",
    label: "Imagen",
    src: "",
    className: "",
  },
  {
    type: "video",
    label: "Video embebido",
    url: "",
    content: "Video embebido",
    className: "",
  },
  {
    type: "code",
    label: "Bloque de código",
    content: "",
    language: "plain",
    className: "",
  },
  {
    type: "math",
    label: "Fórmula matemática",
    content: "",
    className: "",
  },
  {
    type: "diagram",
    label: "Diagrama de flujo",
    content: "flowchart TD\nA[Inicio] --> B[Proceso] --> C[Fin]",
    className: "",
  },
];

export default function Editor() {
  const note = useNotes((state) => state.note);
  const [showMenu, setShowMenu] = useState(false);
  const slashRef = useRef<HTMLParagraphElement>(null);
  const menuRef = useRef<HTMLElement>(null);
  const [bounds, setBounds] = useState({ top: 0, left: 0, maxHeight: 320 });
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
        setShowMenu(true);
      }
      if (e.key === "Escape") setShowMenu(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (!showMenu) return;

    const positionMenu = () => {
      const anchor = slashRef.current?.getBoundingClientRect();
      const menu = menuRef.current;
      if (!anchor || !menu) return;

      const margin = 8;
      const maxHeight = Math.min(320, window.innerHeight - margin * 2);
      const menuHeight = Math.min(menu.scrollHeight, maxHeight);
      const spaceBelow = window.innerHeight - anchor.bottom - margin;
      const top = spaceBelow >= menuHeight || spaceBelow >= 180
        ? Math.min(anchor.bottom + 6, window.innerHeight - menuHeight - margin)
        : Math.max(margin, anchor.top - menuHeight - 6);
      const width = Math.min(288, window.innerWidth - margin * 2);
      const left = Math.max(
        margin,
        Math.min(anchor.left, window.innerWidth - width - margin),
      );

      setBounds({ top, left, maxHeight });
    };

    positionMenu();
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    return () => {
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [showMenu]);

  const addItem = (opt: (typeof options)[number]) => {
    const id = crypto.randomUUID();
    setItems((prev) => [
      ...prev,
      {
        id,
        type: opt.type,
        content: opt.content,
        items: opt.items,
        url: opt.url,
        src: opt.src,
        language: opt.language,
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

  const updateItem = (id: string, changes: Partial<Component>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  };

  const deleteItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="flex-none flex min-w-0 flex-col gap-3 overflow-x-hidden pl-7 sm:gap-4">
      {showMenu && createPortal(
        <article
          ref={menuRef}
          style={{ top: bounds.top, left: bounds.left, maxHeight: bounds.maxHeight }}
          className="fixed z-[9999] flex w-[min(18rem,calc(100vw-1rem))] flex-col gap-1 overflow-y-auto overscroll-contain rounded-xl border border-border bg-background p-2 shadow-xl"
        >
          {options.map((opt) => (
            <button
              key={opt.type}
              onClick={() => addItem(opt)}
              className="flex min-h-9 w-full shrink-0 items-center rounded-lg px-3 text-left text-xs text-text-secondary transition-colors hover:bg-sidebar hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-secondary"
            >
              {opt.label}
            </button>
          ))}
        </article>,
        document.body,
      )}
      <Render
        items={items}
        focusId={focusId}
        onChange={updateItem}
        onDelete={deleteItem}
        onListChange={updateList}
      />
      <p ref={slashRef} className={`mt-2 text-[12px] text-text-secondary ${showMenu ? "invisible" : ""}`}>
          /
      </p>
    </div>
  );
}
