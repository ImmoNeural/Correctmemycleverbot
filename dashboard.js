document.addEventListener('DOMContentLoaded', () => {
    // =================================================================
    // CONFIGURAÇÃO E INICIALIZAÇÃO
    // =================================================================
    const SUPABASE_URL = 'https://timqizyevfkvqgzvcrlx.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpbXFpenlldmZrdnFnenZjcmx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwMTkwMDYsImV4cCI6MjA2MTU5NTAwNn0.LfWFCPPgzTkh7Scf2Q2LjLmYcLnaWSAGKDiMT8eSuWM';
    const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const STRIPE_PUBLIC_KEY = 'pk_live_51RpZAqCYJo68kcPWlBMokRjXKgRQ3SmtQWTTdED5gzn4qSFD8u2dSV88YKDWvs1FTYFePAbp6lsZrHHWkPR2UKL100vpspXOIy'; 
    const stripe = Stripe(STRIPE_PUBLIC_KEY);

    // Seletores de containers principais
    const profileContainer = document.getElementById('perfil-section');
    const mobileFlashcardsContainer = document.getElementById('flashcards-section');
    
    // Templates
    const profileTemplate = document.getElementById('profile-template');
    const flashcardsTemplate = document.getElementById('flashcards-template');

    // Variáveis globais
    let currentUser = null;
    let errorChart = null;
    let historyChart = null;
    let userFlashcards = [];
    let currentFlashcardIndex = 0;
    let isGameActive = false;

    // =================================================================
    // LÓGICA DE INICIALIZAÇÃO DA APLICAÇÃO
    // =================================================================

    _supabase.auth.onAuthStateChange((_event, session) => {
        if (session && session.user) {
            currentUser = session.user;
            initializeApp(currentUser);
            
            // Avisa os outros scripts (como o chatbot) que o utilizador foi autenticado.
            window.dispatchEvent(new CustomEvent('userAuthenticated', { detail: { user: session.user } }));

        } else {
            window.location.href = 'login.html';
        }
    });

    async function initializeApp(user) {
        // Verificar se usuário completou onboarding ANTES de carregar dashboard
        const { data: leadData } = await _supabase
            .from('leads')
            .select('id')
            .eq('id', user.id)
            .single();

        // Se não está na tabela leads, redirecionar para onboarding
        if (!leadData) {
            window.location.href = 'onboarding.html';
            return; // Parar execução aqui
        }

        // Só continua se usuário está na tabela leads
        injectTemplates();
        await loadUserProfile(user);
        attachEventListeners();
        setupResponsiveLayout();
    }

    function injectTemplates() {
        if (profileTemplate && profileContainer) {
            profileContainer.innerHTML = ''; 
            profileContainer.appendChild(profileTemplate.content.cloneNode(true));
        }

        if (flashcardsTemplate) {
            const flashcardDesktopContainer = document.querySelector('#flashcard-desktop-container');
            if (flashcardDesktopContainer) {
                flashcardDesktopContainer.appendChild(flashcardsTemplate.content.cloneNode(true));
            }

            if (mobileFlashcardsContainer) {
                mobileFlashcardsContainer.innerHTML = '';
                mobileFlashcardsContainer.appendChild(flashcardsTemplate.content.cloneNode(true));
            }
        }
    }

    // =================================================================
    // CARREGAMENTO E RENDERIZAÇÃO DE DADOS
    // =================================================================

    async function loadUserProfile(user) {
        const columnsToSelect = 'credits, avatar_url, total_essays, error_declinacao, error_conjugacao, error_sintaxe, error_preposicao, error_vocabulario';
        let { data: profile, error } = await _supabase.from('profiles').select(columnsToSelect).eq('id', user.id).single();
        
        if (error && error.code !== 'PGRST116') { console.error("Erro ao buscar perfil:", error); return; }

        if (!profile) {
            const { data: newProfile } = await _supabase.from('profiles').insert([{ id: user.id, credits: 200 }]).select(columnsToSelect).single();
            profile = newProfile;
        }

        if (profile) {
            updateUI(user, profile);
            await fetchFlashcards(user);
            await loadErrorHistory(user);
        }
    }

    function updateUI(user, profile) {
        document.querySelectorAll('#user-email').forEach(el => el.textContent = user.email);
        document.querySelectorAll('#user-credits').forEach(el => el.textContent = profile.credits !== null ? profile.credits : 0);
        document.querySelectorAll('#profile-pic').forEach(el => {
            if (profile.avatar_url) {
                const { data: urlData } = _supabase.storage.from('avatar').getPublicUrl(profile.avatar_url);
                if (urlData && urlData.publicUrl) el.src = `${urlData.publicUrl}?t=${new Date().getTime()}`;
            } else {
                el.src = 'https://placehold.co/150x150/172a45/ccd6f6?text=Foto';
            }
        });
        
        const userNameEl = document.getElementById('user-name');
        if (userNameEl) userNameEl.value = user.email.split('@')[0];
        const startDateEl = document.getElementById('start-date');
        if (startDateEl) startDateEl.textContent = new Date(user.created_at).toLocaleDateString('pt-BR');
        const totalEssaysEl = document.getElementById('total-essays');
        if (totalEssaysEl) totalEssaysEl.textContent = profile.total_essays || 0;

        document.getElementById('error-declinacao').textContent = `${profile.error_declinacao || 0} erros`;
        document.getElementById('error-conjugacao').textContent = `${profile.error_conjugacao || 0} erros`;
        document.getElementById('error-sintaxe').textContent = `${profile.error_sintaxe || 0} erros`;
        document.getElementById('error-preposicao').textContent = `${profile.error_preposicao || 0} erros`;
        document.getElementById('error-vocabulario').textContent = `${profile.error_vocabulario || 0} erros`;
        
        renderErrorChart(profile);
        
        const chatbotPromptContainer = document.querySelector('#chatbot-prompt-container');
        if (chatbotPromptContainer) {
            chatbotPromptContainer.innerHTML = `
                <div class="robot-dance">🤖</div>
                <p class="text-yellow-400 text-sm mt-2">Que tal conversar com nosso chatbot em alemão?</p>
            `;
        }
    }
    
    function renderErrorChart(profile) {
        const chartCanvas = document.getElementById('error-chart')?.getContext('2d');
        if (!chartCanvas) return;
        Chart.register(ChartDataLabels);
        const errorData = [ profile.error_declinacao || 0, profile.error_conjugacao || 0, profile.error_sintaxe || 0, profile.error_preposicao || 0, profile.error_vocabulario || 0 ];
        const totalErrors = errorData.reduce((sum, value) => sum + value, 0);
        if (errorChart) errorChart.destroy();
        
        const parentDiv = chartCanvas.canvas.parentElement;
        let noDataMessage = parentDiv.querySelector('.no-data-message');
        if (totalErrors === 0) {
            chartCanvas.canvas.style.display = 'none';
            if (!noDataMessage) {
                noDataMessage = document.createElement('p');
                noDataMessage.className = 'no-data-message text-slate-400 text-center mt-4';
                parentDiv.appendChild(noDataMessage);
            }
            noDataMessage.textContent = 'Ainda não há dados de erros para exibir.';
            return;
        } else {
             chartCanvas.canvas.style.display = 'block';
             if(noDataMessage) noDataMessage.remove();
        }

        const data = {
            labels: [ 'Declinação', 'Conjugação', 'Sintaxe', 'Preposição', 'Vocabulário' ],
            datasets: [{ data: errorData, backgroundColor: [ '#8B5CF6', '#3B82F6', '#10B981', '#F97316', '#EF4444' ], borderColor: '#1E293B', borderWidth: 2, hoverOffset: 4 }]
        };
        errorChart = new Chart(chartCanvas, { type: 'pie', data: data, options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false }, datalabels: { formatter: (value) => { if (value === 0) return ''; const percentage = ((value / totalErrors) * 100).toFixed(0) + '%'; return percentage; }, color: '#fff', font: { weight: 'bold', size: 14 } }, tooltip: { callbacks: { label: (context) => `${context.label || ''}: ${context.raw} erros` } } } } });
    }

    let showingLast10 = false;
    let fullHistoryData = [];

    async function loadErrorHistory(user) {
        const container = document.getElementById('history-chart-container');
        if (!user || !container) return;

        const { data: historyData, error } = await _supabase.from('essay_history').select('*').eq('user_id', user.id).order('created_at', { ascending: true });
        if (error) { console.error("Erro ao buscar histórico:", error); return; }

        fullHistoryData = historyData || [];

        if (fullHistoryData.length > 0) {
            container.innerHTML = '<canvas id="history-chart"></canvas>';
            const historyChartCanvas = container.querySelector('canvas').getContext('2d');
            renderHistoryChart(fullHistoryData, historyChartCanvas);
        } else {
            container.innerHTML = `<p class="text-slate-400 text-center mt-4">Envie sua primeira redação para ver o histórico.</p>`;
        }
    }

    function renderHistoryChart(historyData, canvasCtx) {
        if (historyChart) historyChart.destroy();
        const labels = historyData.map((_, index) => `Redação ${index + 1}`);
        const datasets = [
            { label: 'Declinação', data: historyData.map(e => e.error_declinacao), backgroundColor: '#8B5CF6' },
            { label: 'Conjugação', data: historyData.map(e => e.error_conjugacao), backgroundColor: '#3B82F6' },
            { label: 'Sintaxe', data: historyData.map(e => e.error_sintaxe), backgroundColor: '#10B981' },
            { label: 'Preposição', data: historyData.map(e => e.error_preposicao), backgroundColor: '#F97316' },
            { label: 'Vocabulário', data: historyData.map(e => e.error_vocabulario), backgroundColor: '#EF4444' }
        ];
        historyChart = new Chart(canvasCtx, { type: 'bar', data: { labels, datasets }, options: { responsive: true, maintainAspectRatio: false, plugins: { datalabels: { display: false }, legend: { position: 'top', labels: { color: '#cbd5e1' } }, tooltip: { mode: 'index', intersect: false } }, scales: { y: { beginAtZero: true, stacked: true, ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: 'rgba(255, 255, 255, 0.1)' } }, x: { stacked: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } } } } });
    }

    function toggleLast10Essays() {
        showingLast10 = !showingLast10;
        const button = document.getElementById('toggle-last-10');
        const container = document.getElementById('history-chart-container');

        if (!container || fullHistoryData.length === 0) return;

        if (showingLast10) {
            // Mostrar apenas últimas 10 redações
            const last10 = fullHistoryData.slice(-10);
            container.innerHTML = '<canvas id="history-chart"></canvas>';
            const historyChartCanvas = container.querySelector('canvas').getContext('2d');
            renderHistoryChart(last10, historyChartCanvas);

            // Atualizar também o gráfico de pizza com dados das últimas 10
            updatePieChartForLast10(last10);

            if (button) button.textContent = 'Mostrar todas as redações';
        } else {
            // Mostrar todas as redações
            container.innerHTML = '<canvas id="history-chart"></canvas>';
            const historyChartCanvas = container.querySelector('canvas').getContext('2d');
            renderHistoryChart(fullHistoryData, historyChartCanvas);

            // Restaurar gráfico de pizza com todos os dados
            if (currentUser) loadUserProfile(currentUser);

            if (button) button.textContent = 'Mostrar últimas 10 redações';
        }
    }

    function updatePieChartForLast10(last10Data) {
        // Calcular total de erros das últimas 10 redações
        const totals = {
            declinacao: 0,
            conjugacao: 0,
            sintaxe: 0,
            preposicao: 0,
            vocabulario: 0
        };

        last10Data.forEach(essay => {
            totals.declinacao += essay.error_declinacao || 0;
            totals.conjugacao += essay.error_conjugacao || 0;
            totals.sintaxe += essay.error_sintaxe || 0;
            totals.preposicao += essay.error_preposicao || 0;
            totals.vocabulario += essay.error_vocabulario || 0;
        });

        // Atualizar os números exibidos
        document.getElementById('error-declinacao').textContent = `${totals.declinacao} erros`;
        document.getElementById('error-conjugacao').textContent = `${totals.conjugacao} erros`;
        document.getElementById('error-sintaxe').textContent = `${totals.sintaxe} erros`;
        document.getElementById('error-preposicao').textContent = `${totals.preposicao} erros`;
        document.getElementById('error-vocabulario').textContent = `${totals.vocabulario} erros`;

        // Atualizar o gráfico de pizza
        const chartCanvas = document.getElementById('error-chart');
        if (!chartCanvas) return;

        const totalErrors = totals.declinacao + totals.conjugacao + totals.sintaxe + totals.preposicao + totals.vocabulario;
        if (totalErrors === 0) return;

        if (errorChart) errorChart.destroy();

        const data = {
            labels: ['Declinação', 'Conjugação', 'Sintaxe', 'Preposição', 'Vocabulário'],
            datasets: [{ data: [totals.declinacao, totals.conjugacao, totals.sintaxe, totals.preposicao, totals.vocabulario], backgroundColor: ['#f472b6', '#c084fc', '#fb923c', '#60a5fa', '#4ade80'] }]
        };
        errorChart = new Chart(chartCanvas, { type: 'pie', data: data, options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false }, datalabels: { formatter: (value) => { if (value === 0) return ''; const percentage = ((value / totalErrors) * 100).toFixed(0) + '%'; return percentage; }, color: '#fff', font: { weight: 'bold', size: 14 } }, tooltip: { callbacks: { label: (context) => `${context.label || ''}: ${context.raw} erros` } } } } });
    }

    // =================================================================
    // FUNÇÕES DE AÇÃO DO UTILIZADOR
    // =================================================================

    async function handleLogout() {
        try {
            const { error } = await _supabase.auth.signOut();
            if (error) {
                console.error('Erro ao fazer logout:', error);
            }
        } catch (err) {
            console.error('Erro ao fazer logout:', err);
        }
        // Redirecionar para a página de login
        window.location.href = 'login.html';
    }

    async function handleCorrectionSubmit(e) {
        e.preventDefault();
        const formMessageEl = document.getElementById('form-message');
        if (formMessageEl) formMessageEl.textContent = '';

        const redacaoTextarea = document.getElementById('redacao');
        const text = redacaoTextarea.value;
        const words = text.trim().split(/\s+/).filter(word => word.length > 0);
        const wordCount = text.trim() === '' ? 0 : words.length;

        if (wordCount > 350) {
            if (formMessageEl) formMessageEl.textContent = `O texto excede o limite de 350 palavras.`;
            return;
        }

        const dataToSend = {
            userId: currentUser.id,
            nome: document.getElementById('user-name').value,
            email: currentUser.email,
            redacao: document.getElementById('redacao').value,
            nivel: document.querySelector('input[name="nivel"]:checked').value
        };

        const textoOriginal = dataToSend.redacao;
        const flashcardWebhookUrl = '/.netlify/functions/flashcard';
        const trataerroStreamUrl = '/api/trataerro-stream';

        // Categorias de erros
        const categorias = {
            declinacao: { cor: 'bg-pink-400', corHex: '#f472b6', nome: 'Declinação' },
            conjugacao: { cor: 'bg-purple-400', corHex: '#c084fc', nome: 'Conjugação' },
            preposicoes: { cor: 'bg-blue-400', corHex: '#60a5fa', nome: 'Preposições' },
            sintaxe: { cor: 'bg-orange-400', corHex: '#fb923c', nome: 'Sintaxe' },
            vocabulario: { cor: 'bg-green-400', corHex: '#4ade80', nome: 'Vocabulário' }
        };

        // Mostrar imediatamente a legenda e o texto
        if (formMessageEl) {
            formMessageEl.innerHTML = `
                <div class="mt-4 p-4 bg-slate-800 rounded-lg">
                    <p class="text-white font-semibold mb-3">Legenda de Cores:</p>
                    <div class="flex flex-wrap gap-3">
                        <span class="flex items-center gap-2 text-sm">
                            <span class="inline-block w-4 h-4 bg-pink-400 rounded"></span>
                            <span class="text-white">Declinação</span>
                        </span>
                        <span class="flex items-center gap-2 text-sm">
                            <span class="inline-block w-4 h-4 bg-purple-400 rounded"></span>
                            <span class="text-white">Conjugação</span>
                        </span>
                        <span class="flex items-center gap-2 text-sm">
                            <span class="inline-block w-4 h-4 bg-blue-400 rounded"></span>
                            <span class="text-white">Preposições</span>
                        </span>
                        <span class="flex items-center gap-2 text-sm">
                            <span class="inline-block w-4 h-4 bg-orange-400 rounded"></span>
                            <span class="text-white">Sintaxe</span>
                        </span>
                        <span class="flex items-center gap-2 text-sm">
                            <span class="inline-block w-4 h-4 bg-green-400 rounded"></span>
                            <span class="text-white">Vocabulário</span>
                        </span>
                    </div>
                </div>
                <div class="mt-4 p-4 bg-slate-700 rounded-lg">
                    <p class="text-white font-semibold mb-3">Texto corrigido:</p>
                    <div id="texto-corrigido" class="text-white leading-relaxed whitespace-pre-wrap">${textoOriginal}</div>
                </div>
                <div id="analise-container" class="mt-4 p-4 bg-slate-800 rounded-lg">
                    <p class="text-white font-semibold mb-3">Análise detalhada:</p>
                    <div id="erros-lista" class="space-y-3">
                        <p class="text-slate-400 text-sm animate-pulse">Analisando sua redação...</p>
                    </div>
                </div>
            `;
        }

        try {
            // Enviar para flashcard em paralelo (não bloqueia)
            fetch(flashcardWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: currentUser.email, redacao: dataToSend.redacao })
            }).catch(err => console.error('Erro ao enviar flashcard:', err));

            // Streaming da correção
            const response = await fetch(trataerroStreamUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: currentUser.email, redacao: textoOriginal })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ocorreu um problema ao comunicar com o sistema de correção.');
            }

            // Processar streaming
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullJson = '';
            let errosProcessados = new Set();
            let todosErros = [];
            let palavrasJaGrifadas = new Set();

            // Função para grifar uma palavra no texto
            function grifarPalavra(palavra, corClass) {
                const textoEl = document.getElementById('texto-corrigido');
                if (!textoEl || palavrasJaGrifadas.has(palavra.toLowerCase())) return;

                const palavraEscapada = palavra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`\\b${palavraEscapada}\\b`, 'gi');

                textoEl.innerHTML = textoEl.innerHTML.replace(regex, (match) => {
                    // Verificar se já está dentro de uma tag mark
                    return `<mark class="${corClass} text-black px-1 rounded">${match}</mark>`;
                });

                palavrasJaGrifadas.add(palavra.toLowerCase());
            }

            // Função para adicionar erro à lista
            function adicionarErroNaLista(erro) {
                const errosListaEl = document.getElementById('erros-lista');
                if (!errosListaEl) return;

                // Remover mensagem de "Analisando..." se existir
                const msgAnalise = errosListaEl.querySelector('.animate-pulse');
                if (msgAnalise) msgAnalise.remove();

                const erroHtml = `
                    <div class="bg-slate-700 p-3 rounded-lg text-sm border-l-4" style="border-color: ${erro.corHex}">
                        ${erro.topico ? `<p class="text-yellow-400 font-semibold mb-2">${erro.topico}</p>` : ''}
                        <p class="text-red-300 mb-1">
                            <span class="font-semibold">Errado:</span>
                            <span class="line-through">${erro.palavra}</span>
                        </p>
                        ${erro.sugestao ? `<p class="text-green-300 mb-2">
                            <span class="font-semibold">Correção:</span>
                            ${erro.sugestao}
                        </p>` : ''}
                        ${erro.explicacao ? `<p class="text-slate-300 text-xs italic">${erro.explicacao}</p>` : ''}
                    </div>
                `;
                errosListaEl.insertAdjacentHTML('beforeend', erroHtml);
            }

            // Função para extrair valor de um campo no JSON
            function extrairCampo(objStr, campo) {
                const regex = new RegExp(`"${campo}"\\s*:\\s*"([^"]*)"`, 'g');
                const match = regex.exec(objStr);
                return match ? match[1] : '';
            }

            // Função para processar erros encontrados no JSON parcial
            function processarErrosParciais(jsonStr) {
                // Tentar extrair objetos de erro completos do JSON parcial
                Object.keys(categorias).forEach(categoria => {
                    // Regex para encontrar o início do array da categoria
                    const arrayStartPattern = new RegExp(`"${categoria}"\\s*:\\s*\\[`, 'g');
                    const arrayStartMatch = arrayStartPattern.exec(jsonStr);

                    if (arrayStartMatch) {
                        // Encontrar todos os objetos completos (que terminam com })
                        const startIndex = arrayStartMatch.index + arrayStartMatch[0].length;
                        const substring = jsonStr.substring(startIndex);

                        // Encontrar objetos completos { ... }
                        let depth = 0;
                        let objStart = -1;

                        for (let i = 0; i < substring.length; i++) {
                            const char = substring[i];

                            if (char === '{') {
                                if (depth === 0) objStart = i;
                                depth++;
                            } else if (char === '}') {
                                depth--;
                                if (depth === 0 && objStart !== -1) {
                                    const objStr = substring.substring(objStart, i + 1);

                                    // Extrair campos do objeto
                                    const palavraErrada = extrairCampo(objStr, 'palavra_errada').trim();
                                    const erroKey = `${categoria}-${palavraErrada}`;

                                    if (palavraErrada && !errosProcessados.has(erroKey)) {
                                        errosProcessados.add(erroKey);

                                        const erro = {
                                            palavra: palavraErrada,
                                            sugestao: extrairCampo(objStr, 'sugestao_correcao'),
                                            explicacao: extrairCampo(objStr, 'descricao_topico_gramatical'),
                                            topico: extrairCampo(objStr, 'topico_gramatical_nome'),
                                            categoria: categoria,
                                            cor: categorias[categoria].cor,
                                            corHex: categorias[categoria].corHex
                                        };

                                        todosErros.push(erro);

                                        // Grifar cada palavra do erro
                                        palavraErrada.split(/\s+/).forEach(p => {
                                            if (p) grifarPalavra(p, categorias[categoria].cor);
                                        });

                                        // Adicionar erro na lista
                                        adicionarErroNaLista(erro);
                                    }

                                    objStart = -1;
                                }
                            } else if (char === ']' && depth === 0) {
                                // Fim do array desta categoria
                                break;
                            }
                        }
                    }
                });
            }

            // Ler o stream
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                fullJson += chunk;

                // Tentar processar erros a cada chunk
                processarErrosParciais(fullJson);
            }

            // Processar JSON completo no final para garantir que todos os erros foram capturados
            try {
                const jsonMatch = fullJson.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const trataerroData = JSON.parse(jsonMatch[0]);

                    // Processar erros que podem não ter sido capturados
                    Object.keys(categorias).forEach(categoria => {
                        if (trataerroData[categoria] && Array.isArray(trataerroData[categoria])) {
                            trataerroData[categoria].forEach(erroObj => {
                                const palavraErrada = (erroObj.palavra_errada || '').trim();
                                const erroKey = `${categoria}-${palavraErrada}`;

                                if (palavraErrada && !errosProcessados.has(erroKey)) {
                                    errosProcessados.add(erroKey);

                                    const erro = {
                                        palavra: palavraErrada,
                                        sugestao: erroObj.sugestao_correcao || '',
                                        explicacao: erroObj.descricao_topico_gramatical || '',
                                        topico: erroObj.topico_gramatical_nome || '',
                                        categoria: categoria,
                                        cor: categorias[categoria].cor,
                                        corHex: categorias[categoria].corHex
                                    };

                                    todosErros.push(erro);

                                    palavraErrada.split(/\s+/).forEach(p => {
                                        if (p) grifarPalavra(p, categorias[categoria].cor);
                                    });

                                    adicionarErroNaLista(erro);
                                }
                            });
                        }
                    });
                }
            } catch (parseErr) {
                console.error('Erro ao parsear JSON final:', parseErr);
            }

            // Atualizar contador de erros
            const analiseContainer = document.getElementById('analise-container');
            if (analiseContainer) {
                const totalErros = todosErros.length;
                const titulo = analiseContainer.querySelector('p.font-semibold');
                if (titulo) {
                    titulo.textContent = `Análise detalhada (${totalErros} erro${totalErros !== 1 ? 's' : ''}):`;
                }
            }

            // Se não encontrou nenhum erro
            const errosListaEl = document.getElementById('erros-lista');
            if (errosListaEl && todosErros.length === 0) {
                errosListaEl.innerHTML = '<p class="text-green-400 text-sm">Parabéns! Nenhum erro encontrado na sua redação.</p>';
            }

            await loadUserProfile(currentUser);
            document.getElementById('correction-form').reset();
            updateWordCount();

        } catch (error) {
            console.error('Erro na correção:', error);
            if (formMessageEl) {
                formMessageEl.innerHTML = `<p class="text-red-400">${error.message}</p>`;
            }
        }
    }

    async function handlePurchaseClick(event) {
        const button = event.target.closest('button');
        const priceId = button.dataset.priceId;
        button.disabled = true;
        button.textContent = 'Aguarde...';
        try {
            const { data, error } = await _supabase.functions.invoke('create-checkout-session', { body: { priceId } });
            if (error) throw new Error('Não foi possível iniciar o pagamento.');
            const { sessionId } = data;
            if (!sessionId) throw new Error('A sessão de pagamento não pôde ser criada.');
            await stripe.redirectToCheckout({ sessionId });
        } catch (error) {
            alert(error.message);
            button.disabled = false;
        }
    }

    async function handleAvatarUpload(event) {
        const file = event.target.files[0];
        if (!file || !currentUser) return;
        document.querySelectorAll('#avatar-input-dashboard + label').forEach(el => el.textContent = 'Enviando...');
        const filePath = `${currentUser.id}.${file.name.split('.').pop()}`;
        const { error: uploadError } = await _supabase.storage.from('avatar').upload(filePath, file, { cacheControl: '3600', upsert: true });
        if (uploadError) {
            alert('Falha ao enviar a foto.');
        } else {
            const { error: updateError } = await _supabase.from('profiles').update({ avatar_url: filePath }).eq('id', currentUser.id);
            if (updateError) alert('Erro ao salvar a nova foto.');
        }
        await loadUserProfile(currentUser);
        document.querySelectorAll('#avatar-input-dashboard + label').forEach(el => el.textContent = 'Inserir foto');
    }

    const MAX_WORDS = 350;
    const MAX_LAST_WORD_LENGTH = 30;

    function updateWordCount() {
        const redacaoTextarea = document.getElementById('redacao');
        const wordCounterEl = document.getElementById('word-counter');
        const formMessageEl = document.getElementById('form-message');
        if (!redacaoTextarea || !wordCounterEl) return;

        const text = redacaoTextarea.value;
        let words = text.trim().split(/\s+/).filter(Boolean);
        let wordCount = text ? words.length : 0;
        let limitReached = false;

        if (wordCount > MAX_WORDS) {
            words = words.slice(0, MAX_WORDS);
            redacaoTextarea.value = words.join(' ') + ' ';
            limitReached = true;
        } else if (wordCount === MAX_WORDS && words.length > 0) {
            let lastWord = words[MAX_WORDS - 1];
            if (lastWord.length > MAX_LAST_WORD_LENGTH) {
                words[MAX_WORDS - 1] = lastWord.slice(0, MAX_LAST_WORD_LENGTH);
                redacaoTextarea.value = words.join(' ');
                limitReached = true;
            }
        }

        const finalWords = redacaoTextarea.value.trim().split(/\s+/).filter(Boolean);
        const finalWordCount = redacaoTextarea.value ? finalWords.length : 0;
        const remaining = MAX_WORDS - finalWordCount;

        wordCounterEl.textContent = `Palavras restantes: ${remaining}`;
        wordCounterEl.classList.toggle('text-red-500', remaining <= 0);
        wordCounterEl.classList.toggle('text-slate-400', remaining > 0);
        
        if (limitReached && formMessageEl) {
            formMessageEl.textContent = `Limite de ${MAX_WORDS} palavras atingido.`;
            formMessageEl.className = 'mt-4 text-center text-yellow-400';
        } else if (formMessageEl && formMessageEl.textContent.includes('Limite')) {
            formMessageEl.textContent = '';
            formMessageEl.className = 'mt-4 text-center';
        }
    }

    // =================================================================
    // LÓGICA DOS FLASHCARDS
    // =================================================================

    async function fetchFlashcards(user) {
        if (!user) return;
        const { data, error } = await _supabase.from('flashcards').select('palavra, artigo').eq('user_id', user.id);
        if (error) { console.error("Erro ao buscar flashcards:", error); return; }
        
        userFlashcards = (data || []).filter(card => card.palavra && card.artigo);
        
        document.querySelectorAll('.flashcard-message').forEach(el => {
            el.textContent = userFlashcards.length > 0 ? `Você tem ${userFlashcards.length} flashcards para praticar.` : "Escreva textos para gerar flashcards.";
        });
        document.querySelectorAll('.start-flashcard-btn').forEach(btn => {
            btn.classList.toggle('hidden', userFlashcards.length === 0);
        });
    }

    function startFlashcardGame(startButton) {
        if (userFlashcards.length === 0) return;
        isGameActive = true;
        currentFlashcardIndex = 0;
        userFlashcards.sort(() => Math.random() - 0.5);

        const container = startButton.closest('.flex-grow, .mobile-section');
        const gameContainer = container.querySelector('.flashcard-game-container');
        const startContainer = container.querySelector('.flashcard-start-container');
        
        startContainer.classList.add('hidden');
        gameContainer.classList.remove('hidden');
        
        displayCurrentFlashcard(container);
    }

    function displayCurrentFlashcard(container) {
        if (currentFlashcardIndex >= userFlashcards.length) { 
            endFlashcardGame(container); 
            return; 
        }
        const card = userFlashcards[currentFlashcardIndex];
        
        const flashcardEl = container.querySelector('.flashcard');
        if (!flashcardEl) return;
        flashcardEl.classList.remove('is-flipped');
        
        const flashcardBackEl = container.querySelector('.flashcard-back');
        if(flashcardBackEl) {
            flashcardBackEl.classList.remove('bg-green-500', 'bg-red-500');
        }

        const flashcardWordEl = container.querySelector('.flashcard-word');
        if (flashcardWordEl) {
            flashcardWordEl.textContent = card.palavra;
        }
    }

    function checkAnswer(selectedArticle, buttonElement) {
        if (!isGameActive) return;
        isGameActive = false; 
        
        const container = buttonElement.closest('.flex-grow, .mobile-section');
        const currentCard = userFlashcards[currentFlashcardIndex];
        const isCorrect = selectedArticle === currentCard.artigo;

        const flashcardEl = container.querySelector('.flashcard');
        const flashcardBackEl = container.querySelector('.flashcard-back');
        const flashcardFeedbackTextEl = container.querySelector('.flashcard-feedback-text');

        flashcardEl.classList.add('is-flipped');
        if (isCorrect) {
            flashcardBackEl.classList.add('bg-green-500');
            flashcardFeedbackTextEl.textContent = `Correto! ${currentCard.artigo} ${currentCard.palavra}`;
        } else {
            flashcardBackEl.classList.add('bg-red-500');
            flashcardFeedbackTextEl.textContent = `Incorreto. O certo é ${currentCard.artigo} ${currentCard.palavra}`;
            flashcardEl.classList.add('shake');
            setTimeout(() => flashcardEl.classList.remove('shake'), 500);
        }

        setTimeout(() => {
            currentFlashcardIndex++;
            displayCurrentFlashcard(container);
            isGameActive = true;
        }, 2000);
    }

    function endFlashcardGame(container) {
        isGameActive = false;
        container.querySelector('.flashcard-game-container').classList.add('hidden');
        const startContainer = container.querySelector('.flashcard-start-container');
        startContainer.classList.remove('hidden');
        startContainer.querySelector('.flashcard-message').textContent = "Parabéns, você completou a rodada!";
    }

    // =================================================================
    // LÓGICA DE LAYOUT RESPONSIVO
    // =================================================================
    
    function setupResponsiveLayout() {
        const navButtons = document.querySelectorAll('.nav-button');
        const mobileSections = document.querySelectorAll('.mobile-section');
        const flashcardDesktopContainer = document.querySelector('#flashcard-desktop-container');
    
        const updateView = () => {
            const isDesktop = window.innerWidth >= 1024;
    
            if (isDesktop) {
                mobileSections.forEach(section => {
                    section.style.display = '';
                });
                if (flashcardDesktopContainer) {
                    flashcardDesktopContainer.style.display = '';
                }
            } else {
                let activeTab = document.querySelector('.nav-button.active');
                
                if (!activeTab) {
                    activeTab = document.querySelector('[data-target="perfil-section"]');
                    if (activeTab) activeTab.classList.add('active');
                }
                const targetId = activeTab ? activeTab.dataset.target : 'perfil-section';
    
                mobileSections.forEach(section => {
                    section.style.display = section.id === targetId ? 'block' : 'none';
                });

                if (document.getElementById('perfil-section').style.display === 'block') {
                    document.getElementById('perfil-section').style.display = 'flex';
                }

                if (flashcardDesktopContainer) {
                    flashcardDesktopContainer.style.display = 'none';
                }
            }
        };
    
        navButtons.forEach(button => {
            button.addEventListener('click', () => {
                if (window.innerWidth < 1024) {
                    navButtons.forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                    updateView();
                }
            });
        });
    
        window.addEventListener('resize', updateView);
        updateView();
    }

    function attachEventListeners() {
        document.body.addEventListener('click', (event) => {
            if (event.target.matches('#logout-button-mobile, #logout-button-desktop')) {
                handleLogout();
            }
            if (event.target.closest('.buy-credits-btn')) {
                handlePurchaseClick(event);
            }
            if (event.target.matches('.start-flashcard-btn')) {
                startFlashcardGame(event.target);
            }
            const articleBtn = event.target.closest('.article-btn');
            if (articleBtn) {
                checkAnswer(articleBtn.dataset.article, articleBtn);
            }
        });

        const correctionFormEl = document.getElementById('correction-form');
        if (correctionFormEl) correctionFormEl.addEventListener('submit', handleCorrectionSubmit);
        
        const redacaoTextarea = document.getElementById('redacao');
        if (redacaoTextarea) {
            redacaoTextarea.addEventListener('input', updateWordCount);
        }
        
        document.body.addEventListener('change', (event) => {
            if (event.target.matches('#avatar-input-dashboard')) {
                handleAvatarUpload(event);
            }
        });
        
        window.addEventListener('creditsUpdated', () => {
            if (currentUser) {
                console.log('Evento creditsUpdated recebido. A recarregar perfil...');
                loadUserProfile(currentUser);
            }
        });

        // Event listener para o botão de filtrar últimas 10 redações
        const toggleLast10Btn = document.getElementById('toggle-last-10');
        if (toggleLast10Btn) {
            toggleLast10Btn.addEventListener('click', toggleLast10Essays);
        }

        // Chama a função uma vez para definir o estado inicial
        updateWordCount();
    }
});
