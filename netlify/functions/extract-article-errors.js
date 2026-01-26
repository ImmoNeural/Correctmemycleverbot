// Extrai erros de artigos (der/die/das) da análise de redação
// Salva os substantivos com o artigo CORRETO na tabela flashcards
// Também obtém a tradução para português

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
        const body = JSON.parse(event.body);
        const { email, erros } = body;

        if (!email || !erros) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing email or erros' })
            };
        }

        console.log('Processing article errors for:', email);

        // 1. Get user_id from email
        const userIdResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_user_id_by_email`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'apikey': SUPABASE_SERVICE_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ user_email: email })
        });

        const userIdText = await userIdResponse.text();
        let userId;
        try {
            const parsed = JSON.parse(userIdText);
            userId = typeof parsed === 'string' ? parsed : parsed.data || parsed;
        } catch (e) {
            userId = userIdText.replace(/"/g, '');
        }

        if (!userId) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'User not found' })
            };
        }

        console.log('Found user_id:', userId);

        // 2. Extract article errors from declinacao category
        // Topics 2, 3, 67 are related to gender/articles
        const articleErrors = [];
        const declinacaoErrors = erros.declinacao || [];

        for (const erro of declinacaoErrors) {
            const topico = parseInt(erro.topico_gramatical_numero);
            const palavraErrada = (erro.palavra_errada || '').trim();
            const sugestao = (erro.sugestao_correcao || '').trim();
            const descricao = (erro.descricao_topico_gramatical || '').toLowerCase();

            // Check if this is an article error (der/die/das related)
            // Topics: 2 (Geschlecht/Genus), 3 (Nomen Deklination), 67 (Nullartikel)
            const isArticleRelated = [2, 3, 67].includes(topico) ||
                /\b(der|die|das)\b/i.test(palavraErrada) ||
                /\b(der|die|das)\b/i.test(sugestao) ||
                /artigo|artikel|genus|geschlecht/i.test(descricao);

            if (isArticleRelated && sugestao) {
                // Extract the article and noun from the suggestion
                const articleMatch = sugestao.match(/\b(der|die|das)\s+(\w+)/i);
                if (articleMatch) {
                    // Also try to extract the wrong article from palavraErrada
                    const wrongArticleMatch = palavraErrada.match(/\b(der|die|das)\s+(\w+)/i);
                    const artigoErrado = wrongArticleMatch ? wrongArticleMatch[0] : palavraErrada;

                    articleErrors.push({
                        artigo_errado: artigoErrado,
                        artigo_correto: articleMatch[1].toLowerCase(),
                        substantivo: articleMatch[2]
                    });
                }
            }
        }

        // Remove duplicates based on substantivo
        const uniqueErrors = [];
        const seenNouns = new Set();
        for (const error of articleErrors) {
            const key = error.substantivo.toLowerCase();
            if (!seenNouns.has(key)) {
                seenNouns.add(key);
                uniqueErrors.push(error);
            }
        }
        articleErrors.length = 0;
        articleErrors.push(...uniqueErrors);

        console.log('Found article errors:', articleErrors.length);

        if (articleErrors.length === 0) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'No article errors found',
                    inserted: 0
                })
            };
        }

        // 3. Get translations for all nouns using DeepSeek
        const nounsToTranslate = articleErrors.map(e => e.substantivo).join(', ');

        const translatePrompt = `Traduza os seguintes substantivos alemães para português brasileiro.
Responda APENAS com um JSON array no formato: [{"alemao": "palavra", "portugues": "tradução"}]

Palavras: ${nounsToTranslate}

IMPORTANTE: Apenas JSON válido, sem markdown ou texto extra.`;

        const translateResponse = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'user', content: translatePrompt }
                ],
                temperature: 0.3
            })
        });

        let translations = {};
        if (translateResponse.ok) {
            const translateData = await translateResponse.json();
            const translateContent = translateData.choices[0]?.message?.content || '';

            try {
                // Try to parse JSON from response
                const jsonMatch = translateContent.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    const translationArray = JSON.parse(jsonMatch[0]);
                    for (const t of translationArray) {
                        translations[t.alemao.toLowerCase()] = t.portugues;
                    }
                }
            } catch (e) {
                console.error('Error parsing translations:', e);
            }
        }

        console.log('Translations obtained:', Object.keys(translations).length);

        // 4. Insert article errors into flashcards table
        let insertedCount = 0;
        let skippedCount = 0;

        for (const error of articleErrors) {
            const palavra = error.substantivo;
            const artigo = error.artigo_correto;
            const traducao = translations[palavra.toLowerCase()] || '';

            if (!palavra || !artigo) continue;

            // Check if flashcard already exists
            const checkResponse = await fetch(
                `${SUPABASE_URL}/rest/v1/flashcards?user_id=eq.${userId}&palavra=eq.${encodeURIComponent(palavra)}&select=id`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                        'apikey': SUPABASE_SERVICE_KEY
                    }
                }
            );

            const existingCards = await checkResponse.json();

            if (!existingCards || existingCards.length === 0) {
                // Insert new flashcard with is_error flag
                const insertResponse = await fetch(`${SUPABASE_URL}/rest/v1/flashcards`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify({
                        user_id: userId,
                        palavra: palavra,
                        artigo: artigo,
                        traducao: traducao,
                        is_error: true,
                        artigo_errado: error.artigo_errado
                    })
                });

                if (insertResponse.ok) {
                    insertedCount++;
                    console.log(`Inserted error: ${artigo} ${palavra} (was: ${error.artigo_errado})`);
                } else {
                    console.error(`Failed to insert: ${palavra}`, await insertResponse.text());
                }
            } else {
                skippedCount++;
                console.log(`Skipped (exists): ${palavra}`);
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: `Processed ${articleErrors.length} article errors. Inserted: ${insertedCount}, Skipped: ${skippedCount}`,
                inserted: insertedCount,
                skipped: skippedCount,
                total: articleErrors.length
            })
        };

    } catch (error) {
        console.error('Extract article errors error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error', details: error.message })
        };
    }
};
