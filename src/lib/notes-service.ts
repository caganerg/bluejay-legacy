import { prisma } from "./prisma";
import { extractWikiLinks, extractTags } from "./markdown/extractor";
import { slugify } from "./utils";
import { Note, Folder, Tag, SearchResult } from "@/types";
import { GraphData, GraphNode, GraphLink } from "@/types/graph";

// Varsayılan Kullanıcı ID (Demo / Tekil kullanıcı modu için)
export const DEFAULT_USER_ID = "default-user-id";

// ----------------------------------------------------
// FALLBACK / IN-MEMORY STORE (Eğer Postgres henüz ayağa kalkmadıysa)
// ----------------------------------------------------
interface MemoryStore {
  users: { id: string; name: string; email: string }[];
  folders: Folder[];
  notes: Note[];
  tags: Tag[];
}

const initialMockFolders: Folder[] = [];

const initialMockNotes: Note[] = [];

const globalStore = globalThis as unknown as {
  __bluejayStore?: MemoryStore;
};

if (!globalStore.__bluejayStore) {
  globalStore.__bluejayStore = {
    users: [{ id: DEFAULT_USER_ID, name: "Kullanıcı", email: "user@bluejay.app" }],
    folders: initialMockFolders,
    notes: initialMockNotes,
    tags: [],
  };
}

const memoryStore = globalStore.__bluejayStore;

// ----------------------------------------------------
// DATABASE HELPER (Prisma ile bağlanmayı dener, hata verirse fallback kullanır)
// ----------------------------------------------------
let isPrismaAvailable: boolean | null = null;

async function checkPrisma(): Promise<boolean> {
  if (isPrismaAvailable !== null) return isPrismaAvailable;
  try {
    await prisma.$queryRaw`SELECT 1`;
    isPrismaAvailable = true;
    return true;
  } catch {
    isPrismaAvailable = false;
    return false;
  }
}

// ----------------------------------------------------
// NOT SERVİS FONKSİYONLARI
// ----------------------------------------------------

export async function getAllNotes(userId = DEFAULT_USER_ID): Promise<Note[]> {
  const useDb = await checkPrisma();
  if (useDb) {
    try {
      const notes = await prisma.note.findMany({
        where: { userId, isArchived: false },
        include: {
          folder: true,
          tags: { include: { tag: true } },
        },
        orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
      });
      return notes as unknown as Note[];
    } catch {
      // fallback
    }
  }

  // Memory fallback
  return memoryStore.notes
    .filter((n) => n.userId === userId && !n.isArchived)
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
}

export async function getNoteById(id: string, userId = DEFAULT_USER_ID): Promise<Note | null> {
  const useDb = await checkPrisma();
  if (useDb) {
    try {
      const note = await prisma.note.findFirst({
        where: { id, userId },
        include: {
          folder: true,
          tags: { include: { tag: true } },
          incomingLinks: {
            include: {
              sourceNote: { select: { id: true, title: true, slug: true } },
            },
          },
          outgoingLinks: {
            include: {
              targetNote: { select: { id: true, title: true, slug: true } },
            },
          },
        },
      });
      return note as unknown as Note;
    } catch {
      // fallback
    }
  }

  const note = memoryStore.notes.find((n) => (n.id === id || n.slug === id) && n.userId === userId);
  if (!note) return null;

  // Backlinks & Outgoing links hesapla
  const allNotes = memoryStore.notes.filter((n) => n.userId === userId);
  const outgoingExtracted = extractWikiLinks(note.content);
  
  const outgoingLinks = outgoingExtracted.map((l, index) => {
    const target = allNotes.find((n) => n.slug === l.slug || n.title.toLowerCase() === l.targetTitle.toLowerCase());
    return {
      id: `out-${index}`,
      sourceNoteId: note.id,
      targetNoteId: target?.id || null,
      targetNote: target ? { id: target.id, title: target.title, slug: target.slug } : null,
      targetTitle: l.targetTitle,
      createdAt: note.createdAt,
    };
  });

  const incomingLinks = allNotes
    .filter((n) => n.id !== note.id)
    .filter((otherNote) => {
      const links = extractWikiLinks(otherNote.content);
      return links.some((l) => l.slug === note.slug || l.targetTitle.toLowerCase() === note.title.toLowerCase());
    })
    .map((source, index) => ({
      id: `in-${index}`,
      sourceNoteId: source.id,
      sourceNote: { id: source.id, title: source.title, slug: source.slug },
      targetNoteId: note.id,
      targetNote: { id: note.id, title: note.title, slug: note.slug },
      targetTitle: note.title,
      createdAt: source.createdAt,
    }));

  return {
    ...note,
    outgoingLinks,
    incomingLinks,
  };
}

export async function createNote(
  data: { title: string; content?: string; folderId?: string | null },
  userId = DEFAULT_USER_ID
): Promise<Note> {
  const title = data.title.trim() || "Başlıksız Not";
  const slug = slugify(title) || `note-${Date.now()}`;
  const content = data.content || "";

  const useDb = await checkPrisma();
  if (useDb) {
    try {
      const newNote = await prisma.note.create({
        data: {
          title,
          slug,
          content,
          userId,
          folderId: data.folderId || null,
        },
        include: {
          folder: true,
        },
      });

      // Wikilinkleri ve etiketleri parse edip kaydet
      await syncLinksAndTags(newNote.id, content, userId);
      return newNote as unknown as Note;
    } catch {
      // fallback
    }
  }

  // Memory fallback
  const newNote: Note = {
    id: `note-${Date.now()}`,
    title,
    slug,
    content,
    isPinned: false,
    isArchived: false,
    userId,
    folderId: data.folderId || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  memoryStore.notes.unshift(newNote);
  return newNote;
}

export async function updateNote(
  id: string,
  data: { title?: string; content?: string; folderId?: string | null; isPinned?: boolean; isArchived?: boolean },
  userId = DEFAULT_USER_ID
): Promise<Note | null> {
  const useDb = await checkPrisma();
  if (useDb) {
    try {
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      if (data.title !== undefined) {
        updateData.title = data.title.trim();
        updateData.slug = slugify(data.title.trim());
      }
      if (data.content !== undefined) updateData.content = data.content;
      if (data.folderId !== undefined) updateData.folderId = data.folderId;
      if (data.isPinned !== undefined) updateData.isPinned = data.isPinned;
      if (data.isArchived !== undefined) updateData.isArchived = data.isArchived;

      const updated = await prisma.note.update({
        where: { id },
        data: updateData,
        include: { folder: true },
      });

      if (data.content !== undefined) {
        await syncLinksAndTags(id, data.content, userId);
      }

      return updated as unknown as Note;
    } catch {
      // fallback
    }
  }

  // Memory fallback
  const noteIndex = memoryStore.notes.findIndex((n) => n.id === id && n.userId === userId);
  if (noteIndex === -1) return null;

  const note = memoryStore.notes[noteIndex];
  const updatedNote: Note = {
    ...note,
    title: data.title !== undefined ? data.title.trim() : note.title,
    slug: data.title !== undefined ? slugify(data.title.trim()) : note.slug,
    content: data.content !== undefined ? data.content : note.content,
    folderId: data.folderId !== undefined ? data.folderId : note.folderId,
    isPinned: data.isPinned !== undefined ? data.isPinned : note.isPinned,
    isArchived: data.isArchived !== undefined ? data.isArchived : note.isArchived,
    updatedAt: new Date().toISOString(),
  };

  memoryStore.notes[noteIndex] = updatedNote;
  return updatedNote;
}

export async function deleteNote(id: string, userId = DEFAULT_USER_ID): Promise<boolean> {
  const useDb = await checkPrisma();
  if (useDb) {
    try {
      await prisma.note.delete({ where: { id, userId } });
      return true;
    } catch {
      // fallback
    }
  }

  const initialLen = memoryStore.notes.length;
  memoryStore.notes = memoryStore.notes.filter((n) => !(n.id === id && n.userId === userId));
  return memoryStore.notes.length < initialLen;
}

// ----------------------------------------------------
// GRAPH DATA HESAPLAMA (Force-Directed Graph için)
// ----------------------------------------------------

export async function getGraphData(userId = DEFAULT_USER_ID): Promise<GraphData> {
  const notes = await getAllNotes(userId);
  const folders = await getAllFolders(userId);
  const folderMap = new Map(folders.map((f) => [f.id, f.name]));

  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const noteMap = new Map<string, Note>();
  const slugMap = new Map<string, Note>();
  const titleMap = new Map<string, Note>();

  // Notları düğüm olarak ekle
  for (const note of notes) {
    noteMap.set(note.id, note);
    slugMap.set(note.slug, note);
    titleMap.set(note.title.toLowerCase(), note);

    nodes.push({
      id: note.id,
      title: note.title,
      slug: note.slug,
      folderName: note.folderId ? folderMap.get(note.folderId) : undefined,
      group: note.folderId ? folderMap.get(note.folderId) || "Genel" : "Genel",
      val: 1, // degree arttıkça güncellenecek
      isPhantom: false,
    });
  }

  // Henüz var olmayan (Phantom) notları takip etmek için
  const phantomTitles = new Map<string, string>(); // title -> phantomNodeId

  // Bağlantıları çıkar
  for (const note of notes) {
    const extractedLinks = extractWikiLinks(note.content);

    for (const link of extractedLinks) {
      const targetNote = slugMap.get(link.slug) || titleMap.get(link.targetTitle.toLowerCase());

      if (targetNote) {
        // Mevcut nota bağlantı
        links.push({
          source: note.id,
          target: targetNote.id,
          isPhantom: false,
        });

        // Düğüm ağırlıklarını (val) artır
        const sourceNode = nodes.find((n) => n.id === note.id);
        const targetNodeObj = nodes.find((n) => n.id === targetNote.id);
        if (sourceNode) sourceNode.val = (sourceNode.val || 1) + 1;
        if (targetNodeObj) targetNodeObj.val = (targetNodeObj.val || 1) + 1.5;
      } else {
        // Phantom Link (Henüz oluşturulmamış nota referans)
        const phantomKey = link.targetTitle.toLowerCase();
        let phantomId = phantomTitles.get(phantomKey);

        if (!phantomId) {
          phantomId = `phantom-${slugify(link.targetTitle)}`;
          phantomTitles.set(phantomKey, phantomId);

          nodes.push({
            id: phantomId,
            title: link.targetTitle,
            slug: slugify(link.targetTitle),
            group: "Oluşturulmamış",
            val: 0.8,
            isPhantom: true,
          });
        }

        links.push({
          source: note.id,
          target: phantomId,
          isPhantom: true,
        });
      }
    }
  }

  return { nodes, links };
}

// ----------------------------------------------------
// KLASÖR & ETİKET & ARAMA FONKSİYONLARI
// ----------------------------------------------------

export async function getAllFolders(userId = DEFAULT_USER_ID): Promise<Folder[]> {
  const useDb = await checkPrisma();
  if (useDb) {
    try {
      const folders = await prisma.folder.findMany({
        where: { userId },
        include: { notes: { select: { id: true, title: true, slug: true } } },
      });
      return folders as unknown as Folder[];
    } catch {
      // fallback
    }
  }
  return memoryStore.folders.filter((f) => f.userId === userId);
}

export async function createFolder(name: string, parentId: string | null = null, userId = DEFAULT_USER_ID): Promise<Folder> {
  const useDb = await checkPrisma();
  if (useDb) {
    try {
      const folder = await prisma.folder.create({
        data: { name, parentId, userId },
      });
      return folder as unknown as Folder;
    } catch {
      // fallback
    }
  }

  const folder: Folder = {
    id: `folder-${Date.now()}`,
    name,
    parentId,
    userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  memoryStore.folders.push(folder);
  return folder;
}

export async function deleteFolder(id: string, userId = DEFAULT_USER_ID): Promise<boolean> {
  const useDb = await checkPrisma();
  if (useDb) {
    try {
      await prisma.folder.delete({
        where: { id, userId },
      });
      return true;
    } catch {
      // fallback
    }
  }

  const index = memoryStore.folders.findIndex((f) => f.id === id && f.userId === userId);
  if (index === -1) return false;

  // Alt klasörleri ve bu klasöre ait notları güvenli şekilde temizle
  const folderIdsToDelete = new Set<string>([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const f of memoryStore.folders) {
      if (f.parentId && folderIdsToDelete.has(f.parentId) && !folderIdsToDelete.has(f.id)) {
        folderIdsToDelete.add(f.id);
        changed = true;
      }
    }
  }

  memoryStore.notes.forEach((n) => {
    if (n.folderId && folderIdsToDelete.has(n.folderId)) {
      n.folderId = null;
    }
  });

  memoryStore.folders = memoryStore.folders.filter((f) => !folderIdsToDelete.has(f.id));
  return true;
}

export async function searchNotes(query: string, userId = DEFAULT_USER_ID): Promise<SearchResult[]> {
  const notes = await getAllNotes(userId);
  const folders = await getAllFolders(userId);
  const folderMap = new Map(folders.map((f) => [f.id, f.name]));

  const q = query.toLowerCase().trim();
  if (!q) {
    return notes.slice(0, 10).map((n) => ({
      id: n.id,
      title: n.title,
      slug: n.slug,
      preview: n.content.slice(0, 120).replace(/[#*`_[\]]/g, ""),
      folderName: n.folderId ? folderMap.get(n.folderId) : undefined,
      updatedAt: n.updatedAt,
    }));
  }

  return notes
    .filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q))
    .slice(0, 15)
    .map((n) => {
      // Arama sonucunda eşleşen yerin etrafından önizleme çıkar
      const lowerContent = n.content.toLowerCase();
      const matchIndex = lowerContent.indexOf(q);
      let preview = "";

      if (matchIndex !== -1) {
        const start = Math.max(0, matchIndex - 40);
        const end = Math.min(n.content.length, matchIndex + q.length + 60);
        preview = (start > 0 ? "..." : "") + n.content.slice(start, end).replace(/[#*`_[\]]/g, "") + (end < n.content.length ? "..." : "");
      } else {
        preview = n.content.slice(0, 120).replace(/[#*`_[\]]/g, "");
      }

      return {
        id: n.id,
        title: n.title,
        slug: n.slug,
        preview,
        folderName: n.folderId ? folderMap.get(n.folderId) : undefined,
        updatedAt: n.updatedAt,
      };
    });
}

// ----------------------------------------------------
// LİNKLERİ VE ETİKETLERİ SENKRONİZE ET (Postgres için)
// ----------------------------------------------------
async function syncLinksAndTags(noteId: string, content: string, userId: string) {
  try {
    const extractedLinks = extractWikiLinks(content);
    const extractedTags = extractTags(content);

    // Mevcut linkleri temizle
    await prisma.noteLink.deleteMany({ where: { sourceNoteId: noteId } });

    // Linkleri kaydet
    for (const link of extractedLinks) {
      const targetNote = await prisma.note.findFirst({
        where: {
          userId,
          OR: [{ slug: link.slug }, { title: { equals: link.targetTitle, mode: "insensitive" } }],
        },
      });

      await prisma.noteLink.create({
        data: {
          sourceNoteId: noteId,
          targetNoteId: targetNote?.id || null,
          targetTitle: link.targetTitle,
        },
      });
    }

    // Etiketleri senkronize et
    await prisma.noteTag.deleteMany({ where: { noteId } });
    for (const tagName of extractedTags) {
      const tag = await prisma.tag.upsert({
        where: { userId_name: { userId, name: tagName } },
        update: {},
        create: { name: tagName, userId },
      });

      await prisma.noteTag.create({
        data: { noteId, tagId: tag.id },
      });
    }
  } catch (error) {
    console.error("Link ve etiket senkronizasyon hatası:", error);
  }
}
