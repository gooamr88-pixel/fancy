-- ═══════════════════════════════════════════════════════════════════════════
-- THE SHOP — US dollars, and a real minimum order
-- ───────────────────────────────────────────────────────────────────────────
-- Two corrections to 20260825000000_printed_invitations.sql, plus the rename
-- of the customer-facing surface from "Printed Invitations" to "Shop".
--
-- ── 1. CURRENCY ──
-- shop_products.currency was created NOT NULL DEFAULT 'CAD'. The business
-- sells in US dollars; the Canadian default was inherited from the corporate
-- address, not from how anything is actually priced. Every downstream surface
-- copied that default (the admin form, the public formatter, the JSON-LD
-- offer), so a product created without an explicit currency was advertised in
-- the wrong one — and Schema.org priceCurrency feeding Google Shopping makes
-- that a published price, not a display quirk.
--
-- Existing rows are rewritten too. There is no FX conversion here on purpose:
-- these prices were AUTHORED as dollar amounts by an admin who meant dollars,
-- so the number is right and only the label was wrong. Converting them would
-- change prices nobody asked to change.
--
-- ── 2. MINIMUM ORDER ──
-- min_order_qty exists and is nullable with no default, and the admin form
-- offered "50" as a placeholder — a placeholder, so it was never actually
-- stored unless someone typed it. The floor is 100 units across the
-- catalogue: cards, envelopes and printed material are priced per unit off a
-- press run, and a 100-unit run is the smallest one that costs what these
-- prices assume.
--
-- Hardware (scanners, screens) is the exception and is why this is a DEFAULT
-- rather than a NOT NULL: a 100-unit minimum on a $780 display would be
-- absurd, so those rows override it with their own value.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Currency ───────────────────────────────────────────────────────────
ALTER TABLE shop_products
  ALTER COLUMN currency SET DEFAULT 'USD';

-- Only the rows still carrying the old default. A row an admin deliberately
-- set to something else (a EUR price for a European client, say) is left
-- alone — this migration corrects a default, it does not impose a currency.
UPDATE shop_products
   SET currency = 'USD'
 WHERE currency = 'CAD';

-- ── 2. Minimum order ──────────────────────────────────────────────────────
ALTER TABLE shop_products
  ALTER COLUMN min_order_qty SET DEFAULT 100;

-- Rows that never had one get the floor. A row with an explicit value —
-- including a deliberately small one for hardware — keeps it.
UPDATE shop_products
   SET min_order_qty = 100
 WHERE min_order_qty IS NULL;

-- ── 3. Categories the shop now sells ──────────────────────────────────────
-- The catalogue was one implicit category (printed invitations). It is now a
-- store: cards, hardware, print and signage each need their own shelf, and
-- the public routes are /shop/<category-slug>.
--
-- ON CONFLICT DO NOTHING so this is safe to re-run and cannot clobber a name
-- or sort order an admin has already edited.
INSERT INTO shop_categories (slug, name, description, sort_order, is_published)
VALUES
  ('wedding-cards',    'Wedding cards',      'Foiled, letterpressed and embossed cards, printed from the same artwork as your digital invitation.', 10, true),
  ('screens-displays', 'Screens & displays', 'Welcome screens and seating displays for the entrance and the hall.',                                  20, true),
  ('scanners-door',    'Scanners & door kit','Handheld scanners and tablet door kits that keep working with no venue wifi.',                          30, true),
  ('printed-materials','Printed materials',  'Menus, place cards, table numbers and thank-you cards.',                                               40, true),
  ('signage',          'Signage',            'Seating charts, welcome signs and directional boards.',                                                50, true),
  ('envelopes-extras', 'Envelopes & extras', 'Envelopes, wax seals, belly bands, vellum and ribbon.',                                                60, true)
ON CONFLICT (slug) DO NOTHING;

COMMIT;
