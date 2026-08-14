"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FileText,
  Folder as FolderIcon,
  ChevronRight,
  ChevronDown,
  Plus,
  Search,
  Network,
  Pin,
  Trash2,
  FolderPlus,
  Sparkles,
  Info,
} from "lucide-react";
import { Note, Folder } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  notes: Note[];
  folders: Folder[];
  currentNoteId?: string;
  onOpenQuickSwitcher: () => void;
  onOpenNewNote: (folderId?: string | null) => void;
  onOpenNewFolder: () => void;
  onOpenAbout?: () => void;
  onRefresh: () => void;
}

export function Sidebar({
  notes,
  folders,
  currentNoteId,
  onOpenQuickSwitcher,
  onOpenNewNote,
  onOpenNewFolder,
  onOpenAbout,
  onRefresh,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsedFolders, setCollapsedFolders] = React.useState<Record<string, boolean>>({});

  const toggleFolder = (folderId: string) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  const handleDeleteNote = async (e: React.MouseEvent, noteId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Bu notu silmek istediğinize emin misiniz?")) return;

    try {
      await fetch(`/api/notes/${noteId}`, { method: "DELETE" });
      onRefresh();
      window.dispatchEvent(new Event("vault-updated"));
      if (currentNoteId === noteId) {
        router.push("/");
      }
    } catch (err) {
      console.error("Not silinirken hata:", err);
    }
  };

  const handleDeleteFolder = async (e: React.MouseEvent, folder: Folder) => {
    e.preventDefault();
    e.stopPropagation();
    if (
      !confirm(
        `"${folder.name}" klasörünü silmek istediğinize emin misiniz? (İçindeki notlar klasörsüz olarak korunacaktır)`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/folders/${folder.id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error("Klasör silinemedi");
      }
      onRefresh();
      window.dispatchEvent(new Event("vault-updated"));
    } catch (err) {
      console.error("Klasör silinirken hata:", err);
    }
  };

  const handleTogglePin = async (e: React.MouseEvent, note: Note) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await fetch(`/api/notes/${note.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPinned: !note.isPinned }),
      });
      onRefresh();
      window.dispatchEvent(new Event("vault-updated"));
    } catch (err) {
      console.error("Sabitleme güncellenemedi:", err);
    }
  };

  // Klasörsüz notlar ve klasörlü notları grupla
  const unfiledNotes = notes.filter((n) => !n.folderId);
  const pinnedNotes = notes.filter((n) => n.isPinned);

  return (
    <aside className="w-64 shrink-0 border-r border-slate-800/80 bg-[#0c101b] flex flex-col h-screen select-none">
      {/* Üst Bar: Uygulama Başlığı ve Hızlı İşlemler */}
      <div className="p-3.5 border-b border-slate-800/80 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 font-semibold text-slate-100 group">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight text-white leading-tight">Bluejay Notes</span>
            <span className="text-[10px] text-slate-400">Dijital Not Kasası</span>
          </div>
        </Link>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenNewNote(null)}
            title="Yeni Not (Hızlı)"
            className="h-7 w-7 text-slate-400 hover:text-white"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenNewFolder}
            title="Yeni Klasör"
            className="h-7 w-7 text-slate-400 hover:text-white"
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Arama & Graph View Butonları */}
      <div className="p-2 space-y-1 border-b border-slate-800/60">
        <button
          onClick={onOpenQuickSwitcher}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors shadow-xs"
        >
          <span className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            Not ara...
          </span>
          <kbd className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 border border-slate-700">
            Ctrl+K
          </kbd>
        </button>

        <Link
          href="/graph"
          className={cn(
            "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
            pathname === "/graph"
              ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
              : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
          )}
        >
          <Network className="h-3.5 w-3.5 text-purple-400" />
          İlişki Grafiği (Graph View)
        </Link>
      </div>

      {/* Dosya Ağacı / Not Listesi */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {/* Sabitlenmiş Notlar (Varsa) */}
        {pinnedNotes.length > 0 && (
          <div>
            <div className="px-2 mb-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Pin className="h-3 w-3 text-indigo-400" />
              Sabitlenenler
            </div>
            <div className="space-y-0.5">
              {pinnedNotes.map((note) => (
                <NoteItem
                  key={note.id}
                  note={note}
                  isActive={currentNoteId === note.id}
                  onDelete={(e) => handleDeleteNote(e, note.id)}
                  onTogglePin={(e) => handleTogglePin(e, note)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Klasörler ve İçerikleri */}
        <div>
          <div className="px-2 mb-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Gezgin (Vault)</span>
            <span className="text-[10px] text-slate-600">{notes.length} not</span>
          </div>

          {/* Klasörler */}
          <div className="space-y-1">
            {folders.map((folder) => {
              const folderNotes = notes.filter((n) => n.folderId === folder.id);
              const isCollapsed = collapsedFolders[folder.id];

              return (
                <div key={folder.id} className="space-y-0.5">
                  <div
                    onClick={() => toggleFolder(folder.id)}
                    className="flex items-center justify-between px-2 py-1 rounded-md text-xs font-medium text-slate-300 hover:bg-slate-800/50 hover:text-white cursor-pointer group"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {isCollapsed ? (
                        <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                      )}
                      <FolderIcon className="h-3.5 w-3.5 text-indigo-400/80" />
                      <span className="truncate">{folder.name}</span>
                    </div>

                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenNewNote(folder.id);
                        }}
                        title="Bu klasöre not ekle"
                        className="p-1 rounded text-slate-400 hover:text-indigo-300 hover:bg-slate-700/80 transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteFolder(e, folder)}
                        title="Klasörü Sil"
                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-700/80 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Klasördeki Notlar */}
                  {!isCollapsed && (
                    <div className="pl-4 space-y-0.5 border-l border-slate-800/60 ml-3">
                      {folderNotes.map((note) => (
                        <NoteItem
                          key={note.id}
                          note={note}
                          isActive={currentNoteId === note.id}
                          onDelete={(e) => handleDeleteNote(e, note.id)}
                          onTogglePin={(e) => handleTogglePin(e, note)}
                        />
                      ))}
                      {folderNotes.length === 0 && (
                        <div className="py-1 px-2 text-[11px] text-slate-600 italic">Klasör boş</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Klasörsüz Notlar */}
            {unfiledNotes.length > 0 && (
              <div className="pt-1 space-y-0.5">
                {unfiledNotes.map((note) => (
                  <NoteItem
                    key={note.id}
                    note={note}
                    isActive={currentNoteId === note.id}
                    onDelete={(e) => handleDeleteNote(e, note.id)}
                    onTogglePin={(e) => handleTogglePin(e, note)}
                  />
                ))}
              </div>
            )}

            {folders.length === 0 && unfiledNotes.length === 0 && (
              <div className="py-6 px-3 text-center space-y-2">
                <p className="text-xs text-slate-500">Henüz not bulunmuyor</p>
                <button
                  onClick={() => onOpenNewNote(null)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 transition-colors"
                >
                  <Plus className="h-3 w-3" /> Not Ekle
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alt Bilgi */}
      <div className="p-3 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Bulut Depolama Aktif</span>
        </div>
        {onOpenAbout && (
          <button
            onClick={onOpenAbout}
            className="flex items-center gap-1 text-slate-400 hover:text-indigo-300 transition-colors text-[10px] bg-slate-900/60 hover:bg-slate-800 px-2 py-0.5 rounded border border-slate-800"
            title="Uygulama ve Lisans Hakkında"
          >
            <Info className="h-3 w-3" />
            Hakkında
          </button>
        )}
      </div>
    </aside>
  );
}

function NoteItem({
  note,
  isActive,
  onDelete,
  onTogglePin,
}: {
  note: Note;
  isActive: boolean;
  onDelete: (e: React.MouseEvent) => void;
  onTogglePin: (e: React.MouseEvent) => void;
}) {
  return (
    <Link
      href={`/notes/${note.id}`}
      className={cn(
        "group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all relative",
        isActive
          ? "bg-indigo-600/20 text-indigo-200 font-medium border border-indigo-500/30"
          : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
      )}
    >
      <div className="flex items-center gap-2 truncate">
        <FileText
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            isActive ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-400"
          )}
        />
        <span className="truncate">{note.title}</span>
      </div>

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onTogglePin}
          title={note.isPinned ? "Sabitlemeyi Kaldır" : "Sabitle"}
          className={cn(
            "p-1 rounded hover:bg-slate-700/80 transition-colors",
            note.isPinned ? "text-indigo-400" : "text-slate-500 hover:text-slate-200"
          )}
        >
          <Pin className="h-3 w-3" />
        </button>
        <button
          onClick={onDelete}
          title="Notu Sil"
          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-700/80 transition-colors"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </Link>
  );
}
