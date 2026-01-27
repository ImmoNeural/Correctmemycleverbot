// Função para gerar TODAS as 3 dicas do jogo da forca de uma vez usando DeepSeek
// Isso evita chamadas duplicadas e problemas de sincronização

const DEEPSEEK_API_KEY = 'sk-e080234eab8b442fb65fe8955d8947de';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

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
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        const body = JSON.parse(event.body);
        const { palavra, traducao, exemplo } = body;

        console.log('[FORCA-DICAS-BATCH] Gerando 3 dicas para palavra:', palavra);
        console.log('[FORCA-DICAS-BATCH] TRADUÇÃO RECEBIDA:', traducao);
        console.log('[FORCA-DICAS-BATCH] Exemplo:', exemplo);

        if (!palavra) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing palavra parameter' })
            };
        }

        // Se não tiver tradução nem exemplo, retornar dicas genéricas
        if (!traducao && !exemplo) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    dicas: [
                        `Esta palavra tem ${palavra.length} letras.`,
                        `Tente pensar em palavras comuns com ${palavra.length} letras.`,
                        `A palavra começa com a letra ${palavra[0].toUpperCase()}.`
                    ]
                })
            };
        }

        const traducaoLimpa = (traducao || '').trim();
        const exemploLimpo = (exemplo || '').trim();
        const palavraLimpa = (palavra || '').trim();

        // Construir o prompt usando TRADUÇÃO + EXEMPLO para dicas contextualizadas
        // O exemplo de uso é a chave para gerar dicas relevantes e precisas
        const systemPrompt = `Você é um assistente que cria dicas para um jogo da forca de aprendizado de alemão.

CONTEXTO DO JOGO:
- O jogador está aprendendo alemão
- Ele vê a tradução/significado em português e precisa adivinhar qual é a palavra alemã
- Suas dicas devem ajudar o jogador a LEMBRAR da palavra alemã através do contexto de uso

INFORMAÇÕES FORNECIDAS:
- Tradução/Significado em português: "${traducaoLimpa}"
${exemploLimpo ? `- Exemplo de uso: "${exemploLimpo}"` : ''}

REGRAS PARA CRIAR DICAS:
1. Use o EXEMPLO DE USO como base principal para contextualizar as dicas
2. As dicas devem ajudar o jogador a entender o CONTEXTO em que a palavra é usada
3. NÃO revele a palavra diretamente nem dê dicas sobre as letras
4. Foque em situações, contextos e associações que ajudem a lembrar do significado
5. Se houver exemplo, extraia o contexto dele para criar dicas mais precisas

FORMATO DE RESPOSTA:
Responda APENAS em JSON válido: {"dica1": "...", "dica2": "...", "dica3": "..."}

ESTRUTURA DAS DICAS (do mais fácil ao mais difícil):
- dica1: Uma dica vaga sobre a categoria ou campo semântico (ex: "Relacionado a sentimentos" ou "Usado em contexto profissional")
- dica2: Uma dica mais específica sobre quando/como essa palavra é usada, baseada no exemplo se disponível
- dica3: Uma dica bem direta, quase revelando o significado ou dando um contexto muito específico`;

        const userPrompt = exemploLimpo
            ? `A tradução é: "${traducaoLimpa}"
O exemplo de uso é: "${exemploLimpo}"

Crie 3 dicas progressivas (da mais vaga à mais específica) que ajudem o jogador a lembrar desta palavra. Use o exemplo de uso para contextualizar as dicas.
Responda APENAS em JSON.`
            : `A tradução é: "${traducaoLimpa}"

Crie 3 dicas progressivas (da mais vaga à mais específica) que ajudem o jogador a lembrar desta palavra.
Responda APENAS em JSON.`;

        const deepseekResponse = await fetch(DEEPSEEK_API_URL, {
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
                temperature: 0,
                max_tokens: 300
            })
        });

        if (!deepseekResponse.ok) {
            const errorText = await deepseekResponse.text();
            console.error('[FORCA-DICAS-BATCH] DeepSeek API error:', errorText);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'AI API error', details: errorText })
            };
        }

        const deepseekData = await deepseekResponse.json();
        const resposta = deepseekData.choices[0]?.message?.content || '';

        console.log('[FORCA-DICAS-BATCH] Resposta da IA:', resposta);

        // Tentar parsear o JSON da resposta
        let dicas = [];
        try {
            // Remover possíveis marcadores de código markdown
            const jsonStr = resposta.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const parsed = JSON.parse(jsonStr);
            dicas = [parsed.dica1, parsed.dica2, parsed.dica3];
        } catch (parseError) {
            console.error('[FORCA-DICAS-BATCH] Erro ao parsear JSON:', parseError);
            // Fallback: tentar extrair dicas manualmente
            const match1 = resposta.match(/dica1["']?\s*:\s*["']([^"']+)["']/i);
            const match2 = resposta.match(/dica2["']?\s*:\s*["']([^"']+)["']/i);
            const match3 = resposta.match(/dica3["']?\s*:\s*["']([^"']+)["']/i);

            dicas = [
                match1?.[1] || `Categoria: algo relacionado a "${traducaoLimpa.substring(0, 3)}..."`,
                match2?.[1] || `Você usa isso no dia a dia.`,
                match3?.[1] || `A palavra é: ${traducaoLimpa}`
            ];
        }

        // Garantir que temos exatamente 3 dicas
        while (dicas.length < 3) {
            dicas.push(`Dica adicional: pense em "${traducaoLimpa.substring(0, 2)}..."`);
        }

        console.log('[FORCA-DICAS-BATCH] Dicas geradas:', dicas);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                dicas: dicas.slice(0, 3) // Garantir apenas 3 dicas
            })
        };

    } catch (error) {
        console.error('[FORCA-DICAS-BATCH] Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error', details: error.message })
        };
    }
};
