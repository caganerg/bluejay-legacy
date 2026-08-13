"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Link2, ArrowUpRight, ArrowDownLeft, Plus, HelpCircle, FileText } from "lucide-react";
import { NoteLinkItem } from "@/types";
import { Button } from "@/components/ui/button";

interface BacklinksPanelProps {
  currentNoteTitle: string;
  incomingLinks?: NoteLinkItem[];
  outgoingLinks?: NoteLinkItem[];
  onNoteCreated?: (noteId: string) => void;
}

export function BacklinksPanel({
  currentNoteTitle,
  incomingLinks = [],
  outgoingLinks = [],
  onNoteCreated,
}: BacklinksPanelProps) {
  const router = useRouter();
  const [creatingTitle, setCreatingTitle] = React.useState<string | null>(null);

  // Oluşturulmamış bağlantılar (Unresolved links)
  const unresolvedLinks = outgoingLinks.filter((l) => !l.targetNoteId && l.targetTitle);
  const resolvedOutgoing = outgoingLinks.filter((l) => l.targetNoteId);

  const handleCreatePhantomNote = async (title: string) => {
    setCreatingTitle(title);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content: `# ${title.trim()}\n\nBu not [[${currentNoteTitle}]] üzerinden oluşturuldu.\n\n`,
        }),
      });
      const data = await res.json();
      if (data.note) {
        if (onNoteCreated) onNoteCreated(data.note.id);
        router.push(`/notes/${data.note.id}`);
      }
    } catch (err) {
      console.error("Phantom not oluşturulamadı:", err);
    } finally {
      setCreatingTitle(null);
    }
  };

  return (
    <div className="mt-12 pt-6 border-t border-slate-800/80 space-y-6">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
        <Link2 className="h-4 w-4 text-indigo-400" />
        <span>İlişki ve Bağlantı Paneli (Graph & Backlinks)</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Geri Bağlantılar (Incoming Links / Backlinks) */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-400" />
              Geri Bağlantılar (Backlinks)
            </span>
            <span className="text-xs text-slate-500 bg-slate-800/80 px-2 py-0.5 rounded-full">
              {incomingLinks.length}
            </span>
          </div>

          {incomingLinks.length === 0 ? (
            <p className="text-xs text-slate-500 italic">Bu nota henüz başka bir nottan link verilmemiş.</p>
          ) : (
            <div className="space-y-1.5">
              {incomingLinks.map((link) => (
                <Link
                  key={link.id}
                  href={`/notes/${link.sourceNote?.id || link.sourceNoteId}`}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 hover:bg-indigo-950/40 border border-slate-800/60 hover:border-indigo-500/30 text-xs text-slate-300 hover:text-indigo-200 transition-all group"
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="h-3.5 w-3.5 text-slate-500 group-hover:text-indigo-400" />
                    <span className="font-medium truncate">{link.sourceNote?.title || "İsimsiz Not"}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 group-hover:text-indigo-300">Görüntüle →</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Giden Bağlantılar (Outgoing Links) */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <ArrowUpRight className="h-3.5 w-3.5 text-indigo-400" />
              Giden Bağlantılar (Outgoing Links)
            </span>
            <span className="text-xs text-slate-500 bg-slate-800/80 px-2 py-0.5 rounded-full">
              {outgoingLinks.length}
            </span>
          </div>

          {outgoingLinks.length === 0 ? (
            <p className="text-xs text-slate-500 italic">Bu notun içinde başka bir nota verilmiş `[[link]]` yok.</p>
          ) : (
            <div className="space-y-2">
              {/* Var olan notlara linkler */}
              {resolvedOutgoing.map((link) => (
                <Link
                  key={link.id}
                  href={`/notes/${link.targetNote?.id || link.targetNoteId}`}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800/60 text-xs text-slate-300 hover:text-white transition-all group"
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="h-3.5 w-3.5 text-indigo-400" />
                    <span className="font-medium truncate">{link.targetNote?.title || link.targetTitle}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 group-hover:text-slate-300">Aç →</span>
                </Link>
              ))}

              {/* Henüz oluşturulmamış (Unresolved) linkler */}
              {unresolvedLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-amber-950/20 border border-amber-500/20 text-xs text-amber-200/90"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <HelpCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <span className="truncate italic">[[{link.targetTitle}]]</span>
                    <span className="text-[10px] text-amber-400/70">(Henüz yok)</span>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCreatePhantomNote(link.targetTitle!)}
                    disabled={creatingTitle === link.targetTitle}
                    className="h-6 text-[11px] px-2 border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {creatingTitle === link.targetTitle ? "Açılıyor..." : "Oluştur"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
