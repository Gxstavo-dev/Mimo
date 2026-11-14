import { PanelRight } from "lucide-react";
import { useHiddeSidebar } from "../store/HiddeSidebar";
import Head from "./Head.Sidebar";
import Body from "./Body.Sidebar";
import Footer from "./Footer.Sidebar";

export default function Sidebar() {
  const hidde = useHiddeSidebar((state) => state.hidde);
  const toggleHidde = useHiddeSidebar((state) => state.toggle);

  return (
    <>
      {hidde && (
        <button
          type="button"
          onClick={toggleHidde}
          aria-label="Mostrar panel lateral"
          title="Mostrar panel lateral"
          className="fixed left-4 top-4 z-[110] flex h-8 w-8 items-center justify-center rounded-lg bg-background text-icon shadow-sm transition hover:bg-sidebar hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-secondary"
        >
          <PanelRight size={16} />
        </button>
      )}
      {!hidde && (
        <aside className="flex h-sidebar w-sidebar shrink-0 flex-col gap-1 overflow-hidden border-r border-r-border bg-sidebar dark:border-r-border dark:bg-sidebar">
          <Head />
          <Body />
          <Footer />
        </aside>
      )}
    </>
  );
}
