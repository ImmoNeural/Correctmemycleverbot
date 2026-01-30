// Cria sessão de checkout do Stripe para compra de créditos
// Requer STRIPE_SECRET_KEY nas variáveis de ambiente do Netlify

const Stripe = require('stripe');

// Mapeamento de price IDs para quantidade de créditos
const PRICE_CREDITS_MAP = {
    'price_1RusAKCYJo68kcPWjlHcTBSC': 500,
    'price_1RusCBCYJo68kcPWGnvYB6f8': 1000,
    'price_1RusDPCYJo68kcPWTlp9t9hz': 1500
};

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    // Verificar se a chave do Stripe está configurada
    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
    if (!STRIPE_SECRET_KEY) {
        console.error('STRIPE_SECRET_KEY não configurada');
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Stripe não configurado. Contate o administrador.' })
        };
    }

    try {
        const body = JSON.parse(event.body);
        const { priceId, userId, userEmail } = body;

        console.log('Recebido:', { priceId, userId, userEmail });

        if (!priceId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Price ID é obrigatório' })
            };
        }

        // Verificar se o price ID é válido
        const credits = PRICE_CREDITS_MAP[priceId];
        if (!credits) {
            console.error('Price ID não encontrado no mapa:', priceId);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Price ID inválido' })
            };
        }

        // Inicializar Stripe
        const stripe = new Stripe(STRIPE_SECRET_KEY, {
            apiVersion: '2023-10-16'
        });

        // URL base para redirecionamento
        const baseUrl = event.headers.origin || event.headers.referer?.replace(/\/[^/]*$/, '') || 'https://correctme.club';
        console.log('Base URL:', baseUrl);

        // Criar sessão de checkout
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${baseUrl}/dashboard-new.html?payment=success&credits=${credits}`,
            cancel_url: `${baseUrl}/dashboard-new.html?payment=cancelled`,
            metadata: {
                userId: userId || 'unknown',
                credits: credits.toString()
            },
            customer_email: userEmail || undefined
        });

        console.log('Checkout session criada:', session.id);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                sessionId: session.id,
                url: session.url
            })
        };

    } catch (error) {
        console.error('Erro ao criar checkout session:', error.message);
        console.error('Stack:', error.stack);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Erro ao criar sessão de pagamento',
                details: error.message
            })
        };
    }
};
