/**
 * Minimal, dependency-free parser for blog post content written as plain
 * text with a small set of conventions (no markdown library, no
 * dangerouslySetInnerHTML — every block is rendered as real React elements
 * downstream, so there is no HTML-injection surface at all):
 *
 *   Blank line       → paragraph break
 *   "## Heading"     → subheading block
 *   "- item" (each   → list block (each line is one item)
 *    line in a block)
 *   **bold**          → inline bold (within any paragraph/list item)
 *   [text](https://…) → inline link (within any paragraph/list item; only
 *                        http(s) URLs are honored, anything else renders as
 *                        plain text)
 *
 * Returns an array of { type: 'heading'|'list'|'paragraph', ... } blocks —
 * pure data, no JSX — so it's trivially unit-testable and framework-agnostic.
 * The actual rendering lives in blog/BlogContent.js, co-located with its use.
 */

/** Splits inline text into a run of { text } / { bold: text } / { link: text, href } segments. */
function parseInline(text) {
  const segments = [];
  // Matches **bold** or [label](url) — greedy enough for normal prose, not a
  // general markdown engine.
  const pattern = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) segments.push({ text: text.slice(lastIndex, match.index) });
    if (match[1] !== undefined) {
      segments.push({ bold: match[1] });
    } else {
      segments.push({ link: match[2], href: match[3] });
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex) });
  return segments.length > 0 ? segments : [{ text }];
}

export function parseBlogBlocks(content) {
  const raw = (content || '').toString().replace(/\r\n/g, '\n');
  const blocks = raw.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);

  return blocks.map((block) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);

    if (lines.length === 1 && /^#{2,3}\s+/.test(lines[0])) {
      const level = lines[0].startsWith('### ') ? 3 : 2;
      return { type: 'heading', level, segments: parseInline(lines[0].replace(/^#{2,3}\s+/, '')) };
    }

    if (lines.length > 0 && lines.every((l) => /^-\s+/.test(l))) {
      return { type: 'list', items: lines.map((l) => parseInline(l.replace(/^-\s+/, ''))) };
    }

    return { type: 'paragraph', segments: parseInline(lines.join(' ')) };
  });
}
