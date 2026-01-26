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

        // IMPORTANTE: Usar SOMENTE a tradução, não mencionar a palavra alemã para evitar que a IA tente adivinhar
        let instrucaoDica;
        if (nivelDica === 1) {
            instrucaoDica = `A palavra em português é "${traducao}". Crie uma dica MUITO VAGA sobre a categoria ou contexto geral. Exemplos: "relacionado a sentimentos", "usado na cozinha", "algo abstrato". NÃO use a palavra "${traducao}" nem sinônimos diretos na dica.`;
        } else if (nivelDica === 2) {
            instrucaoDica = `A palavra em português é "${traducao}". Crie uma dica MÉDIA explicando situações onde esse conceito é usado. Exemplos: "você sente isso quando a rotina cansa", "algo que todo mundo busca no dia a dia". NÃO use a palavra "${traducao}" nem sinônimos diretos na dica.`;
        } else {
            instrucaoDica = `A palavra em português é "${traducao}". Crie uma dica BEM CLARA com uma frase de exemplo usando "___" no lugar da palavra. Exemplo para "variedade": "Ter ___ na alimentação é importante para a saúde". Pode usar sinônimos ou explicações diretas.`;
        }

        const systemPrompt = `Você é um assistente para um jogo da forca em português. Você receberá uma TRADUÇÃO em português e deve criar UMA dica baseada EXCLUSIVAMENTE nessa tradução.

REGRAS CRÍTICAS:
1. Use SOMENTE a tradução fornecida como base - NÃO tente adivinhar outros significados
2. A dica deve ser em português
3. Máximo de 15 palavras
4. Responda APENAS com a dica, sem prefixos como "Dica:" ou explicações
5. Para nível 1 e 2: NÃO revele a tradução direta nem sinônimos óbvios
6. Para nível 3: Pode ser mais direto, usar sinônimos ou frases de exemplo
7. IGNORE qualquer palavra em alemão - foque APENAS na tradução portuguesa fornecida`;

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
