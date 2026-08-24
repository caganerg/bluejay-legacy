import { z } from "zod";

// Upper bound for note content. Left unbounded, a single request could write a
// note hundreds of megabytes large; because `GET /api/notes` returns the content
// of every note and the app calls that route on every load, one bloated note
// makes the entire vault unusable.
const MAX_CONTENT_LENGTH = 1_000_000;
const contentTooLong = `Note content can be at most ${MAX_CONTENT_LENGTH} characters`;

export const createNoteSchema = z.object({
  title: z
    .string({ message: "A note title is required" })
    .min(1, "The note title cannot be empty")
    .max(255, "The note title can be at most 255 characters")
    .trim(),
  content: z.string().max(MAX_CONTENT_LENGTH, contentTooLong).optional().default(""),
  folderId: z.string().nullable().optional(),
});

export const updateNoteSchema = z.object({
  title: z
    .string()
    .min(1, "The note title cannot be empty")
    .max(255, "The note title can be at most 255 characters")
    .trim()
    .optional(),
  content: z.string().max(MAX_CONTENT_LENGTH, contentTooLong).optional(),
  folderId: z.string().nullable().optional(),
  isPinned: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

export const resolveNoteSchema = z.object({
  title: z
    .string({ message: "A note title is required" })
    .min(1, "The note title cannot be empty")
    .max(255, "The note title can be at most 255 characters")
    .trim(),
  sourceNoteTitle: z.string().max(255).optional(),
});

export const createFolderSchema = z.object({
  name: z
    .string({ message: "A folder name is required" })
    .min(1, "The folder name cannot be empty")
    .max(100, "The folder name can be at most 100 characters")
    .trim(),
  parentId: z.string().nullable().optional(),
});

export const updateFolderSchema = z.object({
  name: z
    .string()
    .min(1, "The folder name cannot be empty")
    .max(100, "The folder name can be at most 100 characters")
    .trim()
    .optional(),
  parentId: z.string().nullable().optional(),
});

export const searchQuerySchema = z.object({
  q: z.string().max(200, "The search query can be at most 200 characters").default(""),
});
