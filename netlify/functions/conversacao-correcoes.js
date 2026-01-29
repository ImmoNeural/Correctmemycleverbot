// Análise de correções para conversação - usa DeepSeek para analisar erros em alemão
// Analisa toda a conversa no final, não em tempo real

const DEEPSEEK_API_KEY = 'sk-e080234eab8b442fb65fe8955d8947de';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// Prompt para análise completa da conversa com contexto
const FULL_ANALYSIS_PROMPT = `Du bist ein erfahrener Deutschlehrer, der die gesprochene Sprache eines Schülers analysiert.

AUFGABE: Analysiere alle Sätze des Schülers und finde grammatische Fehler. Für JEDEN Fehler musst du den VOLLSTÄNDIGEN SATZ (Kontext) angeben, in dem der Fehler vorkommt.

KATEGORIEN:
- "declinacao" (Deklination - Fälle, Artikel, Adjektivendungen)
- "conjugacao" (Konjugation - Verbformen, Zeiten)
- "preposicoes" (Präpositionen)
- "sintaxe" (Syntax - Wortstellung, Satzstruktur)
- "vocabulario" (Vokabular - falsche Wörter, Rechtschreibung)

FORMAT DER ANTWORT (NUR dieses JSON-Array, kein anderer Text):
[
  {
    "categoria": "declinacao|conjugacao|preposicoes|sintaxe|vocabulario",
    "contexto": "Der vollständige Satz, in dem der Fehler vorkommt",
    "erro": "das falsche Wort oder die falsche Phrase",
    "correcao": "die richtige Form",
    "explicacao": "Erklärung auf Portugiesisch (1-2 Sätze), warum es falsch ist und wie man es richtig macht"
  }
]

WICHTIGE REGELN:
- "contexto" MUSS immer den vollständigen Originalsatz des Schülers enthalten
- Wenn keine Fehler gefunden werden, antworte mit: []
- Maximal 10 Fehler analysieren (die wichtigsten)
- Erkläre auf Portugiesisch, klar und lehrreich
- Ignoriere kleine Aussprachefehler, konzentriere dich auf Grammatik
- Sei ermunternd in den Erklärungen`;

// Helper function to call DeepSeek API with longer timeout for full analysis
async function callDeepSeek(systemPrompt, userContent) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout

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
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userContent }
                ],
                temperature: 0.2,
                max_tokens: 2000
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`DeepSeek API error: ${errorText}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || '[]';
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Timeout: análise demorou mais que 25 segundos');
        }
        throw error;
    }
}

// Parse response and extract JSON array
function parseCorrections(rawResponse) {
    if (!rawResponse || typeof rawResponse !== 'string') {
        return [];
    }

    // Try to find JSON array in response
    const jsonMatch = rawResponse.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed)) {
                return parsed;
            }
        } catch (e) {
            console.error('Failed to parse JSON:', e);
        }
    }

    return [];
}

// Format transcripts into a readable conversation
function formatTranscripts(transcripts) {
    if (!Array.isArray(transcripts) || transcripts.length === 0) {
        return '';
    }

    return transcripts
        .filter(t => t.speaker === 'user') // Apenas frases do usuário
        .map((t, index) => `${index + 1}. "${t.text}"`)
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

        // Modo de análise completa (no final da conversa)
        if (fullAnalysis && Array.isArray(transcripts)) {
            console.log('=== RECEBIDO DO FRONTEND ===');
            console.log('Transcripts recebidos:', JSON.stringify(transcripts, null, 2));

            const formattedConversation = formatTranscripts(transcripts);
            console.log('Conversa formatada:', formattedConversation);

            if (!formattedConversation || formattedConversation.length < 10) {
                console.log('Conversa muito curta, retornando vazio');
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        corrections: [],
                        message: 'Conversa muito curta para análise'
                    })
                };
            }

            console.log('=== ANÁLISE COMPLETA DA CONVERSA ===');
            console.log(`Total de frases do usuário: ${transcripts.filter(t => t.speaker === 'user').length}`);

            const userContent = `Hier sind die Sätze des Schülers während des Gesprächs. Analysiere jeden Satz auf Fehler:\n\n${formattedConversation}`;
            console.log('Enviando para DeepSeek:', userContent);

            const rawResponse = await callDeepSeek(FULL_ANALYSIS_PROMPT, userContent);
            console.log('Resposta bruta DeepSeek:', rawResponse);

            const corrections = parseCorrections(rawResponse);
            console.log('Correções parseadas:', JSON.stringify(corrections, null, 2));

            console.log(`Encontrados ${corrections.length} erros na conversa`);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    corrections,
                    totalSentences: transcripts.filter(t => t.speaker === 'user').length,
                    totalErrors: corrections.length
                })
            };
        }

        // Modo legado (texto único) - mantido para compatibilidade
        const { text, speaker } = body;

        if (!text || text.trim().length < 3) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ corrections: [], message: 'Texto muito curto para análise' })
            };
        }

        console.log(`Analisando texto de ${speaker || 'user'}:`, text.substring(0, 100));

        const userContent = `Analysiere diesen Satz auf Fehler: "${text}"`;
        const rawResponse = await callDeepSeek(FULL_ANALYSIS_PROMPT, userContent);
        const corrections = parseCorrections(rawResponse);

        console.log(`Encontrados ${corrections.length} erros`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                corrections,
                analyzedText: text,
                speaker: speaker || 'user'
            })
        };

    } catch (error) {
        console.error('Erro na análise:', error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Erro na análise',
                details: error.message,
                corrections: []
            })
        };
    }
};
