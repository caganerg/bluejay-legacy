"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FilePlus,
  Network,
  Search,
  Sparkles,
  Link2,
  Clock,
  Pin,
  FileText,
  ArrowRight,
  Trash2,
  ShieldCheck,
} from "lucide-react";
import { Note } from "@/types";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export default function HomePage() {
  const router = useRouter();
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [_folders, setFolders] = React.useState<unknown[]>([]);
  const [_loading, setLoading] = React.useState(true);
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
      console.error("Failed to load the home page data:", err);
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
          title: "New Note",
          content: "# New Note\n\nStart writing here...\n",
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
        "Are you sure you want to delete all recently edited notes? This cannot be undone."
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
      console.error("Failed to clear the notes:", err);
    } finally {
      setClearing(false);
    }
  };

  const handleDeleteNote = async (e: React.MouseEvent, noteId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this note?")) return;

    setDeletingId(noteId);
    try {
      await fetch(`/api/notes/${noteId}`, { method: "DELETE" });
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      window.dispatchEvent(new Event("vault-updated"));
    } catch (err) {
      console.error("Failed to delete the note:", err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-8 py-10 bg-[#0a0d16]">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Welcome header */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Cloud-based digital brain (PKM) system</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Welcome to your Bluejay vault
          </h1>
          <p className="text-slate-400 text-sm sm:text-base max-w-2xl leading-relaxed">
            Take notes in Markdown, connect your thoughts with{" "}
            <code className="text-indigo-300 font-mono">[[Note Name]]</code>, and explore your
            entire knowledge network on an interactive Graph View.
          </p>
        </div>

        {/* Quick action cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div
            onClick={handleCreateNew}
            className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950 p-5 hover:border-indigo-500/50 transition-all cursor-pointer shadow-lg hover:shadow-indigo-500/10"
          >
            <div className="h-10 w-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4 group-hover:scale-110 transition-transform">
              <FilePlus className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-100 mb-1">Create a new note</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Start writing right away on a clean, Markdown-powered page.
            </p>
          </div>

          <Link
            href="/graph"
            className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950 p-5 hover:border-purple-500/50 transition-all cursor-pointer shadow-lg hover:shadow-purple-500/10"
          >
            <div className="h-10 w-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4 group-hover:scale-110 transition-transform">
              <Network className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-100 mb-1">Knowledge Graph</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Explore the bi-directional links between your notes in a 2D network simulation.
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
            <h3 className="text-base font-semibold text-slate-100 mb-1">Quick search (Ctrl+K)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Find a note or create a new one in seconds with the command palette.
            </p>
          </div>
        </div>

        {/* Recently edited notes */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
                <Clock className="h-4 w-4 text-indigo-400" />
                Recently Edited Notes
              </h2>
              <span className="text-xs text-slate-500">{notes.length} notes stored</span>
            </div>
            {recentNotes.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearRecent}
                disabled={clearing}
                className="text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800/80 hover:border-rose-500/30 transition-all h-8 px-2.5 flex items-center gap-1.5"
                title="Clear the recently edited notes"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{clearing ? "Clearing..." : "Clear"}</span>
              </Button>
            )}
          </div>

          {recentNotes.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-slate-800 bg-slate-900/20 text-center space-y-3">
              <Clock className="h-8 w-8 text-slate-600 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-400">No recently edited notes</p>
                <p className="text-xs text-slate-500">You can start by creating a new note.</p>
              </div>
              <Button size="sm" onClick={handleCreateNew} className="text-xs">
                <FilePlus className="h-3.5 w-3.5 mr-1" /> Create a new note
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
                          title="Delete this note"
                          className="p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {note.content.slice(0, 140).replace(/[#*`_[\]]/g, "") || "No content yet..."}
                    </p>
                  </div>

                  <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-800/40">
                    <span>{formatDate(note.updatedAt)}</span>
                    <span className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      Open note <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Bi-directional linking tips panel */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6 space-y-3">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Link2 className="h-4 w-4 text-indigo-400" />
            Bi-directional Linking Guide
          </h3>
          <ul className="text-xs text-slate-400 space-y-2 leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
              <span>
                Typing <strong className="text-indigo-300 font-mono">[[</strong> anywhere in the
                editor opens an autocomplete box that lists your existing notes.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
              <span>
                If you link to a note that does not exist yet (e.g.{" "}
                <strong className="text-amber-300 font-mono">[[Future Plans]]</strong>), it is
                stored as a <em>phantom link</em> and shows up in yellow in the Graph View.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
              <span>
                When you open a note, you can see every <strong>backlink</strong> pointing to it
                at the bottom of the page.
              </span>
            </li>
          </ul>
        </div>

        {/* About & license panel */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/20 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <span className="font-semibold text-slate-200 block text-xs">About &amp; License</span>
              <span className="text-[11px] text-slate-400">
                This project is licensed under the{" "}
                <strong className="text-slate-200 font-medium">MIT License</strong>.
              </span>
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
