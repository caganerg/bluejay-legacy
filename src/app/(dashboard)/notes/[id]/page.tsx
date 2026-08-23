"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { MarkdownEditor } from "@/components/editor/markdown-editor";
import { Note } from "@/types";
import { Loader2, AlertCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVault, primeNote } from "@/lib/vault-context";

export default function NoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const noteId = params?.id as string;

  const { folders, loading: vaultLoading, findNote, refresh } = useVault();

  // Sidebar için zaten yüklenmiş olan vault verisi notun tamamını içeriyor;
  // ağ isteğini beklemeden anında gösteriyoruz.
  const cachedNote = findNote(noteId);

  // Detay isteğinden gelen (backlink'li) sürüm; gelene kadar cachedNote kullanılır.
  const [fetchedNote, setFetchedNote] = React.useState<Note | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const note = React.useMemo(() => {
    if (fetchedNote && cachedNote) return { ...cachedNote, ...fetchedNote };
    return fetchedNote || cachedNote;
  }, [fetchedNote, cachedNote]);

  const fetchNote = React.useCallback(async () => {
    if (!noteId) return;
    try {
      const res = await fetch(`/api/notes/${encodeURIComponent(noteId)}`);

      if (!res.ok) {
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Not yüklenemedi");
      }

      const data = await res.json();
      if (data.note) {
        primeNote(data.note);
        setFetchedNote(data.note);
        setNotFound(false);
        setError(null);
      }
    } catch (err: unknown) {
      console.error("Not yükleme hatası:", err);
      setError(err instanceof Error ? err.message : "Not yüklenemedi");
    }
  }, [noteId]);

  // Not değiştiğinde önceki notun detayını sıfırla ve arka planda tazele.
  React.useEffect(() => {
    setFetchedNote(null);
    setNotFound(false);
    setError(null);
    fetchNote();
  }, [fetchNote]);

  const handleSave = async (updatedData: {
    title: string;
    content: string;
    folderId?: string | null;
  }) => {
    if (!note) return;
    const res = await fetch(`/api/notes/${note.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedData),
    });

    if (!res.ok) {
      throw new Error("Not kaydedilemedi");
    }

    const data = await res.json();
    if (data.note) {
      setFetchedNote((prev) => {
        const merged = prev ? { ...prev, ...data.note } : { ...note, ...data.note };
        primeNote(merged);
        return merged;
      });
    }
  };

  const [isCreatingMissing, setIsCreatingMissing] = React.useState(false);

  const displayTitle = React.useMemo(() => {
    if (!noteId) return "Yeni Not";
    try {
      const decoded = decodeURIComponent(noteId);
      // Slug'ı başlığa çevir (örn: yeni-fikirler -> Yeni Fikirler)
      return decoded
        .split("-")
        .map((w) => w.charAt(0).toLocaleUpperCase("tr-TR") + w.slice(1))
        .join(" ");
    } catch {
      return noteId;
    }
  }, [noteId]);

  const handleCreateMissingNote = async () => {
    setIsCreatingMissing(true);
    try {
      const res = await fetch("/api/notes/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: displayTitle,
        }),
      });
      const data = await res.json();
      if (data.note) {
        primeNote(data.note);
        window.dispatchEvent(new Event("vault-updated"));
        router.replace(`/notes/${data.note.id}`);
      }
    } catch (err) {
      console.error("Not oluşturulamadı:", err);
    } finally {
      setIsCreatingMissing(false);
    }
  };

  // Yükleme ekranı yalnızca elimizde hiç veri yokken görünür; önbellekten
  // açılan notlarda hiç gösterilmez.
  if (!note && !notFound && !error) {
    if (vaultLoading) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-[#0a0d16] text-slate-400 space-y-3">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
          <span className="text-xs">Not yükleniyor...</span>
        </div>
      );
    }
    return <div className="flex-1 bg-[#0a0d16]" />;
  }

  if (!note) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0a0d16] text-slate-300 space-y-5 p-8 text-center">
        <div className="h-12 w-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-white">Not Bulunamadı</h2>
          <p className="text-xs text-slate-400 max-w-sm">
            <strong className="text-slate-200 font-semibold">&quot;{displayTitle}&quot;</strong> başlıklı bir not henüz mevcut değil veya silinmiş.
          </p>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={handleCreateMissingNote}
            disabled={isCreatingMissing}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs gap-1.5 shadow-lg shadow-indigo-600/20"
          >
            {isCreatingMissing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            <span>&quot;{displayTitle}&quot; Notunu Oluştur</span>
          </Button>
          <Button onClick={() => router.push("/")} variant="outline" className="text-xs border-slate-800 text-slate-300">
            Ana Sayfaya Dön
          </Button>
        </div>
      </div>
    );
  }

  return (
    <MarkdownEditor
      note={note}
      folders={folders}
      onSave={handleSave}
      onRefreshVault={refresh}
    />
  );
}
