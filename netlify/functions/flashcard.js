// Webhook de Flashcards - Substitui o n8n webhook
// Usa DeepSeek para extrair substantivos alemães e salva no Supabase

const SUPABASE_URL = 'https://timqizyevfkvqgzvcrlx.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpbXFpenlldmZrdnFnenZjcmx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjAxOTAwNiwiZXhwIjoyMDYxNTk1MDA2fQ.mQcEtge5GlyTQHzJMlWO2oT42tiAG-KFl58o-39MEG0';
const DEEPSEEK_API_KEY = 'sk-e080234eab8b442fb65fe8955d8947de';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

exports.handler = async (event) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        // 1. Parse request body
        const body = JSON.parse(event.body);
        const { email, redacao } = body;

        if (!email || !redacao) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing email or redacao' })
            };
        }

        console.log('Processing flashcard request for:', email);

        // 2. Get user_id from email via Supabase RPC
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
            // Parse the response - it might be a string or JSON
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

        // 3. Call DeepSeek to extract nouns with articles AND translations
        const systemPrompt = `Você é um especialista em gramática alemã que funciona como uma API. Sua única função é analisar um texto e retornar um array de objetos JSON. Siga estas regras estritamente:
1.  Identifique apenas substantivos verdadeiros (Nomen).
2.  Ignore advérbios (como "Heute"), pronomes ou outras classes de palavras, mesmo que estejam capitalizadas.
3.  Para cada substantivo, forneça seu artigo definido no caso nominativo singular (der, die, das).
4.  Para cada substantivo, forneça também a tradução em português brasileiro.
5.  Sua resposta DEVE ser um array JSON válido, começando com \`[\` e terminando com \`]\`.
6.  Se nenhum substantivo for encontrado, retorne um array vazio \`[]\`.
7.  Não inclua explicações, comentários ou qualquer outro texto fora do array JSON.
Texto de entrada:
${redacao}`;

        const userPrompt = `Analise o texto fornecido e extraia os substantivos, seus artigos e traduções para português.

Exemplo de tarefa:
Texto de entrada: "Heute geht der Hund in den Garten."
Sua saída esperada: [
  {
    "substantivo": "Hund",
    "artigo_correto": "der",
    "traducao": "cachorro"
  },
  {
    "substantivo": "Garten",
    "artigo_correto": "der",
    "traducao": "jardim"
  }
]

Agora, execute a tarefa real:
Texto de entrada: "${redacao}"

IMPORTANTE: APENAS JSON válido. Não inclua a marcação \`\`\`json, comentários ou qualquer outro texto antes ou depois do objeto JSON. Garanta que o JSON esteja perfeitamente formatado.`;

        const deepseekResponse = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.3
            })
        });

        if (!deepseekResponse.ok) {
            const errorText = await deepseekResponse.text();
            console.error('DeepSeek API error:', errorText);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'AI API error', details: errorText })
            };
        }

        const deepseekData = await deepseekResponse.json();
        const aiMessage = deepseekData.choices[0]?.message?.content || '';

        console.log('DeepSeek response:', aiMessage);

        // 4. Parse the AI response - extract JSON array
        const match = aiMessage.match(/(\[\s*\{[\s\S]*?\}\s*\])/);

        let nouns = [];
        if (match && match[1]) {
            try {
                nouns = JSON.parse(match[1]);
            } catch (e) {
                console.error('Error parsing AI response:', e);
                // Try to parse the entire message as JSON
                try {
                    nouns = JSON.parse(aiMessage);
                } catch (e2) {
                    console.error('Could not parse AI response at all');
                }
            }
        } else if (aiMessage.trim().startsWith('[')) {
            try {
                nouns = JSON.parse(aiMessage);
            } catch (e) {
                console.error('Error parsing direct JSON:', e);
            }
        }

        console.log('Extracted nouns:', nouns.length);

        // 5. Process each noun - check if exists, if not insert
        let insertedCount = 0;
        let skippedCount = 0;

        for (const noun of nouns) {
            const palavra = noun.substantivo;
            const artigo = noun.artigo_correto;
            const traducao = noun.traducao || '';

            if (!palavra || !artigo) continue;

            // Check if flashcard already exists
            const checkResponse = await fetch(
                `${SUPABASE_URL}/rest/v1/flashcards?user_id=eq.${userId}&palavra=eq.${encodeURIComponent(palavra)}&select=id,traducao`,
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
                // Insert new flashcard with translation
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
                        traducao: traducao
                    })
                });

                if (insertResponse.ok) {
                    insertedCount++;
                    console.log(`Inserted: ${artigo} ${palavra} (${traducao})`);
                } else {
                    console.error(`Failed to insert: ${palavra}`, await insertResponse.text());
                }
            } else {
                // Update translation if it's missing
                const existing = existingCards[0];
                if (!existing.traducao && traducao) {
                    await fetch(`${SUPABASE_URL}/rest/v1/flashcards?id=eq.${existing.id}`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                            'apikey': SUPABASE_SERVICE_KEY,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=minimal'
                        },
                        body: JSON.stringify({ traducao: traducao })
                    });
                    console.log(`Updated translation for: ${palavra}`);
                }
                skippedCount++;
                console.log(`Skipped (exists): ${palavra}`);
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: `Processed ${nouns.length} nouns. Inserted: ${insertedCount}, Skipped: ${skippedCount}`,
                inserted: insertedCount,
                skipped: skippedCount,
                total: nouns.length
            })
        };

    } catch (error) {
        console.error('Flashcard webhook error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error', details: error.message })
        };
    }
};
