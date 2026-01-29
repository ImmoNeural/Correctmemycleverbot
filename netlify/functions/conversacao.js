// Gemini API - Conversação para prática de alemão
// Usa Gemini 2.5 Flash para texto, áudio é gerado no frontend com Web Speech API

const SUPABASE_URL = 'https://timqizyevfkvqgzvcrlx.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpbXFpenlldmZrdnFnenZjcmx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjAxOTAwNiwiZXhwIjoyMDYxNTk1MDA2fQ.mQcEtge5GlyTQHzJMlWO2oT42tiAG-KFl58o-39MEG0';

// A API key do Gemini será configurada como variável de ambiente
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// Custo: ~2.5 créditos por minuto de conversa
const CREDITS_PER_MINUTE = 2.5;
const MIN_CREDITS = 5;

// System instruction para o tutor de alemão
const GERMAN_TUTOR_INSTRUCTION = `Du bist ein freundlicher Deutschlehrer für brasilianische Schüler.

WICHTIGE REGELN:
1. Sprich IMMER auf Deutsch mit dem Schüler
2. Wenn der Schüler einen Fehler macht:
   - Korrigiere den Fehler sanft
   - Erkläre kurz auf Portugiesisch warum es falsch war
   - Fahre dann auf Deutsch fort
3. Passe dein Niveau an den Schüler an
4. Sei geduldig und ermutigend
5. Verwende einfache, klare Sätze
6. Stelle Fragen um das Gespräch fortzusetzen

Beispiel einer Korrektur:
Schüler: "Ich habe gestern ins Kino gegangen"
Du: "Fast richtig! Ich BIN gestern ins Kino gegangen. (Explicação: 'gehen' usa o auxiliar 'sein', não 'haben') Und welchen Film hast du gesehen?"`;

// Helper function for Supabase requests
async function supabaseRequest(endpoint, options = {}) {
    const url = `${SUPABASE_URL}${endpoint}`;
    const headers = {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
        ...options.headers
    };
    return await fetch(url, { ...options, headers });
}

// Get user profile
async function getUserProfile(userId) {
    const response = await supabaseRequest(`/rest/v1/profiles?id=eq.${userId}&select=*`);
    const data = await response.json();
    return data[0] || null;
}

// Deduct credits
async function deductCredits(userId, amount) {
    const profile = await getUserProfile(userId);
    if (!profile) return false;

    const newCredits = Math.max(0, parseFloat(profile.credits) - amount);

    await supabaseRequest(`/rest/v1/profiles?id=eq.${userId}`, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ credits: newCredits })
    });

    return true;
}

// Call Gemini API with audio input (transcribes and responds)
async function callGeminiWithAudio(audioBase64, mimeType, conversationHistory) {
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not configured');
    }

    const url = `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`;

    // Build the request with conversation history
    const contents = [];

    // Add conversation history
    if (conversationHistory && conversationHistory.length > 0) {
        for (const msg of conversationHistory) {
            contents.push({
                role: msg.role,
                parts: [{ text: msg.text }]
            });
        }
    }

    // Add current audio input
    contents.push({
        role: 'user',
        parts: [{
            inlineData: {
                mimeType: mimeType || 'audio/webm',
                data: audioBase64
            }
        }]
    });

    const requestBody = {
        contents: contents,
        systemInstruction: {
            parts: [{ text: GERMAN_TUTOR_INSTRUCTION }]
        },
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024
        }
    };

    console.log('Calling Gemini API with audio...');

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API error:', errorText);
        throw new Error(parseGeminiError(response.status, errorText));
    }

    const data = await response.json();
    console.log('Gemini response received');

    return data;
}

// Call Gemini API with text only
async function callGeminiWithText(text, conversationHistory) {
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not configured');
    }

    const url = `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`;

    const contents = [];

    // Add conversation history
    if (conversationHistory && conversationHistory.length > 0) {
        for (const msg of conversationHistory) {
            contents.push({
                role: msg.role,
                parts: [{ text: msg.text }]
            });
        }
    }

    // Add current text input
    contents.push({
        role: 'user',
        parts: [{ text: text }]
    });

    const requestBody = {
        contents: contents,
        systemInstruction: {
            parts: [{ text: GERMAN_TUTOR_INSTRUCTION }]
        },
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024
        }
    };

    console.log('Calling Gemini API with text...');

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API error:', errorText);
        throw new Error(parseGeminiError(response.status, errorText));
    }

    return await response.json();
}

// Parse Gemini API errors into user-friendly messages
function parseGeminiError(status, errorText) {
    let errorMessage = `Gemini API error: ${status}`;
    try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error) {
            const errMsg = errorJson.error.message || '';
            if (status === 403) {
                if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('invalid')) {
                    errorMessage = 'Chave da API Gemini inválida. Verifique a configuração.';
                } else if (errMsg.includes('PERMISSION_DENIED')) {
                    errorMessage = 'Acesso negado. Verifique se a API Generative Language está habilitada no Google Cloud Console.';
                } else if (errMsg.includes('billing') || errMsg.includes('Billing')) {
                    errorMessage = 'Faturamento não configurado ou conta suspensa no Google Cloud.';
                } else {
                    errorMessage = 'Permissão negada: ' + errMsg;
                }
            } else if (status === 400) {
                errorMessage = 'Requisição inválida: ' + errMsg;
            } else if (status === 404) {
                errorMessage = 'Modelo não encontrado. Verifique se o modelo está disponível.';
            } else if (status === 429) {
                errorMessage = 'Limite de requisições excedido. Aguarde um momento e tente novamente.';
            } else if (status === 500 || status === 503) {
                errorMessage = 'Servidor do Gemini temporariamente indisponível. Tente novamente.';
            } else {
                errorMessage = errMsg || errorText;
            }
        }
    } catch (e) {
        errorMessage = errorText;
    }
    return errorMessage;
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
        const {
            action,           // 'start', 'message', 'end'
            userId,
            audioBase64,      // Base64 encoded audio
            mimeType,         // Audio MIME type (audio/webm, audio/wav, etc)
            text,             // Text message (alternative to audio)
            conversationHistory, // Previous messages for context
            durationSeconds   // Duration for credit calculation
        } = body;

        console.log('Conversacao request:', { action, userId, hasAudio: !!audioBase64, hasText: !!text });

        // Check API key
        if (!GEMINI_API_KEY) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    error: 'API not configured',
                    message: 'A chave da API Gemini não está configurada. Por favor, configure GEMINI_API_KEY nas variáveis de ambiente do Netlify.'
                })
            };
        }

        // Verify user and credits
        if (userId) {
            const profile = await getUserProfile(userId);

            if (!profile) {
                return {
                    statusCode: 402,
                    headers,
                    body: JSON.stringify({
                        error: 'Profile not found',
                        message: 'Perfil não encontrado. Por favor, faça login novamente.'
                    })
                };
            }

            const credits = parseFloat(profile.credits) || 0;

            if (credits < MIN_CREDITS) {
                return {
                    statusCode: 402,
                    headers,
                    body: JSON.stringify({
                        error: 'Insufficient credits',
                        message: `Você tem ${credits.toFixed(1)} créditos, mas precisa de pelo menos ${MIN_CREDITS}. Por favor, adquira mais créditos.`,
                        credits: credits
                    })
                };
            }
        }

        // Handle different actions
        if (action === 'start') {
            // Start a new conversation session
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Sessão iniciada. Pode começar a conversar!',
                    sessionStarted: true
                })
            };
        }

        if (action === 'message') {
            let geminiResponse;

            if (audioBase64) {
                // Process audio input
                geminiResponse = await callGeminiWithAudio(audioBase64, mimeType, conversationHistory);
            } else if (text) {
                // Process text input
                geminiResponse = await callGeminiWithText(text, conversationHistory);
            } else {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'No audio or text provided' })
                };
            }

            // Extract response text
            const candidate = geminiResponse.candidates?.[0];
            const parts = candidate?.content?.parts || [];

            let responseText = '';
            for (const part of parts) {
                if (part.text) {
                    responseText = part.text;
                }
            }

            // Deduct credits based on duration
            if (userId && durationSeconds) {
                const minutes = durationSeconds / 60;
                const creditsToDeduct = minutes * CREDITS_PER_MINUTE;
                await deductCredits(userId, creditsToDeduct);
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    text: responseText,
                    tokensUsed: geminiResponse.usageMetadata
                })
            };
        }

        if (action === 'end') {
            // End conversation - deduct remaining credits
            if (userId && durationSeconds) {
                const minutes = durationSeconds / 60;
                const creditsToDeduct = minutes * CREDITS_PER_MINUTE;
                await deductCredits(userId, creditsToDeduct);
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Sessão encerrada.',
                    creditsDeducted: durationSeconds ? (durationSeconds / 60 * CREDITS_PER_MINUTE).toFixed(2) : 0
                })
            };
        }

        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid action' })
        };

    } catch (error) {
        console.error('Conversacao error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message
            })
        };
    }
};
