-- Migration: Add traducao column for Portuguese translations
-- Run this SQL in your Supabase SQL Editor

-- Add traducao column for Portuguese translation of German words
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS traducao TEXT;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_flashcards_user_artigo ON flashcards(user_id, artigo);

COMMENT ON COLUMN flashcards.traducao IS 'Portuguese translation of the German word';
