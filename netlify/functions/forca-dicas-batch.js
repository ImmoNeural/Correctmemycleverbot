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
        const { palavra, traducao } = body;

        // Gerar ID único para evitar cache
        const requestId = Date.now() + '-' + Math.random().toString(36).substring(7);

        console.log('[FORCA-DICAS-BATCH] Request ID:', requestId);
        console.log('[FORCA-DICAS-BATCH] Palavra:', palavra);
        console.log('[FORCA-DICAS-BATCH] Tradução:', traducao);

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
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    dicas: [
                        `Esta palavra tem ${palavraLimpa.length} letras.`,
                        `Tente pensar em palavras alemãs comuns.`,
                        `A palavra começa com a letra ${palavraLimpa[0].toUpperCase()}.`
                    ],
                    palavraOrigem: palavraLimpa
                })
            };
        }

        // Prompt MUITO simples e direto - foco APENAS na tradução
        const systemPrompt = `Você cria dicas para um jogo da forca. O jogador precisa adivinhar uma palavra alemã.

TAREFA: Criar 3 dicas sobre o significado "${traducaoLimpa}" (e SOMENTE sobre isso).

REGRAS:
- Dica 1: Categoria geral (ex: se a tradução é "casa", diga "É um tipo de construção")
- Dica 2: Uso ou contexto (ex: "Lugar onde as pessoas moram")
- Dica 3: Descrição mais direta (ex: "Habitação com quartos, cozinha e banheiro")
- NÃO mencione a palavra "${palavraLimpa}"
- NÃO fale sobre letras ou número de letras
- FOQUE apenas no significado "${traducaoLimpa}"

Responda APENAS em JSON: {"dica1": "...", "dica2": "...", "dica3": "..."}`;

        const userPrompt = `[ID: ${requestId}]
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
            dicas = [
                `Relacionado a: ${traducaoLimpa}`,
                `Pense no significado de "${traducaoLimpa}"`,
                `A tradução é: ${traducaoLimpa}`
            ];
        }

        // Validar que as dicas não estão vazias
        dicas = dicas.map((d, i) => {
            if (!d || d.trim() === '') {
                return i === 2 ? `A tradução é: ${traducaoLimpa}` : `Dica sobre: ${traducaoLimpa}`;
            }
            return d;
        });

        // Garantir que temos exatamente 3 dicas
        while (dicas.length < 3) {
            dicas.push(`A tradução é: ${traducaoLimpa}`);
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
