// Análise de correções para conversação - usa DeepSeek para analisar erros em alemão
// Otimizado para funcionar dentro do timeout do Netlify (10s)

const DEEPSEEK_API_KEY = 'sk-e080234eab8b442fb65fe8955d8947de';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// Prompt otimizado e mais curto para resposta rápida
const ANALYSIS_PROMPT = `Analise os erros de alemão. Responda APENAS com JSON array.

CATEGORIAS: declinacao, conjugacao, preposicoes, sintaxe, vocabulario

FORMATO:
[{"categoria":"X","contexto":"frase original","erro":"erro","correcao":"correto","explicacao":"explicação em português"}]

REGRAS:
- Máximo 5 erros
- Se não houver erros: []
- Explicação curta (1 frase)
- Foque em gramática, ignore pronúncia`;

// Timeout reduzido para funcionar no Netlify
async function callDeepSeek(userContent) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 segundos

    try {
        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: ANALYSIS_PROMPT },
                    { role: 'user', content: userContent }
                ],
                temperature: 0.1,
                max_tokens: 1000
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || '[]';
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

function parseCorrections(rawResponse) {
    if (!rawResponse) return [];
    const match = rawResponse.match(/\[[\s\S]*\]/);
    if (match) {
        try {
            return JSON.parse(match[0]);
        } catch (e) {
            return [];
        }
    }
    return [];
}

function formatTranscripts(transcripts) {
    if (!Array.isArray(transcripts)) return '';
    return transcripts
        .filter(t => t.speaker === 'user')
        .map((t, i) => `${i + 1}. "${t.text}"`)
        .join('\n');
}

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
        const { transcripts, fullAnalysis } = body;

        if (fullAnalysis && Array.isArray(transcripts)) {
            const formatted = formatTranscripts(transcripts);
            console.log('Analisando:', formatted);

            if (!formatted || formatted.length < 10) {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ corrections: [], message: 'Muito curto' })
                };
            }

            const userContent = `Frases do aluno:\n${formatted}`;
            const rawResponse = await callDeepSeek(userContent);
            console.log('Resposta:', rawResponse.substring(0, 200));

            const corrections = parseCorrections(rawResponse);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ corrections, totalErrors: corrections.length })
            };
        }

        // Modo legado
        const { text } = body;
        if (!text || text.length < 5) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ corrections: [] })
            };
        }

        const rawResponse = await callDeepSeek(`Frase: "${text}"`);
        const corrections = parseCorrections(rawResponse);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ corrections })
        };

    } catch (error) {
        console.error('Erro:', error.message);
        return {
            statusCode: 200, // Retorna 200 mesmo com erro para não quebrar o frontend
            headers,
            body: JSON.stringify({
                corrections: [],
                error: error.message
            })
        };
    }
};
