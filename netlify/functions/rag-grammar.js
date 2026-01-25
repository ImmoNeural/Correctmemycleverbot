// Webhook RAG Grammar - Busca explicações de tópicos gramaticais
// Usa DeepSeek para gerar explicações detalhadas de gramática alemã

const SUPABASE_URL = 'https://timqizyevfkvqgzvcrlx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpbXFpenlldmZrdnFnenZjcmx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwMTkwMDYsImV4cCI6MjA2MTU5NTAwNn0.LfWFCPPgzTkh7Scf2Q2LjLmYcLnaWSAGKDiMT8eSuWM';
const DEEPSEEK_API_KEY = 'sk-e080234eab8b442fb65fe8955d8947de';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// System prompt para o RAG Agent - professor de alemão experiente
const RAG_SYSTEM_PROMPT = `# Visão Geral
Você é um assistente RAG e professor de alemão experiente. Sua função é explicar tópicos gramaticais do alemão de forma clara e didática, sempre traduzindo para o português.

# Instruções
1. Explique o tópico gramatical de forma detalhada
2. Sempre forneça exemplos em alemão com tradução para português
3. Use uma linguagem acessível para estudantes brasileiros
4. Se houver exceções ou casos especiais, mencione-os
5. Organize a explicação em seções claras

# Formato da Resposta
- Use markdown para formatação
- Inclua exemplos práticos
- Destaque palavras importantes em **negrito**
- Use tabelas quando apropriado para conjugações ou declinações

# Regras
- Não invente informações
- Seja preciso e correto gramaticalmente
- Foque em ajudar o aluno a entender e memorizar o tópico
- Sempre traduza os exemplos do alemão para o português`;

// User prompt template
const RAG_USER_PROMPT = (assunto, contexto = '') => `Aja como um professor de alemão experiente. Explique o tópico gramatical "${assunto}" trazendo uma explicação detalhada traduzida para o português, com exemplos práticos.

${contexto ? `Contexto adicional do erro do aluno: ${contexto}` : ''}

Por favor, inclua:
1. Explicação clara do conceito
2. Regras principais
3. Exemplos em alemão com tradução
4. Exceções comuns (se houver)
5. Dicas para memorização`;

// Helper function to call DeepSeek API
async function callDeepSeek(systemPrompt, userPrompt, temperature = 0.5) {
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
                { role: 'user', content: userPrompt }
            ],
            temperature: temperature,
            max_tokens: 2000
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DeepSeek API error: ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
}

// Try to search in Supabase for related content (text search fallback)
async function searchSupabaseContent(query) {
    try {
        // Try full-text search on deutschbook table
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/deutschbook?content=ilike.*${encodeURIComponent(query)}*&select=content&limit=3`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'apikey': SUPABASE_ANON_KEY
                }
            }
        );

        if (response.ok) {
            const data = await response.json();
            if (data && data.length > 0) {
                return data.map(item => item.content).join('\n\n---\n\n');
            }
        }
    } catch (error) {
        console.log('Supabase text search not available, using DeepSeek knowledge');
    }
    return null;
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
        // Parse request body
        const body = JSON.parse(event.body);
        const { assunto, query, contexto, prompt_busca_rag } = body;

        // Accept either assunto or query
        const topic = assunto || query || prompt_busca_rag;

        if (!topic) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing assunto or query parameter' })
            };
        }

        console.log('RAG Grammar request for topic:', topic);

        // Try to get additional context from Supabase (if available)
        let supabaseContext = null;
        try {
            supabaseContext = await searchSupabaseContent(topic);
        } catch (e) {
            console.log('Could not fetch from Supabase, using DeepSeek only');
        }

        // Build the prompt with optional context
        let systemPrompt = RAG_SYSTEM_PROMPT;
        if (supabaseContext) {
            systemPrompt += `\n\n# Material de Referência (do banco de dados)\n${supabaseContext}`;
        }

        const userPrompt = RAG_USER_PROMPT(topic, contexto || '');

        // Call DeepSeek to generate the explanation
        const explanation = await callDeepSeek(systemPrompt, userPrompt);

        if (!explanation) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    error: 'Unable to generate explanation',
                    response: 'Não foi possível gerar a explicação. Por favor, tente novamente.'
                })
            };
        }

        console.log('Generated explanation for:', topic);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                assunto: topic,
                response: explanation,
                output: explanation // compatibilidade com formato n8n
            })
        };

    } catch (error) {
        console.error('RAG Grammar error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Internal server error',
                details: error.message,
                response: 'Unable to perform task. Please try again.'
            })
        };
    }
};
