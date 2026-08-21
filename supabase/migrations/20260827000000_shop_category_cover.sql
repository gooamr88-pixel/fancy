-- ════════════════════════════════════════════════════════════════════════
-- A COLLECTION GETS ITS OWN COVER PHOTOGRAPH.
--
-- Until now `shop_categories` had no image column at all, and the public
-- catalogue derived each collection plate's picture from a PRODUCT inside it
-- (the featured piece, else the first by sort order). That was a deliberate
-- shortcut taken to avoid this migration — and it is the wrong picture. A
-- product shot is lit, cropped and styled to sell one object; a collection
-- cover has to stand for a whole shelf, and which product happened to win the
-- derivation changed on its own whenever an admin re-ordered the catalogue or
-- ticked a different piece as featured. Nobody chose those images.
--
-- So the cover becomes an explicit editorial decision, uploaded in
-- Admin → Shop → Collections, and the derivation is deleted rather than kept
-- as a fallback: a collection with no cover shows the drawn plate, which is a
-- designed face, not a hole.
--
-- `cover_image_url` is text, not a FK to shop_product_images, for the same
-- reason — the whole point is that it is NOT one of the product photographs.
-- It holds either a Supabase storage public URL or, on an environment whose
-- 'event-assets' bucket is missing, a base64 data: URI from the admin
-- uploader's fallback path. That bucket has no migration in this repo, so the
-- data: case is real and the column must not be length-constrained.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE shop_categories
    ADD COLUMN IF NOT EXISTS cover_image_url text,
    -- Alt text is stored beside the URL rather than being derived from the
    -- collection name: the plate already prints that name in type next to the
    -- photograph, so a screen reader repeating it is noise. This describes the
    -- PICTURE, and is allowed to stay null — an empty alt on a decorative
    -- cover is correct, an invented one is not.
    ADD COLUMN IF NOT EXISTS cover_image_alt text;

COMMENT ON COLUMN shop_categories.cover_image_url IS
    'Editorial cover photograph for the collection, set in Admin → Shop → Collections. Never a product photo; null renders the drawn plate.';

COMMIT;
