// Função para parafrasear textos em alemão usando DeepSeek
// Suporta diferentes estilos: formal, educado, despojado, original, emojis, simples

const SUPABASE_URL = 'https://timqizyevfkvqgzvcrlx.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpbXFpenlldmZrdnFnenZjcmx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjAxOTAwNiwiZXhwIjoyMDYxNTk1MDA2fQ.mQcEtge5GlyTQHzJMlWO2oT42tiAG-KFl58o-39MEG0';
const DEEPSEEK_API_KEY = 'sk-e080234eab8b442fb65fe8955d8947de';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// Prompts para cada estilo de parafraseamento
const STYLE_PROMPTS = {
    formal: `Você é um especialista em reescrita de textos em alemão. Reescreva o texto fornecido em um estilo FORMAL e PROFISSIONAL.

Características do estilo formal:
- Use "Sie" em vez de "du"
- Vocabulário sofisticado e técnico quando apropriado
- Estruturas frasais mais elaboradas
- Tom respeitoso e distante
- Evite gírias e expressões coloquiais
- Use a voz passiva quando apropriado
- Mantenha um tom neutro e objetivo

Mantenha o significado original do texto. Responda APENAS com o texto parafraseado, sem explicações.`,

    educado: `Você é um especialista em reescrita de textos em alemão. Reescreva o texto fornecido em um estilo EDUCADO e CORTÊS.

Características do estilo educado:
- Tom gentil e respeitoso
- Use expressões de cortesia (bitte, danke, gerne, etc.)
- Frases bem construídas mas acessíveis
- Mostre consideração pelo interlocutor
- Pode usar "Sie" ou "du" conforme o contexto original
- Adicione expressões suavizadoras quando apropriado
- Mantenha um tom positivo e amigável

Mantenha o significado original do texto. Responda APENAS com o texto parafraseado, sem explicações.`,

    despojado: `Você é um especialista em reescrita de textos em alemão. Reescreva o texto fornecido em um estilo DESPOJADO e INFORMAL.

Características do estilo despojado:
- Use "du" em vez de "Sie"
- Tom casual e descontraído
- Frases mais curtas e diretas
- Pode usar algumas expressões coloquiais alemãs
- Estrutura mais relaxada
- Tom amigável e próximo
- Evite formalidades excessivas

Mantenha o significado original do texto. Responda APENAS com o texto parafraseado, sem explicações.`,

    original: `Você é um especialista em reescrita de textos em alemão. Reescreva o texto fornecido de forma CRIATIVA e ORIGINAL.

Características do estilo original:
- Use sinônimos interessantes e menos comuns
- Estruturas frasais criativas
- Mantenha o significado mas com uma abordagem única
- Pode usar metáforas ou comparações quando apropriado
- Tom expressivo e envolvente
- Vocabulário variado e rico
- Mostre personalidade no texto

Mantenha o significado original do texto. Responda APENAS com o texto parafraseado, sem explicações.`,

    emojis: `Você é um especialista em reescrita de textos em alemão. Reescreva o texto fornecido de forma DIVERTIDA e COM EMOJIS.

Características do estilo com emojis:
- Adicione emojis relevantes ao longo do texto
- Tom alegre e animado
- Mantenha o texto claro e legível
- Use emojis que complementem o significado
- Não exagere - 3-5 emojis bem posicionados são suficientes
- O texto deve continuar sendo em alemão correto
- Pode ser levemente informal

Mantenha o significado original do texto. Responda APENAS com o texto parafraseado, sem explicações.`,

    simples: `Você é um especialista em reescrita de textos em alemão. Reescreva o texto fornecido de forma SIMPLES e DIRETA.

Características do estilo simples:
- Frases curtas e claras
- Vocabulário básico e acessível (nível A2-B1)
- Estruturas gramaticais simples
- Evite orações subordinadas complexas
- Vá direto ao ponto
- Remova redundâncias
- Ideal para quem está aprendendo alemão

Mantenha o significado original do texto. Responda APENAS com o texto parafraseado, sem explicações.`
};

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
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Método não permitido' })
        };
    }

    try {
        const { text, style, user_id, email } = JSON.parse(event.body);

        // Validações
        if (!text || !text.trim()) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Texto é obrigatório' })
            };
        }

        if (!style || !STYLE_PROMPTS[style]) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Estilo inválido. Use: formal, educado, despojado, original, emojis, simples' })
            };
        }

        // Verificar créditos do usuário (opcional - pode ser ajustado)
        if (user_id) {
            const creditsCheck = await checkUserCredits(user_id);
            if (!creditsCheck.hasCredits) {
                return {
                    statusCode: 403,
                    headers,
                    body: JSON.stringify({ error: 'Créditos insuficientes. Por favor, adquira mais créditos.' })
                };
            }
        }

        // Chamar DeepSeek API
        const paraphrasedText = await callDeepSeekAPI(text, style);

        // Deduzir crédito (se aplicável)
        if (user_id) {
            await deductCredit(user_id);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                paraphrased: paraphrasedText,
                style: style,
                originalLength: text.length,
                paraphrasedLength: paraphrasedText.length
            })
        };

    } catch (error) {
        console.error('Erro ao parafrasear:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || 'Erro interno ao processar o texto' })
        };
    }
};

async function callDeepSeekAPI(text, style) {
    const systemPrompt = STYLE_PROMPTS[style];

    const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Reescreva o seguinte texto em alemão:\n\n${text}` }
            ],
            temperature: 0.7,
            max_tokens: 2000
        })
    });

    if (!response.ok) {
        const errorData = await response.text();
        console.error('Erro da API DeepSeek:', errorData);
        throw new Error('Erro ao comunicar com o serviço de IA');
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Resposta inválida do serviço de IA');
    }

    return data.choices[0].message.content.trim();
}

async function checkUserCredits(userId) {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=credits`, {
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
            }
        });

        const data = await response.json();

        if (data && data.length > 0) {
            return { hasCredits: data[0].credits > 0, credits: data[0].credits };
        }

        return { hasCredits: true, credits: 0 }; // Default para não bloquear se não encontrar
    } catch (error) {
        console.error('Erro ao verificar créditos:', error);
        return { hasCredits: true, credits: 0 }; // Não bloquear em caso de erro
    }
}

async function deductCredit(userId) {
    try {
        // Primeiro, obter créditos atuais
        const checkResponse = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=credits`, {
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
            }
        });

        const checkData = await checkResponse.json();

        if (checkData && checkData.length > 0 && checkData[0].credits > 0) {
            const newCredits = checkData[0].credits - 1;

            // Atualizar créditos
            await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ credits: newCredits })
            });

            console.log(`Crédito deduzido para usuário ${userId}. Novos créditos: ${newCredits}`);
        }
    } catch (error) {
        console.error('Erro ao deduzir crédito:', error);
        // Não lançar erro para não impedir a funcionalidade
    }
}
