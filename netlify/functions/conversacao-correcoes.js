// Análise de correções para conversação - usa DeepSeek para analisar erros em alemão
// Otimizado para funcionar dentro do timeout do Netlify (10s)

const DEEPSEEK_API_KEY = 'sk-e080234eab8b442fb65fe8955d8947de';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// Get analysis prompt based on language
// language = UI language for explanations (pt-BR, en)
// targetLanguage = language being studied (de = German)
function getAnalysisPrompt(language, targetLanguage = 'de') {
    const isEnglish = language === 'en' || language === 'en-US' || language === 'en-GB';

    if (isEnglish) {
        return `You are a GERMAN language expert specialized in error classification.

CRITICAL INSTRUCTIONS:
- The student is learning GERMAN and speaking with a FOREIGN ACCENT (often Brazilian)
- Analyze ONLY what appears to be attempts at GERMAN speech
- The transcription may be WRONG - it may show Arabic, Japanese, or other characters incorrectly
- If you see text in Arabic, Japanese, Chinese, or other non-German scripts, IGNORE IT COMPLETELY
- If the transcription shows random characters or non-German text, return []
- Focus ONLY on recognizable German words or phrases
- If no recognizable German text, return []

═══════════════════════════════════════════════════════════════════════════════
                    PRECISE ERROR CATEGORY DEFINITIONS
═══════════════════════════════════════════════════════════════════════════════

📘 VOCABULARY ("vocabulary"):
   DEFINITION: Using the WRONG WORD or INAPPROPRIATE word for the semantic context.
   The student chose the wrong word, but the grammar itself is correct.

   EXAMPLES:
   - "genannt" instead of "namens" (wrong word for "named")
   - "bekommen" instead of "werden" (meaning confusion)
   - "aktuell" instead of "eigentlich" (false cognate)
   - "machen Sinn" instead of "Sinn ergeben" (anglicism/wrong expression)
   - Using "groß" when it should be "hoch" (wrong semantic context)

📙 DECLENSION ("declination"):
   DEFINITION: Error in GRAMMATICAL CASE usage (Nominative, Accusative, Dative, Genitive).
   Includes: articles, pronouns, adjectives with wrong case endings.

   EXAMPLES:
   - "die Mann" → "der Mann" (article gender/case)
   - "mit der Auto" → "mit dem Auto" (dative after preposition)
   - "für ich" → "für mich" (pronoun in wrong case)
   - "Ich sehe der Mann" → "den Mann" (accusative required)
   - "Ich helfe der Frau" → "der Frau" is CORRECT (dative)
   - "ein großer Frau" → "eine große Frau" (adjective ending)

📗 PREPOSITION ("prepositions"):
   DEFINITION: Error in CHOOSING or USING prepositions.
   The preposition is wrong, missing, or unnecessary.

   EXAMPLES:
   - "ich denke auf" → "ich denke an" (wrong preposition)
   - "ich warte dich" → "ich warte auf dich" (missing preposition)
   - "ich gehe in die Arbeit" → "zur Arbeit" (wrong preposition)
   - "ich freue auf" → "ich freue mich auf" (missing reflexive + prep)

   ⚠️ ATTENTION: If the preposition is CORRECT but the CASE after it is wrong,
   it's DECLENSION, not preposition!
   Ex: "mit der Auto" - prep "mit" is correct, case is wrong = DECLENSION

📕 SYNTAX ("syntax"):
   DEFINITION: Error in STRUCTURE, WORD ORDER, or general sentence AGREEMENT.
   The overall sentence construction is incorrect.

   EXAMPLES:
   - "Ich gestern bin gegangen" → verb not in V2 = SYNTAX
   - "weil ich bin müde" → "weil ich müde bin" (subordinate clause order)
   - "Ich kann nicht sprechen Deutsch" → wrong object position
   - "Er hat gearbeitet nicht" → wrong "nicht" position
   - Wrong verbal agreement in structure (not verb conjugation itself)
   - Missing mandatory sentence element

📒 CONJUGATION ("conjugation"):
   DEFINITION: Error in the VERB FORM (person, tense, auxiliary).
   The verb itself is conjugated incorrectly.

   EXAMPLES:
   - "er haben" → "er hat" (wrong person)
   - "wir ist" → "wir sind" (wrong conjugation)
   - "ich gehe gestern" → "ich ging" (wrong tense)
   - "ich habe gegangen" → "ich bin gegangen" (wrong auxiliary)
   - "er will geht" → "er will gehen" (modal + infinitive)

═══════════════════════════════════════════════════════════════════════════════
                         CLASSIFICATION RULES
═══════════════════════════════════════════════════════════════════════════════

1. FIRST identify the error type:
   - Wrong word for the context? → VOCABULARY
   - Wrong grammatical case (Nom/Akk/Dat/Gen)? → DECLENSION
   - Wrong/missing preposition? → PREPOSITION
   - Wrong sentence order/structure? → SYNTAX
   - Wrong verb form? → CONJUGATION

2. If in DOUBT between categories:
   - Semantically wrong word = VOCABULARY
   - Wrong case after preposition = DECLENSION (not preposition!)
   - Verb in wrong position = SYNTAX (not conjugation!)

═══════════════════════════════════════════════════════════════════════════════

JSON FORMAT:
[{"categoria":"declination|conjugation|prepositions|syntax|vocabulary","contexto":"full sentence","erro":"wrong part","correcao":"correct form","explicacao":"explanation in English"}]

RULES:
- Maximum 5 errors
- If no errors: []
- Be PRECISE in classification following the definitions above`;
    }

    // Default to Portuguese
    return `Você é um professor de ALEMÃO especialista em classificação de erros gramaticais.

INSTRUÇÕES CRÍTICAS:
- O aluno está aprendendo ALEMÃO e fala com SOTAQUE ESTRANGEIRO (frequentemente brasileiro)
- Analise APENAS o que parece ser tentativas de falar ALEMÃO
- A transcrição pode estar ERRADA - pode mostrar caracteres em árabe, japonês ou outros idiomas incorretamente
- Se você vir texto em árabe, japonês, chinês ou outros scripts não-alemães, IGNORE COMPLETAMENTE
- Se a transcrição mostrar caracteres aleatórios ou texto não-alemão, retorne []
- Foque APENAS em palavras ou frases reconhecíveis em alemão
- Se não houver texto alemão reconhecível, retorne []

═══════════════════════════════════════════════════════════════════════════════
                    DEFINIÇÕES PRECISAS DAS CATEGORIAS DE ERRO
═══════════════════════════════════════════════════════════════════════════════

📘 VOCABULÁRIO ("vocabulario"):
   DEFINIÇÃO: Uso de uma PALAVRA ERRADA ou INADEQUADA para o contexto semântico.
   O aluno escolheu a palavra errada, mas a gramática em si está correta.

   EXEMPLOS:
   - "genannt" em vez de "namens" (palavra errada para "de nome")
   - "bekommen" em vez de "werden" (confusão de significado)
   - "aktuell" em vez de "eigentlich" (falso cognato)
   - "machen Sinn" em vez de "Sinn ergeben" (anglicismo/expressão errada)
   - Usar "groß" quando deveria ser "hoch" (contexto semântico errado)

📙 DECLINAÇÃO ("declinacao"):
   DEFINIÇÃO: Erro no USO DOS CASOS (Nominativo, Acusativo, Dativo, Genitivo).
   Inclui: artigos, pronomes, adjetivos com terminação de caso errada.

   EXEMPLOS:
   - "die Mann" → "der Mann" (gênero/caso do artigo)
   - "mit der Auto" → "mit dem Auto" (dativo após preposição)
   - "für ich" → "für mich" (pronome no caso errado)
   - "Ich sehe der Mann" → "den Mann" (acusativo necessário)
   - "Ich helfe der Frau" → "der Frau" está CORRETO (dativo)
   - "ein großer Frau" → "eine große Frau" (terminação de adjetivo)

📗 PREPOSIÇÃO ("preposicoes"):
   DEFINIÇÃO: Erro na ESCOLHA ou USO da preposição.
   A preposição está errada, faltando, ou é desnecessária.

   EXEMPLOS:
   - "ich denke auf" → "ich denke an" (preposição errada)
   - "ich warte dich" → "ich warte auf dich" (preposição faltando)
   - "ich gehe in die Arbeit" → "zur Arbeit" (preposição errada)
   - "ich freue auf" → "ich freue mich auf" (falta reflexivo + prep)

   ⚠️ ATENÇÃO: Se a preposição está CORRETA mas o CASO após ela está errado,
   é DECLINAÇÃO, não preposição!
   Ex: "mit der Auto" - a prep "mit" está certa, o caso está errado = DECLINAÇÃO

📕 SINTAXE ("sintaxe"):
   DEFINIÇÃO: Erro na ESTRUTURA, ORDEM das palavras, ou CONCORDÂNCIA na frase.
   A construção geral da frase está incorreta.

   EXEMPLOS:
   - "Ich gestern bin gegangen" → verbo não está em V2 = SINTAXE
   - "weil ich bin müde" → "weil ich müde bin" (ordem em subordinada)
   - "Ich kann nicht sprechen Deutsch" → ordem errada do objeto
   - "Er hat gearbeitet nicht" → posição do "nicht" errada
   - Concordância verbal errada na estrutura (não na conjugação do verbo)
   - Falta de elemento obrigatório na estrutura da frase

📒 CONJUGAÇÃO ("conjugacao"):
   DEFINIÇÃO: Erro na FORMA do verbo (pessoa, tempo, auxiliar).
   O verbo em si está conjugado incorretamente.

   EXEMPLOS:
   - "er haben" → "er hat" (pessoa errada)
   - "wir ist" → "wir sind" (conjugação errada)
   - "ich gehe gestern" → "ich ging" (tempo verbal errado)
   - "ich habe gegangen" → "ich bin gegangen" (auxiliar errado)
   - "er will geht" → "er will gehen" (modal + infinitivo)

═══════════════════════════════════════════════════════════════════════════════
                         REGRAS DE CLASSIFICAÇÃO
═══════════════════════════════════════════════════════════════════════════════

1. PRIMEIRO identifique o tipo de erro:
   - Palavra errada para o contexto? → VOCABULÁRIO
   - Caso gramatical errado (Nom/Akk/Dat/Gen)? → DECLINAÇÃO
   - Preposição errada/faltando? → PREPOSIÇÃO
   - Ordem/estrutura da frase errada? → SINTAXE
   - Forma do verbo errada? → CONJUGAÇÃO

2. Se houver DÚVIDA entre categorias:
   - Palavra semanticamente errada = VOCABULÁRIO
   - Caso após preposição errado = DECLINAÇÃO (não preposição!)
   - Verbo na posição errada = SINTAXE (não conjugação!)

═══════════════════════════════════════════════════════════════════════════════

FORMATO JSON:
[{"categoria":"declinacao|conjugacao|preposicoes|sintaxe|vocabulario","contexto":"frase completa","erro":"parte errada","correcao":"forma correta","explicacao":"explicação em português"}]

REGRAS:
- Máximo 5 erros
- Se não houver erros: []
- Seja PRECISO na classificação seguindo as definições acima`;
}

// Timeout reduzido para funcionar no Netlify
async function callDeepSeek(userContent, language = 'pt-BR', targetLanguage = 'de') {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 segundos

    const prompt = getAnalysisPrompt(language, targetLanguage);

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
        const { transcripts, fullAnalysis, language, targetLanguage } = body;

        if (fullAnalysis && Array.isArray(transcripts)) {
            const formatted = formatTranscripts(transcripts);
            console.log('Analisando:', formatted, 'Language:', language, 'TargetLanguage:', targetLanguage || 'de');

            if (!formatted || formatted.length < 10) {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ corrections: [], message: 'Muito curto' })
                };
            }

            const userContent = `Frases do aluno:\n${formatted}`;
            const rawResponse = await callDeepSeek(userContent, language, targetLanguage);
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
