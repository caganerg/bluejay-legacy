import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Folder } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Düz klasör listesini (parentId ile) ağaç sırasına göre (üst -> alt) ve
// derinlik bilgisiyle birlikte döndürür. <select> gibi listelerde klasör
// hiyerarşisini girintiyle göstermek için kullanılır.
export function flattenFoldersAsTree(folders: Folder[]): { folder: Folder; depth: number }[] {
  const childrenByParent = new Map<string | null, Folder[]>();
  for (const folder of folders) {
    const key = folder.parentId || null;
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key)!.push(folder);
  }

  const result: { folder: Folder; depth: number }[] = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const folder of childrenByParent.get(parentId) || []) {
      result.push({ folder, depth });
      visit(folder.id, depth + 1);
    }
  };
  visit(null, 0);
  return result;
}

const TURKISH_CHAR_MAP: Record<string, string> = {
  ç: "c",
  Ç: "c",
  ğ: "g",
  Ğ: "g",
  ı: "i",
  İ: "i",
  ö: "o",
  Ö: "o",
  ş: "s",
  Ş: "s",
  ü: "u",
  Ü: "u",
};

export function slugify(text: string): string {
  return text
    .toString()
    .trim()
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (ch) => TURKISH_CHAR_MAP[ch])
    .toLowerCase()
    .replace(/[\s\W-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
