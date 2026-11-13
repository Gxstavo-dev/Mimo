import { PanelRight } from "lucide-react";
import { useHiddeSidebar } from "../store/HiddeSidebar";
import Head from "./Head.Sidebar";
import Body from "./Body.Sidebar";
import Footer from "./Footer.Sidebar";

export default function Sidebar() {
  const hidde = useHiddeSidebar((state) => state.hidde);
  const toggleHidde = useHiddeSidebar((state) => state.toggle);

  return (
    <aside
      className={`${
        hidde
          ? "w-0 h-0 overflow-hidden"
          : "w-sidebar h-sidebar flex flex-col gap-1 bg-sidebar border-r border-r-border dark:bg-sidebar dark:border-r dark:border-r-border"
      }`}
    >
      {hidde && (
        <PanelRight
          onClick={() => toggleHidde()}
          size={15}
          className="fixed top-4.5 left-4 cursor-pointer outline-none select-none text-icon dark:text-icon "
        />
      )}
      <Head />
      <Body />
      <Footer />
    </aside>
  );
}
