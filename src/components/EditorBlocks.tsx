import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";

type SpeechResult = { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string; isFinal: boolean }>> };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechResult) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function VoiceInputButton({ onText }: { onText: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const [available, setAvailable] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onTextRef = useRef(onText);

  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const toggleListening = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setAvailable(false);
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "es-MX";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).slice(event.resultIndex)
        .filter((result) => result[0]?.isFinal)
        .map((result) => result[0].transcript.trim())
        .filter(Boolean)
        .join(" ");
      if (transcript) onTextRef.current(transcript);
    };
    recognition.onerror = () => {
      setListening(false);
      setAvailable(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setAvailable(true);
    setListening(true);
    try {
      recognition.start();
    } catch {
      setListening(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggleListening}
      aria-label={available ? (listening ? "Detener dictado" : "Dictar por micrófono") : "Dictado no disponible en este navegador"}
      title={!available ? "El dictado por voz no está disponible en este navegador" : listening ? "Detener dictado" : "Dictar por micrófono"}
      className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-secondary ${listening ? "text-red-500" : "text-text-secondary"}`}
    >
      {listening ? <MicOff size={13} /> : <Mic size={13} />}
      <span className="hidden sm:inline">{listening ? "Escuchando" : "Dictar"}</span>
    </button>
  );
}

function appendDictation(current: string, text: string) {
  return `${current}${current && !/\s$/.test(current) ? " " : ""}${text}`;
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
        <VoiceInputButton onText={(text) => onChange(appendDictation(formula, text))} />
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
  const height = Math.max(100, nodes.length * 82 + 24);
  const rowY = (index: number) => index * 82 + 34;
  const nodeIndex = new Map(nodes.map((node, index) => [node.id, index]));

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-sidebar/50">
      <div className="flex min-h-11 items-center justify-between border-b border-border px-3 sm:px-4">
        <span className="text-[11px] font-medium tracking-wide text-text-secondary">Diagrama de flujo</span>
        <VoiceInputButton onText={(text) => onChange(appendDictation(source, text))} />
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
              const fromY = rowY(nodeIndex.get(from) ?? 0) + 18;
              const toY = rowY(nodeIndex.get(to) ?? 0) - 19;
              return <path key={`${from}-${to}-${index}`} d={`M ${width / 2} ${fromY} L ${width / 2} ${toY}`} fill="none" stroke="currentColor" strokeWidth="1.5" markerEnd="url(#diagram-arrow)" className="text-text-secondary" />;
            })}
            {nodes.map((node, index) => (
              <g key={node.id}>
                <rect x={width / 2 - 105} y={rowY(index) - 18} width="210" height="38" rx="10" fill="var(--background)" stroke="var(--border)" />
                <text x={width / 2} y={rowY(index) + 5} textAnchor="middle" className="fill-text-primary" fontSize="13">{node.label}</text>
              </g>
            ))}
          </svg>
        ) : <p className="py-5 text-center text-xs text-text-idle">Escribe nodos como <code>A[Inicio] --&gt; B[Proceso]</code> para dibujar el diagrama.</p>}
      </div>
    </div>
  );
}

export { VoiceInputButton, appendDictation };
