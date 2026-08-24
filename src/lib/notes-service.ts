import { prisma } from "./prisma";
import { extractWikiLinks, extractTags } from "./markdown/extractor";
import { slugify, collectFolderSubtreeIds } from "./utils";
import { Note, Folder, Tag, SearchResult } from "@/types";
import { GraphData, GraphNode, GraphLink } from "@/types/graph";

// Varsayılan Kullanıcı ID (Demo / Tekil kullanıcı modu için)
export const DEFAULT_USER_ID = "default-user-id";

// ----------------------------------------------------
// DEPOLAMA MODU
// ----------------------------------------------------
// Mod süreç başlarken bir kez, yalnızca `DATABASE_URL`'in varlığına bakarak
// belirlenir ve çalışma sırasında değişmez.
//
// Daha önce her fonksiyon `try { prisma… } catch { /* fallback */ }` kalıbını
// kullanıyordu. Bu kalıp bağlantı kopmasını, benzersizlik ihlalini ve kısıt
// hatasını ayırt etmeden yutup isteği sessizce bellek içi depoya yönlendiriyordu:
// kullanıcı "Kaydedildi" görüyor, not yalnızca belleğe yazıldığı için yeniden
// başlatmada yok oluyordu. Artık veritabanı modundayken hatalar yutulmuyor —
// çağırana yükseliyor ve rota 500 dönüyor. Yanlış depoya sessizce yazmaktansa
// görünür bir hata vermek yeğdir.
export const USE_DATABASE = Boolean(process.env.DATABASE_URL);

// ----------------------------------------------------
// BELLEK İÇİ DEPO (yalnızca `DATABASE_URL` tanımsızken)
// ----------------------------------------------------
interface MemoryStore {
  users: { id: string; name: string; email: string }[];
  folders: Folder[];
  notes: Note[];
  tags: Tag[];
}

const globalStore = globalThis as unknown as {
  __bluejayStore?: MemoryStore;
};

if (!globalStore.__bluejayStore) {
  globalStore.__bluejayStore = {
    users: [{ id: DEFAULT_USER_ID, name: "Kullanıcı", email: "user@bluejay.app" }],
    folders: [],
    notes: [],
    tags: [],
  };
}

const memoryStore = globalStore.__bluejayStore;

// ----------------------------------------------------
// NOT SERVİS FONKSİYONLARI
// ----------------------------------------------------

// Notlar `[userId, slug]` üzerinde benzersiz olmak zorunda (bkz. prisma/schema.prisma).
// Aynı başlıkla (veya aynı slug'a dönüşen farklı başlıklarla) not oluşturmak/yeniden
// adlandırmak veritabanında çakışmaya ve notun sessizce kaybolmasına yol açabildiğinden,
// slug'ı önceden -2, -3... ekleyerek benzersizleştiriyoruz.
async function getExistingSlugs(userId: string, excludeNoteId?: string): Promise<Set<string>> {
  if (USE_DATABASE) {
    const notes = await prisma.note.findMany({
      where: excludeNoteId ? { userId, id: { not: excludeNoteId } } : { userId },
      select: { slug: true },
    });
    return new Set(notes.map((n) => n.slug));
  }

  return new Set(
    memoryStore.notes
      .filter((n) => n.userId === userId && n.id !== excludeNoteId)
      .map((n) => n.slug)
  );
}

async function generateUniqueSlug(
  title: string,
  userId: string,
  excludeNoteId?: string
): Promise<string> {
  const base = slugify(title) || "not";
  const existingSlugs = await getExistingSlugs(userId, excludeNoteId);

  if (!existingSlugs.has(base)) return base;

  let counter = 2;
  while (existingSlugs.has(`${base}-${counter}`)) {
    counter++;
  }
  return `${base}-${counter}`;
}

// Prisma'nın benzersizlik ihlali hata kodu. `generateUniqueSlug` mevcut slug'ları
// okuyup sonra yazdığı için araya giren eşzamanlı bir oluşturma aynı slug'ı
// üretebiliyor; bu durumda tekrar deniyoruz.
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}

// Prisma'nın serileştirme çakışması / kilitlenme kodu. `SERIALIZABLE` seviyesinde
// çalışan bir transaction eşzamanlı bir yazmayla çakışırsa bununla düşer ve
// yeniden denenmesi beklenir.
function isSerializationFailure(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2034"
  );
}

export async function getAllNotes(userId = DEFAULT_USER_ID): Promise<Note[]> {
  if (USE_DATABASE) {
    const notes = await prisma.note.findMany({
      where: { userId, isArchived: false },
      include: {
        folder: true,
        tags: { include: { tag: true } },
      },
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
    });
    return notes as unknown as Note[];
  }

  return memoryStore.notes
    .filter((n) => n.userId === userId && !n.isArchived)
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
}

// Bir notu ID, slug ya da başlıkla eşleştiren tek ortak kural. `getNoteById`,
// `updateNote` ve `deleteNote` aynı kuralı kullanır; aksi halde `GET` ile açılan
// bir tanımlayıcı `PUT`'ta 404 veriyordu.
function noteIdentityCandidates(id: string): { raw: string; decoded: string; slug: string } {
  let decoded = id;
  try {
    decoded = decodeURIComponent(id);
  } catch {
    decoded = id;
  }
  return { raw: id, decoded, slug: slugify(decoded) };
}

function memoryNoteMatches(note: Note, id: string): boolean {
  const { raw, decoded, slug } = noteIdentityCandidates(id);
  return (
    note.id === raw ||
    note.id === decoded ||
    note.slug === raw ||
    note.slug === decoded ||
    note.slug === slug ||
    note.title.toLowerCase() === raw.toLowerCase() ||
    note.title.toLowerCase() === decoded.toLowerCase()
  );
}

/**
 * Verilen tanımlayıcıyı (ID, slug ya da başlık) gerçek not ID'sine çevirir.
 * Yazma işlemleri önce bunu çağırır, böylece okuma ve yazma rotaları aynı
 * tanımlayıcı kümesini kabul eder.
 */
export async function resolveNoteId(id: string, userId = DEFAULT_USER_ID): Promise<string | null> {
  const { raw, decoded, slug } = noteIdentityCandidates(id);

  if (USE_DATABASE) {
    const note = await prisma.note.findFirst({
      where: {
        userId,
        OR: [
          { id: raw },
          { id: decoded },
          { slug: raw },
          { slug: decoded },
          { slug },
          { title: { equals: raw, mode: "insensitive" } },
          { title: { equals: decoded, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    return note?.id ?? null;
  }

  const note = memoryStore.notes.find((n) => n.userId === userId && memoryNoteMatches(n, id));
  return note?.id ?? null;
}

export async function getNoteById(id: string, userId = DEFAULT_USER_ID): Promise<Note | null> {
  const { raw, decoded, slug } = noteIdentityCandidates(id);

  if (USE_DATABASE) {
    const note = await prisma.note.findFirst({
      where: {
        userId,
        OR: [
          { id: raw },
          { id: decoded },
          { slug: raw },
          { slug: decoded },
          { slug },
          { title: { equals: raw, mode: "insensitive" } },
          { title: { equals: decoded, mode: "insensitive" } },
        ],
      },
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
    return (note as unknown as Note) ?? null;
  }

  const note = memoryStore.notes.find((n) => n.userId === userId && memoryNoteMatches(n, id));
  if (!note) return null;

  // Backlinks & Outgoing links hesapla
  const allNotes = memoryStore.notes.filter((n) => n.userId === userId);
  const outgoingExtracted = extractWikiLinks(note.content);

  const outgoingLinks = outgoingExtracted.map((l, index) => {
    const target = allNotes.find(
      (n) => n.slug === l.slug || n.title.toLowerCase() === l.targetTitle.toLowerCase()
    );
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
      return links.some(
        (l) => l.slug === note.slug || l.targetTitle.toLowerCase() === note.title.toLowerCase()
      );
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

export async function findOrCreateNoteByTitle(
  title: string,
  sourceNoteTitle?: string,
  userId = DEFAULT_USER_ID
): Promise<{ note: Note; created: boolean }> {
  const cleanTitle = title.trim();
  const targetSlug = slugify(cleanTitle);

  // Try finding existing note by title or slug
  const allNotes = await getAllNotes(userId);
  const existing = allNotes.find(
    (n) => n.slug === targetSlug || n.title.toLowerCase() === cleanTitle.toLowerCase()
  );

  if (existing) {
    const fullNote = await getNoteById(existing.id, userId);
    return { note: (fullNote || existing) as Note, created: false };
  }

  // Not found -> create new note
  const initialContent = sourceNoteTitle
    ? `# ${cleanTitle}\n\nBu not [[${sourceNoteTitle}]] üzerinden oluşturuldu.\n\n`
    : `# ${cleanTitle}\n\n`;

  const newNote = await createNote(
    {
      title: cleanTitle,
      content: initialContent,
    },
    userId
  );

  const fullNewNote = await getNoteById(newNote.id, userId);
  return { note: (fullNewNote || newNote) as Note, created: true };
}

export async function createNote(
  data: { title: string; content?: string; folderId?: string | null },
  userId = DEFAULT_USER_ID
): Promise<Note> {
  const title = data.title.trim() || "Başlıksız Not";
  const content = data.content || "";

  if (USE_DATABASE) {
    // Slug üretimi oku-sonra-yaz olduğu için eşzamanlı bir oluşturma araya
    // girebiliyor; benzersizlik ihlalinde yeni bir slug hesaplayıp tekrar deniyoruz.
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = await generateUniqueSlug(title, userId);
      try {
        const newNote = await prisma.note.create({
          data: {
            title,
            slug,
            content,
            userId,
            folderId: data.folderId || null,
          },
          include: { folder: true },
        });

        await syncLinksAndTags(newNote.id, content, userId);
        return newNote as unknown as Note;
      } catch (error) {
        if (!isUniqueViolation(error) || attempt === 4) throw error;
      }
    }
  }

  const slug = await generateUniqueSlug(title, userId);
  const newNote: Note = {
    id: crypto.randomUUID(),
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
  data: {
    title?: string;
    content?: string;
    folderId?: string | null;
    isPinned?: boolean;
    isArchived?: boolean;
  },
  userId = DEFAULT_USER_ID
): Promise<Note | null> {
  // Okuma rotalarıyla aynı tanımlayıcıları kabul et (ID / slug / başlık).
  const noteId = await resolveNoteId(id, userId);
  if (!noteId) return null;

  if (USE_DATABASE) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.content !== undefined) updateData.content = data.content;
    if (data.folderId !== undefined) updateData.folderId = data.folderId;
    if (data.isPinned !== undefined) updateData.isPinned = data.isPinned;
    if (data.isArchived !== undefined) updateData.isArchived = data.isArchived;

    // `userId` kapsamı zorunlu: bu olmadan not ID'sini bilen herkes başkasının
    // notunu güncelleyebilir (IDOR).
    for (let attempt = 0; attempt < 5; attempt++) {
      if (data.title !== undefined) {
        updateData.title = data.title.trim();
        updateData.slug = await generateUniqueSlug(data.title.trim(), userId, noteId);
      }

      try {
        const updated = await prisma.note.update({
          where: { id: noteId, userId },
          data: updateData,
          include: { folder: true },
        });

        if (data.content !== undefined) {
          await syncLinksAndTags(noteId, data.content, userId);
        }

        return updated as unknown as Note;
      } catch (error) {
        if (data.title === undefined || !isUniqueViolation(error) || attempt === 4) throw error;
      }
    }
  }

  const noteIndex = memoryStore.notes.findIndex((n) => n.id === noteId && n.userId === userId);
  if (noteIndex === -1) return null;

  const note = memoryStore.notes[noteIndex];
  const newSlug =
    data.title !== undefined
      ? await generateUniqueSlug(data.title.trim(), userId, noteId)
      : undefined;

  const updatedNote: Note = {
    ...note,
    title: data.title !== undefined ? data.title.trim() : note.title,
    slug: newSlug !== undefined ? newSlug : note.slug,
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
  const noteId = await resolveNoteId(id, userId);
  if (!noteId) return false;

  if (USE_DATABASE) {
    await prisma.note.delete({ where: { id: noteId, userId } });
    return true;
  }

  const initialLen = memoryStore.notes.length;
  memoryStore.notes = memoryStore.notes.filter(
    (n) => !(n.id === noteId && n.userId === userId)
  );
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
  const slugMap = new Map<string, Note>();
  const titleMap = new Map<string, Note>();
  // Düğüm ağırlığını artırırken `nodes.find()` kullanmak toplamı
  // notlar × bağlantılar × düğüm karmaşıklığına çıkarıyordu; ID ile
  // doğrudan erişim için indeks tutuyoruz.
  const nodeById = new Map<string, GraphNode>();

  // Notları düğüm olarak ekle
  for (const note of notes) {
    slugMap.set(note.slug, note);
    titleMap.set(note.title.toLowerCase(), note);

    const node: GraphNode = {
      id: note.id,
      title: note.title,
      slug: note.slug,
      folderName: note.folderId ? folderMap.get(note.folderId) : undefined,
      group: note.folderId ? folderMap.get(note.folderId) || "Genel" : "Genel",
      val: 1, // degree arttıkça güncellenecek
      isPhantom: false,
    };
    nodes.push(node);
    nodeById.set(node.id, node);
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
        const sourceNode = nodeById.get(note.id);
        const targetNodeObj = nodeById.get(targetNote.id);
        if (sourceNode) sourceNode.val = (sourceNode.val || 1) + 1;
        if (targetNodeObj) targetNodeObj.val = (targetNodeObj.val || 1) + 1.5;
      } else {
        // Phantom Link (Henüz oluşturulmamış nota referans)
        const phantomKey = link.targetTitle.toLowerCase();
        let phantomId = phantomTitles.get(phantomKey);

        if (!phantomId) {
          phantomId = `phantom-${slugify(link.targetTitle)}`;
          phantomTitles.set(phantomKey, phantomId);

          const phantomNode: GraphNode = {
            id: phantomId,
            title: link.targetTitle,
            slug: slugify(link.targetTitle),
            group: "Oluşturulmamış",
            val: 0.8,
            isPhantom: true,
          };
          nodes.push(phantomNode);
          nodeById.set(phantomId, phantomNode);
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
  if (USE_DATABASE) {
    const folders = await prisma.folder.findMany({
      where: { userId },
      include: { notes: { select: { id: true, title: true, slug: true } } },
    });
    return folders as unknown as Folder[];
  }
  return memoryStore.folders.filter((f) => f.userId === userId);
}

export async function createFolder(
  name: string,
  parentId: string | null = null,
  userId = DEFAULT_USER_ID
): Promise<Folder> {
  if (USE_DATABASE) {
    const folder = await prisma.folder.create({
      data: { name, parentId, userId },
    });
    return folder as unknown as Folder;
  }

  const folder: Folder = {
    id: crypto.randomUUID(),
    name,
    parentId,
    userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  memoryStore.folders.push(folder);
  return folder;
}

// Bir klasörün (id) verilen hedef (targetParentId) altına taşınmasının
// döngü oluşturup oluşturmayacağını kontrol eder (kendi alt klasörüne taşınamaz).
//
// Yürüyüş `visited` ile sınırlanmak ZORUNDA: veride zaten bir döngü varsa
// (A.parent=B, B.parent=A) sınırsız `while` sonsuza kadar dönüyor ve isteği
// işleyen süreci kilitliyordu. Böyle bir veri hâli mümkün, çünkü bu kontrol
// oku-sonra-yaz; aşağıdaki çağrı noktası artık ikisini tek transaction'a alıyor
// ama diskte önceden oluşmuş bozuk bir hiyerarşiye de dayanıklı olmalıyız.
// Mevcut bir döngüye girmek yeni bir döngü kurmakla aynı sonucu doğurduğu için
// bu durumda `true` (taşımayı reddet) dönüyoruz.
function wouldCreateCycle(
  allFolders: { id: string; parentId?: string | null }[],
  id: string,
  targetParentId: string | null
): boolean {
  if (!targetParentId) return false;
  if (targetParentId === id) return true;

  const byId = new Map(allFolders.map((f) => [f.id, f]));
  const visited = new Set<string>();

  let current = byId.get(targetParentId);
  while (current) {
    if (current.id === id) return true;
    if (visited.has(current.id)) return true; // veride hâlihazırda döngü var
    visited.add(current.id);
    if (!current.parentId) break;
    current = byId.get(current.parentId);
  }
  return false;
}

export async function updateFolder(
  id: string,
  data: { name?: string; parentId?: string | null },
  userId = DEFAULT_USER_ID
): Promise<Folder | null | "cycle"> {
  if (USE_DATABASE) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.parentId !== undefined) updateData.parentId = data.parentId;

    // Döngü kontrolü ile yazma TEK ve SERİLEŞTİRİLEBİLİR bir transaction'da
    // olmak zorunda. Eskiden ikisi arasında `await` vardı: eşzamanlı iki taşıma
    // isteği (A'yı B'ye, B'yi A'ya) ikisi de döngüsüz bir anlık görüntü okuyup
    // ikisi de yazabiliyor, sonuçta veritabanında gerçek bir döngü kalıyordu.
    // Bu tam olarak "write skew" anomalisi; Postgres'in varsayılan READ
    // COMMITTED seviyesi bunu engellemez, SERIALIZABLE engeller.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await prisma.$transaction(
          async (tx) => {
            // `userId` kapsamı zorunlu (bkz. updateNote).
            const existing = await tx.folder.findFirst({
              where: { id, userId },
              select: { id: true },
            });
            if (!existing) return null;

            if (data.parentId !== undefined) {
              const allFolders = await tx.folder.findMany({
                where: { userId },
                select: { id: true, parentId: true },
              });
              if (wouldCreateCycle(allFolders, id, data.parentId)) {
                return "cycle";
              }
            }

            const updated = await tx.folder.update({
              where: { id, userId },
              data: updateData,
            });
            return updated as unknown as Folder;
          },
          { isolationLevel: "Serializable" }
        );
      } catch (error) {
        // P2034: serileştirme çakışması / kilitlenme — tekrar denenmeli.
        if (!isSerializationFailure(error) || attempt === 2) throw error;
      }
    }
  }

  const folder = memoryStore.folders.find((f) => f.id === id && f.userId === userId);
  if (!folder) return null;

  if (data.parentId !== undefined) {
    if (wouldCreateCycle(memoryStore.folders, id, data.parentId)) {
      return "cycle";
    }
    folder.parentId = data.parentId;
  }
  if (data.name !== undefined) folder.name = data.name.trim();
  folder.updatedAt = new Date().toISOString();

  return folder;
}

export async function deleteFolder(id: string, userId = DEFAULT_USER_ID): Promise<boolean> {
  if (USE_DATABASE) {
    const existing = await prisma.folder.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) return false;

    // Alt klasörler şemadaki `onDelete: Cascade` ile birlikte silinir,
    // notlar `onDelete: SetNull` ile klasörsüz kalır.
    await prisma.folder.delete({ where: { id, userId } });
    return true;
  }

  const index = memoryStore.folders.findIndex((f) => f.id === id && f.userId === userId);
  if (index === -1) return false;

  const folderIdsToDelete = collectFolderSubtreeIds(memoryStore.folders, id);

  memoryStore.notes.forEach((n) => {
    if (n.folderId && folderIdsToDelete.has(n.folderId)) {
      n.folderId = null;
    }
  });

  memoryStore.folders = memoryStore.folders.filter((f) => !folderIdsToDelete.has(f.id));
  return true;
}

export async function searchNotes(
  query: string,
  userId = DEFAULT_USER_ID
): Promise<SearchResult[]> {
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
        preview =
          (start > 0 ? "..." : "") +
          n.content.slice(start, end).replace(/[#*`_[\]]/g, "") +
          (end < n.content.length ? "..." : "");
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
/**
 * Bir notun wikilink ve etiketlerini yeniden yazar.
 *
 * Tamamı tek bir işlemde çalışır: önceki sürüm bağlantıları silip tek tek
 * yeniden oluşturuyordu ve araya giren bir hata notu bağlantısız bırakıyordu.
 * Ayrıca `NoteLink` üzerindeki `@@unique([sourceNoteId, targetNoteId])` kısıtı
 * yüzünden aynı nota çözülen iki farklı wikilink (`[[Not A]]` ve `[[Not-A]]`)
 * benzersizlik ihlali doğuruyor, hata yutulduğu için etiket senkronizasyonuna
 * hiç sıra gelmiyordu — notun bütün etiketleri sessizce kayboluyordu. Hedefler
 * artık yazılmadan önce ID'ye göre tekilleştiriliyor.
 */
async function syncLinksAndTags(noteId: string, content: string, userId: string) {
  const extractedLinks = extractWikiLinks(content);
  const extractedTags = extractTags(content);

  // Hedef notları tek sorguda topla (bağlantı başına ayrı sorgu yerine).
  const targetNotes = extractedLinks.length
    ? await prisma.note.findMany({
        where: {
          userId,
          OR: [
            { slug: { in: extractedLinks.map((l) => l.slug) } },
            { title: { in: extractedLinks.map((l) => l.targetTitle), mode: "insensitive" } },
          ],
        },
        select: { id: true, slug: true, title: true },
      })
    : [];

  const bySlug = new Map(targetNotes.map((n) => [n.slug, n]));
  const byTitle = new Map(targetNotes.map((n) => [n.title.toLowerCase(), n]));

  // `[sourceNoteId, targetNoteId]` benzersiz olduğu için çözülmüş hedefleri
  // ID'ye göre tekilleştir. Çözülemeyen (phantom) bağlantılarda `targetNoteId`
  // null kalır; Postgres'te null'lar benzersizlik açısından farklı sayıldığından
  // bunlar başlığa göre tekilleştirilir.
  const resolved = new Map<string, string>(); // targetNoteId -> targetTitle
  const phantom = new Map<string, string>(); // lowercased title -> targetTitle

  for (const link of extractedLinks) {
    const target = bySlug.get(link.slug) || byTitle.get(link.targetTitle.toLowerCase());
    if (target) {
      if (!resolved.has(target.id)) resolved.set(target.id, link.targetTitle);
    } else {
      const key = link.targetTitle.toLowerCase();
      if (!phantom.has(key)) phantom.set(key, link.targetTitle);
    }
  }

  const tagNames = Array.from(new Set(extractedTags));

  await prisma.$transaction(async (tx) => {
    await tx.noteLink.deleteMany({ where: { sourceNoteId: noteId } });

    const linkRows = [
      ...Array.from(resolved, ([targetNoteId, targetTitle]) => ({
        sourceNoteId: noteId,
        targetNoteId,
        targetTitle,
      })),
      ...Array.from(phantom.values(), (targetTitle) => ({
        sourceNoteId: noteId,
        targetNoteId: null,
        targetTitle,
      })),
    ];

    if (linkRows.length) {
      await tx.noteLink.createMany({ data: linkRows });
    }

    await tx.noteTag.deleteMany({ where: { noteId } });

    if (tagNames.length) {
      // Etiketler kullanıcı genelinde paylaşıldığı için önce var olanları çek,
      // eksikleri toplu oluştur.
      const existingTags = await tx.tag.findMany({
        where: { userId, name: { in: tagNames } },
        select: { id: true, name: true },
      });
      const existingByName = new Map(existingTags.map((t) => [t.name, t.id]));

      const missing = tagNames.filter((name) => !existingByName.has(name));
      if (missing.length) {
        await tx.tag.createMany({
          data: missing.map((name) => ({ name, userId })),
          skipDuplicates: true,
        });
        const created = await tx.tag.findMany({
          where: { userId, name: { in: missing } },
          select: { id: true, name: true },
        });
        for (const t of created) existingByName.set(t.name, t.id);
      }

      await tx.noteTag.createMany({
        data: tagNames
          .map((name) => existingByName.get(name))
          .filter((tagId): tagId is string => Boolean(tagId))
          .map((tagId) => ({ noteId, tagId })),
        skipDuplicates: true,
      });
    }
  });
}
