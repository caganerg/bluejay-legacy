export interface Note {
  id: string;
  title: string;
  slug: string;
  content: string;
  isPinned: boolean;
  isArchived: boolean;
  userId: string;
  folderId?: string | null;
  folder?: Folder | null;
  outgoingLinks?: NoteLinkItem[];
  incomingLinks?: NoteLinkItem[];
  tags?: { tag: Tag }[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface NoteLinkItem {
  id: string;
  sourceNoteId: string;
  sourceNote?: {
    id: string;
    title: string;
    slug: string;
  };
  targetNoteId?: string | null;
  targetNote?: {
    id: string;
    title: string;
    slug: string;
  } | null;
  targetTitle?: string | null;
  createdAt: string | Date;
}

export interface Folder {
  id: string;
  name: string;
  parentId?: string | null;
  parent?: Folder | null;
  children?: Folder[];
  notes?: Note[];
  userId: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface Tag {
  id: string;
  name: string;
  color?: string | null;
  userId: string;
  _count?: {
    notes: number;
  };
}

export interface SearchResult {
  id: string;
  title: string;
  slug: string;
  preview: string;
  folderName?: string;
  updatedAt: string | Date;
}
