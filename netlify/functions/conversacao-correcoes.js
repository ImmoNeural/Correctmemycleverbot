// Análise de correções para conversação - usa DeepSeek para analisar erros em alemão
// Otimizado para funcionar dentro do timeout do Netlify (10s)

const DEEPSEEK_API_KEY = 'sk-e080234eab8b442fb65fe8955d8947de';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// Get analysis prompt based on language
function getAnalysisPrompt(language) {
    const isEnglish = language === 'en' || language === 'en-US' || language === 'en-GB';

    if (isEnglish) {
        return `You are a GERMAN language teacher. Analyze ONLY GERMAN (Deutsch) errors.

IMPORTANT:
- The student is practicing GERMAN (Germanic language)
- IGNORE any text that is not German
- DO NOT analyze Russian, English, Portuguese or other languages
- If the text is not German, return []

CATEGORY DEFINITIONS (use EXACTLY these category names):
1. "declination" - Article errors (der/die/das), incorrect case usage (Nominativ/Akkusativ/Dativ/Genitiv), adjective endings
   Examples: "die Mann" → "der Mann", "mit der Auto" → "mit dem Auto", "ein großer Frau" → "eine große Frau"

2. "conjugation" - Verb conjugation errors, incorrect tense, wrong verb forms
   Examples: "ich gehe gestern" → "ich ging gestern", "er haben" → "er hat", "wir ist" → "wir sind"

3. "prepositions" - Wrong preposition choice or missing prepositions
   Examples: "ich warte auf du" → "ich warte auf dich", "in die Schule gehen" → "zur Schule gehen"

4. "syntax" - Word order errors, sentence structure problems, missing words
   Examples: "Ich gestern bin gegangen" → "Ich bin gestern gegangen", "Er hat gearbeitet nicht" → "Er hat nicht gearbeitet"

5. "vocabulary" - Wrong word choice (not grammar), incorrect expressions, false friends
   Examples: "Ich bin kalt" → "Mir ist kalt", "machen ein Foto" → "ein Foto machen"

JSON FORMAT:
[{"categoria":"declination|conjugation|prepositions|syntax|vocabulary","contexto":"full German sentence","erro":"specific wrong word/structure","correcao":"correct German form","explicacao":"brief explanation in English"}]

RULES:
- Maximum 5 errors
- If no GERMAN errors: []
- ALWAYS classify into the correct category based on the definitions above
- Do NOT default everything to "vocabulary" - analyze carefully`;
    }

    // Default to Portuguese
    return `Você é um professor de ALEMÃO. Analise APENAS erros de ALEMÃO (Deutsch).

IMPORTANTE:
- O aluno está praticando ALEMÃO (idioma germânico)
- IGNORE qualquer texto que não seja alemão
- NÃO analise russo, inglês, português ou outros idiomas
- Se o texto não for alemão, retorne []

DEFINIÇÃO DAS CATEGORIAS (use EXATAMENTE estes nomes):
1. "declinacao" - Erros de artigo (der/die/das), caso incorreto (Nominativ/Akkusativ/Dativ/Genitiv), terminações de adjetivos
   Exemplos: "die Mann" → "der Mann", "mit der Auto" → "mit dem Auto", "ein großer Frau" → "eine große Frau"

2. "conjugacao" - Erros de conjugação verbal, tempo incorreto, formas verbais erradas
   Exemplos: "ich gehe gestern" → "ich ging gestern", "er haben" → "er hat", "wir ist" → "wir sind"

3. "preposicoes" - Preposição errada ou faltando
   Exemplos: "ich warte auf du" → "ich warte auf dich", "in die Schule gehen" → "zur Schule gehen"

4. "sintaxe" - Ordem das palavras errada, estrutura da frase incorreta, palavras faltando
   Exemplos: "Ich gestern bin gegangen" → "Ich bin gestern gegangen", "Er hat gearbeitet nicht" → "Er hat nicht gearbeitet"

5. "vocabulario" - Palavra errada (não gramática), expressões incorretas, falsos cognatos
   Exemplos: "Ich bin kalt" → "Mir ist kalt", "machen ein Foto" → "ein Foto machen"

FORMATO JSON:
[{"categoria":"declinacao|conjugacao|preposicoes|sintaxe|vocabulario","contexto":"frase completa em alemão","erro":"palavra/estrutura específica errada","correcao":"forma correta em alemão","explicacao":"explicação breve em português"}]

REGRAS:
- Máximo 5 erros
- Se não houver erros de ALEMÃO: []
- SEMPRE classifique na categoria correta baseado nas definições acima
- NÃO coloque tudo como "vocabulario" - analise cuidadosamente`;
}

// Timeout reduzido para funcionar no Netlify
async function callDeepSeek(userContent, language = 'pt-BR') {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 segundos

    const prompt = getAnalysisPrompt(language);

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
                    { role: 'system', content: prompt },
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
        const { transcripts, fullAnalysis, language } = body;

        if (fullAnalysis && Array.isArray(transcripts)) {
            const formatted = formatTranscripts(transcripts);
            console.log('Analisando:', formatted, 'Language:', language);

            if (!formatted || formatted.length < 10) {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ corrections: [], message: 'Muito curto' })
                };
            }

            const userContent = `Frases do aluno:\n${formatted}`;
            const rawResponse = await callDeepSeek(userContent, language);
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

        const rawResponse = await callDeepSeek(`Frase: "${text}"`, language);
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
