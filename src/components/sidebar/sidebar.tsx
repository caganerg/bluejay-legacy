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
  GripVertical,
} from "lucide-react";
import { Note, Folder } from "@/types";
import { cn, collectFolderSubtreeIds } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const DND_MIME = "application/x-bluejay-item";
const ROOT_DROP_TARGET = "__root__";

type DragPayload = { type: "note" | "folder"; id: string };

interface SidebarProps {
  notes: Note[];
  folders: Folder[];
  currentNoteId?: string;
  onOpenQuickSwitcher: () => void;
  onOpenNewNote: (folderId?: string | null) => void;
  onOpenNewFolder: (parentId?: string | null) => void;
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
  const [dragOverTarget, setDragOverTarget] = React.useState<string | null>(null);
  const [isDragActive, setIsDragActive] = React.useState(false);

  const toggleFolder = (folderId: string) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  // Başarısız bir istek arayüzde başarılı gibi görünmemeli: sunucu 429 ya da 500
  // dönse bile eskiden liste tazeleniyor, silmede ana sayfaya yönlendiriliyordu.
  const reportFailure = async (res: Response, fallback: string) => {
    const data = await res.json().catch(() => null);
    const message = data?.error || fallback;
    console.error(message);
    alert(message);
  };

  const handleDeleteNote = async (e: React.MouseEvent, noteId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Bu notu silmek istediğinize emin misiniz?")) return;

    try {
      const res = await fetch(`/api/notes/${noteId}`, { method: "DELETE" });
      if (!res.ok) {
        await reportFailure(res, "Not silinemedi.");
        return;
      }
      onRefresh();
      window.dispatchEvent(new Event("vault-updated"));
      if (currentNoteId === noteId) {
        router.push("/");
      }
    } catch (err) {
      console.error("Not silinirken hata:", err);
      alert("Not silinemedi: sunucuya ulaşılamadı.");
    }
  };

  const handleDeleteFolder = async (e: React.MouseEvent, folder: Folder) => {
    e.preventDefault();
    e.stopPropagation();

    // Şemadaki `onDelete: Cascade` alt klasörleri gerçekten siliyor; notlar ise
    // `onDelete: SetNull` ile klasörsüz kalıyor. Onay metni eskiden alt
    // klasörlerin de korunacağını söylüyordu — kullanıcı korunacağı söylenen
    // klasör hiyerarşisini kaybediyordu.
    const subtree = collectFolderSubtreeIds(folders, folder.id);
    const subfolderCount = subtree.size - 1;
    const noteCount = notes.filter((n) => n.folderId && subtree.has(n.folderId)).length;

    const details = [
      subfolderCount > 0
        ? `${subfolderCount} alt klasör de KALICI OLARAK SİLİNECEK`
        : null,
      noteCount > 0 ? `${noteCount} not klasörsüz olarak korunacak` : null,
    ].filter(Boolean);

    const message = details.length
      ? `"${folder.name}" klasörü silinsin mi?\n\n• ${details.join("\n• ")}`
      : `"${folder.name}" klasörü silinsin mi? (Klasör boş)`;

    if (!confirm(message)) return;

    try {
      const res = await fetch(`/api/folders/${folder.id}`, { method: "DELETE" });
      if (!res.ok) {
        await reportFailure(res, "Klasör silinemedi.");
        return;
      }
      onRefresh();
      window.dispatchEvent(new Event("vault-updated"));
    } catch (err) {
      console.error("Klasör silinirken hata:", err);
      alert("Klasör silinemedi: sunucuya ulaşılamadı.");
    }
  };

  const handleTogglePin = async (e: React.MouseEvent, note: Note) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await fetch(`/api/notes/${note.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPinned: !note.isPinned }),
      });
      if (!res.ok) {
        await reportFailure(res, "Sabitleme güncellenemedi.");
        return;
      }
      onRefresh();
      window.dispatchEvent(new Event("vault-updated"));
    } catch (err) {
      console.error("Sabitleme güncellenemedi:", err);
      alert("Sabitleme güncellenemedi: sunucuya ulaşılamadı.");
    }
  };

  const moveNoteToFolder = async (noteId: string, folderId: string | null) => {
    const note = notes.find((n) => n.id === noteId);
    if (note && (note.folderId || null) === folderId) return;

    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId }),
      });
      if (!res.ok) {
        await reportFailure(res, "Not taşınamadı.");
        return;
      }
      onRefresh();
      window.dispatchEvent(new Event("vault-updated"));
    } catch (err) {
      console.error("Not taşınamadı:", err);
      alert("Not taşınamadı: sunucuya ulaşılamadı.");
    }
  };

  const moveFolderToParent = async (folderId: string, parentId: string | null) => {
    if (folderId === parentId) return;
    const folder = folders.find((f) => f.id === folderId);
    if (folder && (folder.parentId || null) === parentId) return;

    // Bir klasör kendi alt klasörünün içine taşınamaz (istemci tarafı ön kontrol)
    let cursor = parentId;
    while (cursor) {
      if (cursor === folderId) return;
      const cursorFolder = folders.find((f) => f.id === cursor);
      cursor = cursorFolder?.parentId || null;
    }

    try {
      const res = await fetch(`/api/folders/${folderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        console.error(data?.error || "Klasör taşınamadı");
        return;
      }
      onRefresh();
      window.dispatchEvent(new Event("vault-updated"));
    } catch (err) {
      console.error("Klasör taşınamadı:", err);
    }
  };

  const handleDragStartNote = (e: React.DragEvent, noteId: string) => {
    const payload: DragPayload = { type: "note", id: noteId };
    e.dataTransfer.setData(DND_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
    setIsDragActive(true);
  };

  const handleDragStartFolder = (e: React.DragEvent, folderId: string) => {
    const payload: DragPayload = { type: "folder", id: folderId };
    e.dataTransfer.setData(DND_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
    setIsDragActive(true);
  };

  const handleDragEnd = () => {
    setIsDragActive(false);
    setDragOverTarget(null);
  };

  const handleDragOverTarget = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (dragOverTarget !== targetId) setDragOverTarget(targetId);
  };

  const handleDragLeaveTarget = (targetId: string) => {
    setDragOverTarget((cur) => (cur === targetId ? null : cur));
  };

  const handleDropOnTarget = async (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(null);
    setIsDragActive(false);

    const raw = e.dataTransfer.getData(DND_MIME);
    if (!raw) return;

    let payload: DragPayload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }

    if (payload.type === "note") {
      await moveNoteToFolder(payload.id, targetFolderId);
    } else if (payload.type === "folder") {
      await moveFolderToParent(payload.id, targetFolderId);
    }
  };

  // Klasörsüz notlar ve klasörlü notları grupla
  const unfiledNotes = notes.filter((n) => !n.folderId);
  const pinnedNotes = notes.filter((n) => n.isPinned);

  const treeActions: TreeActions = {
    onOpenNewNote,
    onOpenNewFolder,
    onDeleteFolder: handleDeleteFolder,
    onDeleteNote: handleDeleteNote,
    onTogglePin: handleTogglePin,
    onDragStartFolder: handleDragStartFolder,
    onDragStartNote: handleDragStartNote,
    onDragEnd: handleDragEnd,
    onDragOverTarget: handleDragOverTarget,
    onDragLeaveTarget: handleDragLeaveTarget,
    onDropOnTarget: handleDropOnTarget,
  };

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
            onClick={() => onOpenNewFolder(null)}
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
      <div
        className="flex-1 overflow-y-auto px-2 py-3 space-y-4"
        onDragOver={(e) => handleDragOverTarget(e, ROOT_DROP_TARGET)}
        onDragLeave={() => handleDragLeaveTarget(ROOT_DROP_TARGET)}
        onDrop={(e) => handleDropOnTarget(e, null)}
      >
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
                  onDragStart={(e) => handleDragStartNote(e, note.id)}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </div>
          </div>
        )}

        {/* Klasörler ve İçerikleri (Ağaç Yapısı) */}
        <div>
          <div className="px-2 mb-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Gezgin (Vault)</span>
            <span className="text-[10px] text-slate-600">{notes.length} not</span>
          </div>

          <FolderTree
            folders={folders}
            notes={notes}
            parentId={null}
            collapsedFolders={collapsedFolders}
            toggleFolder={toggleFolder}
            currentNoteId={currentNoteId}
            dragOverTarget={dragOverTarget}
            actions={treeActions}
          />

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
                  onDragStart={(e) => handleDragStartNote(e, note.id)}
                  onDragEnd={handleDragEnd}
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

          {/* Sürükleme sırasında görünen "köke taşı" alanı */}
          {isDragActive && (
            <div
              onDragOver={(e) => handleDragOverTarget(e, ROOT_DROP_TARGET)}
              onDragLeave={() => handleDragLeaveTarget(ROOT_DROP_TARGET)}
              onDrop={(e) => handleDropOnTarget(e, null)}
              className={cn(
                "mt-2 py-2 rounded-lg border border-dashed text-center text-[11px] transition-colors",
                dragOverTarget === ROOT_DROP_TARGET
                  ? "border-indigo-500/60 bg-indigo-600/10 text-indigo-300"
                  : "border-slate-800 text-slate-600"
              )}
            >
              Kök dizine taşı
            </div>
          )}
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

interface TreeActions {
  onOpenNewNote: (folderId?: string | null) => void;
  onOpenNewFolder: (parentId?: string | null) => void;
  onDeleteFolder: (e: React.MouseEvent, folder: Folder) => void;
  onDeleteNote: (e: React.MouseEvent, noteId: string) => void;
  onTogglePin: (e: React.MouseEvent, note: Note) => void;
  onDragStartFolder: (e: React.DragEvent, folderId: string) => void;
  onDragStartNote: (e: React.DragEvent, noteId: string) => void;
  onDragEnd: () => void;
  onDragOverTarget: (e: React.DragEvent, targetId: string) => void;
  onDragLeaveTarget: (targetId: string) => void;
  onDropOnTarget: (e: React.DragEvent, targetFolderId: string | null) => void;
}

// Klasörleri parentId ilişkisine göre gerçek bir ağaç olarak, sonsuz derinlikte
// (alt klasörlerin alt klasörleri...) özyinelemeli şekilde render eder.
function FolderTree({
  folders,
  notes,
  parentId,
  collapsedFolders,
  toggleFolder,
  currentNoteId,
  dragOverTarget,
  actions,
}: {
  folders: Folder[];
  notes: Note[];
  parentId: string | null;
  collapsedFolders: Record<string, boolean>;
  toggleFolder: (folderId: string) => void;
  currentNoteId?: string;
  dragOverTarget: string | null;
  actions: TreeActions;
}) {
  const childFolders = folders.filter((f) => (f.parentId || null) === parentId);
  if (childFolders.length === 0) return null;

  return (
    <div className="space-y-1">
      {childFolders.map((folder) => {
        const folderNotes = notes.filter((n) => n.folderId === folder.id);
        const hasSubfolders = folders.some((f) => (f.parentId || null) === folder.id);
        const isCollapsed = collapsedFolders[folder.id];
        const isDragOver = dragOverTarget === folder.id;

        return (
          <div key={folder.id} className="space-y-0.5">
            <div
              draggable
              onDragStart={(e) => actions.onDragStartFolder(e, folder.id)}
              onDragEnd={actions.onDragEnd}
              onDragOver={(e) => actions.onDragOverTarget(e, folder.id)}
              onDragLeave={() => actions.onDragLeaveTarget(folder.id)}
              onDrop={(e) => actions.onDropOnTarget(e, folder.id)}
              onClick={() => toggleFolder(folder.id)}
              className={cn(
                "flex items-center justify-between px-2 py-1 rounded-md text-xs font-medium text-slate-300 hover:bg-slate-800/50 hover:text-white cursor-pointer group",
                isDragOver && "bg-indigo-600/20 ring-1 ring-inset ring-indigo-500/50"
              )}
            >
              <div className="flex items-center gap-1.5 truncate">
                <GripVertical className="h-3 w-3 text-slate-700 group-hover:text-slate-600 shrink-0 -ml-1" />
                {isCollapsed ? (
                  <ChevronRight className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                )}
                <FolderIcon className="h-3.5 w-3.5 text-indigo-400/80 shrink-0" />
                <span className="truncate">{folder.name}</span>
              </div>

              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    actions.onOpenNewFolder(folder.id);
                  }}
                  title="Bu klasöre alt klasör ekle"
                  className="p-1 rounded text-slate-400 hover:text-indigo-300 hover:bg-slate-700/80 transition-colors"
                >
                  <FolderPlus className="h-3 w-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    actions.onOpenNewNote(folder.id);
                  }}
                  title="Bu klasöre not ekle"
                  className="p-1 rounded text-slate-400 hover:text-indigo-300 hover:bg-slate-700/80 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                </button>
                <button
                  onClick={(e) => actions.onDeleteFolder(e, folder)}
                  title="Klasörü Sil"
                  className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-700/80 transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Klasörün alt klasörleri ve notları */}
            {!isCollapsed && (
              <div
                onDragOver={(e) => actions.onDragOverTarget(e, folder.id)}
                onDragLeave={() => actions.onDragLeaveTarget(folder.id)}
                onDrop={(e) => actions.onDropOnTarget(e, folder.id)}
                className="pl-4 space-y-0.5 border-l border-slate-800/60 ml-3"
              >
                <FolderTree
                  folders={folders}
                  notes={notes}
                  parentId={folder.id}
                  collapsedFolders={collapsedFolders}
                  toggleFolder={toggleFolder}
                  currentNoteId={currentNoteId}
                  dragOverTarget={dragOverTarget}
                  actions={actions}
                />

                {folderNotes.map((note) => (
                  <NoteItem
                    key={note.id}
                    note={note}
                    isActive={currentNoteId === note.id}
                    onDelete={(e) => actions.onDeleteNote(e, note.id)}
                    onTogglePin={(e) => actions.onTogglePin(e, note)}
                    onDragStart={(e) => actions.onDragStartNote(e, note.id)}
                    onDragEnd={actions.onDragEnd}
                  />
                ))}

                {folderNotes.length === 0 && !hasSubfolders && (
                  <div className="py-1 px-2 text-[11px] text-slate-600 italic">Klasör boş</div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NoteItem({
  note,
  isActive,
  onDelete,
  onTogglePin,
  onDragStart,
  onDragEnd,
}: {
  note: Note;
  isActive: boolean;
  onDelete: (e: React.MouseEvent) => void;
  onTogglePin: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  return (
    <Link
      href={`/notes/${note.id}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
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
