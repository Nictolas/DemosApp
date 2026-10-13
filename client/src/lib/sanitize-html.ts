import DOMPurify from 'dompurify';

const RICH_TEXT_TAGS = [
  'a',
  'b',
  'br',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'i',
  'li',
  'mark',
  'ol',
  'p',
  'small',
  'span',
  'strong',
  'u',
  'ul',
];

const RICH_TEXT_ATTRS = [
  'class',
  'href',
  'rel',
  'target',
  'title',
];

/**
 * Sanitizes HTML that is intentionally rendered through dangerouslySetInnerHTML.
 * Keep this allowlist narrow: DEMOS rich text needs formatting and links, not
 * executable content, forms, embedded documents, inline styles or media.
 */
export function sanitizeRichHtml(value: unknown): string {
  return DOMPurify.sanitize(String(value ?? ''), {
    ALLOWED_TAGS: RICH_TEXT_TAGS,
    ALLOWED_ATTR: RICH_TEXT_ATTRS,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
  });
}
