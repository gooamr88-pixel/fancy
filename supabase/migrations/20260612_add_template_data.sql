-- Migration: Add template_data column to events table
-- Date: 2026-06-12
-- Description: Adds a JSONB column for storing template-specific structured data
--   (partner names, agenda, speakers, honorees, etc.) per event template type.

-- Add template_data column if it doesn't already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'events'
        AND column_name = 'template_data'
    ) THEN
        ALTER TABLE events ADD COLUMN template_data JSONB DEFAULT '{}';
    END IF;
END $$;

-- Verify the column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'events'
AND column_name = 'template_data';
