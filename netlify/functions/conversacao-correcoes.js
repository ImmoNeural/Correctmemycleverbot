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

═══════════════════════════════════════════════════════════════
CLASSIFICATION DECISION TREE - FOLLOW THIS ORDER:
═══════════════════════════════════════════════════════════════

STEP 1: Is it a VERB error?
   → Wrong conjugation (ich gehe → ich geht)? → "conjugation"
   → Wrong tense (ich gehe gestern)? → "conjugation"
   → Wrong auxiliary (ich habe gegangen → ich bin gegangen)? → "conjugation"
   → Verb in wrong position? → "syntax"

STEP 2: Is it an ARTICLE/CASE error?
   → Wrong article gender (die Mann → der Mann)? → "declination"
   → Wrong case after preposition (mit der Auto → mit dem Auto)? → "declination"
   → Wrong adjective ending (ein großer Frau → eine große Frau)? → "declination"
   → Wrong pronoun case (ich warte auf du → auf dich)? → "declination"

STEP 3: Is it a PREPOSITION error?
   → Wrong preposition choice (ich denke auf → ich denke an)? → "prepositions"
   → Missing preposition? → "prepositions"
   → Extra unnecessary preposition? → "prepositions"

STEP 4: Is it a WORD ORDER error?
   → Verb not in second position (Ich gestern bin gegangen)? → "syntax"
   → Wrong subordinate clause order? → "syntax"
   → Negation in wrong place (nicht at wrong position)? → "syntax"
   → Missing sentence element? → "syntax"

STEP 5: ONLY if none of the above apply:
   → Wrong word entirely (used "bekommen" meaning "become")? → "vocabulary"
   → False friend from another language? → "vocabulary"
   → Wrong idiomatic expression? → "vocabulary"

═══════════════════════════════════════════════════════════════
CATEGORY EXAMPLES:
═══════════════════════════════════════════════════════════════

"declination" examples:
  - "die Mann" → "der Mann" (wrong article gender)
  - "mit der Auto" → "mit dem Auto" (wrong case after preposition)
  - "für ich" → "für mich" (wrong pronoun case)
  - "ein großer Frau" → "eine große Frau" (wrong adjective ending)
  - "Ich sehe der Mann" → "Ich sehe den Mann" (wrong accusative)
  - "Ich helfe der Mann" → "Ich helfe dem Mann" (dative required)

"conjugation" examples:
  - "er haben" → "er hat" (wrong person conjugation)
  - "wir ist" → "wir sind" (wrong verb form)
  - "ich gehe gestern" → "ich ging gestern" (wrong tense)
  - "ich habe gegangen" → "ich bin gegangen" (wrong auxiliary)
  - "er will geht" → "er will gehen" (modal verb + infinitive)

"prepositions" examples:
  - "ich denke auf dich" → "ich denke an dich" (wrong preposition)
  - "ich warte dich" → "ich warte auf dich" (missing preposition)
  - "ich interessiere für" → "ich interessiere mich für" (reflexive + prep)

"syntax" examples:
  - "Ich gestern bin gegangen" → "Ich bin gestern gegangen" (V2 rule)
  - "Er hat nicht gearbeitet" vs "Er hat gearbeitet nicht" (negation position)
  - "weil ich bin müde" → "weil ich müde bin" (subordinate clause)
  - "Ich kann nicht sprechen Deutsch" → "Ich kann nicht Deutsch sprechen"

"vocabulary" - ONLY USE WHEN:
  - Completely wrong word: "Ich will bekommen a doctor" (become vs get)
  - False friends: "aktuell" used as "actual" instead of "current"
  - Wrong expression: "machen Sinn" (anglicism) → "Sinn ergeben/haben"

═══════════════════════════════════════════════════════════════

JSON FORMAT:
[{"categoria":"declination|conjugation|prepositions|syntax|vocabulary","contexto":"full German sentence","erro":"specific wrong word/structure","correcao":"correct German form","explicacao":"brief explanation in English"}]

CRITICAL RULES:
- Maximum 5 errors
- If no GERMAN errors: []
- "vocabulary" is the LAST RESORT - only use when no grammar rule is violated
- If in doubt between categories, choose the GRAMMAR category, not vocabulary
- Article/case errors are ALWAYS "declination", never vocabulary
- Verb form errors are ALWAYS "conjugation", never vocabulary`;
    }

    // Default to Portuguese
    return `Você é um professor de ALEMÃO. Analise APENAS erros de ALEMÃO (Deutsch).

IMPORTANTE:
- O aluno está praticando ALEMÃO (idioma germânico)
- IGNORE qualquer texto que não seja alemão
- NÃO analise russo, inglês, português ou outros idiomas
- Se o texto não for alemão, retorne []

═══════════════════════════════════════════════════════════════
ÁRVORE DE DECISÃO PARA CLASSIFICAÇÃO - SIGA ESTA ORDEM:
═══════════════════════════════════════════════════════════════

PASSO 1: É um erro de VERBO?
   → Conjugação errada (ich gehe → ich geht)? → "conjugacao"
   → Tempo verbal errado (ich gehe gestern)? → "conjugacao"
   → Auxiliar errado (ich habe gegangen → ich bin gegangen)? → "conjugacao"
   → Verbo na posição errada? → "sintaxe"

PASSO 2: É um erro de ARTIGO/CASO?
   → Gênero do artigo errado (die Mann → der Mann)? → "declinacao"
   → Caso errado após preposição (mit der Auto → mit dem Auto)? → "declinacao"
   → Terminação de adjetivo errada (ein großer Frau → eine große Frau)? → "declinacao"
   → Caso do pronome errado (ich warte auf du → auf dich)? → "declinacao"

PASSO 3: É um erro de PREPOSIÇÃO?
   → Preposição errada (ich denke auf → ich denke an)? → "preposicoes"
   → Preposição faltando? → "preposicoes"
   → Preposição extra desnecessária? → "preposicoes"

PASSO 4: É um erro de ORDEM DAS PALAVRAS?
   → Verbo não está na segunda posição (Ich gestern bin gegangen)? → "sintaxe"
   → Ordem errada em oração subordinada? → "sintaxe"
   → Negação no lugar errado (nicht na posição errada)? → "sintaxe"
   → Elemento da frase faltando? → "sintaxe"

PASSO 5: SOMENTE se nenhum dos anteriores se aplicar:
   → Palavra completamente errada (usou "bekommen" como "become")? → "vocabulario"
   → Falso cognato de outro idioma? → "vocabulario"
   → Expressão idiomática errada? → "vocabulario"

═══════════════════════════════════════════════════════════════
EXEMPLOS POR CATEGORIA:
═══════════════════════════════════════════════════════════════

Exemplos de "declinacao":
  - "die Mann" → "der Mann" (gênero do artigo errado)
  - "mit der Auto" → "mit dem Auto" (caso errado após preposição)
  - "für ich" → "für mich" (caso do pronome errado)
  - "ein großer Frau" → "eine große Frau" (terminação de adjetivo errada)
  - "Ich sehe der Mann" → "Ich sehe den Mann" (acusativo errado)
  - "Ich helfe der Mann" → "Ich helfe dem Mann" (dativo necessário)

Exemplos de "conjugacao":
  - "er haben" → "er hat" (conjugação de pessoa errada)
  - "wir ist" → "wir sind" (forma verbal errada)
  - "ich gehe gestern" → "ich ging gestern" (tempo errado)
  - "ich habe gegangen" → "ich bin gegangen" (auxiliar errado)
  - "er will geht" → "er will gehen" (verbo modal + infinitivo)

Exemplos de "preposicoes":
  - "ich denke auf dich" → "ich denke an dich" (preposição errada)
  - "ich warte dich" → "ich warte auf dich" (preposição faltando)
  - "ich interessiere für" → "ich interessiere mich für" (reflexivo + prep)

Exemplos de "sintaxe":
  - "Ich gestern bin gegangen" → "Ich bin gestern gegangen" (regra V2)
  - "Er hat gearbeitet nicht" → "Er hat nicht gearbeitet" (posição da negação)
  - "weil ich bin müde" → "weil ich müde bin" (oração subordinada)
  - "Ich kann nicht sprechen Deutsch" → "Ich kann nicht Deutsch sprechen"

"vocabulario" - USE APENAS QUANDO:
  - Palavra completamente errada: "Ich will bekommen a doctor" (become vs get)
  - Falsos cognatos: "aktuell" usado como "atual" em vez de "corrente"
  - Expressão errada: "machen Sinn" (anglicismo) → "Sinn ergeben/haben"

═══════════════════════════════════════════════════════════════

FORMATO JSON:
[{"categoria":"declinacao|conjugacao|preposicoes|sintaxe|vocabulario","contexto":"frase completa em alemão","erro":"palavra/estrutura específica errada","correcao":"forma correta em alemão","explicacao":"explicação breve em português"}]

REGRAS CRÍTICAS:
- Máximo 5 erros
- Se não houver erros de ALEMÃO: []
- "vocabulario" é o ÚLTIMO RECURSO - use apenas quando nenhuma regra gramatical foi violada
- Na dúvida entre categorias, escolha a categoria de GRAMÁTICA, não vocabulário
- Erros de artigo/caso são SEMPRE "declinacao", nunca vocabulário
- Erros de forma verbal são SEMPRE "conjugacao", nunca vocabulário`;
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
