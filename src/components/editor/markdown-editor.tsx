"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useRouter } from "next/navigation";
import {
  Bold,
  Italic,
  Code,
  Heading1,
  Heading2,
  List,
  CheckSquare,
  Eye,
  Edit3,
  Columns,
  Sparkles,
  Check,
  Loader2,
  Folder as FolderIcon,
  Hash,
} from "lucide-react";
import { Note, Folder } from "@/types";
import { transformWikiLinksForDisplay, extractTags } from "@/lib/markdown/extractor";
import { BacklinksPanel } from "./backlinks-panel";
import { Badge } from "@/components/ui/badge";
import { cn, flattenFoldersAsTree, slugify } from "@/lib/utils";
import { useVault, primeNote } from "@/lib/vault-context";

interface MarkdownEditorProps {
  note: Note;
  folders: Folder[];
  onSave: (updatedData: { title: string; content: string; folderId?: string | null }) => Promise<void>;
  onRefreshVault?: () => void;
}

type EditorMode = "split" | "edit" | "preview";

export function MarkdownEditor({ note, folders, onSave, onRefreshVault }: MarkdownEditorProps) {
  const router = useRouter();
  const { notes: vaultNotes } = useVault();
  const [title, setTitle] = React.useState(note.title);
  const [content, setContent] = React.useState(note.content);
  const [folderId, setFolderId] = React.useState<string | null>(note.folderId || null);
  const [mode, setMode] = React.useState<EditorMode>("split");
  const [saveStatus, setSaveStatus] = React.useState<"saved" | "saving" | "unsaved">("saved");

  // Track what has been saved to prevent redundant calls and loops
  const lastSavedRef = React.useRef<{ title: string; content: string; folderId: string | null }>({
    title: note.title,
    content: note.content,
    folderId: note.folderId || null,
  });

  // Wikilink Autocomplete State
  const [isSuggesting, setIsSuggesting] = React.useState(false);
  const [suggestionQuery, setSuggestionQuery] = React.useState("");
  const [suggestedNotes, setSuggestedNotes] = React.useState<{ id: string; title: string; slug: string }[]>([]);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [triggerPos, setTriggerPos] = React.useState<number | null>(null);

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Reset the local editing state ONLY when a different note is selected.
  // If `note.title/content/folderId` were added to the dependencies, the save
  // response would change the `note` object, this effect would re-run, and the
  // characters the user typed while the request was in flight would be
  // overwritten by the version coming back from the server (a lost update).
  React.useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    setFolderId(note.folderId || null);
    setSaveStatus("saved");
    lastSavedRef.current = {
      title: note.title,
      content: note.content,
      folderId: note.folderId || null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  // Debounced Auto-Save (only if actually changed)
  React.useEffect(() => {
    const hasChanged =
      title !== lastSavedRef.current.title ||
      content !== lastSavedRef.current.content ||
      folderId !== lastSavedRef.current.folderId;

    if (!hasChanged) {
      return;
    }

    setSaveStatus("unsaved");
    const timeout = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await onSave({ title, content, folderId });
        lastSavedRef.current = { title, content, folderId };
        setSaveStatus("saved");
      } catch (err) {
        console.error("Failed to save:", err);
        setSaveStatus("unsaved");
      }
    }, 800);

    return () => clearTimeout(timeout);
  }, [title, content, folderId, onSave]);

  // [[ Wikilink Autocomplete Logic
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart;
    setContent(val);

    // Is there an open [[ in the text to the left of the cursor?
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastOpenBracket = textBeforeCursor.lastIndexOf("[[");

    if (lastOpenBracket !== -1) {
      const textAfterBracket = textBeforeCursor.slice(lastOpenBracket + 2);
      // If there is no closing ]] and no newline, suggestions are active
      if (!textAfterBracket.includes("]]") && !textAfterBracket.includes("\n")) {
        setIsSuggesting(true);
        setSuggestionQuery(textAfterBracket);
        setTriggerPos(lastOpenBracket);
        setSelectedIndex(0);
        return;
      }
    }

    setIsSuggesting(false);
  };

  // The suggestion search has to be debounced and cancellable: every keystroke
  // used to fire a request directly, out-of-order responses let stale results
  // overwrite fresher ones, and a fast typist could hit the 180-requests-per-
  // minute search limit on their own.
  React.useEffect(() => {
    if (!isSuggesting) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(suggestionQuery)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        setSuggestedNotes(data.results || []);
      } catch {
        // An aborted request or a network error: the previous suggestions stay.
      }
    }, 120);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isSuggesting, suggestionQuery]);

  const insertWikilink = (targetTitle: string) => {
    if (triggerPos === null || !textareaRef.current) return;

    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;
    const before = content.slice(0, triggerPos);
    const after = content.slice(cursorPos);

    const newContent = `${before}[[${targetTitle}]]${after}`;
    setContent(newContent);
    setIsSuggesting(false);
    setTriggerPos(null);

    // Place the cursor at the end of the link
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = triggerPos + targetTitle.length + 4;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isSuggesting) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (suggestedNotes.length + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + (suggestedNotes.length + 1)) % (suggestedNotes.length + 1));
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      if (selectedIndex < suggestedNotes.length) {
        insertWikilink(suggestedNotes[selectedIndex].title);
      } else if (suggestionQuery.trim()) {
        insertWikilink(suggestionQuery.trim());
      }
    } else if (e.key === "Escape") {
      setIsSuggesting(false);
    }
  };

  // Markdown toolbar buttons
  const insertFormatting = (prefix: string, suffix = prefix) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end);

    const replacement = `${prefix}${selected || "text"}${suffix}`;
    const newContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + (selected.length || 5));
    }, 10);
  };

  const [_isNavigatingWikilink, setIsNavigatingWikilink] = React.useState(false);

  // Intercept wikilink clicks (in preview mode)
  const handlePreviewClick = async (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const link = target.closest("a");
    const href = link?.getAttribute("href");

    if (link && href?.startsWith("#wikilink:")) {
      e.preventDefault();
      const rawTargetTitle = decodeURIComponent(href.replace("#wikilink:", "")).trim();
      if (!rawTargetTitle) return;

      // If the target note is already in the vault, navigate without waiting
      // for the resolve request.
      const targetSlug = slugify(rawTargetTitle);
      const existing = vaultNotes.find(
        (n) =>
          n.slug === targetSlug ||
          n.title.toLowerCase() === rawTargetTitle.toLowerCase()
      );
      if (existing) {
        router.push(`/notes/${existing.id}`);
        return;
      }

      setIsNavigatingWikilink(true);
      try {
        const res = await fetch("/api/notes/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: rawTargetTitle,
            sourceNoteTitle: title,
          }),
        });

        const data = await res.json();
        if (data.note) {
          primeNote(data.note);
          if (data.created) {
            window.dispatchEvent(new Event("vault-updated"));
            if (onRefreshVault) onRefreshVault();
          }
          router.push(`/notes/${data.note.id}`);
        }
      } catch (err) {
        console.error("Failed to navigate to the wikilink:", err);
      } finally {
        setIsNavigatingWikilink(false);
      }
    }
  };

  const tags = extractTags(content);
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#0a0d16]">
      {/* Top toolbar */}
      <header className="relative h-13 border-b border-slate-800/80 px-6 flex items-center justify-between shrink-0 bg-[#0c101b]/80 backdrop-blur-md">
        {/* Left: folder picker and status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <FolderIcon className="h-3.5 w-3.5 text-slate-500" />
            <select
              value={folderId || ""}
              onChange={(e) => setFolderId(e.target.value || null)}
              className="bg-transparent border-0 text-slate-300 hover:text-white focus:outline-none cursor-pointer text-xs"
            >
              <option value="" className="bg-slate-900">No folder</option>
              {flattenFoldersAsTree(folders).map(({ folder, depth }) => (
                <option key={folder.id} value={folder.id} className="bg-slate-900">
                  {"  ".repeat(depth)}
                  {folder.name}
                </option>
              ))}
            </select>
          </div>

          <span className="text-slate-700">|</span>

          {/* Auto-save indicator */}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            {saveStatus === "saving" && (
              <>
                <Loader2 className="h-3 w-3 animate-spin text-indigo-400" />
                <span className="text-indigo-400">Saving...</span>
              </>
            )}
            {saveStatus === "saved" && (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-slate-400">Saved</span>
              </>
            )}
            {saveStatus === "unsaved" && (
              <span className="text-amber-400/80">Unsaved changes</span>
            )}
          </div>
        </div>

        {/* Middle: Markdown formatting tools */}
        <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-1 bg-slate-900/60 p-1 rounded-lg border border-slate-800 shadow-sm">
          <button
            onClick={() => insertFormatting("**")}
            title="Bold"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
          >
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => insertFormatting("*")}
            title="Italic"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
          >
            <Italic className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => insertFormatting("`")}
            title="Inline code"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
          >
            <Code className="h-3.5 w-3.5" />
          </button>
          <span className="w-px h-3 bg-slate-800 my-auto" />
          <button
            onClick={() => insertFormatting("# ", "")}
            title="Heading 1"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
          >
            <Heading1 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => insertFormatting("## ", "")}
            title="Heading 2"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
          >
            <Heading2 className="h-3.5 w-3.5" />
          </button>
          <span className="w-px h-3 bg-slate-800 my-auto" />
          <button
            onClick={() => insertFormatting("- ", "")}
            title="List"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
          >
            <List className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => insertFormatting("- [ ] ", "")}
            title="Task checkbox"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
          >
            <CheckSquare className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => insertFormatting("[[", "]]")}
            title="Insert wikilink [[Note]]"
            className="p-1.5 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/40 rounded transition-colors flex items-center gap-1 font-bold text-xs"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>[[ ]]</span>
          </button>
        </div>

        {/* Right: view mode switcher */}
        <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setMode("edit")}
            title="Edit only"
            className={cn(
              "p-1.5 rounded text-xs flex items-center gap-1.5 transition-colors",
              mode === "edit" ? "bg-indigo-600 text-white font-medium shadow-xs" : "text-slate-400 hover:text-slate-200"
            )}
          >
            <Edit3 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Edit</span>
          </button>
          <button
            onClick={() => setMode("split")}
            title="Split view"
            className={cn(
              "p-1.5 rounded text-xs flex items-center gap-1.5 transition-colors",
              mode === "split" ? "bg-indigo-600 text-white font-medium shadow-xs" : "text-slate-400 hover:text-slate-200"
            )}
          >
            <Columns className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Split</span>
          </button>
          <button
            onClick={() => setMode("preview")}
            title="Preview"
            className={cn(
              "p-1.5 rounded text-xs flex items-center gap-1.5 transition-colors",
              mode === "preview" ? "bg-indigo-600 text-white font-medium shadow-xs" : "text-slate-400 hover:text-slate-200"
            )}
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Preview</span>
          </button>
        </div>
      </header>

      {/* Main editor area */}
      <div className="flex-1 overflow-y-auto px-8 py-6 relative">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Note title */}
          <div className="space-y-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title..."
              className="w-full text-3xl sm:text-4xl font-extrabold text-white tracking-tight bg-transparent border-0 focus:outline-none placeholder:text-slate-600"
            />

            {/* Etiketler (Varsa) */}
            {tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {tags.map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1 bg-slate-800/80 text-indigo-300 border-slate-700/60">
                    <Hash className="h-3 w-3 text-indigo-400" />
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Editor & preview panes */}
          <div className={cn("grid gap-8", mode === "split" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1")}>
            {/* Markdown writing area (edit) */}
            {(mode === "edit" || mode === "split") && (
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={handleContentChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Start writing in Markdown... Type [[ to reference another note."
                  className="w-full min-h-[500px] bg-transparent resize-none font-mono text-sm leading-relaxed text-slate-200 placeholder:text-slate-600 focus:outline-none selection:bg-indigo-500/30"
                  spellCheck={false}
                />

                {/* [[ Wikilink Autocomplete Dropdown Popup */}
                {isSuggesting && (
                  <div className="absolute left-4 top-20 z-50 w-72 rounded-xl border border-slate-800 bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 border-b border-slate-800 flex items-center justify-between">
                      <span>Pick a note to link ([[...]])</span>
                      <span className="text-[10px] text-indigo-400">↵ Insert</span>
                    </div>

                    <div className="max-h-48 overflow-y-auto py-1 space-y-0.5">
                      {suggestedNotes.map((item, idx) => (
                        <div
                          key={item.id}
                          onClick={() => insertWikilink(item.title)}
                          className={cn(
                            "flex items-center justify-between px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors",
                            idx === selectedIndex
                              ? "bg-indigo-600 text-white font-medium"
                              : "text-slate-300 hover:bg-slate-800 hover:text-white"
                          )}
                        >
                          <span className="truncate">{item.title}</span>
                          <span className="text-[10px] opacity-70">Mevcut</span>
                        </div>
                      ))}

                      {suggestionQuery.trim() !== "" && (
                        <div
                          onClick={() => insertWikilink(suggestionQuery.trim())}
                          className={cn(
                            "flex items-center justify-between px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors border-t border-slate-800/80 mt-1",
                            selectedIndex === suggestedNotes.length
                              ? "bg-indigo-600 text-white font-medium"
                              : "text-indigo-300 hover:bg-indigo-950/50"
                          )}
                        >
                          <span className="truncate">+ &quot;{suggestionQuery}&quot; (as a new note)</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Markdown preview area */}
            {(mode === "preview" || mode === "split") && (
              <div
                onClick={handlePreviewClick}
                className={cn(
                  "markdown-body prose prose-invert max-w-none text-slate-300 leading-relaxed",
                  mode === "split" && "border-l border-slate-800/80 pl-8 min-h-[500px]"
                )}
              >
                {content.trim() ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({ node: _node, ...props }) => {
                        const href = props.href || "";
                        if (href.startsWith("#wikilink:")) {
                          return (
                            <a {...props} className="wikilink">
                              <span className="text-indigo-400">[[</span>
                              <span>{props.children}</span>
                              <span className="text-indigo-400">]]</span>
                            </a>
                          );
                        }
                        return <a {...props} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline" />;
                      },
                    }}
                  >
                    {transformWikiLinksForDisplay(content)}
                  </ReactMarkdown>
                ) : (
                  <div className="text-slate-600 italic py-12 text-center text-sm">
                    Nothing to preview yet. Start writing on the left.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer and backlinks panel */}
          <BacklinksPanel
            currentNoteTitle={title}
            incomingLinks={note.incomingLinks}
            outgoingLinks={note.outgoingLinks}
            onNoteCreated={onRefreshVault}
          />
        </div>
      </div>

      {/* Bottom status bar */}
      <footer className="h-8 border-t border-slate-800/80 px-6 flex items-center justify-between text-[11px] text-slate-500 shrink-0 bg-[#090d16]">
        <div className="flex items-center gap-4">
          <span>{wordCount} words</span>
          <span>{content.length} characters</span>
          <span>{tags.length} tags</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Wikilink parser:</span>
          <span className="text-indigo-400 font-mono">[[Note Name]]</span>
        </div>
      </footer>
    </div>
  );
}
