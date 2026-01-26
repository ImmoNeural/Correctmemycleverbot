-- Migration: Add columns for article error tracking
-- Run this SQL in your Supabase SQL Editor

-- Add is_error column to indicate this flashcard is from an article error in an essay
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS is_error BOOLEAN DEFAULT false;

-- Add artigo_errado column to store what wrong article the user used
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS artigo_errado TEXT;

-- Add traducao column if it doesn't exist (for Portuguese translation)
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS traducao TEXT;

-- Create index for faster queries on is_error
CREATE INDEX IF NOT EXISTS idx_flashcards_is_error ON flashcards(user_id, is_error);

-- Update existing flashcards to have is_error = false (backward compatibility)
UPDATE flashcards SET is_error = false WHERE is_error IS NULL;

COMMENT ON COLUMN flashcards.is_error IS 'True if this word was added due to an article error in an essay';
COMMENT ON COLUMN flashcards.artigo_errado IS 'The wrong article the user used (e.g., "die" when it should be "der")';
COMMENT ON COLUMN flashcards.traducao IS 'Portuguese translation of the German word';
