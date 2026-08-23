"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Search, FileText, Plus, Folder as FolderIcon, Network, Info } from "lucide-react";
import { Note, SearchResult } from "@/types";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";


interface QuickSwitcherProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNoteCreated?: (noteId: string, note?: Note) => void;
  onOpenAbout?: () => void;
}

export function QuickSwitcher({ open, onOpenChange, onNoteCreated, onOpenAbout }: QuickSwitcherProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Arama sonuçlarını getir
  React.useEffect(() => {
    if (!open) return;
    const fetchResults = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results || []);
      } catch (err) {
        console.error("Arama hatası:", err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchResults, 120);
    return () => clearTimeout(timer);
  }, [query, open]);

  // Tuş kısayolu dinleyicisi (Ctrl+K / Cmd+K)
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  const handleSelectNote = (id: string) => {
    onOpenChange(false);
    setQuery("");
    router.push(`/notes/${id}`);
  };

  const handleCreateNote = async (title: string) => {
    if (!title.trim()) return;
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content: `# ${title.trim()}\n\n`,
        }),
      });
      const data = await res.json();
      if (data.note) {
        onOpenChange(false);
        setQuery("");
        if (onNoteCreated) onNoteCreated(data.note.id, data.note);
        router.push(`/notes/${data.note.id}`);
      }
    } catch (err) {
      console.error("Hızlı not oluşturulamadı:", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 max-w-xl border-slate-800 bg-slate-950/95 backdrop-blur-xl shadow-2xl">
        <DialogTitle className="sr-only">Hızlı Arama ve Komut Paleti</DialogTitle>
        <Command className="flex h-full w-full flex-col overflow-hidden rounded-xl bg-transparent">
          <div className="flex items-center border-b border-slate-800/80 px-4">
            <Search className="mr-3 h-4 w-4 shrink-0 text-slate-400" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Not ara veya oluşturmak için yaz..."
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none disabled:cursor-not-allowed disabled:opacity-50"
              autoFocus
            />
          </div>

          <Command.List className="max-h-[340px] overflow-y-auto p-2">
            {loading && (
              <div className="py-6 text-center text-xs text-slate-500">Aranıyor...</div>
            )}

            {!loading && results.length === 0 && query.trim() !== "" && (
              <div className="p-4 text-center">
                <p className="text-sm text-slate-400">Eşleşen not bulunamadı.</p>
                <button
                  onClick={() => handleCreateNote(query)}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-indigo-600/20 px-3 py-1.5 text-xs font-medium text-indigo-400 hover:bg-indigo-600/30 border border-indigo-500/30 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  &quot;{query}&quot; adında yeni not oluştur
                </button>
              </div>
            )}

            {query.trim() !== "" && (
              <Command.Group heading="Eylemler" className="px-2 py-1 text-xs text-slate-500 font-semibold">
                <Command.Item
                  onSelect={() => handleCreateNote(query)}
                  className="flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-indigo-600/20 hover:text-indigo-300 transition-colors"
                >
                  <Plus className="h-4 w-4 text-indigo-400" />
                  <span>
                    Yeni Not Oluştur: <strong className="text-indigo-300 font-semibold">{query}</strong>
                  </span>
                </Command.Item>
              </Command.Group>
            )}

            <Command.Group heading="Hızlı Navigasyon" className="px-2 py-1 text-xs text-slate-500 font-semibold">
              <Command.Item
                value="ilişki grafiği graph view ağ haritası"
                onSelect={() => {
                  onOpenChange(false);
                  router.push("/graph");
                }}
                className="flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-slate-800/70 hover:text-white transition-colors"
              >
                <Network className="h-4 w-4 text-purple-400" />
                <span>İlişki Grafiği (Graph View)</span>
              </Command.Item>

              {onOpenAbout && (
                <Command.Item
                  value="hakkında lisans mit license info"
                  onSelect={() => {
                    onOpenChange(false);
                    onOpenAbout();
                  }}
                  className="flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-slate-800/70 hover:text-white transition-colors"
                >
                  <Info className="h-4 w-4 text-emerald-400" />
                  <span>Hakkında (MIT Lisansı)</span>
                </Command.Item>
              )}
            </Command.Group>

            {results.length > 0 && (
              <Command.Group heading="Notlar" className="px-2 py-1 text-xs text-slate-500 font-semibold">
                {results.map((note) => (
                  <Command.Item
                    key={note.id}
                    value={note.title + " " + note.preview}
                    onSelect={() => handleSelectNote(note.id)}
                    className="flex cursor-pointer select-none items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-slate-800/70 hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                      <div className="flex flex-col truncate">
                        <span className="font-medium text-slate-100 truncate">{note.title}</span>
                        {note.preview && (
                          <span className="text-xs text-slate-500 truncate">{note.preview}</span>
                        )}
                      </div>
                    </div>

                    {note.folderName && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 shrink-0 ml-2">
                        <FolderIcon className="h-3 w-3" />
                        {note.folderName}
                      </span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>

          <div className="border-t border-slate-800/80 px-4 py-2 text-[11px] text-slate-500 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span><kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-400">↑↓</kbd> Gezin</span>
              <span><kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-400">↵</kbd> Aç / Seç</span>
              <span><kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-400">ESC</kbd> Çık</span>
            </div>
            <span className="text-indigo-400 font-medium">Hızlı Arama & Geçiş</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
