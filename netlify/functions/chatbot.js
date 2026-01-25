// Webhook Chatbot - Integra RAG para explicações de gramática
// Usa DeepSeek para gerar respostas e explicações

const SUPABASE_URL = 'https://timqizyevfkvqgzvcrlx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpbXFpenlldmZrdnFnenZjcmx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwMTkwMDYsImV4cCI6MjA2MTU5NTAwNn0.LfWFCPPgzTkh7Scf2Q2LjLmYcLnaWSAGKDiMT8eSuWM';
const DEEPSEEK_API_KEY = 'sk-e080234eab8b442fb65fe8955d8947de';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// Níveis de gramática que indicam que é uma solicitação de estudo de gramática
const GRAMMAR_LEVELS = ['Iniciante (A1/A2)', 'Intermediário (B1/B2)', 'Avançado (C1/C2)'];

// System prompt para RAG de gramática
const RAG_GRAMMAR_SYSTEM_PROMPT = `# Visão Geral
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

// System prompt para treino de escrita
const WRITING_SYSTEM_PROMPT = `# Visão Geral
Você é um professor de alemão experiente e amigável. Sua função é ajudar o aluno a praticar escrita em alemão.

# Instruções
1. Dê um tema ou situação para o aluno escrever sobre
2. Forneça vocabulário útil relacionado ao tema
3. Dê exemplos de frases que podem ser usadas
4. Seja encorajador e motivador

# Formato da Resposta
- Use markdown para formatação
- Inclua vocabulário útil com traduções
- Dê exemplos de frases
- Sugira uma estrutura para o texto

# Regras
- Adapte a dificuldade ao nível do aluno
- Seja positivo e encorajador
- Foque em temas práticos e úteis`;

// System prompt para conversação geral
const GENERAL_SYSTEM_PROMPT = `# Visão Geral
Você é um assistente de aprendizado de alemão. Você ajuda estudantes brasileiros a aprender alemão de forma interativa e divertida.

# Instruções
1. Responda de forma clara e didática
2. Use exemplos quando possível
3. Seja amigável e encorajador
4. Adapte-se ao nível do aluno

# Formato
- Use markdown quando apropriado
- Inclua traduções do alemão para português
- Seja conciso mas completo`;

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
            max_tokens: 2500
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DeepSeek API error: ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
}

// Try to search in Supabase for related grammar content
async function searchSupabaseContent(query) {
    try {
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
        console.log('Supabase search not available');
    }
    return null;
}

// Determine if this is a grammar study request
function isGrammarRequest(workflow) {
    return GRAMMAR_LEVELS.includes(workflow);
}

// Determine if this is a writing practice request
function isWritingRequest(workflow) {
    return workflow === 'escrita';
}

// Handle grammar topic explanation (RAG)
async function handleGrammarRequest(message, workflow) {
    console.log('Handling grammar request:', message);

    // Try to get context from Supabase
    let supabaseContext = null;
    try {
        supabaseContext = await searchSupabaseContent(message);
    } catch (e) {
        console.log('Could not fetch from Supabase');
    }

    let systemPrompt = RAG_GRAMMAR_SYSTEM_PROMPT;
    if (supabaseContext) {
        systemPrompt += `\n\n# Material de Referência (do banco de dados)\nUse este material como base para sua explicação:\n${supabaseContext}`;
    }

    const userPrompt = `Aja como um professor de alemão experiente. Explique o tópico gramatical "${message}" para um aluno de nível ${workflow}.

Por favor, inclua:
1. Explicação clara do conceito
2. Regras principais
3. Exemplos em alemão com tradução para português
4. Exceções comuns (se houver)
5. Dicas para memorização

Nível do aluno: ${workflow}`;

    const response = await callDeepSeek(systemPrompt, userPrompt, 0.4);
    return response;
}

// Handle writing practice request
async function handleWritingRequest(message, tema) {
    console.log('Handling writing request:', message, tema);

    const userPrompt = `O aluno quer praticar escrita sobre o tema: "${message}"

Por favor:
1. Apresente o tema de forma interessante
2. Forneça vocabulário útil em alemão (com tradução)
3. Dê exemplos de frases que o aluno pode usar
4. Sugira uma estrutura para o texto
5. Incentive o aluno a escrever

Seja amigável e motivador!`;

    const response = await callDeepSeek(WRITING_SYSTEM_PROMPT, userPrompt, 0.6);
    return response;
}

// Handle general conversation/question
async function handleGeneralRequest(message) {
    console.log('Handling general request:', message);

    const userPrompt = message;
    const response = await callDeepSeek(GENERAL_SYSTEM_PROMPT, userPrompt, 0.5);
    return response;
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
        const { message, workflow, tema, thread, userId } = body;

        if (!message) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing message parameter' })
            };
        }

        console.log('Chatbot request:', { message, workflow, tema });

        let output = '';

        // Route to appropriate handler based on workflow
        if (isGrammarRequest(workflow)) {
            // Grammar study - use RAG
            output = await handleGrammarRequest(message, workflow);
        } else if (isWritingRequest(workflow)) {
            // Writing practice
            output = await handleWritingRequest(message, tema);
        } else {
            // General conversation
            output = await handleGeneralRequest(message);
        }

        if (!output) {
            output = 'Desculpe, não consegui processar sua solicitação. Por favor, tente novamente.';
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                output: output,
                thread: thread
            })
        };

    } catch (error) {
        console.error('Chatbot error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Internal server error',
                details: error.message,
                output: 'Ocorreu um erro. Por favor, tente novamente.'
            })
        };
    }
};
