"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { MarkdownEditor } from "@/components/editor/markdown-editor";
import { Note, Folder } from "@/types";
import { Loader2, AlertCircle } from "lucide-react";
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
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0a0d16] text-slate-300 space-y-4 p-8 text-center">
        <div className="h-12 w-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-white">Not Bulunamadı</h2>
        <p className="text-xs text-slate-400 max-w-sm">
          Aradığınız not silinmiş veya henüz oluşturulmamış olabilir.
        </p>
        <Button onClick={() => router.push("/")} variant="secondary">
          Ana Sayfaya Dön
        </Button>
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
