// Função para traduzir palavras alemãs para português usando DeepSeek
// Atualiza a tabela flashcards com as traduções

const SUPABASE_URL = 'https://timqizyevfkvqgzvcrlx.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpbXFpenlldmZrdnFnenZjcmx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjAxOTAwNiwiZXhwIjoyMDYxNTk1MDA2fQ.mQcEtge5GlyTQHzJMlWO2oT42tiAG-KFl58o-39MEG0';
const DEEPSEEK_API_KEY = 'sk-e080234eab8b442fb65fe8955d8947de';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        const { user_id } = JSON.parse(event.body);

        if (!user_id) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'user_id é obrigatório' })
            };
        }

        // Buscar palavras sem tradução
        const wordsResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/flashcards?user_id=eq.${user_id}&traducao=is.null&select=id,palavra,artigo`,
            {
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
                }
            }
        );

        const wordsWithoutTranslation = await wordsResponse.json();

        // Também buscar palavras com tradução vazia
        const emptyResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/flashcards?user_id=eq.${user_id}&traducao=eq.&select=id,palavra,artigo`,
            {
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
                }
            }
        );

        const wordsWithEmptyTranslation = await emptyResponse.json();

        // Combinar as duas listas
        const allWordsToTranslate = [...(wordsWithoutTranslation || []), ...(wordsWithEmptyTranslation || [])];

        if (!allWordsToTranslate || allWordsToTranslate.length === 0) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Todas as palavras já possuem tradução',
                    translated: 0
                })
            };
        }

        console.log(`Traduzindo ${allWordsToTranslate.length} palavras...`);

        // Limitar a 20 palavras por vez para não sobrecarregar
        const wordsToProcess = allWordsToTranslate.slice(0, 20);

        // Preparar lista de palavras para tradução em batch
        const wordsList = wordsToProcess.map(w => `${w.artigo} ${w.palavra}`).join('\n');

        // Chamar DeepSeek para traduzir todas de uma vez
        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    {
                        role: 'system',
                        content: `Você é um tradutor alemão-português.
Traduza cada substantivo alemão para português de forma concisa (1-3 palavras).
Responda APENAS no formato JSON: {"traduções": ["tradução1", "tradução2", ...]}
Mantenha a mesma ordem das palavras.
Não inclua o artigo na tradução, apenas o substantivo traduzido.`
                    },
                    {
                        role: 'user',
                        content: `Traduza estes substantivos alemães para português:\n${wordsList}`
                    }
                ],
                temperature: 0.3,
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            throw new Error('Erro ao chamar API de tradução');
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';

        // Extrair JSON da resposta
        let translations = [];
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                translations = parsed.traduções || parsed.traducoes || parsed.translations || [];
            }
        } catch (e) {
            console.error('Erro ao parsear traduções:', e);
            // Tentar extrair linha por linha
            translations = content.split('\n').filter(line => line.trim());
        }

        // Atualizar cada palavra no banco
        let updatedCount = 0;
        for (let i = 0; i < wordsToProcess.length && i < translations.length; i++) {
            const word = wordsToProcess[i];
            const translation = translations[i]?.trim();

            if (translation && translation.length > 0) {
                await fetch(
                    `${SUPABASE_URL}/rest/v1/flashcards?id=eq.${word.id}`,
                    {
                        method: 'PATCH',
                        headers: {
                            'apikey': SUPABASE_SERVICE_KEY,
                            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=minimal'
                        },
                        body: JSON.stringify({ traducao: translation })
                    }
                );
                updatedCount++;
                console.log(`Traduzido: ${word.artigo} ${word.palavra} -> ${translation}`);
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: `${updatedCount} palavras traduzidas com sucesso`,
                translated: updatedCount,
                remaining: allWordsToTranslate.length - updatedCount
            })
        };

    } catch (error) {
        console.error('Erro ao traduzir palavras:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || 'Erro interno ao traduzir palavras' })
        };
    }
};
