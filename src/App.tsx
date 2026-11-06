import { PanelRight } from "lucide-react";
import Content from "./components/Content";
import Sidebar from "./components/Sidebar";
import { useHiddeSb } from "./components/store/HiddeSidebar";

function App() {
  const toggleSb = useHiddeSb((state) => state.toggle);
  const hidde = useHiddeSb((state) => state.hidde);

  const ShowBottomSb = () => {
    return (
      <PanelRight
        size={14}
        color="white"
        className="cursor-pointer fixed left-5 top-5"
        onClick={toggleSb}
      />
    );
  };

  return (
    <main className="w-full h-screen flex">
      {hidde && ShowBottomSb()}
      <Sidebar />
      <Content />
    </main>
  );
}

export default App;
