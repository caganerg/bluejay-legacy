import { slugify } from "../utils";

export interface ExtractedLink {
  targetTitle: string;
  slug: string;
  alias?: string;
}

/**
 * `[[Başlık|Takma Ad]]` içeriğini ilk `|` karakterinden böler. Ayırıcıdan
 * sonraki her şey takma ada aittir; başlıkta `|` kullanılamaz.
 */
function splitTitleAndAlias(rawContent: string): { targetTitle: string; alias?: string } {
  const separator = rawContent.indexOf("|");
  if (separator === -1) return { targetTitle: rawContent.trim() };

  return {
    targetTitle: rawContent.slice(0, separator).trim(),
    alias: rawContent.slice(separator + 1).trim(),
  };
}

/**
 * Bir metni markdown link etiketi (`[...]`) içine güvenle gömülebilir hale getirir.
 *
 * Takma ad daha önce ham olarak yazılıyordu; bu yüzden link söz diziminden kaçıp
 * keyfi markdown enjekte edebiliyordu — örneğin `[[Foo|x](başka-adres)]]`
 * saldırgan hedefli bir bağlantıya dönüşüyordu. (react-markdown'ın varsayılan
 * `urlTransform`'u `javascript:`/`data:` şemalarını temizlediği için bu bir XSS
 * değildi, ama `rehype-raw` eklendiği anda öyle olurdu.)
 */
function escapeMarkdownText(text: string): string {
  return text.replace(/[\\[\]!*_`~<>]/g, (ch) => `\\${ch}`);
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

    const { targetTitle, alias } = splitTitleAndAlias(rawContent);

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
  return markdown.replace(/\[\[(.*?)\]\]/g, (whole, match: string) => {
    const { targetTitle, alias } = splitTitleAndAlias(match);
    if (!targetTitle) return whole;

    const label = alias || targetTitle;
    return `[${escapeMarkdownText(label)}](#wikilink:${encodeURIComponent(targetTitle)})`;
  });
}
