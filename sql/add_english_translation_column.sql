-- SQL para adicionar coluna de tradução em inglês na tabela flashcards
-- Execute este SQL no Supabase SQL Editor

-- Adicionar coluna para tradução em inglês
ALTER TABLE flashcards
ADD COLUMN IF NOT EXISTS translation_en TEXT;

-- Comentário para documentação
COMMENT ON COLUMN flashcards.translation_en IS 'English translation of the German word';

-- Renomear a coluna existente para deixar claro que é português (opcional, mas recomendado)
-- Se a coluna atual se chama 'translation', você pode querer renomeá-la para 'translation_pt'
-- ALTER TABLE flashcards RENAME COLUMN translation TO translation_pt;

-- Índice para melhorar performance de buscas (opcional)
CREATE INDEX IF NOT EXISTS idx_flashcards_translation_en ON flashcards(translation_en);
