import { PanelRight } from "lucide-react";
import { useHiddeSb } from "../store/HiddeSidebar";

export default function Head() {
  const toggleSb = useHiddeSb((state) => state.toggle);

  return (
    <nav className="w-full h-10 flex items-center justify-end">
      <PanelRight
        size={14}
        color="white"
        className="cursor-pointer"
        onClick={toggleSb}
      />
    </nav>
  );
}
