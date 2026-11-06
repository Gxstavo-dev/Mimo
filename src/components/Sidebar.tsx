import Actions from "./Sidebar/Actions";
import Head from "./Sidebar/Head";
import { useHiddeSb } from "./store/HiddeSidebar";

export default function Sidebar() {
  const hidde = useHiddeSb((state) => state.hidde);

  return (
    <aside
      className={`${!hidde ? "w-80 h-full p-2 border-r border-r-neutral-800/50" : "w-0 h-0 overflow-hidden"} flex flex-col gap-2`}
    >
      <Head />
      <Actions />
    </aside>
  );
}
