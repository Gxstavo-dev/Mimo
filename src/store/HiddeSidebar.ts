import { create } from "zustand";

interface Sidebar {
  hidde: boolean;
  toggle: () => void;
}

export const useHiddeSidebar = create<Sidebar>((set) => ({
  hidde: false,
  toggle: () => set((state) => ({ hidde: !state.hidde })),
}));
