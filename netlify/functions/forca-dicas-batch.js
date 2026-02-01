// Função para gerar TODAS as 3 dicas do jogo da forca de uma vez usando DeepSeek
// Isso evita chamadas duplicadas e problemas de sincronização

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
        const body = JSON.parse(event.body);
        const { palavra, traducao, lang = 'pt-BR' } = body;

        // Gerar ID único para evitar cache
        const requestId = Date.now() + '-' + Math.random().toString(36).substring(7);

        // Detectar idioma
        const isEnglish = lang === 'en' || lang === 'en-US';

        console.log('[FORCA-DICAS-BATCH] Request ID:', requestId);
        console.log('[FORCA-DICAS-BATCH] Palavra:', palavra);
        console.log('[FORCA-DICAS-BATCH] Tradução:', traducao);
        console.log('[FORCA-DICAS-BATCH] Language:', lang, '(isEnglish:', isEnglish, ')');

        if (!palavra) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing palavra parameter' })
            };
        }

        const traducaoLimpa = (traducao || '').trim();
        const palavraLimpa = (palavra || '').trim();

        // Se não tiver tradução, retornar dicas genéricas
        if (!traducaoLimpa) {
            const genericHints = isEnglish ? [
                `This word has ${palavraLimpa.length} letters.`,
                `Try to think of common German words.`,
                `The word starts with the letter ${palavraLimpa[0].toUpperCase()}.`
            ] : [
                `Esta palavra tem ${palavraLimpa.length} letras.`,
                `Tente pensar em palavras alemãs comuns.`,
                `A palavra começa com a letra ${palavraLimpa[0].toUpperCase()}.`
            ];
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    dicas: genericHints,
                    palavraOrigem: palavraLimpa
                })
            };
        }

        // Prompt baseado no idioma
        const systemPrompt = isEnglish ?
            `You create hints for a hangman game. The player needs to guess a German word.

TASK: Create 3 hints about the meaning "${traducaoLimpa}" (and ONLY about that).

RULES:
- Hint 1: General category (e.g., if the meaning is "house", say "It's a type of building")
- Hint 2: Use or context (e.g., "A place where people live")
- Hint 3: More direct description (e.g., "A dwelling with rooms, kitchen and bathroom")
- DO NOT mention the word "${palavraLimpa}"
- DO NOT talk about letters or number of letters
- FOCUS only on the meaning "${traducaoLimpa}"

Reply ONLY in JSON: {"dica1": "...", "dica2": "...", "dica3": "..."}`
            :
            `Você cria dicas para um jogo da forca. O jogador precisa adivinhar uma palavra alemã.

TAREFA: Criar 3 dicas sobre o significado "${traducaoLimpa}" (e SOMENTE sobre isso).

REGRAS:
- Dica 1: Categoria geral (ex: se a tradução é "casa", diga "É um tipo de construção")
- Dica 2: Uso ou contexto (ex: "Lugar onde as pessoas moram")
- Dica 3: Descrição mais direta (ex: "Habitação com quartos, cozinha e banheiro")
- NÃO mencione a palavra "${palavraLimpa}"
- NÃO fale sobre letras ou número de letras
- FOQUE apenas no significado "${traducaoLimpa}"

Responda APENAS em JSON: {"dica1": "...", "dica2": "...", "dica3": "..."}`;

        const userPrompt = isEnglish ?
            `[ID: ${requestId}]
Create 3 hints for the word that means "${traducaoLimpa}".
JSON only:`
            :
            `[ID: ${requestId}]
Crie 3 dicas para a palavra que significa "${traducaoLimpa}" em português.
JSON apenas:`;

        console.log('[FORCA-DICAS-BATCH] Enviando para DeepSeek...');

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
                temperature: 0.3, // Pequena variação para evitar cache
                max_tokens: 300
            })
        });

        if (!deepseekResponse.ok) {
            const errorText = await deepseekResponse.text();
            console.error('[FORCA-DICAS-BATCH] DeepSeek API error:', errorText);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'AI API error', details: errorText })
            };
        }

        const deepseekData = await deepseekResponse.json();
        const resposta = deepseekData.choices[0]?.message?.content || '';

        console.log('[FORCA-DICAS-BATCH] Resposta da IA:', resposta);

        // Tentar parsear o JSON da resposta
        let dicas = [];
        try {
            // Remover possíveis marcadores de código markdown
            const jsonStr = resposta.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const parsed = JSON.parse(jsonStr);
            dicas = [parsed.dica1, parsed.dica2, parsed.dica3];
        } catch (parseError) {
            console.error('[FORCA-DICAS-BATCH] Erro ao parsear JSON:', parseError);
            // Fallback: dicas baseadas diretamente na tradução
            dicas = isEnglish ? [
                `Related to: ${traducaoLimpa}`,
                `Think about the meaning of "${traducaoLimpa}"`,
                `The translation is: ${traducaoLimpa}`
            ] : [
                `Relacionado a: ${traducaoLimpa}`,
                `Pense no significado de "${traducaoLimpa}"`,
                `A tradução é: ${traducaoLimpa}`
            ];
        }

        // Validar que as dicas não estão vazias
        const translationHint = isEnglish ? `The translation is: ${traducaoLimpa}` : `A tradução é: ${traducaoLimpa}`;
        const hintAbout = isEnglish ? `Hint about: ${traducaoLimpa}` : `Dica sobre: ${traducaoLimpa}`;
        dicas = dicas.map((d, i) => {
            if (!d || d.trim() === '') {
                return i === 2 ? translationHint : hintAbout;
            }
            return d;
        });

        // Garantir que temos exatamente 3 dicas
        while (dicas.length < 3) {
            dicas.push(translationHint);
        }

        console.log('[FORCA-DICAS-BATCH] Dicas finais para', palavraLimpa, '(', traducaoLimpa, '):', dicas);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                dicas: dicas.slice(0, 3),
                palavraOrigem: palavraLimpa,
                traducaoOrigem: traducaoLimpa // Também retornar tradução para debug
            })
        };

    } catch (error) {
        console.error('[FORCA-DICAS-BATCH] Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error', details: error.message })
        };
    }
};
