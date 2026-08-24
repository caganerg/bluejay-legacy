"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Folder, Note } from "@/types";
import { flattenFoldersAsTree } from "@/lib/utils";
import { FilePlus } from "lucide-react";

interface NewNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: Folder[];
  currentFolderId?: string | null;
  onCreated: (noteId: string, note?: Note) => void;
}

export function NewNoteDialog({
  open,
  onOpenChange,
  folders,
  currentFolderId,
  onCreated,
}: NewNoteDialogProps) {
  const [title, setTitle] = React.useState("");
  const [folderId, setFolderId] = React.useState<string | null>(currentFolderId || null);
  const [loading, setLoading] = React.useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setTitle("");
      setFolderId(currentFolderId || null);
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          folderId: folderId || null,
          content: `# ${title.trim()}\n\n`,
        }),
      });
      const data = await res.json();
      if (data.note) {
        setTitle("");
        onOpenChange(false);
        onCreated(data.note.id, data.note);
      }
    } catch (err) {
      console.error("Failed to create the note:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-100">
            <FilePlus className="h-5 w-5 text-indigo-400" />
            Create New Note
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Note title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Project Architecture, Ideas..."
              autoFocus
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Folder (optional)</label>
            <div className="relative">
              <select
                value={folderId || ""}
                onChange={(e) => setFolderId(e.target.value || null)}
                className="flex h-9 w-full rounded-lg border border-slate-700/80 bg-slate-900/70 px-3 py-1 text-sm text-slate-200 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
              >
                <option value="">No folder (root)</option>
                {flattenFoldersAsTree(folders).map(({ folder, depth }) => (
                  <option key={folder.id} value={folder.id}>
                    {"  ".repeat(depth)}
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || loading}>
              {loading ? "Creating..." : "Create Note"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
