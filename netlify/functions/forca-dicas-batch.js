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

        console.log('[FORCA-DICAS-BATCH] Gerando 3 dicas para:', { palavra, traducao });

        if (!palavra) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing palavra parameter' })
            };
        }

        // Se não tiver tradução, retornar dicas genéricas
        if (!traducao) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    dicas: [
                        `Esta palavra tem ${palavra.length} letras.`,
                        `Tente pensar em palavras comuns com ${palavra.length} letras.`,
                        `A palavra começa com a letra ${palavra[0].toUpperCase()}.`
                    ]
                })
            };
        }

        const traducaoLimpa = traducao.trim();

        // Prompt para gerar as 3 dicas de uma vez
        const systemPrompt = `Você gera dicas para um jogo da forca em português.
Você receberá uma TRADUÇÃO em português e deve criar EXATAMENTE 3 dicas progressivas.

REGRAS IMPORTANTES:
1. Responda APENAS em formato JSON: {"dica1": "...", "dica2": "...", "dica3": "..."}
2. Cada dica deve ter no máximo 15 palavras
3. NÃO use a palavra "${traducaoLimpa}" diretamente nas dicas 1 e 2
4. As dicas devem ser progressivamente mais reveladoras:
   - dica1: VAGA - categoria ou contexto geral
   - dica2: MÉDIA - quando/onde/como é usado
   - dica3: DIRETA - frase de exemplo com "___" no lugar da palavra`;

        const userPrompt = `TRADUÇÃO: "${traducaoLimpa}"

Gere 3 dicas progressivas para esta palavra.
Responda APENAS com o JSON, sem explicações.`;

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
                temperature: 0.3,
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
            // Fallback: tentar extrair dicas manualmente
            const match1 = resposta.match(/dica1["']?\s*:\s*["']([^"']+)["']/i);
            const match2 = resposta.match(/dica2["']?\s*:\s*["']([^"']+)["']/i);
            const match3 = resposta.match(/dica3["']?\s*:\s*["']([^"']+)["']/i);

            dicas = [
                match1?.[1] || `Categoria: algo relacionado a "${traducaoLimpa.substring(0, 3)}..."`,
                match2?.[1] || `Você usa isso no dia a dia.`,
                match3?.[1] || `A palavra é: ${traducaoLimpa}`
            ];
        }

        // Garantir que temos exatamente 3 dicas
        while (dicas.length < 3) {
            dicas.push(`Dica adicional: pense em "${traducaoLimpa.substring(0, 2)}..."`);
        }

        console.log('[FORCA-DICAS-BATCH] Dicas geradas:', dicas);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                dicas: dicas.slice(0, 3) // Garantir apenas 3 dicas
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
