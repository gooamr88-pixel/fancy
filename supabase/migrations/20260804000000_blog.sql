-- ════════════════════════════════════════════════════════════════════════
-- BLOG — real, admin-managed articles replacing the fabricated mock content
-- previously hard-coded in frontend/src/app/blog/page.js (fake authors
-- "Sarah Laurent" / "Elena Martinez" / "James Chen" / "David Park", fake
-- dates, "Read Full Article" links that didn't even lead to an article).
-- ────────────────────────────────────────────────────────────────────────
-- Mirrors the testimonials / press_mentions Landing CMS tables exactly:
-- full CRUD via backend/controllers/admin/blogController.js, publicly
-- readable (published only) via marketingController.getPublicBlogPosts /
-- getPublicBlogPostBySlug. RLS enabled with NO policies — the backend only
-- ever talks to Postgres with the service-role key, so this is a hard deny
-- for any anon/authed client, same as every other backend-only table here.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS blog_posts (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title               text NOT NULL,
    slug                text NOT NULL,
    excerpt             text,
    content             text NOT NULL,
    cover_image_url     text,
    category            text,
    author_name         text NOT NULL,
    is_published        boolean NOT NULL DEFAULT false,
    published_at        timestamptz,
    read_time_minutes   integer,
    meta_title          text,
    meta_description    text,
    created_by          uuid,
    updated_by          uuid,
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category) WHERE category IS NOT NULL;

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

COMMIT;
