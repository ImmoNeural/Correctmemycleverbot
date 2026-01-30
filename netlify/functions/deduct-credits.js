// Deduz créditos após conversa (Gemini Live) ou outras operações
// 10 créditos por minuto de conversa

const SUPABASE_URL = 'https://timqizyevfkvqgzvcrlx.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpbXFpenlldmZrdnFnenZjcmx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjAxOTAwNiwiZXhwIjoyMDYxNTk1MDA2fQ.mQcEtge5GlyTQHzJMlWO2oT42tiAG-KFl58o-39MEG0';

// Custo: 10 créditos por minuto de conversa
const CREDITS_PER_MINUTE = 10;

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
    if (!profile) return { success: false, error: 'Profile not found' };

    const currentCredits = parseFloat(profile.credits) || 0;
    const newCredits = Math.max(0, currentCredits - amount);

    await supabaseRequest(`/rest/v1/profiles?id=eq.${userId}`, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ credits: newCredits })
    });

    return {
        success: true,
        previousCredits: currentCredits,
        deducted: amount,
        newCredits: newCredits
    };
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
        const { userId, durationSeconds, type } = body;

        console.log('Deduct credits request:', { userId, durationSeconds, type });

        if (!userId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'userId is required' })
            };
        }

        if (!durationSeconds || durationSeconds <= 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'durationSeconds must be a positive number' })
            };
        }

        // Calcular créditos a deduzir
        const minutes = durationSeconds / 60;
        const creditsToDeduct = Math.ceil(minutes * CREDITS_PER_MINUTE); // Arredonda para cima

        console.log(`Conversation: ${minutes.toFixed(2)} min = ${creditsToDeduct} credits to deduct`);

        // Deduzir créditos
        const result = await deductCredits(userId, creditsToDeduct);

        if (!result.success) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: result.error })
            };
        }

        console.log(`Credits deducted: ${result.previousCredits} -> ${result.newCredits} (-${creditsToDeduct})`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: `${creditsToDeduct} créditos deduzidos`,
                durationMinutes: minutes.toFixed(2),
                creditsDeducted: creditsToDeduct,
                previousCredits: result.previousCredits,
                newCredits: result.newCredits,
                creditsPerMinute: CREDITS_PER_MINUTE
            })
        };

    } catch (error) {
        console.error('Deduct credits error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Internal server error',
                details: error.message
            })
        };
    }
};
