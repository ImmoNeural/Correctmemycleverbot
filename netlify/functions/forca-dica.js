// Função para gerar dicas do jogo da forca usando DeepSeek
// A dica é gerada em alemão/português, descrevendo o contexto ou uso da palavra

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
        const { palavra, nivel } = body;

        if (!palavra) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing palavra parameter' })
            };
        }

        // Nível da dica: 1 = vaga, 2 = média, 3 = mais direta
        const nivelDica = nivel || 1;

        let instrucaoDica;
        if (nivelDica === 1) {
            instrucaoDica = 'Dê uma dica MUITO VAGA sobre o contexto geral onde essa palavra é usada. Seja misterioso e não revele muito.';
        } else if (nivelDica === 2) {
            instrucaoDica = 'Dê uma dica MÉDIA, indicando a categoria ou situação onde a palavra é comumente usada.';
        } else {
            instrucaoDica = 'Dê uma dica CLARA com um exemplo de frase em alemão usando a palavra (substituindo a palavra por "___").';
        }

        const systemPrompt = `Você é um assistente para um jogo da forca em alemão. Sua tarefa é criar dicas para ajudar o jogador a adivinhar uma palavra alemã.

REGRAS IMPORTANTES:
1. NUNCA revele a tradução direta da palavra em português
2. NUNCA diga a palavra em alemão
3. A dica deve ser em português
4. A dica deve ter no máximo 50 palavras
5. Seja criativo e útil

${instrucaoDica}`;

        const userPrompt = `Crie uma dica para a palavra alemã: "${palavra}"

Responda APENAS com a dica, sem explicações adicionais.`;

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
                temperature: 0.7,
                max_tokens: 150
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
