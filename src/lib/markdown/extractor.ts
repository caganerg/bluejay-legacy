import { slugify } from "../utils";

export interface ExtractedLink {
  targetTitle: string;
  slug: string;
  alias?: string;
}

/**
 * Splits the contents of `[[Title|Alias]]` at the first `|`. Everything after
 * the separator belongs to the alias; a title cannot contain `|`.
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
 * Makes a piece of text safe to embed inside a markdown link label (`[...]`).
 *
 * The alias used to be written out raw, which let it escape the link syntax and
 * inject arbitrary markdown — for example `[[Foo|x](another-address)]]` turned
 * into a link with an attacker-chosen target. (It was not XSS, because
 * react-markdown's default `urlTransform` strips `javascript:`/`data:` schemes,
 * but it would become XSS the moment `rehype-raw` was added.)
 */
function escapeMarkdownText(text: string): string {
  return text.replace(/[\\[\]!*_`~<>]/g, (ch) => `\\${ch}`);
}

/**
 * Wikilink pattern: `[[Note Name]]` or `[[Note Name|Display Name]]`.
 *
 * The body may not contain `[`, `]` or a newline, and its length is capped.
 * Both restrictions are required for security: the old pattern
 * (`/\[\[(.*?)\]\]/g`) scanned to the end of the line for every unclosed `[[`,
 * so the cost grew QUADRATICALLY with the length of the text. A single note at
 * the `MAX_CONTENT_LENGTH` limit (1 MB) could block `/api/graph`,
 * `/api/notes/[id]` and the link synchronisation on save for minutes — and
 * permanently, since the content is stored. Measured: on 160 KB of malicious
 * input the old pattern took 32 s, this one takes 0.5 ms.
 *
 * Banning `[`/`]` in the body does not restrict normal usage; square brackets
 * were already unusable in a title (the first `]]` ended the match).
 */
const WIKILINK_PATTERN = /\[\[([^[\]\n]{0,255})\]\]/g;

/**
 * Extracts wikilinks in the form [[Note Name]] or [[Note Name|Display Name]]
 * from a piece of text.
 */
export function extractWikiLinks(markdown: string): ExtractedLink[] {
  if (!markdown) return [];

  const regex = new RegExp(WIKILINK_PATTERN.source, "g");
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
 * Extracts #tags from a piece of text (excluding those in code blocks and URLs).
 */
export function extractTags(markdown: string): string[] {
  if (!markdown) return [];

  // Temporarily strip code blocks
  const cleanMarkdown = markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`.*?`/g, "");

  const tagRegex = /(?:^|\s)#([a-zA-Z0-9_\u00C0-\u017F-]+)/g;
  const tags = new Set<string>();

  let match;
  while ((match = tagRegex.exec(cleanMarkdown)) !== null) {
    const tag = match[1].trim();
    if (tag && !/^\d+$/.test(tag)) { // Exclude purely numeric headings such as #1
      tags.add(tag.toLowerCase());
    }
  }

  return Array.from(tags);
}

/**
 * Render helper that turns [[Wikilink]]s in markdown content into a clickable
 * custom element.
 */
export function transformWikiLinksForDisplay(markdown: string): string {
  if (!markdown) return "";

  // [[Note Title|Alias]] -> [Alias](#wikilink:encodedTitle)
  // [[Note Title]] -> [Note Title](#wikilink:encodedTitle)
  // The same pattern as `extractWikiLinks`: there must be no quadratic
  // backtracking here either, because this function runs on every keystroke in
  // the preview.
  return markdown.replace(new RegExp(WIKILINK_PATTERN.source, "g"), (whole, match: string) => {
    const { targetTitle, alias } = splitTitleAndAlias(match);
    if (!targetTitle) return whole;

    const label = alias || targetTitle;
    return `[${escapeMarkdownText(label)}](#wikilink:${encodeURIComponent(targetTitle)})`;
  });
}
