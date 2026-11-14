import { useEffect, useState } from "react";
import Content from "./components/Content";
import Sidebar from "./components/Sidebar";
import CodexChat, { CodexLauncher } from "./components/CodexChat";
import { useDatabase } from "./store/Database";
import { useTheme } from "./store/Theme";

export default function App() {
  const [codexOpen, setCodexOpen] = useState(false);
  const scheme = useTheme((state) => state.scheme);
  const initDatabase = useDatabase((state) => state.init);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", scheme === "dark");
  }, [scheme]);

  useEffect(() => {
    initDatabase().catch((error) => console.error("Database error:", error));
  }, [initDatabase]);

  return (
    <main className="relative flex h-screen w-full shrink-0 overflow-hidden dark:bg-background">
      <Sidebar />
      <Content />
      <CodexLauncher open={codexOpen} onToggle={() => setCodexOpen((open) => !open)} />
      {codexOpen && <CodexChat onClose={() => setCodexOpen(false)} />}
    </main>
  );
}
