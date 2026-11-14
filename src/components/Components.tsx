import { Check, ChevronDown, Code2, Copy, X } from "lucide-react";
import { createElement, useEffect, useLayoutEffect, useRef, useState } from "react";
import { DiagramBlock, MathBlock, VoiceInputButton, appendDictation } from "./EditorBlocks";

export type tagHtml = "h1" | "h2" | "h3" | "p" | "span" | "ul" | "ol";
export type BlockType = tagHtml | "link" | "image" | "video" | "code" | "math" | "diagram";

export interface Component {
  id: string;
  type: BlockType;
  content?: string;
  items?: string[]; // solo para ul / ol
  url?: string;
  src?: string;
  alt?: string;
  language?: string;
  className?: string;
  style?: React.CSSProperties;
}

interface RenderProps {
  items: Component[];
  onChange: (id: string, changes: Partial<Component>) => void;
  onListChange: (id: string, items: string[]) => void;
  onDelete: (id: string) => void;
  focusId?: string | null;
}

const codeLanguages = [
  "plain", "javascript", "typescript", "python", "rust", "sql", "bash", "json", "html", "css",
];

const richTextTags = new Set([
  "A", "B", "BLOCKQUOTE", "BR", "CODE", "DEL", "DIV", "EM", "I", "LI",
  "OL", "P", "PRE", "S", "SPAN", "STRONG", "U", "UL",
]);
const richTextStyles = new Set([
  "background-color", "color", "font-style", "font-weight", "text-align", "text-decoration",
]);

function sanitizeRichHtml(html: string) {
  const documentNode = new DOMParser().parseFromString(html, "text/html");
  const cleanNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    if (!(node instanceof HTMLElement)) return "";
    const tag = node.tagName;
    if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "SVG", "MATH"].includes(tag)) return "";
    const children = Array.from(node.childNodes).map(cleanNode).join("");
    if (!richTextTags.has(tag)) return children;

    const attributes: string[] = [];
    if (tag === "A") {
      const href = node.getAttribute("href") ?? "";
      try {
        const url = new URL(href, window.location.href);
        if (["http:", "https:", "mailto:"].includes(url.protocol)) {
          attributes.push(`href="${url.href.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`, 'target="_blank"', 'rel="noreferrer"');
        }
      } catch {
        // Unsafe or malformed links are retained as plain text.
      }
    }
    const safeStyles = Array.from(node.style)
      .filter((property) => richTextStyles.has(property))
      .map((property) => `${property}: ${node.style.getPropertyValue(property)}`)
      .join("; ");
    if (safeStyles) attributes.push(`style="${safeStyles.replace(/"/g, "&quot;")}"`);
    return `<${tag.toLowerCase()}${attributes.length ? ` ${attributes.join(" ")}` : ""}>${children}</${tag.toLowerCase()}>`;
  };

  return Array.from(documentNode.body.childNodes).map(cleanNode).join("");
}

function CodeBlock({
  id,
  content,
  language,
  onChange,
  registerFocusable,
}: {
  id: string;
  content?: string;
  language?: string;
  onChange: RenderProps["onChange"];
  registerFocusable: (id: string, element: HTMLElement | null) => void;
}) {
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedLanguage = language ?? "plain";

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const resizeToContent = () => {
      textarea.style.height = "auto";
      const minHeight = 120;
      const maxHeight = 360;
      const height = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
      textarea.style.height = `${height}px`;
      textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
    };

    resizeToContent();
    window.addEventListener("resize", resizeToContent);
    return () => window.removeEventListener("resize", resizeToContent);
  }, [content]);

  useEffect(() => () => {
    if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
  }, []);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(content ?? "");
      setCopied(true);
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      console.error("No se pudo copiar el código:", error);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-sidebar/70">
      <div className="flex min-h-11 items-center justify-between gap-3 border-b border-border px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 text-text-secondary">
          <Code2 size={14} aria-hidden="true" />
          <span className="text-[11px] font-medium tracking-wide">Código</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <VoiceInputButton onText={(text) => onChange(id, { content: appendDictation(content ?? "", text) })} />
          <button
            type="button"
            onClick={copyCode}
            aria-label={copied ? "Código copiado" : "Copiar código"}
            title={copied ? "Copiado" : "Copiar código"}
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] text-text-secondary transition-colors hover:bg-background hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-secondary"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span className="hidden sm:inline">{copied ? "Copiado" : "Copiar"}</span>
          </button>
          <div className="relative">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={languageMenuOpen}
            onClick={() => setLanguageMenuOpen((open) => !open)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setLanguageMenuOpen(false);
            }}
            className="inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-text-secondary transition-colors hover:bg-background hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-secondary"
          >
            <span>{selectedLanguage === "plain" ? "Texto plano" : selectedLanguage}</span>
            <ChevronDown size={13} aria-hidden="true" />
          </button>
          {languageMenuOpen && (
            <div
              role="listbox"
              aria-label="Lenguaje del bloque de código"
              className="absolute right-0 top-full z-20 mt-1 max-h-52 w-40 overflow-y-auto rounded-lg border border-border bg-background p-1 shadow-xl"
            >
              {codeLanguages.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={selectedLanguage === option}
                  onClick={() => {
                    onChange(id, { language: option });
                    setLanguageMenuOpen(false);
                  }}
                  className={`w-full rounded-md px-2.5 py-1.5 text-left text-xs capitalize transition-colors hover:bg-sidebar ${selectedLanguage === option ? "text-text-primary" : "text-text-secondary"}`}
                >
                  {option === "plain" ? "Texto plano" : option}
                </button>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>
      <textarea
        ref={(element) => {
          textareaRef.current = element;
          registerFocusable(id, element);
        }}
        value={content ?? ""}
        onChange={(event) => onChange(id, { content: event.currentTarget.value })}
        placeholder="Escribe o pega código…"
        spellCheck={false}
        rows={1}
        className="block min-h-[120px] max-h-[360px] w-full min-w-0 resize-none overflow-hidden bg-transparent px-3 py-3 font-mono text-[13px] leading-6 text-text-primary outline-none placeholder:text-text-idle sm:px-4"
      />
    </div>
  );
}

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const getVideoEmbedUrl = (value: string) => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      const id =
        url.searchParams.get("v") ??
        url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }

    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const id = url.pathname.match(/\/(?:video\/)?(\d+)/)?.[1];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    return null;
  }

  return null;
};

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
      {items.map(({ id, type, content, items: listItems, ...props }, index) => {
        const headingSpacing =
          index === 0
            ? ""
            : type === "h1"
            ? "mt-4"
            : type === "h2"
              ? "mt-3"
              : type === "h3"
                ? "mt-2"
                : "";

        return (
        <div key={id} className={`group relative min-w-0 max-w-full ${headingSpacing}`}>
          <button
            onClick={() => onDelete(id)}
            contentEditable={false}
            className="absolute right-full top-1/2 z-10 mr-2 -translate-y-1/2 rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-secondary"
            aria-label="Eliminar bloque"
          >
            <X size={15} className="text-text-primary hover:text-red-500" />
          </button>

          {type === "ul" || type === "ol" ? (
            createElement(
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
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const li = e.currentTarget;
                      const next = [...current];
                      next[i] = li.textContent ?? "";
                      next.splice(i + 1, 0, "");
                      onListChange(id, next);
                      requestAnimationFrame(() =>
                        (li.nextElementSibling as HTMLElement | null)?.focus(),
                      );
                    }
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
          ) : type === "code" ? (
            <CodeBlock
              id={id}
              content={content}
              language={props.language}
              onChange={onChange}
              registerFocusable={registerFocusable}
            />
          ) : type === "math" ? (
            <MathBlock
              content={content}
              onChange={(nextContent) => onChange(id, { content: nextContent })}
            />
          ) : type === "diagram" ? (
            <DiagramBlock
              content={content}
              onChange={(nextContent) => onChange(id, { content: nextContent })}
            />
          ) : type === "link" ? (
            <div className="flex flex-col gap-1 rounded-md border border-border px-3 py-2">
              <input
                ref={(element) => registerFocusable(id, element)}
                value={content ?? ""}
                onChange={(event) =>
                  onChange(id, { content: event.currentTarget.value })
                }
                placeholder="Texto del enlace"
                className="bg-transparent text-sm text-text-primary outline-none"
              />
              <input
                value={props.url ?? ""}
                onChange={(event) =>
                  onChange(id, { url: event.currentTarget.value })
                }
                placeholder="https://..."
                inputMode="url"
                className="bg-transparent text-xs text-text-secondary outline-none"
              />
              {isHttpUrl(props.url ?? "") && (
                <a
                  href={props.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 w-fit text-xs text-blue-500 underline underline-offset-2"
                >
                  Abrir enlace
                </a>
              )}
            </div>
          ) : type === "image" ? (
            <figure className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={(element) => registerFocusable(id, element)}
                  value={props.src ?? ""}
                  onChange={(event) =>
                    onChange(id, { src: event.currentTarget.value })
                  }
                  placeholder="Pega la URL de una imagen"
                  inputMode="url"
                  className="min-w-0 flex-1 bg-transparent text-xs text-text-secondary outline-none"
                />
                <label className="cursor-pointer rounded px-2 py-1 text-xs text-text-secondary hover:bg-sidebar">
                  Elegir archivo
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      if (!file) return;
                      if (!file.type.startsWith("image/")) return;
                      if (file.size > 5 * 1024 * 1024) {
                        window.alert("La imagen debe pesar menos de 5 MB.");
                        event.currentTarget.value = "";
                        return;
                      }

                      const reader = new FileReader();
                      reader.onload = () => {
                        if (typeof reader.result !== "string") return;
                        onChange(id, {
                          src: reader.result,
                          alt: props.alt || file.name,
                        });
                      };
                      reader.onerror = () =>
                        console.error("Error reading image file");
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              </div>
              <input
                value={props.alt ?? ""}
                onChange={(event) =>
                  onChange(id, { alt: event.currentTarget.value })
                }
                placeholder="Descripción de la imagen"
                className="bg-transparent text-xs text-text-secondary outline-none"
              />
              {props.src && isHttpUrl(props.src) ? (
                <img
                  src={props.src}
                  alt={props.alt ?? ""}
                  className="max-h-[480px] max-w-full rounded object-contain object-left"
                />
              ) : props.src?.startsWith("data:image/") ? (
                <img
                  src={props.src}
                  alt={props.alt ?? ""}
                  className="max-h-[480px] max-w-full rounded object-contain object-left"
                />
              ) : null}
            </figure>
          ) : type === "video" ? (
            <div className="flex flex-col gap-2">
              <input
                ref={(element) => registerFocusable(id, element)}
                value={props.url ?? ""}
                onChange={(event) =>
                  onChange(id, { url: event.currentTarget.value })
                }
                placeholder="URL de YouTube o Vimeo"
                inputMode="url"
                className="bg-transparent text-xs text-text-secondary outline-none"
              />
              {getVideoEmbedUrl(props.url ?? "") ? (
                <iframe
                  src={getVideoEmbedUrl(props.url ?? "") ?? undefined}
                  title={content || "Video embebido"}
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="aspect-video w-full max-w-3xl rounded-md border-0"
                />
              ) : props.url ? (
                <p className="text-xs text-text-secondary">
                  Pega un enlace válido de YouTube o Vimeo.
                </p>
              ) : null}
            </div>
          ) : (
            createElement(
              type,
              {
                ...props,
                className: `${props.className ?? ""} whitespace-pre-wrap break-words outline-none`,
                ref: (element: HTMLElement | null) =>
                  registerFocusable(id, element),
                contentEditable: true,
                suppressContentEditableWarning: true,
                dangerouslySetInnerHTML: { __html: sanitizeRichHtml(content ?? "") },
                onPaste: (event: React.ClipboardEvent<HTMLElement>) => {
                  const html = event.clipboardData.getData("text/html");
                  const plainText = event.clipboardData.getData("text/plain");
                  if (!html && !plainText) return;
                  event.preventDefault();

                  const safeHtml = html
                    ? sanitizeRichHtml(html)
                    : plainText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                  const template = document.createElement("template");
                  template.innerHTML = safeHtml;
                  const fragment = template.content;
                  const selection = window.getSelection();
                  const range = selection?.rangeCount ? selection.getRangeAt(0) : null;

                  if (range && event.currentTarget.contains(range.commonAncestorContainer)) {
                    range.deleteContents();
                    const lastNode = fragment.lastChild;
                    range.insertNode(fragment);
                    if (lastNode) {
                      range.setStartAfter(lastNode);
                      range.collapse(true);
                      selection?.removeAllRanges();
                      selection?.addRange(range);
                    }
                  } else {
                    event.currentTarget.append(fragment);
                  }
                },
                onBlur: (event: React.FocusEvent<HTMLElement>) =>
                  onChange(id, {
                    content: sanitizeRichHtml(event.currentTarget.innerHTML),
                  }),
              },
            )
          )}
        </div>
        );
      })}
    </>
  );
}
