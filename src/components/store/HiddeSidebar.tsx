import { create } from "zustand";

interface HiddeSb {
  hidde: boolean;
  toggle: () => void;
}

export const useHiddeSb = create<HiddeSb>((set) => ({
  hidde: false,
  toggle: () => set((state) => ({ hidde: !state.hidde })),
}));
