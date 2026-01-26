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

        let instrucaoDica;
        if (nivelDica === 1) {
            instrucaoDica = `Com base no significado "${traducao}", dê uma dica MUITO VAGA sobre a categoria ou contexto geral (ex: "relacionado a sentimentos", "usado na cozinha"). NÃO use a palavra "${traducao}" nem sinônimos diretos.`;
        } else if (nivelDica === 2) {
            instrucaoDica = `Com base no significado "${traducao}", dê uma dica MÉDIA explicando quando ou onde a palavra é usada (ex: "você usa isso quando está com fome", "encontrado em escritórios"). NÃO use a palavra "${traducao}" nem sinônimos diretos.`;
        } else {
            instrucaoDica = `Com base no significado "${traducao}", dê uma dica BEM CLARA com uma frase de exemplo usando "___" no lugar da palavra (ex: "Eu ___ muito café de manhã" para "beber"). Pode dar sinônimos ou explicações mais diretas.`;
        }

        const systemPrompt = `Você é um assistente para um jogo da forca. Sua tarefa é criar UMA dica curta e útil.

REGRAS OBRIGATÓRIAS:
1. A dica deve ser em português
2. Máximo de 20 palavras
3. Seja direto e claro
4. Responda APENAS com a dica, sem explicações
5. Para nível 1 e 2: NÃO revele a tradução direta nem sinônimos óbvios
6. Para nível 3: Pode ser mais direto, usar sinônimos ou frases de exemplo`;

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
                temperature: 0.3,
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

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                dica: dica.trim(),
                nivel: nivelDica
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
