// Webhook TrataErro - Substitui o n8n webhook
// Analisa erros gramaticais em textos alemães usando DeepSeek

const SUPABASE_URL = 'https://timqizyevfkvqgzvcrlx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpbXFpenlldmZrdnFnenZjcmx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwMTkwMDYsImV4cCI6MjA2MTU5NTAwNn0.LfWFCPPgzTkh7Scf2Q2LjLmYcLnaWSAGKDiMT8eSuWM';
const DEEPSEEK_API_KEY = 'sk-e080234eab8b442fb65fe8955d8947de';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// Prompt para limpar o texto (remover caracteres especiais)
const CLEAN_TEXT_SYSTEM_PROMPT = `Você é uma ferramenta de pré-processamento de texto. Sua única função é limpar o texto fornecido, removendo caracteres específicos.

**REGRA FUNDAMENTAL:**
Sua única e exclusiva saída deve ser o texto limpo. NÃO adicione nenhuma palavra, saudação, explicação ou qualquer outro texto antes ou depois do texto limpo.

**Processo Obrigatório:**
1. Receba o texto da redação.
2. Remova todos os seguintes caracteres do texto: colchetes ( [ e ] ), parênteses ( ( e ) ) e chaves ( { e } ).
3. Substitua todas as quebras de linha (\\n, \\r, \\r\\n) por um único espaço em branco.
4. Se houver aspas ou aspas alemãs(„"), duplas("") ou simples ('') adicione somente UMA barra invertida na frente conforme exemplos abaixo.
„das Auto" ficaria \\„das Auto\\"
"das Auto" ficaria \\"das Auto\\"
'das Auto' ficaria \\'das Auto\\'

IMPORTANTE
Em hipótese alguma faça correções de palavras. Siga somente as instruções dadas. Em hipótese alguma esqueça de colocar a barra invertida conforme explicado no item 4.`;

// Prompt principal para análise de erros gramaticais
const GRAMMAR_ANALYSIS_SYSTEM_PROMPT = `PERSONA E OBJETIVO
Você é um especialista meticuloso em gramática alemã. A sua única tarefa é analisar um texto, identificar todos os erros gramaticais, ortográficos, etc e estruturar a sua análise num formato JSON preciso, usando uma tabela de referência numérica.

IMPORTANTE
Se a redação tiver aspas, colchetes, parênteses ou chaves, ou quebra de linhas você deverá eliminar antes de prosseguir. Se o idioma que o usuário escrever for qualquer outro que não seja alemão, a redação deve ser considerada sem erros, ou seja, seria como se o usuário tivesse acertado tudo.
"palavra_errada" no campo "conjugacao" deve conter o auxiliar haben ou sein mas também o verbo que o acompanha, caso esteja no perfekt ou em outros tempos verbais em que se precisam destes auxiliares.

REGRAS DE ANÁLISE
Para cada erro encontrado no texto, você deve:
1. Identificar a palavra ou trecho exato do erro.
2. Fornecer uma sugestão de correção.
3. Consultar a TABELA DE REFERÊNCIA e encontrar o tópico mais específico que descreve o erro.
4. Criar uma descrição curta e contextualizada do erro.
5. Criar um prompt de busca claro para uma base de conhecimento.

FORMATO DA RESPOSTA
A sua resposta DEVE ser APENAS um objeto JSON válido, sem nenhum texto extra. A estrutura do JSON deve ser exatamente esta:
{
  "declinacao": [
    {
      "topico_gramatical_numero": "",
      "topico_gramatical_nome": "",
      "descricao_topico_gramatical": "",
      "linha": "",
      "coluna": "",
      "palavra_errada": "",
      "sugestao_correcao": "",
      "prompt_busca_rag": ""
    }
  ],
  "conjugacao": [
    {
      "topico_gramatical_numero": "",
      "topico_gramatical_nome": "",
      "descricao_topico_gramatical": "",
      "linha": "",
      "coluna": "",
      "palavra_errada": "",
      "sugestao_correcao": "",
      "prompt_busca_rag": ""
    }
  ],
  "sintaxe": [
    {
      "topico_gramatical_numero": "",
      "topico_gramatical_nome": "",
      "descricao_topico_gramatical": "",
      "linha": "",
      "coluna": "",
      "palavra_errada": "",
      "sugestao_correcao": "",
      "prompt_busca_rag": ""
    }
  ],
  "preposicoes": [
    {
      "topico_gramatical_numero": "",
      "topico_gramatical_nome": "",
      "descricao_topico_gramatical": "",
      "linha": "",
      "coluna": "",
      "palavra_errada": "",
      "sugestao_correcao": "",
      "prompt_busca_rag": ""
    }
  ],
  "vocabulario": [
    {
      "topico_gramatical_numero": "",
      "topico_gramatical_nome": "",
      "descricao_topico_gramatical": "",
      "linha": "",
      "coluna": "",
      "palavra_errada": "",
      "sugestao_correcao": "",
      "prompt_busca_rag": ""
    }
  ]
}

Tópico Gramatical: Forneça APENAS o número do tópico da Tabela de Referência (ex: "4", "31", "50") baseado nesta tabela abaixo, e seu mapeamento:

TABELA DE REFERÊNCIA GRAMATICAL (1-68)

Se uma categoria não tiver erros, devolva uma lista vazia [].

Tabela de Tópicos Gramaticais para Referência:

1. Das Alphabet (ä, ö, ü, ß) - Umlaute, Das scharfe „s" (ß), Diphthonge, Konsonantengruppen
2. Geschlecht (Genus), Anzahl (Numerus), Fall (Kasus)
3. Nomen Deklination - Funktion der Deklination, Die Fälle
4. Verben - Nominativ, Akkusativ, Dativ, Verben mit Dativ und/oder Akkusativ, Verben mit Genitiv
5. Präpositionen - Präpositionen mit Dativ oder Akkusativ, Präpositionen mit Zeitangaben, Präpositionen mit Genitiv
6. Personalpronomen, Höflichkeitsform
7. Konjugation von Verben - Vokalwechsel, Ausnahmen der Konjugation im Präsens
8. Die Verben „haben" und „sein"
9. Trennbare Verben und nicht trennbare Verben
10. Verbklammer
11. Modalverben
12. Infinitiv ohne „zu"
13. Reflexive Verben - Reflexivpronomen
14. Reziproke Verben
15. Präsens (Gegenwart)
16. Perfekt (Vergangenheit)
17. Partizip II
18. „Sein" und „haben" im Perfekt und Präteritum
19. Modalverben im Perfekt und Präteritum
20. Futur I (Zukunft)
21. Syntax - Hauptsatz, Nebensatz, Position des Verbes, Hierarchie der Verben, Verben im Hauptsatz, Verben im Nebensatz, Verbindung von Sätzen
22. Konjunktionen
23. Subjunktionen
24. Konjunktionaladverbien
25. Relativsatz - Relativpronomen, Relativadverbien
26. Infinitivsatz (Infinitiv mit „zu") - Infinitivsatz mit trennbaren Verben, Infinitivsatz mit mehreren Verben
27. Satzglieder
28. Die Satzbauregel
29. Satzbautendenzen
30. Verneinung - Verneinung von Satzgliedern und Verben, Verneinung von Nomen, Verneinung mit Gegenwörtern
31. Adjektivdeklination
32. Steigerung von Adjektiven - Besonderheiten bei der Steigerung von Adjektiven
33. Komparation
34. Substantivierung von Adjektiven
35. Präteritum - Bildung des Präteritums, Die Verben „sein" und „haben" im Präteritum, Modalverben im Präteritum, Trennbare Verben im Präteritum
36. Plusquamperfekt
37. Futur II
38. Zeiten Übersicht
39. Passiv - Vorgangs- und Zustandspassiv, Bildung des Passivs, Zeitformen im Passiv, Rezipientenpassiv
40. Konjunktiv I
41. Konjunktiv II
42. Zeitformen des Konjunktivs
43. Weitere zentrale Grammatikthemen - Genitivbildung (-s, -es)
44. Imperativ - Bildung des Imperativs
45. Direkte und indirekte Rede
46. Indefinitpronomen
47. Interrogativpronomen
48. Demonstrativpronomen
49. Erläuterung zu den Partikeln - Gradpartikeln, Fokuspartikeln, Negationspartikeln, Gesprächspartikeln, Ausdruckspartikeln (Interjektionen), Lautmalende Partikeln
50. Modalpartikeln - Die Modalpartikel „doch", „schon", „noch", „ja"
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
62. Komposita - Bildung von Komposita, Fugenelemente, Bindestrich, Derivation, Adjektivbildung, Substantivierung von Verben, Antonyme, Konversion
63. Satzarten - Hauptsätze (Aussagesatz, Fragesatz, Aufforderungssatz, Wunschsatz, Ausrufesatz), Nebensätze (Der Adverbialsatz, Attributsatz, Relativsatz, Partizipialsatz, Indirekte Rede)
64. Verlaufsform (Progressivität)
65. Weiterführende Erläuterungen - Verben mit Ergänzung, Transitive und intransitive Verben, Situativergänzung
66. Häufige Fehler
67. Nullartikel
68. „Viel" und „wenig"

Para decidir em qual categoria macro ("declinacao", "conjugacao", etc.) colocar o erro, use o seguinte MAPA DE CATEGORIAS:
- Se o 'topico_gramatical_numero' for um destes [2, 3, 4, 6, 31, 32, 33, 34, 43, 46, 47, 48, 51, 52, 67, 68], coloque o objeto do erro na lista "declinacao".
- Se o 'topico_gramatical_numero' for um destes [7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 35, 36, 37, 38, 39, 40, 41, 42, 44, 64, 65], coloque na lista "conjugacao".
- Se o 'topico_gramatical_numero' for um destes [10, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 45, 61, 63], coloque na lista "sintaxe".
- Se o 'topico_gramatical_numero' for um destes [1, 49, 50, 53, 54, 55, 56, 57, 58, 59, 60, 62, 66], coloque na lista "vocabulario".
- Se o 'topico_gramatical_numero' for [5], coloque na lista "preposicoes".`;

// Helper function to call DeepSeek API
async function callDeepSeek(systemPrompt, userPrompt, temperature = 0.3) {
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
            temperature: temperature
        })
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

    const response = await fetch(url, { ...options, headers });
    return response;
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

// Get user profile
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

// Update user profile stats
async function updateProfileStats(userId, contagem, currentProfile) {
    const updateData = {
        error_declinacao: (parseInt(contagem.declinacao) || 0) + (parseInt(currentProfile.error_declinacao) || 0),
        error_conjugacao: (parseInt(contagem.conjugacao) || 0) + (parseInt(currentProfile.error_conjugacao) || 0),
        error_sintaxe: (parseInt(contagem.sintaxe) || 0) + (parseInt(currentProfile.error_sintaxe) || 0),
        error_preposicao: (parseInt(contagem.preposicoes) || 0) + (parseInt(currentProfile.error_preposicao) || 0),
        error_vocabulario: (parseInt(contagem.vocabulario) || 0) + (parseInt(currentProfile.error_vocabulario) || 0),
        total_essays: (parseInt(currentProfile.total_essays) || 0) + 1
    };

    await supabaseRequest(`/rest/v1/profiles?id=eq.${userId}`, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify(updateData)
    });
}

// Insert essay history
async function insertEssayHistory(userId, contagem) {
    await supabaseRequest('/rest/v1/essay_history', {
        method: 'POST',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({
            user_id: userId,
            error_declinacao: parseInt(contagem.declinacao) || 0,
            error_conjugacao: parseInt(contagem.conjugacao) || 0,
            error_sintaxe: parseInt(contagem.sintaxe) || 0,
            error_preposicao: parseInt(contagem.preposicoes) || 0,
            error_vocabulario: parseInt(contagem.vocabulario) || 0
        })
    });
}

// Deduct credits
async function deductCredits(userId, currentCredits) {
    await supabaseRequest(`/rest/v1/profiles?id=eq.${userId}`, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({
            credits: parseInt(currentCredits) - 100
        })
    });
}

// Parse and organize AI response
function organizeResponse(rawResponse) {
    if (typeof rawResponse !== 'string') {
        return { error: "A resposta da IA está vazia ou num formato inesperado." };
    }

    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
        try {
            const parsedJson = JSON.parse(jsonMatch[0]);

            const categoriasEsperadas = [
                'declinacao',
                'conjugacao',
                'preposicoes',
                'estrutura_frase',
                'sintaxe',
                'vocabulario'
            ];

            const contemCategoriasSoltas = categoriasEsperadas.some(cat => parsedJson.hasOwnProperty(cat));

            if (contemCategoriasSoltas && !parsedJson.hasOwnProperty('erros')) {
                const erros = {};
                for (const cat of categoriasEsperadas) {
                    if (parsedJson[cat]) {
                        erros[cat] = parsedJson[cat];
                        delete parsedJson[cat];
                    }
                }
                parsedJson.erros = erros;
            }

            return parsedJson;

        } catch (error) {
            return { error: "Falha ao extrair o JSON da resposta da IA.", raw: rawResponse };
        }
    }

    return { error: "Nenhum objeto JSON foi encontrado na resposta da IA." };
}

// Count errors in each category
function countErrors(erros) {
    const contagem = {};

    if (!erros) return contagem;

    for (const categoria in erros) {
        if (Object.hasOwnProperty.call(erros, categoria)) {
            const errosNaCategoria = erros[categoria];
            contagem[categoria] = Array.isArray(errosNaCategoria) ? errosNaCategoria.length : Object.keys(errosNaCategoria).length;
        }
    }

    return contagem;
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
        // 1. Parse request body
        const body = JSON.parse(event.body);
        const { email, redacao, nivel, nome } = body;

        if (!email || !redacao) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing email or redacao' })
            };
        }

        console.log('Processing trataerro request for:', email);

        // 2. Get user_id from email
        const userId = await getUserIdByEmail(email);

        if (!userId) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'User not found' })
            };
        }

        console.log('Found user_id:', userId);

        // 3. Clean the text with AI
        const cleanedText = await callDeepSeek(
            CLEAN_TEXT_SYSTEM_PROMPT,
            `Limpe o seguinte texto de acordo com as suas instruções:\n\n${redacao}`,
            0.1
        );

        console.log('Text cleaned');

        // 4. Get user profile to check credits
        const userProfile = await getUserProfile(userId);

        if (!userProfile) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'User profile not found' })
            };
        }

        // 5. Check credits
        if (parseInt(userProfile.credits) < 100) {
            return {
                statusCode: 402,
                headers,
                body: JSON.stringify({ error: 'Sem crédito suficiente', credit: 'Sem crédito suficiente' })
            };
        }

        console.log('User has sufficient credits:', userProfile.credits);

        // 6. Analyze grammar errors with AI
        const analysisResponse = await callDeepSeek(
            GRAMMAR_ANALYSIS_SYSTEM_PROMPT,
            cleanedText,
            0.3
        );

        console.log('Grammar analysis completed');

        // 7. Parse and organize the response
        const organizedResponse = organizeResponse(analysisResponse);

        // 8. Get the errors object
        const erros = organizedResponse.erros || organizedResponse;

        // 9. Count errors for stats
        const contagem = countErrors(erros);

        console.log('Error counts:', contagem);

        // 10. Update stats in background (non-blocking)
        // We don't await these to return response faster
        Promise.all([
            updateProfileStats(userId, contagem, userProfile),
            insertEssayHistory(userId, contagem),
            deductCredits(userId, userProfile.credits)
        ]).catch(err => console.error('Error updating stats:', err));

        // 11. Return the errors to the client
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(erros)
        };

    } catch (error) {
        console.error('TrataErro webhook error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error', details: error.message })
        };
    }
};
