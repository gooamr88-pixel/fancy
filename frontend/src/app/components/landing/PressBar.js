'use client';

import { usePressMentions } from '../../utils/usePressMentions';

/**
 * "As Seen In" trust-badge strip — real, admin-managed press mentions only
 * (see /admin/cms). Previously the site had a /press marketing page with a
 * "Media Mentions" list, but none of it was ever surfaced on the landing
 * page itself, and that list was fabricated content (invented headlines, a
 * fictitious funding round, a founder name that appears nowhere else in
 * this codebase) — not something to mirror here. This component starts
 * empty and only ever shows what an admin actually adds; if nothing is
 * published yet, it renders nothing rather than an empty strip or a
 * placeholder.
 */
function LogoItem({ mention }) {
  const content = mention.logo_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={mention.logo_url} alt={mention.publication_name} className="press-logo-img" />
  ) : (
    <span className="press-wordmark">{mention.publication_name}</span>
  );

  if (mention.article_url) {
    return (
      <a
        href={mention.article_url}
        target="_blank"
        rel="noopener noreferrer"
        className="press-item press-item-link"
        title={mention.headline || mention.publication_name}
      >
        {content}
      </a>
    );
  }

  return (
    <span className="press-item" title={mention.headline || mention.publication_name}>
      {content}
    </span>
  );
}

export default function PressBar() {
  const { pressMentions } = usePressMentions();

  // Still loading (null) or nothing published yet — render nothing. Placed
  // right after the Hero, so an empty state here would otherwise leave an
  // awkward gap between Hero and SocialProofBar.
  if (!pressMentions || pressMentions.length === 0) return null;

  return (
    <section className="press-bar">
      <div className="press-bar-inner">
        <span className="press-eyebrow">As Seen In</span>
        <div className="press-logos">
          {pressMentions.map((m) => (
            <LogoItem key={m.id} mention={m} />
          ))}
        </div>
      </div>

      <style jsx>{`
        .press-bar {
          background: #FFFFFF;
          border-bottom: 1px solid #F0ECE3;
          width: 100%;
        }
        .press-bar-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 28px 48px;
          display: flex;
          align-items: center;
          gap: 32px;
          flex-wrap: wrap;
        }
        .press-eyebrow {
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #A09A91;
          flex-shrink: 0;
        }
        .press-logos {
          display: flex;
          align-items: center;
          gap: 40px;
          flex-wrap: wrap;
          flex: 1;
        }
        .press-item {
          display: inline-flex;
          align-items: center;
          text-decoration: none;
          filter: grayscale(100%);
          opacity: 0.55;
          transition: opacity 0.25s ease, filter 0.25s ease;
        }
        .press-item-link {
          cursor: pointer;
        }
        .press-item:hover,
        .press-item:focus-visible {
          filter: grayscale(0%);
          opacity: 1;
        }
        .press-logo-img {
          height: 26px;
          max-width: 130px;
          object-fit: contain;
        }
        .press-wordmark {
          font-family: var(--font-serif);
          font-size: 17px;
          font-weight: 700;
          color: #191B1E;
          letter-spacing: 0.3px;
        }

        @media (max-width: 768px) {
          .press-bar-inner {
            padding: 22px 24px;
            gap: 16px;
            flex-direction: column;
            align-items: flex-start;
          }
          .press-logos {
            gap: 28px;
          }
        }
        @media (max-width: 640px) {
          .press-bar-inner {
            padding: 18px 20px;
          }
          .press-logos {
            gap: 22px;
          }
          .press-logo-img {
            height: 22px;
            max-width: 100px;
          }
          .press-wordmark {
            font-size: 15px;
          }
        }
      `}</style>
    </section>
  );
}
