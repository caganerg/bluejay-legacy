"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar/sidebar";
import { QuickSwitcher } from "@/components/modals/quick-switcher";
import { NewNoteDialog } from "@/components/modals/new-note-dialog";
import { NewFolderDialog } from "@/components/modals/new-folder-dialog";
import { AboutDialog } from "@/components/modals/about-dialog";
import { Note, Folder } from "@/types";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const params = useParams();
  const currentNoteId = params?.id as string | undefined;

  const [notes, setNotes] = React.useState<Note[]>([]);
  const [folders, setFolders] = React.useState<Folder[]>([]);
  const [_loading, setLoading] = React.useState(true);

  // Modals state
  const [quickSwitcherOpen, setQuickSwitcherOpen] = React.useState(false);
  const [newNoteOpen, setNewNoteOpen] = React.useState(false);
  const [newFolderOpen, setNewFolderOpen] = React.useState(false);
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const [selectedFolderForNewNote, setSelectedFolderForNewNote] = React.useState<string | null>(null);
  const [selectedParentForNewFolder, setSelectedParentForNewFolder] = React.useState<string | null>(null);

  const fetchVaultData = async () => {
    try {
      const [notesRes, foldersRes] = await Promise.all([
        fetch("/api/notes"),
        fetch("/api/folders"),
      ]);
      const notesData = await notesRes.json();
      const foldersData = await foldersRes.json();

      setNotes(notesData.notes || []);
      setFolders(foldersData.folders || []);
    } catch (err) {
      console.error("Vault verisi yüklenirken hata:", err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchVaultData();

    const handleVaultUpdated = () => {
      fetchVaultData();
    };

    window.addEventListener("vault-updated", handleVaultUpdated);
    return () => {
      window.removeEventListener("vault-updated", handleVaultUpdated);
    };
  }, []);

  const handleOpenNewNote = (folderId?: string | null) => {
    setSelectedFolderForNewNote(folderId || null);
    setNewNoteOpen(true);
  };

  const handleOpenNewFolder = (parentId?: string | null) => {
    setSelectedParentForNewFolder(parentId || null);
    setNewFolderOpen(true);
  };

  const handleNoteCreated = (noteId: string) => {
    fetchVaultData();
    router.push(`/notes/${noteId}`);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0a0d16] text-slate-100 antialiased selection:bg-indigo-500/30 selection:text-white">
      {/* Sol Sidebar */}
      <Sidebar
        notes={notes}
        folders={folders}
        currentNoteId={currentNoteId}
        onOpenQuickSwitcher={() => setQuickSwitcherOpen(true)}
        onOpenNewNote={handleOpenNewNote}
        onOpenNewFolder={handleOpenNewFolder}
        onOpenAbout={() => setAboutOpen(true)}
        onRefresh={fetchVaultData}
      />

      {/* Ana Çalışma Alanı */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {children}
      </main>

      {/* Hızlı Arama & Komut Paleti (Ctrl+K) */}
      <QuickSwitcher
        open={quickSwitcherOpen}
        onOpenChange={setQuickSwitcherOpen}
        onNoteCreated={handleNoteCreated}
        onOpenAbout={() => setAboutOpen(true)}
      />

      {/* Yeni Not Oluşturma Modalı */}
      <NewNoteDialog
        open={newNoteOpen}
        onOpenChange={setNewNoteOpen}
        folders={folders}
        currentFolderId={selectedFolderForNewNote}
        onCreated={handleNoteCreated}
      />

      {/* Yeni Klasör Oluşturma Modalı */}
      <NewFolderDialog
        open={newFolderOpen}
        onOpenChange={setNewFolderOpen}
        onCreated={fetchVaultData}
        parentId={selectedParentForNewFolder}
      />

      {/* Hakkında Modalı */}
      <AboutDialog
        open={aboutOpen}
        onOpenChange={setAboutOpen}
      />
    </div>
  );
}
