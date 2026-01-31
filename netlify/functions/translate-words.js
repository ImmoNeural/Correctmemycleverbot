// Função para traduzir palavras alemãs para português E inglês usando DeepSeek
// Atualiza a tabela flashcards com as traduções em ambos os idiomas

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

        // Buscar palavras sem tradução em português OU inglês
        const wordsResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/flashcards?user_id=eq.${user_id}&or=(traducao.is.null,traducao.eq.,translation_en.is.null,translation_en.eq.)&select=id,palavra,artigo,traducao,translation_en`,
            {
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
                }
            }
        );

        const allWordsToTranslate = await wordsResponse.json();

        if (!allWordsToTranslate || allWordsToTranslate.length === 0) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Todas as palavras já possuem tradução em ambos os idiomas',
                    translated: 0
                })
            };
        }

        console.log(`Processando ${allWordsToTranslate.length} palavras...`);

        // Limitar a 15 palavras por vez para não sobrecarregar
        const wordsToProcess = allWordsToTranslate.slice(0, 15);

        // Separar palavras que precisam de tradução PT e/ou EN
        const needsPT = wordsToProcess.filter(w => !w.traducao || w.traducao.trim() === '');
        const needsEN = wordsToProcess.filter(w => !w.translation_en || w.translation_en.trim() === '');

        let updatedCount = 0;

        // Traduzir para Português se necessário
        if (needsPT.length > 0) {
            const wordsList = needsPT.map(w => `${w.artigo} ${w.palavra}`).join('\n');

            const ptResponse = await fetch(DEEPSEEK_API_URL, {
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
Responda APENAS no formato JSON: {"translations": ["tradução1", "tradução2", ...]}
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

            if (ptResponse.ok) {
                const data = await ptResponse.json();
                const content = data.choices?.[0]?.message?.content || '';

                let translations = [];
                try {
                    const jsonMatch = content.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        translations = parsed.translations || parsed.traduções || parsed.traducoes || [];
                    }
                } catch (e) {
                    translations = content.split('\n').filter(line => line.trim());
                }

                for (let i = 0; i < needsPT.length && i < translations.length; i++) {
                    const word = needsPT[i];
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
                        console.log(`PT: ${word.artigo} ${word.palavra} -> ${translation}`);
                    }
                }
            }
        }

        // Traduzir para Inglês se necessário
        if (needsEN.length > 0) {
            const wordsList = needsEN.map(w => `${w.artigo} ${w.palavra}`).join('\n');

            const enResponse = await fetch(DEEPSEEK_API_URL, {
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
                            content: `You are a German-English translator.
Translate each German noun to English concisely (1-3 words).
Respond ONLY in JSON format: {"translations": ["translation1", "translation2", ...]}
Keep the same order of words.
Do not include the article in the translation, only the translated noun.`
                        },
                        {
                            role: 'user',
                            content: `Translate these German nouns to English:\n${wordsList}`
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 1000
                })
            });

            if (enResponse.ok) {
                const data = await enResponse.json();
                const content = data.choices?.[0]?.message?.content || '';

                let translations = [];
                try {
                    const jsonMatch = content.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        translations = parsed.translations || [];
                    }
                } catch (e) {
                    translations = content.split('\n').filter(line => line.trim());
                }

                for (let i = 0; i < needsEN.length && i < translations.length; i++) {
                    const word = needsEN[i];
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
                                body: JSON.stringify({ translation_en: translation })
                            }
                        );
                        updatedCount++;
                        console.log(`EN: ${word.artigo} ${word.palavra} -> ${translation}`);
                    }
                }
            }
        }

        updatedCount = Math.max(needsPT.length, needsEN.length);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: `${updatedCount} palavras traduzidas com sucesso`,
                translated: updatedCount,
                remaining: allWordsToTranslate.length - wordsToProcess.length,
                pt_translated: needsPT.length,
                en_translated: needsEN.length
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
