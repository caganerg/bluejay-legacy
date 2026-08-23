import { z } from "zod";

// Not içeriği için üst sınır. Sınırsız bırakıldığında tek bir istek yüzlerce
// megabaytlık bir not yazabiliyor; `GET /api/notes` bütün notların içeriğini
// döndürdüğü ve uygulama her açılışta bu rotayı çağırdığı için şişkin tek bir
// not tüm kasayı kullanılamaz hale getiriyor.
const MAX_CONTENT_LENGTH = 1_000_000;
const contentTooLong = `Not içeriği en fazla ${MAX_CONTENT_LENGTH} karakter olabilir`;

export const createNoteSchema = z.object({
  title: z
    .string({ message: "Not başlığı gereklidir" })
    .min(1, "Not başlığı boş olamaz")
    .max(255, "Not başlığı en fazla 255 karakter olabilir")
    .trim(),
  content: z.string().max(MAX_CONTENT_LENGTH, contentTooLong).optional().default(""),
  folderId: z.string().nullable().optional(),
});

export const updateNoteSchema = z.object({
  title: z
    .string()
    .min(1, "Not başlığı boş olamaz")
    .max(255, "Not başlığı en fazla 255 karakter olabilir")
    .trim()
    .optional(),
  content: z.string().max(MAX_CONTENT_LENGTH, contentTooLong).optional(),
  folderId: z.string().nullable().optional(),
  isPinned: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

export const resolveNoteSchema = z.object({
  title: z
    .string({ message: "Not başlığı gereklidir" })
    .min(1, "Not başlığı boş olamaz")
    .max(255, "Not başlığı en fazla 255 karakter olabilir")
    .trim(),
  sourceNoteTitle: z.string().max(255).optional(),
});

export const createFolderSchema = z.object({
  name: z
    .string({ message: "Klasör adı gereklidir" })
    .min(1, "Klasör adı boş olamaz")
    .max(100, "Klasör adı en fazla 100 karakter olabilir")
    .trim(),
  parentId: z.string().nullable().optional(),
});

export const updateFolderSchema = z.object({
  name: z
    .string()
    .min(1, "Klasör adı boş olamaz")
    .max(100, "Klasör adı en fazla 100 karakter olabilir")
    .trim()
    .optional(),
  parentId: z.string().nullable().optional(),
});

export const searchQuerySchema = z.object({
  q: z.string().max(200, "Arama sorgusu en fazla 200 karakter olabilir").default(""),
});
