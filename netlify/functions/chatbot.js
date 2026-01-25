// Webhook Chatbot Gramática - Replica o fluxo completo do n8n
// Usa DeepSeek para classificação de tópicos, RAG e conversação

const SUPABASE_URL = 'https://timqizyevfkvqgzvcrlx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpbXFpenlldmZrdnFnenZjcmx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwMTkwMDYsImV4cCI6MjA2MTU5NTAwNn0.LfWFCPPgzTkh7Scf2Q2LjLmYcLnaWSAGKDiMT8eSuWM';
const DEEPSEEK_API_KEY = 'sk-e080234eab8b442fb65fe8955d8947de';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// Custos em créditos
const GRAMMAR_COST = 5;
const WRITING_COST = 25;
const MIN_CREDITS = 10;

// Tabela oficial de tópicos gramaticais
const GRAMMAR_TOPICS_TABLE = `
1. Das Alphabet (ä, ö, ü, ß)
2. Geschlecht (Genus)
3. Nomen Deklination
4. Verben
5. Präpositionen
6. Personalpronomen
7. Konjugation von Verben
8. Die Verben „haben" und „sein"
9. Trennbare und nicht trennbare Verben
10. Verbklammer
11. Modalverben
12. Infinitiv ohne „zu"
13. Reflexive Verben
14. Reziproke Verben
15. Präsens (Gegenwart)
16. Perfekt (Vergangenheit)
17. Partizip II
18. „Sein" und „haben" im Perfekt und Präteritum
19. Modalverben im Perfekt und Präteritum
20. Futur I (Zukunft)
21. Syntax
22. Konjunktionen
23. Subjunktionen
24. Konjunktionaladverbien
25. Relativsatz
26. Infinitivsatz (Infinitiv mit „zu")
27. Satzglieder
28. Die Satzbauregel
29. Satzbautendenzen
30. Verneinung
31. Adjektivdeklination
32. Steigerung von Adjektiven
33. Komparation
34. Substantivierung von Adjektiven
35. Präteritum
36. Plusquamperfekt
37. Futur II
38. Zeiten Übersicht
39. Passiv
40. Konjunktiv I
41. Konjunktiv II
42. Zeitformen des Konjunktivs
43. Weitere zentrale Grammatikthemen
44. Imperativ
45. Direkte und indirekte Rede
46. Indefinitpronomen
47. Interrogativpronomen
48. Demonstrativpronomen
49. Erläuterung zu den Partikeln
50. Modalpartikeln
51. Das Indefinitpronomen „man"
52. Das unpersönliche „es"
53. Kardinalzahlen
54. Ordinalzahlen
55. Iterativzahlen
56. Multiplikativzahlen
57. Bruchzahlen
58. Sammelzahlwörter
59. Gattungszahlen
60. Unbestimmte Zahlwörter
61. Weiterführende Syntax und stilistische Aspekte
62. Komposita
63. Satzarten
64. Verlaufsform (Progressivität)
65. Weiterführende Erläuterungen
66. Häufige Fehler
67. Nullartikel
68. „Viel" und „wenig"
`;

// System prompt para classificação de tópico gramatical
const TOPIC_CLASSIFIER_SYSTEM_PROMPT = `Você é um assistente de IA focado em classificação e enriquecimento de dados para um sistema de aprendizado de alemão. Sua única função é preparar a consulta do usuário para um próximo agente.

**Processo:**
1. Você receberá uma entrada do usuário contendo um tópico gramatical e um nível de proficiência.
2. Sua tarefa é analisar o tópico e encontrar a correspondência exata na "Tabela Oficial de Tópicos" abaixo.
3. Após identificar o tópico, você deve gerar uma frase em **alemão** que inclua o nome do tópico e 2-3 palavras-chave relevantes (como "Regeln", "Verwendung", "Beispiele"). Esta frase servirá como uma consulta otimizada para uma busca semântica posterior.

**Regras Críticas:**
- **NÃO EXPLIQUE A GRAMÁTICA.** Sua única saída é a estrutura de dados definida abaixo.
- Sua resposta deve ser exclusivamente a estrutura de dados no formato especificado.
- A \`mensagemParaRAG\` deve ser inteiramente em **alemão**.

**Formato de Saída Obrigatório:**
Sua resposta deve ser um objeto JSON contendo as seguintes chaves:
{
  "numeroTopico": "[Número do Tópico]",
  "nomeTopico": "[Nome do Tópico em Alemão]",
  "nivelAluno": "[Nível do aluno]",
  "mensagemParaRAG": "[Frase em alemão com o tópico e palavras-chave.]"
}

Tabela Oficial de Tópicos:
${GRAMMAR_TOPICS_TABLE}`;

// System prompt para o RAG Agent de gramática
const RAG_AGENT_SYSTEM_PROMPT = `Você é o "CorrectMe", um professor de alemão especialista em gramática, amigável e pedagógico, que ajuda estudantes brasileiros a aprender alemão.

**Processo:**
1. Você receberá um objeto JSON contendo um tópico gramatical já identificado e uma mensagem otimizada para busca.
2. Use esse contexto para formular uma explicação clara, detalhada e didática sobre o tópico gramatical.

**Regras de Comportamento:**
- Use exemplos práticos para ilustrar a explicação.
- Mantenha um tom amigável e encorajador.
- A sua resposta deve ser exclusivamente em português do Brasil.

**Formato de Saída:**
- A sua resposta deve ser um texto formatado em Markdown para fácil leitura.
- Comece a resposta com o título do tópico em alemão e português: Exemplo: \`### **Modalverben (Verbos Modais)**\`
- Não mencione a ferramenta RAG ou o processo de busca. Apenas apresente a explicação final.
- Inclua exemplos em alemão com tradução para português.`;

// System prompt para conversação em alemão (escrita)
const CONVERSATION_SYSTEM_PROMPT = `Sua diretiva principal é atuar como um tutor de conversação em alemão chamado "CorrectMe", mantendo um diálogo contínuo e coerente sobre um tópico pré-definido. Você deve conversar somente em alemão. Somente quando for fazer alguma explicação da correção do erro do aluno você deve fazer em português do Brasil.

Não se desvie do tópico mesmo que o aluno insista em falar de um outro assunto que não tenha nenhuma conexão com o tópico escolhido.

**Persona:**
- Você é amigável, paciente e encorajador.
- Seu objetivo é ajudar estudantes brasileiros a praticar a conversação em alemão.

**Processo de Conversa:**
1. **Início:** Se for a primeira mensagem sobre o tópico, inicie a conversa com uma pergunta aberta em alemão sobre esse tópico.
2. **Continuação:** Responda à última mensagem do aluno, faça perguntas e mantenha a conversa fluindo naturalmente.
3. **Correção Detalhada de Erros:** Sua principal tarefa é identificar e corrigir **qualquer tipo de erro**, prestando atenção especial a:
   - **Casos (Fälle):** Erros de acusativo (Akkusativ), dativo (Dativ), etc.
   - **Capitalização (Groß- und Kleinschreibung):** Substantivos devem sempre começar com letra maiúscula.
   - **Conjugação Verbal (Konjugation):** Terminações de verbos incorretas.
   - **Ordem das Palavras (Wortstellung):** Posição do verbo, especialmente em orações subordinadas.
   - **Vocabulário (Wortschatz):** Uso de palavras incorretas.

   Quando encontrar um erro, corrija-o de forma gentil. **Primeiro, mostre a frase correta em alemão** e, em seguida, **explique o erro brevemente em português**. E na mesma frase continue com a conversa naturalmente sobre o tópico, mas em alemão.

**Regras de Interação:**
- **Idioma Principal:** A maior parte da conversa DEVE ser em **alemão**.
- **Idioma das Correções:** As explicações dos erros DEVEM ser em **português**.
- **Persistência:** Mantenha a conversa focada no **Tópico Geral da Conversa** fornecido.`;

// Helper function to call DeepSeek API
async function callDeepSeek(systemPrompt, userPrompt, temperature = 0.5) {
    const body = {
        model: 'deepseek-chat',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: temperature,
        max_tokens: 2500
    };

    // Note: DeepSeek may not support response_format, so we rely on prompt instructions for JSON

    const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DeepSeek API error: ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
}

// Helper function for Supabase requests
async function supabaseRequest(endpoint, options = {}) {
    const url = `${SUPABASE_URL}${endpoint}`;
    const headers = {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        ...options.headers
    };
    return await fetch(url, { ...options, headers });
}

// Get user ID from email
async function getUserIdByEmail(email) {
    const response = await supabaseRequest('/rest/v1/rpc/get_user_id_by_email', {
        method: 'POST',
        body: JSON.stringify({ user_email: email })
    });
    const text = await response.text();
    console.log('getUserIdByEmail response:', text);
    try {
        const parsed = JSON.parse(text);
        const userId = typeof parsed === 'string' ? parsed : parsed.data || parsed;
        console.log('Parsed userId:', userId);
        return userId;
    } catch (e) {
        const userId = text.replace(/"/g, '');
        console.log('Fallback userId:', userId);
        return userId;
    }
}

// Get user profile (for credits check)
async function getUserProfile(userId) {
    console.log('Getting profile for userId:', userId);

    // Try with 'id' first
    let response = await supabaseRequest(`/rest/v1/profiles?id=eq.${userId}&select=*`);
    let data = await response.json();
    console.log('Profile query by id result:', JSON.stringify(data));

    if (data && data.length > 0) {
        return data[0];
    }

    // Try with 'user_id' if 'id' didn't work
    response = await supabaseRequest(`/rest/v1/profiles?user_id=eq.${userId}&select=*`);
    data = await response.json();
    console.log('Profile query by user_id result:', JSON.stringify(data));

    return data[0] || null;
}

// Deduct credits from user
async function deductCredits(userId, amount) {
    // First get current credits
    const profile = await getUserProfile(userId);
    if (!profile) return false;

    const newCredits = parseInt(profile.credits) - amount;

    await supabaseRequest(`/rest/v1/profiles?id=eq.${userId}`, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ credits: newCredits })
    });

    return true;
}

// Try to search in Supabase for related grammar content
async function searchSupabaseContent(query) {
    try {
        const response = await supabaseRequest(
            `/rest/v1/deutschbook?content=ilike.*${encodeURIComponent(query)}*&select=content&limit=3`
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

// Determine workflow type
function getWorkflowType(workflow) {
    const lowerWorkflow = (workflow || '').toLowerCase();
    if (lowerWorkflow === 'escrita') return 'escrita';
    if (lowerWorkflow.includes('iniciante') || lowerWorkflow.includes('a1') || lowerWorkflow.includes('a2')) return 'iniciante';
    if (lowerWorkflow.includes('intermediario') || lowerWorkflow.includes('intermediário') || lowerWorkflow.includes('b1') || lowerWorkflow.includes('b2')) return 'intermediario';
    if (lowerWorkflow.includes('avancado') || lowerWorkflow.includes('avançado') || lowerWorkflow.includes('c1') || lowerWorkflow.includes('c2')) return 'avancado';
    return 'general';
}

// Step 1: Classify the grammar topic
async function classifyGrammarTopic(message, workflow) {
    const userPrompt = `O aluno, que está no nível de proficiência **${workflow}**, selecionou o seguinte tópico para estudar: **"${message}"**.

Siga suas instruções, identifique o tópico na tabela e gere a saída no formato JSON obrigatório.`;

    const response = await callDeepSeek(TOPIC_CLASSIFIER_SYSTEM_PROMPT, userPrompt, 0.3);

    try {
        // Try to parse JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return JSON.parse(response);
    } catch (e) {
        console.error('Error parsing topic classification:', e);
        return {
            numeroTopico: '0',
            nomeTopico: message,
            nivelAluno: workflow,
            mensagemParaRAG: `Deutsche Grammatik: ${message} Erklärung und Beispiele.`
        };
    }
}

// Step 2: Generate grammar explanation using RAG
async function generateGrammarExplanation(topicInfo) {
    // Try to get context from Supabase
    let supabaseContext = null;
    try {
        supabaseContext = await searchSupabaseContent(topicInfo.mensagemParaRAG);
    } catch (e) {
        console.log('Could not fetch from Supabase');
    }

    let systemPrompt = RAG_AGENT_SYSTEM_PROMPT;
    if (supabaseContext) {
        systemPrompt += `\n\n# Material de Referência (do banco de dados)\nUse este material como base para sua explicação:\n${supabaseContext}`;
    }

    const userPrompt = `Use a seguinte informação para fornecer uma explicação completa sobre o tópico gramatical para o aluno.

**Tópico:** ${topicInfo.nomeTopico}
**Número:** ${topicInfo.numeroTopico}
**Nível do Aluno:** ${topicInfo.nivelAluno}
**Mensagem para Busca:** ${topicInfo.mensagemParaRAG}

Formule sua resposta final diretamente para o aluno, seguindo todas as suas regras de formatação e comportamento. Em hipótese alguma coloque a numeração do capítulo do tópico da gramática.`;

    return await callDeepSeek(systemPrompt, userPrompt, 0.4);
}

// Handle grammar study (iniciante, intermediario, avancado)
async function handleGrammarRequest(message, workflow) {
    console.log('Handling grammar request:', message, workflow);

    // Step 1: Classify the topic
    const topicInfo = await classifyGrammarTopic(message, workflow);
    console.log('Topic classified:', topicInfo);

    // Step 2: Generate explanation
    const explanation = await generateGrammarExplanation(topicInfo);
    return explanation;
}

// Handle writing practice (escrita)
async function handleWritingRequest(message, tema, sessionId) {
    console.log('Handling writing request:', message, tema);

    const userPrompt = `**Tópico Geral da Conversa (NÃO MUDAR):** \`${tema || message}\`
**Última Mensagem do Aluno (RESPONDER A ESTA):** \`${message}\`

Sua tarefa é continuar a conversa sobre o **Tópico Geral**. Responda diretamente à **Última Mensagem do Aluno**. Siga todas as suas regras de persona e formatação de saída.`;

    const response = await callDeepSeek(CONVERSATION_SYSTEM_PROMPT, userPrompt, 0.6);

    // Try to parse JSON output if present
    try {
        const jsonMatch = response.match(/\{[\s\S]*"output"[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return parsed.output || response;
        }
    } catch (e) {
        // Not JSON, return as is
    }

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
        const { message, workflow, tema, thread, sessionId, email, userId } = body;

        if (!message) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing message parameter' })
            };
        }

        console.log('Chatbot request:', { message, workflow, tema, email });

        // Get user ID if email is provided
        let userIdResolved = userId;
        if (!userIdResolved && email) {
            userIdResolved = await getUserIdByEmail(email);
        }

        // Check credits if we have a user
        if (userIdResolved) {
            const profile = await getUserProfile(userIdResolved);

            if (!profile || parseInt(profile.credits) < MIN_CREDITS) {
                return {
                    statusCode: 402,
                    headers,
                    body: JSON.stringify({
                        error: 'Sem crédito suficiente',
                        output: 'Você não tem créditos suficientes para usar o chatbot. Por favor, adquira mais créditos.',
                        credito: 'Sem crédito suficiente.'
                    })
                };
            }

            // Determine cost and deduct credits
            const workflowType = getWorkflowType(workflow);
            const cost = workflowType === 'escrita' ? WRITING_COST : GRAMMAR_COST;

            // Deduct credits in background
            deductCredits(userIdResolved, cost).catch(err =>
                console.error('Error deducting credits:', err)
            );
        }

        // Determine workflow type and handle accordingly
        const workflowType = getWorkflowType(workflow);
        let output = '';

        if (workflowType === 'escrita') {
            // Writing practice - conversation mode
            output = await handleWritingRequest(message, tema, sessionId);
        } else if (['iniciante', 'intermediario', 'avancado'].includes(workflowType)) {
            // Grammar study - classification + RAG
            output = await handleGrammarRequest(message, workflow);
        } else {
            // General - treat as grammar
            output = await handleGrammarRequest(message, workflow || 'Iniciante (A1/A2)');
        }

        if (!output) {
            output = 'Desculpe, não consegui processar sua solicitação. Por favor, tente novamente.';
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                output: output,
                thread: thread,
                sessionId: sessionId
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
