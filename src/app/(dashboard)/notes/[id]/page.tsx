"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { MarkdownEditor } from "@/components/editor/markdown-editor";
import { Note, Folder } from "@/types";
import { Loader2, AlertCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const noteId = params?.id as string;

  const [note, setNote] = React.useState<Note | null>(null);
  const [folders, setFolders] = React.useState<Folder[]>([]);
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchNoteAndFolders = React.useCallback(
    async (isInitial = false) => {
      if (!noteId) return;
      if (isInitial) {
        setInitialLoading(true);
        setError(null);
      }
      try {
        const [noteRes, foldersRes] = await Promise.all([
          fetch(`/api/notes/${noteId}`),
          fetch("/api/folders"),
        ]);

        if (!noteRes.ok) {
          throw new Error("Not bulunamadı");
        }

        const noteData = await noteRes.json();
        const foldersData = await foldersRes.json();

        setNote(noteData.note);
        setFolders(foldersData.folders || []);
      } catch (err: any) {
        console.error(err);
        if (isInitial) {
          setError(err.message || "Not yüklenemedi");
        }
      } finally {
        if (isInitial) {
          setInitialLoading(false);
        }
      }
    },
    [noteId]
  );

  React.useEffect(() => {
    fetchNoteAndFolders(true);
  }, [fetchNoteAndFolders]);

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
      setNote((prev) => (prev ? { ...prev, ...data.note } : data.note));
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
        window.dispatchEvent(new Event("vault-updated"));
        router.replace(`/notes/${data.note.id}`);
      }
    } catch (err) {
      console.error("Not oluşturulamadı:", err);
    } finally {
      setIsCreatingMissing(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0a0d16] text-slate-400 space-y-3">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
        <span className="text-xs">Not yükleniyor...</span>
      </div>
    );
  }

  if (error || !note) {
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
      onRefreshVault={() => fetchNoteAndFolders(false)}
    />
  );
}
