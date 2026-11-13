import { create } from "zustand";
import { persist } from "zustand/middleware";

type Mode = "light" | "dark";

interface Theme {
  scheme: Mode;
  toggle: () => void;
}

export const useTheme = create<Theme>()(
  persist(
    (set) => ({
      scheme: "light",
      toggle: () =>
        set((state) => ({
          scheme: state.scheme === "light" ? "dark" : "light",
        })),
    }),
    { name: "mimo-theme" },
  ),
);
