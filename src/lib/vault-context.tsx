"use client";

import * as React from "react";
import { Note, Folder } from "@/types";
import { slugify } from "@/lib/utils";

// `/api/notes` already returns the full content of every note
// (title/content/folderId). So there is no need to wait for a network request
// when a note is clicked: we open it instantly from this cache and fill in extra
// fields such as backlinks in the background.
interface VaultContextValue {
  notes: Note[];
  folders: Folder[];
  loading: boolean;
  refresh: () => Promise<void>;
  /** noteId may be the real id, a slug, or (as in wikilinks) a title. */
  findNote: (noteId: string) => Note | null;
  /** Refreshes the cache once a detail request completes (backlinks included). */
  primeNote: typeof primeNote;
}

const VaultContext = React.createContext<VaultContextValue | null>(null);

// A detail cache kept at module level so that it survives route changes (and
// remounts of the layout).
const noteDetailCache = new Map<string, Note>();

/**
 * Puts a note into the cache whenever we hold a complete note object (from a
 * detail request or a create response), so that navigating to it paints
 * instantly.
 */
export function primeNote(note: Note) {
  if (!note?.id) return;
  noteDetailCache.set(note.id, note);
}

function matchesNote(note: Note, rawId: string, decodedId: string, slugId: string): boolean {
  return (
    note.id === rawId ||
    note.id === decodedId ||
    note.slug === rawId ||
    note.slug === decodedId ||
    note.slug === slugId ||
    note.title.toLowerCase() === decodedId.toLowerCase()
  );
}

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [folders, setFolders] = React.useState<Folder[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    try {
      const [notesRes, foldersRes] = await Promise.all([
        fetch("/api/notes"),
        fetch("/api/folders"),
      ]);
      const notesData = await notesRes.json();
      const foldersData = await foldersRes.json();

      const freshNotes: Note[] = notesData.notes || [];
      setNotes(freshNotes);
      setFolders(foldersData.folders || []);

      // Apply the fresh fields from the list onto notes whose details were
      // fetched earlier, and evict notes that no longer exist (deleted).
      const freshIds = new Set(freshNotes.map((n) => n.id));
      for (const note of freshNotes) {
        const cached = noteDetailCache.get(note.id);
        if (cached) noteDetailCache.set(note.id, { ...cached, ...note });
      }
      for (const id of [...noteDetailCache.keys()]) {
        if (!freshIds.has(id)) noteDetailCache.delete(id);
      }
    } catch (err) {
      console.error("Failed to load vault data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();

    const handleVaultUpdated = () => {
      refresh();
    };

    window.addEventListener("vault-updated", handleVaultUpdated);
    return () => {
      window.removeEventListener("vault-updated", handleVaultUpdated);
    };
  }, [refresh]);

  const findNote = React.useCallback(
    (noteId: string): Note | null => {
      if (!noteId) return null;

      let decodedId = noteId;
      try {
        decodedId = decodeURIComponent(noteId);
      } catch {
        decodedId = noteId;
      }
      const slugId = slugify(decodedId);

      // The detail cache first (backlinks live there), then the list. The list
      // can carry fresher scalar fields, so we merge the two.
      const fromList = notes.find((n) => matchesNote(n, noteId, decodedId, slugId));
      const cached =
        noteDetailCache.get(noteId) ||
        noteDetailCache.get(decodedId) ||
        (fromList ? noteDetailCache.get(fromList.id) : undefined);

      if (cached && fromList) return { ...cached, ...fromList };
      return cached || fromList || null;
    },
    [notes]
  );

  const value = React.useMemo(
    () => ({ notes, folders, loading, refresh, findNote, primeNote }),
    [notes, folders, loading, refresh, findNote]
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault(): VaultContextValue {
  const ctx = React.useContext(VaultContext);
  if (!ctx) {
    throw new Error("useVault must be used within a VaultProvider");
  }
  return ctx;
}

export function invalidateNoteCache(noteId?: string) {
  if (noteId) {
    noteDetailCache.delete(noteId);
    return;
  }
  noteDetailCache.clear();
}
