// Função para gerar dicas do jogo da forca usando DeepSeek
// A dica é baseada na tradução do banco de dados para ser consistente

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
        const { palavra, traducao, nivel } = body;

        // DEBUG: Log dos dados recebidos
        console.log('[FORCA-DICA] Dados recebidos:');
        console.log('[FORCA-DICA] Palavra:', palavra);
        console.log('[FORCA-DICA] Tradução:', traducao);
        console.log('[FORCA-DICA] Nível:', nivel);

        if (!palavra) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing palavra parameter' })
            };
        }

        // Se não tiver tradução, retornar erro pedindo para usar a tradução
        if (!traducao) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    dica: `Esta palavra tem ${palavra.length} letras.`,
                    nivel: nivel || 1
                })
            };
        }

        // Nível da dica: 1 = vaga, 2 = média, 3 = mais direta
        const nivelDica = nivel || 1;

        // IMPORTANTE: Usar SOMENTE a tradução, de forma bem explícita
        const traducaoLimpa = traducao.trim();

        console.log('[FORCA-DICA] Gerando dica para tradução:', traducaoLimpa);

        let instrucaoDica;
        if (nivelDica === 1) {
            instrucaoDica = `TRADUÇÃO A USAR: "${traducaoLimpa}"

Crie UMA dica VAGA sobre a categoria ou contexto geral desta tradução.
Exemplo: se a tradução fosse "carro", a dica seria "meio de transporte terrestre".
NÃO use "${traducaoLimpa}" na dica.`;
        } else if (nivelDica === 2) {
            instrucaoDica = `TRADUÇÃO A USAR: "${traducaoLimpa}"

Crie UMA dica MÉDIA explicando quando/onde este conceito é usado.
Exemplo: se a tradução fosse "carro", a dica seria "você usa isso para ir ao trabalho".
NÃO use "${traducaoLimpa}" na dica.`;
        } else {
            instrucaoDica = `TRADUÇÃO A USAR: "${traducaoLimpa}"

Crie UMA frase de exemplo usando "___" no lugar da tradução.
Exemplo: se a tradução fosse "carro", a dica seria "Comprei um ___ novo ontem".`;
        }

        const systemPrompt = `Você gera dicas para um jogo da forca. Você receberá uma TRADUÇÃO em português e deve criar EXATAMENTE UMA dica baseada nela.

REGRAS:
1. Use SOMENTE a tradução fornecida - ela está marcada como "TRADUÇÃO A USAR:"
2. Responda APENAS com a dica, sem prefixos
3. Máximo 15 palavras
4. A dica deve fazer sentido para a tradução fornecida`;

        const userPrompt = instrucaoDica;

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
                temperature: 0,
                max_tokens: 100
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
        const dica = deepseekData.choices[0]?.message?.content || 'Não foi possível gerar uma dica.';

        console.log('[FORCA-DICA] Dica gerada:', dica.trim());
        console.log('[FORCA-DICA] Para tradução:', traducaoLimpa);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                dica: dica.trim(),
                nivel: nivelDica,
                // Debug info
                debug: {
                    palavraRecebida: palavra,
                    traducaoRecebida: traducao,
                    traducaoUsada: traducaoLimpa
                }
            })
        };

    } catch (error) {
        console.error('Forca dica error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error', details: error.message })
        };
    }
};
