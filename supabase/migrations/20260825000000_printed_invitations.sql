-- ════════════════════════════════════════════════════════════════════════
-- PRINTED INVITATIONS — the physical cards, sold by conversation
-- ────────────────────────────────────────────────────────────────────────
-- This platform sells DIGITAL invitations. It also makes real, handcrafted
-- printed cards — paper a guest holds — and the product had nowhere to show
-- them: there was no catalogue, no product page, nothing in the tree.
--
-- These are deliberately NOT sold with online checkout. The conversion is a
-- WhatsApp conversation ("want to order? message us"), which is why there is
-- no cart, no order table and no payment coupling anywhere below. Adding one
-- later is a new table, not a rewrite of these.
--
-- ── NAMING ──
-- Tables and code use the short `shop_` prefix. Every user-visible label and
-- the public URL say "Printed Invitations" (/printed-invitations). Keep that
-- mapping in mind when grepping: the customer-facing noun and the identifier
-- are deliberately different, because "printed_invitations_product_images"
-- reads worse in every join it ever appears in.
--
-- ── SECURITY ──
-- RLS enabled with NO policies, exactly like blog_posts / testimonials /
-- press_mentions. The backend only ever talks to Postgres with the
-- service-role key, so this is a hard deny for any anon or authed client, and
-- the public read path is a backend endpoint that filters to published rows.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Collections: the filter the visitor actually browses by ───────────────
CREATE TABLE IF NOT EXISTS shop_categories (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name                text NOT NULL,
    slug                text NOT NULL,
    description         text,
    sort_order          integer NOT NULL DEFAULT 0,
    is_published        boolean NOT NULL DEFAULT true,
    created_by          uuid,
    updated_by          uuid,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shop_categories_slug ON shop_categories(slug);
CREATE INDEX IF NOT EXISTS idx_shop_categories_order ON shop_categories(is_published, sort_order, name);

-- ── Labels: "New", "Best seller", "Limited run", anything the admin types ─
--
-- The requirement was a filter the admin can WRITE ON — so a label is one row
-- with its own colours, reusable across products, and `is_filterable` decides
-- whether it also appears as a filter chip on the public page. That is the
-- difference between a decorative ribbon ("Handmade") and a way to browse
-- ("New"), and it is a per-label choice rather than a hardcoded list of two.
CREATE TABLE IF NOT EXISTS shop_badges (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    label               text NOT NULL,
    bg_color            text NOT NULL DEFAULT '#8A6D34',
    text_color          text NOT NULL DEFAULT '#FFFFFF',
    is_filterable       boolean NOT NULL DEFAULT true,
    sort_order          integer NOT NULL DEFAULT 0,
    is_published        boolean NOT NULL DEFAULT true,
    created_by          uuid,
    updated_by          uuid,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_badges_order ON shop_badges(is_published, sort_order, label);

-- ── The products ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_products (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title               text NOT NULL,
    slug                text NOT NULL,
    category_id         uuid REFERENCES shop_categories(id) ON DELETE SET NULL,
    tagline             text,
    description         text,

    -- NULL price is a FEATURE, not missing data: it renders "Price on request"
    -- and is what lets an admin publish a piece they would rather quote
    -- privately. Any code reading this must branch on null, never coerce to 0 —
    -- a card silently priced "$0.00" is worse than no page at all.
    price_cents         integer CHECK (price_cents IS NULL OR price_cents >= 0),
    compare_at_cents    integer CHECK (compare_at_cents IS NULL OR compare_at_cents >= 0),
    currency            text NOT NULL DEFAULT 'CAD',
    price_unit          text,              -- "per card", "per set of 25", …
    min_order_qty       integer CHECK (min_order_qty IS NULL OR min_order_qty > 0),
    lead_time_text      text,              -- "Standard production lead time: 3–4 weeks"

    -- [{ "label": "Material", "value": "350gsm cotton board" }, …]
    specs               jsonb NOT NULL DEFAULT '[]'::jsonb,
    -- ["Gold foil stamping", "Laser-engraved monogram", …]
    highlights          jsonb NOT NULL DEFAULT '[]'::jsonb,

    -- Per-product override for the prefilled WhatsApp message. Null falls back
    -- to the platform-wide greeting in super_admin_config.shop_settings.
    whatsapp_message    text,

    is_published        boolean NOT NULL DEFAULT false,
    is_featured         boolean NOT NULL DEFAULT false,
    is_sold_out         boolean NOT NULL DEFAULT false,
    sort_order          integer NOT NULL DEFAULT 0,

    meta_title          text,
    meta_description    text,

    view_count          integer NOT NULL DEFAULT 0,
    inquiry_count       integer NOT NULL DEFAULT 0,

    published_at        timestamptz,
    created_by          uuid,
    updated_by          uuid,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shop_products_slug ON shop_products(slug);
-- The public listing's exact ORDER BY, so the catalogue stays one index scan.
CREATE INDEX IF NOT EXISTS idx_shop_products_listing
    ON shop_products(is_published, sort_order, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_products_category
    ON shop_products(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shop_products_featured
    ON shop_products(is_featured) WHERE is_featured = true;

-- ── Gallery ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_product_images (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id          uuid NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
    image_url           text NOT NULL,
    alt_text            text,
    sort_order          integer NOT NULL DEFAULT 0,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_product_images_product
    ON shop_product_images(product_id, sort_order);

-- ── Product ↔ label ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_product_badges (
    product_id          uuid NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
    badge_id            uuid NOT NULL REFERENCES shop_badges(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_shop_product_badges_badge ON shop_product_badges(badge_id);

-- ── Interest log ─────────────────────────────────────────────────────────
--
-- Every "Order on WhatsApp" tap. Without this the section is a brochure that
-- reports nothing: the whole funnel leaves for WhatsApp and the platform never
-- learns which card people actually want made.
--
-- product_title is a SNAPSHOT, and product_id is ON DELETE SET NULL rather
-- than CASCADE, precisely so deleting a retired product does not silently
-- rewrite last quarter's demand report to zero.
CREATE TABLE IF NOT EXISTS shop_inquiries (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id          uuid REFERENCES shop_products(id) ON DELETE SET NULL,
    product_title       text,
    source              text NOT NULL DEFAULT 'whatsapp',
    referrer            text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT shop_inquiries_source_check
        CHECK (source = ANY (ARRAY['whatsapp'::text, 'listing'::text, 'homepage'::text, 'dashboard'::text]))
);

CREATE INDEX IF NOT EXISTS idx_shop_inquiries_product ON shop_inquiries(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_inquiries_recent ON shop_inquiries(created_at DESC);

-- ── Backend-only, like every other table here ────────────────────────────
ALTER TABLE shop_categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_badges          ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_product_images  ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_product_badges  ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_inquiries       ENABLE ROW LEVEL SECURITY;

-- ── View counter ─────────────────────────────────────────────────────────
--
-- A function rather than a read-then-write in the controller, for two reasons:
-- it is ONE round trip on a path that runs on every product view, and
-- `SET x = x + 1` in the database is atomic, where read-modify-write from two
-- concurrent visitors loses one of the increments. Paired with inquiry_count,
-- this is what makes "viewed 400 times, asked about twice" visible to an admin.
CREATE OR REPLACE FUNCTION increment_shop_product_view(p_product_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE shop_products
       SET view_count = view_count + 1
     WHERE id = p_product_id
       AND is_published = true;
$$;

-- The same argument applies to inquiry_count, which is the more valuable of
-- the two numbers: it is the count of people who asked to buy. It was
-- originally a read-then-write in the controller, which drops one of any two
-- taps that land together — precisely the case a popular piece produces.
CREATE OR REPLACE FUNCTION increment_shop_product_inquiry(p_product_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE shop_products
       SET inquiry_count = inquiry_count + 1
     WHERE id = p_product_id;
$$;

-- ── Section settings, on the existing singleton config row ───────────────
--
-- Lives beside landing_stats on super_admin_config for the same reason that
-- does: it is one small blob of admin-editable presentation config, and a
-- dedicated singleton table for it would be a second row nobody remembers to
-- create. NOTE for anyone adding a public read: getPlatformConfig() returns
-- this WHOLE row, pricing tiers and SMS margins included — the anonymous
-- endpoint selects `shop_settings` explicitly instead of going through it.
ALTER TABLE super_admin_config
    ADD COLUMN IF NOT EXISTS shop_settings jsonb NOT NULL DEFAULT '{
        "enabled": true,
        "show_on_homepage": true,
        "show_in_dashboard": true,
        "whatsapp_number": "16196666620",
        "whatsapp_greeting": "Hello! I would like to order printed invitations.",
        "hero_kicker": "HANDCRAFTED · PRINTED · DELIVERED",
        "hero_title": "Printed Invitations",
        "hero_subtitle": "Invitations your guests can hold. Pressed, foiled and finished by hand, then delivered to your door.",
        "default_lead_time": "Standard production lead time: 3–4 weeks",
        "default_sort": "manual"
    }'::jsonb;

-- ── Seed the ordering number ─────────────────────────────────────────────
--
-- +1 (619) 666-6620, stored the only way wa.me accepts: digits, country code
-- first, no punctuation. The admin UI normalises pasted input the same way
-- (see updateSettings in controllers/admin/shopController.js), so this matches
-- what typing it into Admin → Printed Invitations → Settings would produce.
--
-- Needed as well as the DEFAULT above, because a DEFAULT only reaches the row
-- when the column is CREATED. If shop_settings already exists — the migration
-- ran once before with an empty number — the default is inert and the existing
-- row keeps "".
--
-- Guarded on being empty/absent so it is idempotent AND cannot overwrite a
-- number an admin has since changed in the UI: re-running this migration must
-- never silently point every "Order on WhatsApp" button back at an old number.
UPDATE super_admin_config
   SET shop_settings = shop_settings || '{"whatsapp_number": "16196666620"}'::jsonb
 WHERE COALESCE(shop_settings ->> 'whatsapp_number', '') = '';

COMMIT;
