import { create } from "zustand";

interface Tag {
  id: number;
  title: string;
  idNote: number;
}

interface Tags {
  tags: Tag[];
  setTags: (tags: Tag[]) => void;
  deleteTag: (id: number) => void;
  updateTag: (id: number, changes: Partial<Tag>) => void;
}

export const useTags = create<Tags>((set) => ({
  tags: [],
  setTags: (tags) => set({ tags }),
  deleteTag: (id) =>
    set((state) => ({ tags: state.tags.filter((t) => t.id !== id) })),
  updateTag: (id, changes) =>
    set((state) => ({
      tags: state.tags.map((n) => (n.id === id ? { ...n, ...changes } : n)),
    })),
}));
