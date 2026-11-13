import { useEffect } from "react";
import Content from "./components/Content";
import Sidebar from "./components/Sidebar";
import { useDatabase } from "./store/Database";
import { useTheme } from "./store/Theme";

export default function App() {
  const scheme = useTheme((state) => state.scheme);
  const initDatabase = useDatabase((state) => state.init);

  useEffect(() => {
    initDatabase().catch((error) => console.error("Database error:", error));
  }, [initDatabase]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", scheme === "dark");
  }, [scheme]);

  return (
    <main className="w-full h-screen overflow-hidden shrink-0 flex dark:bg-background">
      <Sidebar />
      <Content />
    </main>
  );
}
