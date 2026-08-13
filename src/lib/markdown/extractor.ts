import { slugify } from "../utils";

export interface ExtractedLink {
  targetTitle: string;
  slug: string;
  alias?: string;
}

/**
 * [[Not Adı]] veya [[Not Adı|Görünen İsim]] formatındaki wikilinkleri metinden ayıklar.
 */
export function extractWikiLinks(markdown: string): ExtractedLink[] {
  if (!markdown) return [];
  
  // [[Note Name]] veya [[Note Name|Alias]]
  const regex = /\[\[(.*?)\]\]/g;
  const links: ExtractedLink[] = [];
  const seenTitles = new Set<string>();

  let match;
  while ((match = regex.exec(markdown)) !== null) {
    const rawContent = match[1].trim();
    if (!rawContent) continue;

    let targetTitle = rawContent;
    let alias: string | undefined = undefined;

    if (rawContent.includes("|")) {
      const parts = rawContent.split("|");
      targetTitle = parts[0].trim();
      alias = parts[1].trim();
    }

    if (targetTitle && !seenTitles.has(targetTitle.toLowerCase())) {
      seenTitles.add(targetTitle.toLowerCase());
      links.push({
        targetTitle,
        slug: slugify(targetTitle),
        alias,
      });
    }
  }

  return links;
}

/**
 * Metin içindeki #etiket leri ayıklar (kod blokları ve url'ler dışındaki)
 */
export function extractTags(markdown: string): string[] {
  if (!markdown) return [];

  // Kod bloklarını geçici olarak temizle
  const cleanMarkdown = markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`.*?`/g, "");

  const tagRegex = /(?:^|\s)#([a-zA-Z0-9_\u00C0-\u017F-]+)/g;
  const tags = new Set<string>();

  let match;
  while ((match = tagRegex.exec(cleanMarkdown)) !== null) {
    const tag = match[1].trim();
    if (tag && !/^\d+$/.test(tag)) { // Sadece sayıdan oluşan başlık #1 leri hariç tut
      tags.add(tag.toLowerCase());
    }
  }

  return Array.from(tags);
}

/**
 * Markdown içeriğindeki [[Wikilink]] leri tıklanabilir özel elemente dönüştürmek için render yardımcısı
 */
export function transformWikiLinksForDisplay(markdown: string): string {
  if (!markdown) return "";

  // [[Note Title|Alias]] -> [Alias](#wikilink:encodedTitle)
  // [[Note Title]] -> [Note Title](#wikilink:encodedTitle)
  return markdown.replace(/\[\[(.*?)\]\]/g, (_, match) => {
    const parts = match.split("|");
    const title = parts[0].trim();
    const alias = parts[1] ? parts[1].trim() : title;
    return `[${alias}](#wikilink:${encodeURIComponent(title)})`;
  });
}
