// Correções em tempo real para conversação - usa DeepSeek para analisar erros em alemão
// Versão simplificada e rápida para uso durante conversas

const DEEPSEEK_API_KEY = 'sk-e080234eab8b442fb65fe8955d8947de';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// Prompt simplificado para análise rápida de erros em conversação
const CONVERSATION_CORRECTION_PROMPT = `Du bist ein Deutschlehrer, der Fehler in der gesprochenen Sprache analysiert.

AUFGABE: Analysiere den deutschen Text und finde grammatische Fehler. Antworte NUR mit einem JSON-Array.

KATEGORIEN (mit Farben für die Anzeige):
- "declinacao" (Deklination - Fälle, Artikel, Adjektivendungen) - Rosa #f472b6
- "conjugacao" (Konjugation - Verbformen, Zeiten) - Lila #c084fc
- "preposicoes" (Präpositionen) - Blau #60a5fa
- "sintaxe" (Syntax - Wortstellung, Satzstruktur) - Orange #fb923c
- "vocabulario" (Vokabular - falsche Wörter, Rechtschreibung) - Grün #4ade80

FORMAT DER ANTWORT (NUR dieses JSON-Array, kein anderer Text):
[
  {
    "categoria": "declinacao|conjugacao|preposicoes|sintaxe|vocabulario",
    "erro": "das falsche Wort/Phrase",
    "correcao": "die richtige Form",
    "explicacao": "kurze Erklärung auf Portugiesisch (1 Satz)"
  }
]

WICHTIG:
- Wenn keine Fehler gefunden werden, antworte mit: []
- Maximal 5 Fehler pro Analyse
- Erkläre auf Portugiesisch, kurz und klar
- Analysiere NUR den letzten Satz/die letzte Äußerung des Benutzers`;

// Helper function to call DeepSeek API with timeout
async function callDeepSeek(text) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

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
                    { role: 'system', content: CONVERSATION_CORRECTION_PROMPT },
                    { role: 'user', content: `Analysiere diesen Text auf Fehler: "${text}"` }
                ],
                temperature: 0.2,
                max_tokens: 1000
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
            throw new Error('Timeout: análise demorou mais que 15 segundos');
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
        const { text, speaker } = body;

        if (!text || text.trim().length < 3) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ corrections: [], message: 'Texto muito curto para análise' })
            };
        }

        console.log(`Analisando texto de ${speaker || 'user'}:`, text.substring(0, 100));

        // Call DeepSeek for correction analysis
        const rawResponse = await callDeepSeek(text);
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
