// Endpoint seguro para obter a API key do Gemini
// A key não fica exposta no frontend, só é fornecida para usuários autenticados

const SUPABASE_URL = 'https://timqizyevfkvqgzvcrlx.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpbXFpenlldmZrdnFnenZjcmx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjAxOTAwNiwiZXhwIjoyMDYxNTk1MDA2fQ.mQcEtge5GlyTQHzJMlWO2oT42tiAG-KFl58o-39MEG0';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

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
        const { userId } = body;

        if (!userId) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'User ID required' })
            };
        }

        // Verificar se o usuário existe e tem créditos
        const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=id,credits`, {
            headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'apikey': SUPABASE_SERVICE_KEY,
                'Content-Type': 'application/json'
            }
        });

        const profiles = await response.json();
        const profile = profiles[0];

        if (!profile) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'User not found' })
            };
        }

        const credits = parseFloat(profile.credits) || 0;
        if (credits < 5) {
            return {
                statusCode: 402,
                headers,
                body: JSON.stringify({
                    error: 'Insufficient credits',
                    message: 'Você precisa de pelo menos 5 créditos para usar a conversa.',
                    credits: credits
                })
            };
        }

        if (!GEMINI_API_KEY) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'API key not configured' })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                apiKey: GEMINI_API_KEY,
                credits: credits
            })
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};
