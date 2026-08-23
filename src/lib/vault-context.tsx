"use client";

import * as React from "react";
import { Note, Folder } from "@/types";
import { slugify } from "@/lib/utils";

// `/api/notes` zaten her notun tam içeriğini (title/content/folderId) döndürüyor.
// Bu yüzden bir nota tıklandığında ağ isteğini beklemeye gerek yok: notu bu
// önbellekten anında açıp, backlink gibi ek alanları arka planda tamamlıyoruz.
interface VaultContextValue {
  notes: Note[];
  folders: Folder[];
  loading: boolean;
  refresh: () => Promise<void>;
  /** noteId; gerçek id, slug veya (wikilink'lerde olduğu gibi) başlık olabilir. */
  findNote: (noteId: string) => Note | null;
  /** Detay isteği tamamlandığında (backlink'ler dahil) önbelleği tazeler. */
  primeNote: typeof primeNote;
}

const VaultContext = React.createContext<VaultContextValue | null>(null);

// Rota değişimleri arasında (ve layout yeniden bağlandığında) kalıcı olsun diye
// modül seviyesinde tutulan detay önbelleği.
const noteDetailCache = new Map<string, Note>();

/**
 * Elimizde tam bir not nesnesi olduğunda (detay isteği ya da oluşturma yanıtı)
 * önbelleğe koyar; böylece o nota geçildiğinde ekran anında çizilir.
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
    note.title.toLocaleLowerCase("tr-TR") === decodedId.toLocaleLowerCase("tr-TR")
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

      // Listeden gelen güncel alanları, daha önce detayı çekilmiş notlara yansıt;
      // artık var olmayan (silinmiş) notları önbellekten düşür.
      const freshIds = new Set(freshNotes.map((n) => n.id));
      for (const note of freshNotes) {
        const cached = noteDetailCache.get(note.id);
        if (cached) noteDetailCache.set(note.id, { ...cached, ...note });
      }
      for (const id of [...noteDetailCache.keys()]) {
        if (!freshIds.has(id)) noteDetailCache.delete(id);
      }
    } catch (err) {
      console.error("Vault verisi yüklenirken hata:", err);
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

      // Önce detay önbelleği (backlink'ler burada), sonra liste. Liste daha
      // güncel skaler alanlar taşıyabildiği için ikisini birleştiriyoruz.
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
    throw new Error("useVault, VaultProvider içinde kullanılmalıdır");
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
