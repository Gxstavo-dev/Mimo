import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { CircleHelp, Mic, MicOff } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { createPortal } from "react-dom";
import CustomScrollbar from "./CustomScrollbar";

function VoiceInputButton({ onText }: { onText: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState("");
  const onTextRef = useRef(onText);
  const listeningRef = useRef(false);
  const unlistenRef = useRef<UnlistenFn[]>([]);

  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  useEffect(() => () => {
    if (listeningRef.current) void invoke("stop_dictation");
    unlistenRef.current.forEach((unlisten) => unlisten());
  }, []);

  const toggleListening = async () => {
    if (listening) {
      setMessage("Terminando la transcripción…");
      try {
        await invoke("stop_dictation");
      } catch (error) {
        listeningRef.current = false;
        setListening(false);
        setMessage(`No se pudo detener el dictado: ${String(error)}`);
        unlistenRef.current.forEach((unlisten) => unlisten());
        unlistenRef.current = [];
      }
      return;
    }

    if (listeningRef.current) return;
    listeningRef.current = true;
    setMessage("Preparando el micrófono y el modelo…");
    setListening(true);
    try {
      const unlistenTranscript = await listen<string>("dictation-transcript", (event) => {
        onTextRef.current(event.payload);
      });
      const unlistenStatus = await listen<{ message: string }>("dictation-status", (event) => {
        setMessage(event.payload.message);
        if (event.payload.message === "Dictado detenido.") {
          listeningRef.current = false;
          setListening(false);
          unlistenRef.current.forEach((unlisten) => unlisten());
          unlistenRef.current = [];
        }
      });
      unlistenRef.current = [unlistenTranscript, unlistenStatus];
      await invoke("start_dictation");
    } catch (error) {
      listeningRef.current = false;
      setListening(false);
      unlistenRef.current.forEach((unlisten) => unlisten());
      unlistenRef.current = [];
      setMessage(String(error));
    }
  };

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={toggleListening}
        aria-label={listening ? "Detener dictado" : "Dictar por micrófono"}
        title={listening ? "Detener dictado" : "Dictar por micrófono"}
        className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-secondary ${listening ? "text-red-500" : "text-text-secondary"}`}
      >
        {listening ? <MicOff size={13} /> : <Mic size={13} />}
        <span className="hidden sm:inline">{listening ? "Escuchando" : "Dictar"}</span>
      </button>
      {message && <span role="status" className={`max-w-56 text-right text-[10px] ${listening ? "text-text-secondary" : "text-red-500"}`}>{message}</span>}
    </div>
  );
}

function appendDictation(current: string, text: string) {
  return `${current}${current && !/\s$/.test(current) ? " " : ""}${text}`;
}

function SyntaxHelp({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, height: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(352, window.innerWidth - 24);
      const left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12));
      const estimatedHeight = Math.min(460, window.innerHeight - 24);
      const below = rect.bottom + 8;
      const top = below + estimatedHeight <= window.innerHeight ? below : Math.max(12, rect.top - estimatedHeight - 8);
      setPosition({ top, left, height: estimatedHeight });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    const dismiss = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", dismiss);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("keydown", dismiss);
    };
  }, [open]);

  return (
    <>
      <button type="button" aria-label={`Ayuda: ${title}`} title={`Ayuda: ${title}`} onClick={() => setOpen((value) => !value)}
        ref={buttonRef}
        className="rounded-md p-1 text-text-idle transition-colors hover:bg-background hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-secondary">
        <CircleHelp size={15} />
      </button>
      {open && createPortal(
        <aside style={{ top: position.top, left: position.left, height: position.height }} className="fixed z-[20000] flex w-[min(22rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-border bg-background text-xs leading-5 text-text-secondary shadow-2xl">
          <div className="min-h-0 flex-1">
            <CustomScrollbar direction="vertical" label={title} className="h-full w-full" contentClassName="p-4">
              <div className="mb-2 text-sm font-semibold text-text-primary">{title}</div>
              {children}
            </CustomScrollbar>
          </div>
          <div className="shrink-0 border-t border-border bg-background p-2 text-right">
            <button type="button" onClick={() => setOpen(false)} className="rounded-md px-2.5 py-1.5 text-[11px] font-medium text-text-primary transition hover:bg-sidebar">Cerrar guía</button>
          </div>
        </aside>, document.body,
      )}
    </>
  );
}

const mathSymbols: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", theta: "θ", lambda: "λ",
  mu: "μ", pi: "π", sigma: "σ", phi: "φ", omega: "ω", infty: "∞",
  times: "×", cdot: "⋅", pm: "±", le: "≤", leq: "≤", ge: "≥", geq: "≥",
  neq: "≠", approx: "≈", sum: "∑", int: "∫", to: "→", rightarrow: "→",
};

function latexToMathML(source: string) {
  let index = 0;
  const escapeMath = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const argument = () => {
    if (source[index] === "{") {
      index++;
      const value = sequence("}");
      if (source[index] === "}") index++;
      return value;
    }
    return atom();
  };
  const atom = (): string => {
    if (index >= source.length) return "";
    if (source[index] === "\\") {
      index++;
      const command = source.slice(index).match(/^[A-Za-z]+/)?.[0] ?? source[index++];
      if (/^[A-Za-z]+$/.test(command)) index += command.length;
      if (command === "frac") return `<mfrac><mrow>${argument()}</mrow><mrow>${argument()}</mrow></mfrac>`;
      if (command === "sqrt") return `<msqrt>${argument()}</msqrt>`;
      if (["left", "right", ",", ";", "!", " "].includes(command)) return "";
      if (mathSymbols[command]) return `<mi>${mathSymbols[command]}</mi>`;
      if (["sin", "cos", "tan", "log", "ln", "lim", "max", "min", "exp"].includes(command)) return `<mi>${command}</mi>`;
      return `<mi>${escapeMath(command)}</mi>`;
    }
    const char = source[index++];
    if (char === "{") {
      const group = sequence("}");
      if (source[index] === "}") index++;
      return `<mrow>${group}</mrow>`;
    }
    if (/\d/.test(char)) return `<mn>${char}</mn>`;
    if (/[A-Za-z]/.test(char)) return `<mi>${char}</mi>`;
    if (/\s/.test(char)) return "<mspace width=\"0.25em\"/>";
    return `<mo>${escapeMath(char)}</mo>`;
  };
  const sequence = (until?: string): string => {
    let output = "";
    while (index < source.length && source[index] !== until) {
      let base = atom();
      let sub = "";
      let sup = "";
      while (source[index] === "_" || source[index] === "^") {
        const kind = source[index++];
        const value = argument();
        if (kind === "_") sub = value;
        else sup = value;
      }
      if (sub && sup) base = `<msubsup><mrow>${base}</mrow><mrow>${sub}</mrow><mrow>${sup}</mrow></msubsup>`;
      else if (sub) base = `<msub><mrow>${base}</mrow><mrow>${sub}</mrow></msub>`;
      else if (sup) base = `<msup><mrow>${base}</mrow><mrow>${sup}</mrow></msup>`;
      output += base;
    }
    return output;
  };

  return `<math xmlns="http://www.w3.org/1998/Math/MathML"><mrow>${sequence()}</mrow></math>`;
}

export function MathBlock({ content, onChange }: { content?: string; onChange: (content: string) => void }) {
  const formula = content ?? "";
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-sidebar/50">
      <div className="flex min-h-11 items-center justify-between border-b border-border px-3 sm:px-4">
        <span className="text-[11px] font-medium tracking-wide text-text-secondary">Fórmula</span>
        <SyntaxHelp title="Sintaxis de fórmulas">
          <p>Escribe en la caja superior usando los comandos admitidos. La vista previa se actualiza mientras escribes. Esta es una sintaxis matemática inspirada en LaTeX, no un procesador completo de LaTeX.</p>
          <h4 className="mt-3 font-semibold text-text-primary">Reglas básicas</h4>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            <li><code className="text-text-primary">&#123;...&#125;</code> agrupa una expresión; úsalo si el numerador, exponente o índice tiene más de un símbolo.</li>
            <li><code className="text-text-primary">^</code> crea un exponente y <code className="text-text-primary">_</code> un subíndice. Sin llaves afectan al símbolo que sigue.</li>
            <li><code className="text-text-primary">\frac&#123;arriba&#125;&#123;abajo&#125;</code> forma una fracción; <code className="text-text-primary">\sqrt&#123;...&#125;</code> una raíz.</li>
            <li>Los comandos empiezan con barra invertida. Separa comandos entre sí con espacios.</li>
          </ul>
          <h4 className="mt-3 font-semibold text-text-primary">Ejemplos</h4>
          <div className="mt-1 space-y-2">
            <div><code className="block rounded-md bg-sidebar px-2 py-1.5 font-mono text-text-primary">{String.raw`\frac{a+b}{c}`}</code><span>Fracción con numerador de dos términos.</span></div>
            <div><code className="block rounded-md bg-sidebar px-2 py-1.5 font-mono text-text-primary">{String.raw`x_{n+1} = x_n^2`}</code><span>Índice y exponente con grupos.</span></div>
            <div><code className="block rounded-md bg-sidebar px-2 py-1.5 font-mono text-text-primary">{String.raw`\sqrt{x^2 + 1}`}</code><span>Raíz de una expresión completa.</span></div>
            <div><code className="block rounded-md bg-sidebar px-2 py-1.5 font-mono text-text-primary">{String.raw`\sum_{i=1}^{n} i, \alpha \leq \beta`}</code><span>Símbolo de suma, letras griegas y comparación.</span></div>
          </div>
          <p className="mt-3 rounded-lg border border-border bg-sidebar/60 p-2">Admite fracción, raíz, superíndices, subíndices, letras griegas, suma, integral, flechas y operadores comunes como <code>\leq</code>, <code>\neq</code> y <code>\infty</code>. Matrices y entornos como <code>\begin&#123;...&#125;</code> todavía no están implementados.</p>
        </SyntaxHelp>
      </div>
      <textarea
        value={formula}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder="Escribe una fórmula, por ejemplo: \\frac{-b + \\sqrt{b^2 - 4ac}}{2a}"
        aria-label="Fórmula en sintaxis LaTeX"
        className="w-full resize-y bg-transparent px-3 py-3 font-mono text-sm text-text-primary outline-none placeholder:text-text-idle sm:px-4"
        rows={2}
      />
      <div className="overflow-x-auto border-t border-border px-4 py-5 text-xl text-text-primary">
        {formula ? <div className="min-w-fit" dangerouslySetInnerHTML={{ __html: latexToMathML(formula) }} /> : <span className="text-xs text-text-idle">La vista previa aparecerá aquí</span>}
      </div>
    </div>
  );
}

export function DictationTextBlock({ content, onChange }: { content?: string; onChange: (content: string) => void }) {
  const text = content ?? "";
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-sidebar/50">
      <div className="flex min-h-11 items-center justify-between border-b border-border px-3 sm:px-4">
        <span className="text-[11px] font-medium tracking-wide text-text-secondary">Texto</span>
        <VoiceInputButton onText={(transcript) => onChange(appendDictation(text, transcript))} />
      </div>
      <textarea
        value={text}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder="Escribe o dicta tu texto…"
        aria-label="Texto con dictado por voz"
        className="w-full resize-y bg-transparent px-3 py-3 text-sm leading-6 text-text-primary outline-none placeholder:text-text-idle sm:px-4"
        rows={3}
      />
      <p className="px-3 pb-3 text-[10px] text-text-idle sm:px-4">
        Pulsa Dictar y comienza a hablar. El modelo se descarga la primera vez y después transcribe localmente.
      </p>
    </div>
  );
}

type DiagramNode = { id: string; label: string };
function parseDiagram(source: string) {
  const nodes: DiagramNode[] = [];
  const edges: Array<[string, string]> = [];
  const known = new Set<string>();
  const addNode = (token: string) => {
    const match = token.trim().match(/^([\w-]+)(?:\[([^\]]*)\]|\(([^)]*)\)|\{([^}]*)\})?$/);
    if (!match) return null;
    const [, id, square, round, curly] = match;
    if (!known.has(id)) {
      known.add(id);
      nodes.push({ id, label: square ?? round ?? curly ?? id });
    }
    return id;
  };

  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || /^(flowchart|graph)\s+(TD|TB|LR|RL|BT)$/i.test(trimmed)) continue;
    const tokens = trimmed.split(/\s*(?:-->|---|==>|-.->)\s*/);
    if (tokens.length > 1) {
      const chain = tokens.map(addNode).filter((id): id is string => Boolean(id));
      for (let i = 0; i < chain.length - 1; i++) edges.push([chain[i], chain[i + 1]]);
    } else {
      const label = trimmed.replace(/^[-*]\s*/, "");
      if (!addNode(label)) {
        const id = `step-${nodes.length + 1}`;
        known.add(id);
        nodes.push({ id, label });
      }
    }
  }
  return { nodes, edges };
}

export function DiagramBlock({ content, onChange }: { content?: string; onChange: (content: string) => void }) {
  const source = content ?? "";
  const { nodes, edges } = parseDiagram(source);
  const width = 520;
  const nodeWidth = 300;
  const lineHeight = 17;
  const wrapLabel = (label: string) => {
    const words = label.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [""];
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      // Split long unbroken strings too, so they cannot escape the node bounds.
      const pieces = word.match(new RegExp(`.{1,34}`, "gu")) ?? [word];
      for (const piece of pieces) {
        if (line && `${line} ${piece}`.length > 34) {
          lines.push(line);
          line = piece;
        } else line = line ? `${line} ${piece}` : piece;
      }
    }
    if (line) lines.push(line);
    return lines;
  };
  const wrappedNodes = nodes.map((node) => {
    const lines = wrapLabel(node.label);
    return { ...node, lines, height: Math.max(42, lines.length * lineHeight + 18) };
  });
  const nodeTop = (index: number) => 12 + wrappedNodes.slice(0, index).reduce((total, node) => total + node.height + 40, 0);
  const nodeCenter = (index: number) => nodeTop(index) + wrappedNodes[index].height / 2;
  const height = Math.max(100, wrappedNodes.reduce((total, node) => total + node.height + 40, 12));
  const nodeIndex = new Map(nodes.map((node, index) => [node.id, index]));

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-sidebar/50">
      <div className="flex min-h-11 items-center justify-between border-b border-border px-3 sm:px-4">
        <span className="text-[11px] font-medium tracking-wide text-text-secondary">Diagrama de flujo</span>
        <SyntaxHelp title="Sintaxis de diagramas">
          <p>Escribe una línea de inicio y después una conexión por línea. Cada nodo necesita un identificador corto, único y sin espacios; el texto visible va entre delimitadores.</p>
          <h4 className="mt-3 font-semibold text-text-primary">Forma de los nodos</h4>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            <li><code className="text-text-primary">A[Texto]</code> crea un bloque rectangular, útil para procesos.</li>
            <li><code className="text-text-primary">A(Texto)</code> crea un bloque redondeado, útil para inicio o fin.</li>
            <li><code className="text-text-primary">A&#123;Texto&#125;</code> crea un bloque con forma de decisión.</li>
            <li>Las etiquetas pueden incluir espacios; los identificadores no.</li>
          </ul>
          <h4 className="mt-3 font-semibold text-text-primary">Conexiones y ejemplo</h4>
          <p className="mt-1">Usa <code>--&gt;</code> para conectar nodos. Puedes encadenar varios, o repetir un identificador para crear una bifurcación:</p>
          <div className="mt-2 whitespace-pre-wrap rounded-md bg-sidebar p-2 font-mono text-[11px] leading-5 text-text-primary">{`flowchart TD\nInicio(Inicio) --> Revisar[Revisar datos]\nRevisar --> Decision{¿Son correctos?}\nDecision --> Guardar[Guardar]\nDecision --> Corregir[Corregir datos]`}</div>
          <p className="mt-2">En este ejemplo, ambas últimas líneas salen de <code>Decision</code>. También se aceptan los encabezados <code>graph TD</code>, <code>flowchart TB</code>, <code>LR</code>, <code>RL</code> y <code>BT</code>. La vista previa actual organiza los nodos verticalmente; por ahora todos los tipos de flecha se dibujan igual.</p>
          <p className="mt-3 rounded-lg border border-border bg-sidebar/60 p-2">Si una conexión no aparece, revisa que el identificador exista y esté escrito exactamente igual en ambos lados. Cada nodo se dibuja una sola vez aunque aparezca en varias conexiones.</p>
        </SyntaxHelp>
      </div>
      <textarea
        value={source}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={'flowchart TD\nA[Inicio] --> B[Proceso] --> C[Fin]'}
        aria-label="Definición del diagrama"
        spellCheck={false}
        className="w-full resize-y border-b border-border bg-transparent px-3 py-3 font-mono text-xs leading-5 text-text-primary outline-none placeholder:text-text-idle sm:px-4"
        rows={3}
      />
      <div className="max-h-[420px] overflow-auto p-3 sm:p-4">
        {nodes.length ? (
          <svg viewBox={`0 0 ${width} ${height}`} className="mx-auto h-auto w-full max-w-2xl" role="img" aria-label="Vista previa del diagrama">
            <defs><marker id="diagram-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="currentColor" /></marker></defs>
            {edges.map(([from, to], index) => {
              const fromIndex = nodeIndex.get(from) ?? 0;
              const toIndex = nodeIndex.get(to) ?? 0;
              const fromY = nodeTop(fromIndex) + wrappedNodes[fromIndex].height;
              const toY = nodeTop(toIndex);
              return <path key={`${from}-${to}-${index}`} d={`M ${width / 2} ${fromY} L ${width / 2} ${toY}`} fill="none" stroke="currentColor" strokeWidth="1.5" markerEnd="url(#diagram-arrow)" className="text-text-secondary" />;
            })}
            {wrappedNodes.map((node, index) => (
              <g key={node.id}>
                <rect x={width / 2 - nodeWidth / 2} y={nodeTop(index)} width={nodeWidth} height={node.height} rx="10" fill="var(--background)" stroke="var(--border)" />
                <text textAnchor="middle" className="fill-text-primary" fontSize="13">
                  {node.lines.map((line, lineIndex) => <tspan key={lineIndex} x={width / 2} y={nodeCenter(index) + (lineIndex - (node.lines.length - 1) / 2) * lineHeight}>{line}</tspan>)}
                </text>
              </g>
            ))}
          </svg>
        ) : <p className="py-5 text-center text-xs text-text-idle">Escribe nodos como <code>A[Inicio] --&gt; B[Proceso]</code> para dibujar el diagrama.</p>}
      </div>
    </div>
  );
}

export { VoiceInputButton, appendDictation };
