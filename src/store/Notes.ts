import { create } from "zustand";

interface Note {
  id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface Notes {
  notes: Note[];
  note: Note | null;
  setNote: (data: Note | null) => void;
  setNotes: (data: Note[]) => void;
  addNote: (note: Note) => void;
  updateNote: (id: number, changes: Partial<Note>) => void;
  deleteNote: (id: number) => void;
}

export const useNotes = create<Notes>((set) => ({
  notes: [],
  note: null,
  setNote: (data) => set({ note: data }),
  setNotes: (data) => set({ notes: data }),
  addNote: (note) => set((state) => ({ notes: [...state.notes, note] })),
  updateNote: (id, changes) =>
    set((state) => ({
      notes: state.notes.map((n) => (n.id === id ? { ...n, ...changes } : n)),
    })),
  deleteNote: (id) =>
    set((state) => ({ notes: state.notes.filter((n) => n.id !== id) })),
}));
