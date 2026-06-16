-- ════════════════════════════════════════════════════════════════════════
-- Expand rsvp_form_fields.field_type to match the field types the UI offers.
-- ────────────────────────────────────────────────────────────────────────
-- The create-event wizard's form builder (InlineFormBuilder) lets organizers
-- create `radio`, `date`, and `url` fields, and the API validator
-- (fieldController.ALLOWED_FIELD_TYPES) accepts them — but the column's CHECK
-- constraint (from 20260607100000_schema_completion) only allowed
--   text, email, phone, select, multiselect, textarea, number, checkbox
-- so inserting a radio/date/url field failed with a 23514 check violation and
-- the field was silently dropped. We standardize on the full UI set across the
-- stack and enforce it at the DB.
--
-- The original constraint is an inline (auto-named) column CHECK, so we discover
-- and drop whatever check references field_type before re-adding a named one.

DO $$
DECLARE
  v_conname TEXT;
BEGIN
  SELECT con.conname
    INTO v_conname
  FROM pg_constraint con
  JOIN pg_class      rel ON rel.oid = con.conrelid
  JOIN pg_namespace  nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'rsvp_form_fields'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%field_type%'
  LIMIT 1;

  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.rsvp_form_fields DROP CONSTRAINT %I', v_conname);
  END IF;
END $$;

ALTER TABLE public.rsvp_form_fields
  ADD CONSTRAINT rsvp_form_fields_field_type_check
  CHECK (field_type IN (
    'text', 'email', 'phone', 'url',
    'select', 'multiselect', 'radio',
    'textarea', 'number', 'checkbox', 'date'
  ));
