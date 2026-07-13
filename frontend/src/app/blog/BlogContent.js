'use client';
import { parseBlogBlocks } from '../utils/parseBlogContent';

function InlineSegments({ segments }) {
  return segments.map((seg, i) => {
    if (seg.bold !== undefined) return <strong key={i}>{seg.bold}</strong>;
    if (seg.link !== undefined) {
      return (
        <a key={i} href={seg.href} target="_blank" rel="noopener noreferrer" style={{ color: '#B8944F', fontWeight: 600 }}>
          {seg.link}
        </a>
      );
    }
    return <span key={i}>{seg.text}</span>;
  });
}

/** Renders a blog post's plain-text content (see parseBlogContent.js for the accepted conventions). */
export default function BlogContent({ content }) {
  const blocks = parseBlogBlocks(content);

  return (
    <div className="blog-content">
      {blocks.map((block, i) => {
        // Both heading levels are written out literally rather than via a dynamic
        // <Tag> variable: styled-jsx only stamps its scoping class onto literal
        // JSX elements, so a dynamic/component tag would silently lose the scoped
        // rules below and fall back to globals.css's much larger global h2/h3
        // sizes (clamp up to 2.4rem) in the middle of the article body.
        if (block.type === 'heading') {
          if (block.level === 3) {
            return (
              <h3 key={i} className="blog-content-heading blog-content-h3">
                <InlineSegments segments={block.segments} />
              </h3>
            );
          }
          return (
            <h2 key={i} className="blog-content-heading blog-content-h2">
              <InlineSegments segments={block.segments} />
            </h2>
          );
        }
        if (block.type === 'list') {
          return (
            <ul key={i} className="blog-content-list">
              {block.items.map((item, j) => (
                <li key={j}><InlineSegments segments={item} /></li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="blog-content-paragraph">
            <InlineSegments segments={block.segments} />
          </p>
        );
      })}

      <style jsx>{`
        .blog-content {
          font-family: var(--font-sans);
          font-size: 17px;
          line-height: 1.85;
          color: #3a362f;
        }
        .blog-content-paragraph {
          margin: 0 0 22px;
          /* Admin-authored prose can contain long unbroken URLs/tokens — wrap them
             instead of forcing the whole article column to overflow horizontally. */
          overflow-wrap: break-word;
        }
        .blog-content-heading {
          font-family: var(--font-serif);
          color: #191B1E;
          font-weight: 600;
          margin: 40px 0 18px;
          line-height: 1.3;
          /* Long unbroken words/URLs in an admin-authored heading must wrap, not
             punch out of the article column on a narrow screen. */
          overflow-wrap: break-word;
        }
        /* Class-only selectors (no h2./h3. element qualifier) so these stay
           immune to the global h1–h6 rules in globals.css. */
        .blog-content-h2 { font-size: 26px; }
        .blog-content-h3 { font-size: 21px; }
        .blog-content-list {
          margin: 0 0 22px;
          padding-left: 24px;
        }
        .blog-content-list li {
          margin-bottom: 10px;
        }
        @media (max-width: 640px) {
          .blog-content { font-size: 16px; }
          .blog-content-h2 { font-size: 22px; }
          .blog-content-h3 { font-size: 19px; }
          .blog-content-heading { margin: 32px 0 14px; }
          .blog-content-list { padding-left: 20px; }
        }
      `}</style>
    </div>
  );
}
