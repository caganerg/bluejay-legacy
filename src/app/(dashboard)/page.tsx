"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FilePlus,
  Network,
  Search,
  BookOpen,
  Sparkles,
  Link2,
  Clock,
  Pin,
  FileText,
  ArrowRight,
  Folder as FolderIcon,
  Trash2,
  Info,
  ShieldCheck,
} from "lucide-react";
import { Note, Folder } from "@/types";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export default function HomePage() {
  const router = useRouter();
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [folders, setFolders] = React.useState<Folder[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [clearing, setClearing] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const fetchData = async () => {
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
      console.error("Ana sayfa verileri alınamadı:", err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();

    const handleVaultUpdated = () => {
      fetchData();
    };

    window.addEventListener("vault-updated", handleVaultUpdated);
    return () => {
      window.removeEventListener("vault-updated", handleVaultUpdated);
    };
  }, []);

  const handleCreateNew = async () => {
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Yeni Not",
          content: "# Yeni Not\n\nBuraya yazmaya başlayın...\n",
        }),
      });
      const data = await res.json();
      if (data.note) {
        window.dispatchEvent(new Event("vault-updated"));
        router.push(`/notes/${data.note.id}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const recentNotes = notes.slice(0, 6);

  const handleClearRecent = async () => {
    if (recentNotes.length === 0) return;
    if (
      !confirm(
        "Son düzenlenen tüm notları silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
      )
    ) {
      return;
    }

    setClearing(true);
    try {
      await Promise.all(
        recentNotes.map((note) =>
          fetch(`/api/notes/${note.id}`, { method: "DELETE" })
        )
      );
      setNotes((prev) =>
        prev.filter((n) => !recentNotes.some((r) => r.id === n.id))
      );
      window.dispatchEvent(new Event("vault-updated"));
    } catch (err) {
      console.error("Notlar temizlenirken hata:", err);
    } finally {
      setClearing(false);
    }
  };

  const handleDeleteNote = async (e: React.MouseEvent, noteId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Bu notu silmek istediğinize emin misiniz?")) return;

    setDeletingId(noteId);
    try {
      await fetch(`/api/notes/${noteId}`, { method: "DELETE" });
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      window.dispatchEvent(new Event("vault-updated"));
    } catch (err) {
      console.error("Not silinirken hata:", err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-8 py-10 bg-[#0a0d16]">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Karşılama Başlığı */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Bulut Tabanlı Dijital Beyin (PKM) Sistemi</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Bluejay Not Kasanıza Hoş Geldiniz
          </h1>
          <p className="text-slate-400 text-sm sm:text-base max-w-2xl leading-relaxed">
            Markdown formatında notlar alın, <code className="text-indigo-300 font-mono">[[Not Adı]]</code> ile düşüncelerinizi birbirine bağlayın ve tüm bilgi ağınızı interaktif bir ilişki grafiği (Graph View) üzerinde keşfedin.
          </p>
        </div>

        {/* Hızlı Aksiyon Kartları */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div
            onClick={handleCreateNew}
            className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950 p-5 hover:border-indigo-500/50 transition-all cursor-pointer shadow-lg hover:shadow-indigo-500/10"
          >
            <div className="h-10 w-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4 group-hover:scale-110 transition-transform">
              <FilePlus className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-100 mb-1">Yeni Not Oluştur</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Markdown destekli temiz bir sayfayla yazmaya hemen başlayın.
            </p>
          </div>

          <Link
            href="/graph"
            className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950 p-5 hover:border-purple-500/50 transition-all cursor-pointer shadow-lg hover:shadow-purple-500/10"
          >
            <div className="h-10 w-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4 group-hover:scale-110 transition-transform">
              <Network className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-100 mb-1">İlişki Grafiği (Graph)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Notlarınız arasındaki çift yönlü bağlantıları 2D ağ simülasyonunda inceleyin.
            </p>
          </Link>

          <div
            onClick={() => {
              const event = new KeyboardEvent("keydown", { key: "k", ctrlKey: true });
              document.dispatchEvent(event);
            }}
            className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950 p-5 hover:border-emerald-500/50 transition-all cursor-pointer shadow-lg hover:shadow-emerald-500/10"
          >
            <div className="h-10 w-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-110 transition-transform">
              <Search className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-100 mb-1">Hızlı Arama (Ctrl+K)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Komut paleti ile saniyeler içinde not bulun veya yeni not oluşturun.
            </p>
          </div>
        </div>

        {/* Son Düzenlenen Notlar */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
                <Clock className="h-4 w-4 text-indigo-400" />
                Son Düzenlenen Notlar
              </h2>
              <span className="text-xs text-slate-500">{notes.length} not kayıtlı</span>
            </div>
            {recentNotes.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearRecent}
                disabled={clearing}
                className="text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800/80 hover:border-rose-500/30 transition-all h-8 px-2.5 flex items-center gap-1.5"
                title="Son düzenlenen notları temizle"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{clearing ? "Temizleniyor..." : "Temizle"}</span>
              </Button>
            )}
          </div>

          {recentNotes.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-slate-800 bg-slate-900/20 text-center space-y-3">
              <Clock className="h-8 w-8 text-slate-600 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-400">Son düzenlenen not bulunmuyor</p>
                <p className="text-xs text-slate-500">Yeni bir not oluşturarak başlayabilirsiniz.</p>
              </div>
              <Button size="sm" onClick={handleCreateNew} className="text-xs">
                <FilePlus className="h-3.5 w-3.5 mr-1" /> Yeni Not Oluştur
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recentNotes.map((note) => (
                <Link
                  key={note.id}
                  href={`/notes/${note.id}`}
                  className="group p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 hover:bg-slate-850 hover:border-indigo-500/40 transition-all space-y-2 flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-slate-200 group-hover:text-indigo-300 transition-colors flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-400" />
                        <span className="truncate max-w-[200px]">{note.title}</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        {note.isPinned && <Pin className="h-3 w-3 text-indigo-400 shrink-0" />}
                        <button
                          onClick={(e) => handleDeleteNote(e, note.id)}
                          disabled={deletingId === note.id}
                          title="Bu Notu Sil"
                          className="p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {note.content.slice(0, 140).replace(/[#*`_[\]]/g, "") || "İçerik henüz boş..."}
                    </p>
                  </div>

                  <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-800/40">
                    <span>{formatDate(note.updatedAt)}</span>
                    <span className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      Notu Aç <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Çift Yönlü Bağlantı İpuçları Paneli */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6 space-y-3">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Link2 className="h-4 w-4 text-indigo-400" />
            Çift Yönlü Bağlantı Rehberi
          </h3>
          <ul className="text-xs text-slate-400 space-y-2 leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
              <span>
                Editörde herhangi bir yere <strong className="text-indigo-300 font-mono">[[</strong> yazdığınızda otomatik tamamlama kutusu açılır ve mevcut notları listeleyebilirsiniz.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
              <span>
                Henüz var olmayan bir nota link verirseniz (örn: <strong className="text-amber-300 font-mono">[[Gelecek Planları]]</strong>), bu bir <em>Phantom Link</em> olarak kaydedilir ve Graph View&apos;de sarı renkte görünür.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
              <span>
                Bir notu açtığınızda sayfanın en altında o nota gelen tüm <strong>Geri Bağlantıları (Backlinks)</strong> görebilirsiniz.
              </span>
            </li>
          </ul>
        </div>

        {/* Hakkında & Lisans Paneli */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/20 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <span className="font-semibold text-slate-200 block text-xs">Hakkında & Lisans</span>
              <span className="text-[11px] text-slate-400">Bu proje <strong className="text-slate-200 font-medium">MIT Lisansı</strong> ile lisanslanmıştır.</span>
            </div>
          </div>
          <span className="text-[10px] text-slate-500 font-mono self-start sm:self-auto bg-slate-950/60 px-2.5 py-1 rounded-md border border-slate-800">
            MIT License
          </span>
        </div>
      </div>
    </div>
  );
}
