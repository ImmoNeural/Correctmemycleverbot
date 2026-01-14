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

        const webhookUrl = 'https://pastro83.app.n8n.cloud/webhook/corrige';
        const flashcardWebhookUrl = 'https://pastro83.app.n8n.cloud/webhook/flashcard';
        const trataerroWebhookUrl = 'https://pastro83.app.n8n.cloud/webhook/trataerro';

        try {
            if (formMessageEl) formMessageEl.textContent = 'A enviar para correção...';

            // Enviar para os 3 webhooks em paralelo
            const [response, flashcardResponse, trataerroResponse] = await Promise.all([
                fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataToSend) }),
                fetch(flashcardWebhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: currentUser.email, redacao: dataToSend.redacao }) }),
                fetch(trataerroWebhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataToSend) })
            ]);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Ocorreu um problema ao comunicar com o sistema de correção.');
            }

            // Processar resposta do webhook trataerro
            let trataerroData = null;
            if (trataerroResponse.ok) {
                trataerroData = await trataerroResponse.json();
            }

            await loadUserProfile(currentUser);

            // Se recebeu dados do trataerro, mostrar análise detalhada
            if (trataerroData) {
                const textoOriginal = dataToSend.redacao;

                // Categorias de erros
                const categorias = {
                    declinacao: { cor: 'bg-pink-400', corHex: '#f472b6', nome: 'Declinação' },
                    conjugacao: { cor: 'bg-purple-400', corHex: '#c084fc', nome: 'Conjugação' },
                    preposicoes: { cor: 'bg-blue-400', corHex: '#60a5fa', nome: 'Preposições' },
                    sintaxe: { cor: 'bg-orange-400', corHex: '#fb923c', nome: 'Sintaxe' },
                    vocabulario: { cor: 'bg-green-400', corHex: '#4ade80', nome: 'Vocabulário' }
                };

                // Coletar todos os erros (SEM duplicar)
                let todosErros = [];
                let palavrasParaGrifar = []; // Separado: para grifar no texto

                Object.keys(categorias).forEach(categoria => {
                    if (trataerroData[categoria] && Array.isArray(trataerroData[categoria])) {
                        trataerroData[categoria].forEach(erro => {
                            const palavraErrada = (erro.palavra_errada || '').trim();
                            if (palavraErrada) {
                                // Adicionar erro UMA VEZ para exibição
                                todosErros.push({
                                    palavra: palavraErrada,
                                    sugestao: erro.sugestao_correcao || '',
                                    explicacao: erro.descricao_topico_grammatical || erro.descricao_topico_gramatical || '',
                                    topico: erro.topico_grammatical_nome || erro.topico_gramatical_nome || '',
                                    categoria: categoria,
                                    cor: categorias[categoria].cor,
                                    corHex: categorias[categoria].corHex
                                });

                                // Dividir palavras compostas APENAS para grifar
                                const palavras = palavraErrada.split(/\s+/);
                                palavras.forEach(palavra => {
                                    if (palavra) {
                                        palavrasParaGrifar.push({
                                            palavra: palavra,
                                            cor: categorias[categoria].cor
                                        });
                                    }
                                });
                            }
                        });
                    }
                });

                // Grifar texto (usando palavrasParaGrifar, não todosErros)
                let textoGrifado = textoOriginal;
                const palavrasJaGrifadas = new Set();

                palavrasParaGrifar.forEach(item => {
                    const palavra = item.palavra;
                    if (palavra && !palavrasJaGrifadas.has(palavra.toLowerCase())) {
                        // Escapar regex
                        const palavraEscapada = palavra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const regex = new RegExp(`\\b${palavraEscapada}\\b`, 'gi');

                        textoGrifado = textoGrifado.replace(regex, (match) => {
                            return `<mark class="${item.cor} text-black px-1 rounded">${match}</mark>`;
                        });

                        palavrasJaGrifadas.add(palavra.toLowerCase());
                    }
                });

                // Montar HTML
                let mensagem = '';

                // Legenda
                mensagem += `<div class="mt-4 p-4 bg-slate-800 rounded-lg">
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
                </div>`;

                // Texto Original
                mensagem += `<div class="mt-4 p-4 bg-slate-700 rounded-lg">
                    <p class="text-white font-semibold mb-3">Texto original</p>
                    <div class="text-white leading-relaxed whitespace-pre-wrap">${textoGrifado}</div>
                </div>`;

                // Análise Detalhada
                const totalErros = todosErros.length;
                mensagem += `<div class="mt-4 p-4 bg-slate-800 rounded-lg">
                    <p class="text-white font-semibold mb-3">Análise detalhada (${totalErros} erro${totalErros !== 1 ? 's' : ''}):</p>`;

                // Agrupar erros por categoria
                Object.keys(categorias).forEach(catKey => {
                    const errosCategoria = todosErros.filter(e => e.categoria === catKey);

                    if (errosCategoria.length > 0) {
                        const cat = categorias[catKey];
                        mensagem += `<div class="mt-4 mb-3">
                            <p class="text-white font-semibold mb-2">${cat.nome} (${errosCategoria.length})</p>
                            <div class="space-y-3">`;

                        errosCategoria.forEach(erro => {
                            mensagem += `<div class="bg-slate-700 p-3 rounded-lg text-sm border-l-4" style="border-color: ${erro.corHex}">`;

                            if (erro.topico) {
                                mensagem += `<p class="text-yellow-400 font-semibold mb-2">${erro.topico}</p>`;
                            }

                            mensagem += `<p class="text-red-300 mb-1">
                                <span class="font-semibold">Errado:</span>
                                <span class="line-through">${erro.palavra}</span>
                            </p>`;

                            if (erro.sugestao) {
                                mensagem += `<p class="text-green-300 mb-2">
                                    <span class="font-semibold">Correção:</span>
                                    ${erro.sugestao}
                                </p>`;
                            }

                            if (erro.explicacao) {
                                mensagem += `<p class="text-slate-300 text-xs italic">${erro.explicacao}</p>`;
                            }

                            mensagem += `</div>`;
                        });

                        mensagem += `</div></div>`;
                    }
                });

                mensagem += `</div>`;

                if (formMessageEl) {
                    formMessageEl.innerHTML = mensagem;
                }
            } else {
                // Fallback: mensagem simples
                if (formMessageEl) {
                    formMessageEl.innerHTML = `
                        <div class="text-green-400">
                            <p>Redação enviada com sucesso! Você receberá sua correção por e-mail em 5 a 10 minutos.</p>
                        </div>
                    `;
                }
            }

            document.getElementById('correction-form').reset();
            updateWordCount();
        } catch (error) {
            if (formMessageEl) formMessageEl.textContent = error.message;
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
