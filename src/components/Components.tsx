import { X } from "lucide-react";
import { createElement, useEffect, useRef } from "react";

export type tagHtml = "h1" | "h2" | "h3" | "p" | "span" | "ul" | "ol";

export interface Component {
  id: string;
  type: tagHtml;
  content?: string;
  items?: string[]; // solo para ul / ol
  className?: string;
  style?: React.CSSProperties;
}

interface RenderProps {
  items: Component[];
  onChange: (id: string, content: string) => void;
  onListChange: (id: string, items: string[]) => void;
  onDelete: (id: string) => void;
  focusId?: string | null;
}

export default function Render({
  items,
  onChange,
  onListChange,
  onDelete,
  focusId,
}: RenderProps) {
  const focusableRefs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    if (!focusId) return;

    const frame = requestAnimationFrame(() => {
      const element = focusableRefs.current.get(focusId);
      if (!element) return;

      element.focus();
      if (!element.isContentEditable) return;

      const range = document.createRange();
      range.selectNodeContents(element);
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    });

    return () => cancelAnimationFrame(frame);
  }, [focusId]);

  const registerFocusable = (id: string, element: HTMLElement | null) => {
    if (element) focusableRefs.current.set(id, element);
    else focusableRefs.current.delete(id);
  };

  return (
    <>
      {items.map(({ id, type, content, items: listItems, ...props }) => (
        <div key={id} className="group relative">
          <button
            onClick={() => onDelete(id)}
            contentEditable={false}
            className="absolute right-full top-1/2 -translate-y-1/2 pr-1 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
            aria-label="Eliminar bloque"
          >
            <X size={15} className="text-text-primary hover:text-red-500" />
          </button>

          {type === "ul" || type === "ol"
            ? createElement(
                type,
                {
                  ...props,
                  className: `${props.className ?? ""} pl-5 ${
                    type === "ul" ? "list-disc" : "list-decimal"
                  }`,
                },
                (listItems ?? [""]).map((text, i) => (
                  <li
                    key={i}
                    ref={
                      i === 0
                        ? (element) => registerFocusable(id, element)
                        : undefined
                    }
                    contentEditable
                    suppressContentEditableWarning
                    className="outline-none"
                    onBlur={(e) => {
                      const next = [...(listItems ?? [])];
                      next[i] = e.currentTarget.textContent ?? "";
                      onListChange(id, next);
                    }}
                    onKeyDown={(e) => {
                      const current = listItems ?? [""];
                      // Enter: nuevo punto debajo
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const li = e.currentTarget;
                        const next = [...current];
                        next[i] = li.textContent ?? "";
                        next.splice(i + 1, 0, "");
                        onListChange(id, next);
                        requestAnimationFrame(() =>
                          (
                            li.nextElementSibling as HTMLElement | null
                          )?.focus(),
                        );
                      }
                      // Backspace en un punto vacío: lo elimina
                      if (
                        e.key === "Backspace" &&
                        (e.currentTarget.textContent ?? "") === "" &&
                        current.length > 1
                      ) {
                        e.preventDefault();
                        const prev = e.currentTarget
                          .previousElementSibling as HTMLElement | null;
                        onListChange(
                          id,
                          current.filter((_, idx) => idx !== i),
                        );
                        requestAnimationFrame(() => prev?.focus());
                      }
                    }}
                  >
                    {text}
                  </li>
                )),
              )
            : createElement(
                type,
                {
                  ...props,
                  className: `${props.className ?? ""} outline-none`,
                  ref: (element: HTMLElement | null) =>
                    registerFocusable(id, element),
                  contentEditable: true,
                  suppressContentEditableWarning: true,
                  onBlur: (e: React.FocusEvent<HTMLElement>) =>
                    onChange(id, e.currentTarget.textContent ?? ""),
                },
                content,
              )}
        </div>
      ))}
    </>
  );
}
