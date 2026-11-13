import { Moon, Sun } from "lucide-react";
import { useTheme } from "../store/Theme";

export default function Footer() {
  const toggleTheme = useTheme((state) => state.toggle);
  const scheme = useTheme((state) => state.scheme);
  console.log(scheme);

  return (
    <section className="w-full h-15 flex items-center justify-end pr-2">
      {scheme == "light" && (
        <Moon
          onClick={() => toggleTheme()}
          size={15}
          className="cursor-pointer outline-none select-none text-icon dark:text-icon"
        />
      )}
      {scheme == "dark" && (
        <Sun
          onClick={() => toggleTheme()}
          size={15}
          className="cursor-pointer outline-none select-none text-icon dark:text-icon"
        />
      )}
    </section>
  );
}
