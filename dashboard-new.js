// Flag GLOBAL para evitar inicializações duplicadas do jogo da forca
// (fora do closure para funcionar mesmo se DOMContentLoaded executar múltiplas vezes)
let _forcaGameInitializing = false;

document.addEventListener('DOMContentLoaded', () => {
    // =================================================================
    // CONFIGURAÇÃO E INICIALIZAÇÃO
    // =================================================================
    const SUPABASE_URL = 'https://timqizyevfkvqgzvcrlx.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpbXFpenlldmZrdnFnenZjcmx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwMTkwMDYsImV4cCI6MjA2MTU5NTAwNn0.LfWFCPPgzTkh7Scf2Q2LjLmYcLnaWSAGKDiMT8eSuWM';
    const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const STRIPE_PUBLIC_KEY = 'pk_live_51RpZAqCYJo68kcPWlBMokRjXKgRQ3SmtQWTTdED5gzn4qSFD8u2dSV88YKDWvs1FTYFePAbp6lsZrHHWkPR2UKL100vpspXOIy';
    const stripe = Stripe(STRIPE_PUBLIC_KEY);

    // Variáveis globais
    let currentUser = null;
    let errorChart = null;
    let historyChart = null;
    let userFlashcards = [];
    let currentFlashcardIndex = 0;
    let isGameActive = false;
    let ultimaCorrecaoHTML = ''; // Armazena a última correção para persistir na tela

    // =================================================================
    // LÓGICA DE INICIALIZAÇÃO DA APLICAÇÃO
    // =================================================================

    // Flag para evitar redirecionamento prematuro durante callback OAuth
    let isProcessingAuth = false;

    // Verifica se estamos processando um callback OAuth (tokens na URL)
    function isOAuthCallback() {
        const hash = window.location.hash;
        const search = window.location.search;
        return hash.includes('access_token') ||
               hash.includes('refresh_token') ||
               search.includes('code=') ||
               hash.includes('type=');
    }

    // Inicialização: primeiro tenta obter a sessão existente
    async function initAuth() {
        isProcessingAuth = true;

        try {
            // Se for callback OAuth, aguarda o Supabase processar
            if (isOAuthCallback()) {
                console.log('🔄 Processando callback de autenticação...');
                // Aguarda um momento para o Supabase processar os tokens
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // Tenta obter a sessão atual
            const { data: { session }, error } = await _supabase.auth.getSession();

            if (error) {
                console.error('Erro ao obter sessão:', error);
            }

            if (session && session.user) {
                currentUser = session.user;
                window.currentUser = session.user;
                await initializeApp(currentUser);
                window.dispatchEvent(new CustomEvent('userAuthenticated', { detail: { user: session.user } }));
            } else if (!isOAuthCallback()) {
                // Só redireciona se não estiver processando OAuth
                window.location.href = 'login.html';
            }
        } catch (err) {
            console.error('Erro na inicialização de auth:', err);
        } finally {
            isProcessingAuth = false;
        }
    }

    // Inicia a autenticação
    initAuth();

    _supabase.auth.onAuthStateChange((_event, session) => {
        console.log('🔄 Auth state changed:', _event, session?.user?.email);

        // Ignora se já estamos processando
        if (isProcessingAuth) return;

        if (session && session.user) {
            // Só reinicializa se for um usuário diferente
            if (!currentUser || currentUser.id !== session.user.id) {
                currentUser = session.user;
                window.currentUser = session.user;
                initializeApp(currentUser);
                window.dispatchEvent(new CustomEvent('userAuthenticated', { detail: { user: session.user } }));
            }
        } else if (!isOAuthCallback()) {
            console.log('❌ No session, redirecting to login');
            window.location.href = 'login.html';
        }
    });

    async function initializeApp(user) {
        console.log('🚀 Inicializando app para usuário:', user.email);
        console.log('🔑 User ID:', user.id);

        try {
            // Verificar se usuário completou onboarding ANTES de carregar dashboard
            const { data: leadData, error: leadError } = await _supabase
                .from('leads')
                .select('id')
                .eq('id', user.id)
                .single();

            console.log('📊 Lead data:', leadData);
            console.log('📊 Lead error:', leadError);

            if (leadError && leadError.code !== 'PGRST116') {
                console.error('⚠️ Erro ao verificar leads (continuando mesmo assim):', leadError);
            }

            // Se não está na tabela leads, redirecionar para onboarding
            if (!leadData && (!leadError || leadError.code === 'PGRST116')) {
                console.log('➡️ Usuário não completou onboarding, redirecionando...');
                window.location.href = 'onboarding.html';
                return;
            }

            console.log('✅ Usuário já completou onboarding, carregando perfil...');

            // Carregar perfil e anexar listeners
            await loadUserProfile(user);
            attachEventListeners();

        } catch (initError) {
            console.error('❌ Erro crítico na inicialização:', initError);
            // Mesmo com erro, tenta carregar o perfil básico
            try {
                await loadUserProfile(user);
                attachEventListeners();
            } catch (fallbackError) {
                console.error('❌ Erro no fallback de carregamento:', fallbackError);
            }
        }

        // Restaura correção salva ao carregar a página (se estiver na seção REDAÇÃO)
        const correcaoSalva = localStorage.getItem('ultimaCorrecaoHTML');
        if (correcaoSalva) {
            ultimaCorrecaoHTML = correcaoSalva;
            const sectionRedacao = document.getElementById('section-redacao');
            const formMessageEl = document.getElementById('form-message');
            // Se a seção REDAÇÃO estiver visível, restaura imediatamente
            if (sectionRedacao && !sectionRedacao.classList.contains('hidden') && formMessageEl) {
                formMessageEl.innerHTML = correcaoSalva;
                console.log('Correção restaurada ao carregar página');
            }
        }

        // --- INÍCIO DA CORREÇÃO ---
        // Sistema robusto de restauração usando Eventos de Visibilidade
        // (Substitui o setInterval anterior)

        // Função centralizada para restaurar a correção
        function restaurarCorrecaoSeNecessario() {
            const sectionRedacao = document.getElementById('section-redacao');
            const formMessageEl = document.getElementById('form-message');
            
            // Só executa se a seção de redação estiver visível e o formMessageEl existir
            if (formMessageEl && sectionRedacao && !sectionRedacao.classList.contains('hidden')) {
                const htmlAtual = formMessageEl.innerHTML.trim();
                const correcaoSalva = localStorage.getItem('ultimaCorrecaoHTML'); // Usar localStorage como fonte da verdade
                
                // Placeholder que é definido durante o envio
                const placeholderEnviando = '<p class="text-yellow-400">Enviando... aguarde 1 minuto...</p>';

                // [NOVA LÓGICA]
                // Restaurar se:
                // 1. Existe uma correção salva.
                // 2. O campo está-
                //    a) Totalmente vazio (htmlAtual === '')
                //    b) Mostrando o placeholder de "Enviando..." (que pode ter ficado "preso" na tela)
                if (correcaoSalva && (htmlAtual === '' || htmlAtual === placeholderEnviando)) {
                    console.log('Restaurando correção ao re-focar a aba.');
                    formMessageEl.innerHTML = correcaoSalva;
                    // Garante que o data-attribute também está sincronizado
                    formMessageEl.setAttribute('data-correcao-salva', correcaoSalva); 
                }
            }
        }

        // Substitui o setInterval por listeners de eventos mais eficientes
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                restaurarCorrecaoSeNecessario();

                // Chatbot não precisa reiniciar - o iframe é preservado
            }
        });
        
        // O evento 'focus' ajuda a pegar casos que o 'visibilitychange' pode perder
        window.addEventListener('focus', () => {
             restaurarCorrecaoSeNecessario();
             // Chatbot não precisa reiniciar - o iframe é preservado
        });
        
        // --- FIM DA CORREÇÃO ---
    }

    // =================================================================
    // CARREGAMENTO E RENDERIZAÇÃO DE DADOS
    // =================================================================

    async function loadUserProfile(user) {
        console.log('👤 loadUserProfile chamada para:', user.email, 'ID:', user.id);

        const columnsToSelect = 'credits, avatar_url, total_essays, error_declinacao, error_conjugacao, error_sintaxe, error_preposicao, error_vocabulario';
        let profile = null;

        try {
            console.log('🔍 Buscando perfil no Supabase...');
            const { data, error } = await _supabase.from('profiles').select(columnsToSelect).eq('id', user.id).single();
            console.log('🔍 Resultado da busca:', { data, error });

            if (error && error.code !== 'PGRST116') {
                console.error("Erro ao buscar perfil:", error);
                // Continua mesmo com erro para tentar mostrar dados básicos do usuário
            } else {
                profile = data;
            }

            // Se não existe perfil, tenta criar um novo
            if (!profile) {
                console.log('Criando novo perfil para usuário:', user.id);
                const { data: newProfile, error: insertError } = await _supabase
                    .from('profiles')
                    .insert([{ id: user.id, credits: 200 }])
                    .select(columnsToSelect)
                    .single();

                if (insertError) {
                    console.error("Erro ao criar perfil:", insertError);
                    // Usa perfil padrão se a inserção falhar
                    profile = { credits: 200, avatar_url: null, total_essays: 0, error_declinacao: 0, error_conjugacao: 0, error_sintaxe: 0, error_preposicao: 0, error_vocabulario: 0 };
                } else {
                    profile = newProfile;
                }
            }

            // Sempre atualiza a UI com o que temos disponível
            updateUI(user, profile || { credits: 0, avatar_url: null, total_essays: 0, error_declinacao: 0, error_conjugacao: 0, error_sintaxe: 0, error_preposicao: 0, error_vocabulario: 0 });
            await loadErrorHistory(user);

        } catch (err) {
            console.error("Erro inesperado ao carregar perfil:", err);
            // Mesmo com erro, tenta atualizar a UI com dados básicos do usuário
            updateUI(user, { credits: 0, avatar_url: null, total_essays: 0, error_declinacao: 0, error_conjugacao: 0, error_sintaxe: 0, error_preposicao: 0, error_vocabulario: 0 });
        }
    }

    function updateUI(user, profile) {
        console.log('📊 updateUI chamada com:', { email: user.email, credits: profile?.credits });

        const emailElements = document.querySelectorAll('#user-email');
        const creditsElements = document.querySelectorAll('#user-credits');

        console.log('📊 Elementos encontrados:', { emailElements: emailElements.length, creditsElements: creditsElements.length });

        emailElements.forEach(el => {
            el.textContent = user.email;
            console.log('✅ Email atualizado para:', user.email);
        });
        creditsElements.forEach(el => {
            el.textContent = profile.credits !== null ? profile.credits : 0;
            console.log('✅ Créditos atualizados para:', profile.credits);
        });
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

        const errorDeclinacaoEl = document.getElementById('error-declinacao');
        if (errorDeclinacaoEl) errorDeclinacaoEl.textContent = `${profile.error_declinacao || 0} erros`;

        const errorConjugacaoEl = document.getElementById('error-conjugacao');
        if (errorConjugacaoEl) errorConjugacaoEl.textContent = `${profile.error_conjugacao || 0} erros`;

        const errorSintaxeEl = document.getElementById('error-sintaxe');
        if (errorSintaxeEl) errorSintaxeEl.textContent = `${profile.error_sintaxe || 0} erros`;

        const errorPreposicaoEl = document.getElementById('error-preposicao');
        if (errorPreposicaoEl) errorPreposicaoEl.textContent = `${profile.error_preposicao || 0} erros`;

        const errorVocabularioEl = document.getElementById('error-vocabulario');
        if (errorVocabularioEl) errorVocabularioEl.textContent = `${profile.error_vocabulario || 0} erros`;

        renderErrorChart(profile);

        const chatbotPromptContainer = document.querySelector('#chatbot-prompt-container');
        // [NOVA VERIFICAÇÃO] Só define o placeholder se o container estiver VAZIO
        // e não tiver já o iframe do chatbot.
        if (chatbotPromptContainer && !chatbotPromptContainer.querySelector('iframe')) {
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
            labels: ['Declinação', 'Conjugação', 'Sintaxe', 'Preposição', 'Vocabulário'],
            datasets: [{
                data: errorData,
                backgroundColor: ['#f472b6', '#c084fc', '#fb923c', '#60a5fa', '#4ade80'],
                borderColor: ['#ec4899', '#a855f7', '#f97316', '#3b82f6', '#22c55e'],
                borderWidth: 2
            }]
        };

        errorChart = new Chart(chartCanvas, {
            type: 'pie',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        color: '#fff',
                        font: { weight: 'bold', size: 14 },
                        formatter: (value) => value > 0 ? value : ''
                    }
                }
            }
        });
    }

    let showingLast10 = false;
    let fullHistoryData = [];

    async function loadErrorHistory(user) {
        const container = document.getElementById('history-chart-container');
        if (!container) return;

        const { data: history, error } = await _supabase
            .from('essay_history')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true });

        if (error) {
            console.warn('Histórico de erros não disponível (tabela não existe):', error.message);
            container.innerHTML = '<p class="text-slate-400 text-center">Histórico de erros não disponível.</p>';
            return;
        }

        fullHistoryData = history || [];

        if (historyChart) historyChart.destroy();

        if (fullHistoryData.length === 0) {
            container.innerHTML = '<p class="text-slate-400 text-center">Ainda não há histórico de erros disponível.</p>';
            return;
        } else {
            container.innerHTML = '<canvas id="history-chart"></canvas>';
        }

        renderHistoryChart(fullHistoryData);
    }

    function renderHistoryChart(historyData) {
        const chartCanvas = document.getElementById('history-chart');
        if (!chartCanvas) return;

        if (historyChart) historyChart.destroy();

        const labels = historyData.map((_, index) => `Redação ${index + 1}`);
        const declinacaoData = historyData.map(h => h.error_declinacao || 0);
        const conjugacaoData = historyData.map(h => h.error_conjugacao || 0);
        const sintaxeData = historyData.map(h => h.error_sintaxe || 0);
        const preposicaoData = historyData.map(h => h.error_preposicao || 0);
        const vocabularioData = historyData.map(h => h.error_vocabulario || 0);

        historyChart = new Chart(chartCanvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Declinação', data: declinacaoData, backgroundColor: '#f472b6' },
                    { label: 'Conjugação', data: conjugacaoData, backgroundColor: '#c084fc' },
                    { label: 'Sintaxe', data: sintaxeData, backgroundColor: '#fb923c' },
                    { label: 'Preposição', data: preposicaoData, backgroundColor: '#60a5fa' },
                    { label: 'Vocabulário', data: vocabularioData, backgroundColor: '#4ade80' }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    datalabels: { display: false },
                    legend: { position: 'top', labels: { color: '#cbd5e1' } },
                    tooltip: { mode: 'index', intersect: false }
                },
                scales: {
                    y: { beginAtZero: true, stacked: true, ticks: { color: '#cbd5e1', stepSize: 1 }, grid: { color: 'rgba(100, 116, 139, 0.2)' } },
                    x: { stacked: true, ticks: { color: '#cbd5e1' }, grid: { color: 'rgba(100, 116, 139, 0.2)' } }
                }
            }
        });
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
            renderHistoryChart(last10);

            // Atualizar também o gráfico de pizza com dados das últimas 10
            updatePieChartForLast10(last10);

            if (button) button.textContent = 'Mostrar todas as redações';
        } else {
            // Mostrar todas as redações
            container.innerHTML = '<canvas id="history-chart"></canvas>';
            renderHistoryChart(fullHistoryData);

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
        const errorDeclinacaoEl = document.getElementById('error-declinacao');
        if (errorDeclinacaoEl) errorDeclinacaoEl.textContent = `${totals.declinacao} erros`;

        const errorConjugacaoEl = document.getElementById('error-conjugacao');
        if (errorConjugacaoEl) errorConjugacaoEl.textContent = `${totals.conjugacao} erros`;

        const errorSintaxeEl = document.getElementById('error-sintaxe');
        if (errorSintaxeEl) errorSintaxeEl.textContent = `${totals.sintaxe} erros`;

        const errorPreposicaoEl = document.getElementById('error-preposicao');
        if (errorPreposicaoEl) errorPreposicaoEl.textContent = `${totals.preposicao} erros`;

        const errorVocabularioEl = document.getElementById('error-vocabulario');
        if (errorVocabularioEl) errorVocabularioEl.textContent = `${totals.vocabulario} erros`;

        // Atualizar o gráfico de pizza
        renderErrorChart({
            error_declinacao: totals.declinacao,
            error_conjugacao: totals.conjugacao,
            error_sintaxe: totals.sintaxe,
            error_preposicao: totals.preposicao,
            error_vocabulario: totals.vocabulario
        });
    }

    // =================================================================
    // EVENT HANDLERS E LÓGICA DE NEGÓCIO
    // =================================================================

    async function handleLogout() {
        await _supabase.auth.signOut();
        // Redirecionar para a página de login
        window.location.href = 'login.html';
    }
async function handleCorrectionSubmit(e) {
    e.preventDefault();
    console.log('🚀 handleCorrectionSubmit (prioriza campos de descrição)');

    const formMessageEl = document.getElementById('form-message');
    if (formMessageEl) formMessageEl.innerHTML = '<p class="text-yellow-400">Enviando... aguarde 1 minuto...</p>';

    const redacaoTextarea = document.getElementById('redacao');
    const text = (redacaoTextarea?.value || '').trim();
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length > 350) {
        if (formMessageEl) formMessageEl.innerHTML = '<p class="text-red-400">O texto excede o limite de 350 palavras.</p>';
        return;
    }

    const dataToSend = {
        userId: currentUser?.id || '',
        nome: document.getElementById('user-name')?.value || '',
        email: currentUser?.email || '',
        redacao: text,
        nivel: document.querySelector('input[name="nivel"]:checked')?.value || ''
    };


     // função que PRIORIZA os campos de descrição (texto explicativo)
     function getExplanation(erro) {
         if (!erro || typeof erro !== 'object') return 'Explicação não disponível';

         const preferredKeys = [
             'gramatica',
             'descricao_topico_gramatical', // Chave corrigida
             'descricao',
             'explicacao',
             'explanation'
         ];
         const fallbackPattern = /descricao|topico|explic|explan/i;
         const visited = new WeakSet();

         const extractText = (value) => {
             if (!value) return '';
             if (typeof value === 'string') {
                 const trimmed = value.trim();
                 return trimmed && !/^\d+$/.test(trimmed) ? trimmed : '';
             }

             if (typeof value === 'object') {
                 if (visited.has(value)) return '';
                 visited.add(value);
             }

             if (Array.isArray(value)) {
                 for (const item of value) {
                     const text = extractText(item);
                     if (text) return text;
                 }
                 return '';
             }

             if (typeof value === 'object') {
                 for (const key of Object.keys(value)) {
                     const text = extractText(value[key]);
                     if (text) return text;
                 }
             }

             return '';
         };

         for (const key of preferredKeys) {
             if (Object.prototype.hasOwnProperty.call(erro, key)) {
                 const text = extractText(erro[key]);
                 if (text) return text;
             }
         }

         for (const key of Object.keys(erro)) {
             if (fallbackPattern.test(key)) {
                 const text = extractText(erro[key]);
                 if (text) return text;
             }
         }

         const nested = extractText(erro);
         return nested || 'Explicação não fornecida pelo webhook.';
     }

    try {
        // Inicia extração de substantivos em paralelo (não precisa esperar)
        // Extrai todos os substantivos da redação com artigos corretos e traduções
        fetch('/.netlify/functions/flashcard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: dataToSend.email, redacao: dataToSend.redacao })
        }).catch(err => console.warn('Flashcard error (não crítico):', err));

        // Definição das categorias (precisa estar acessível antes)
        const categorias = {
            declinacao: { corHex: '#f472b6', nome: 'Declinação' },
            conjugacao: { corHex: '#c084fc', nome: 'Conjugação' },
            preposicoes: { corHex: '#60a5fa', nome: 'Preposições' },
            sintaxe: { corHex: '#fb923c', nome: 'Sintaxe' },
            vocabulario: { corHex: '#4ade80', nome: 'Vocabulário' }
        };

        // IMEDIATAMENTE: Mostra legenda + texto do usuário
        if (formMessageEl) {
            formMessageEl.innerHTML = `
                <div style="padding: 16px; background-color: #1e293b; border-radius: 8px; margin-bottom: 20px;">
                    <h3 style="font-size: 16px; font-weight: 600; color: #cbd5e1; margin-bottom: 12px;">Legenda de Cores:</h3>
                    <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                        ${Object.values(categorias).map(c => `
                            <span style="display: flex; align-items: center; gap: 6px; padding: 6px 12px; background-color: #334155; border-radius: 6px;">
                                <span style="display: inline-block; width: 14px; height: 14px; background: ${c.corHex}; border-radius: 3px;"></span>
                                <span style="color: #e2e8f0; font-size: 14px;">${c.nome}</span>
                            </span>`).join('')}
                    </div>
                </div>

                <div style="padding: 16px; background-color: #1e293b; border-radius: 8px; margin-bottom: 20px;">
                    <h3 style="font-size: 16px; font-weight: 600; color: #cbd5e1; margin-bottom: 10px;">Análise do seu texto:</h3>
                    <div id="texto-corrigido-container" style="padding: 12px; background-color: #0f172a; border-radius: 6px; font-size: 15px; line-height: 1.7; color: #e2e8f0;">${escapeHtml(text)}</div>
                </div>

                <div id="status-analise" style="padding: 16px; background-color: #1e293b; border-radius: 8px; margin-bottom: 20px;">
                    <div class="text-yellow-400" style="display: flex; align-items: center; gap: 10px;">
                        <span class="loading-spinner" style="width: 20px; height: 20px; border: 2px solid #fbbf24; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></span>
                        <span>Analisando erros gramaticais...</span>
                    </div>
                </div>

                <style>@keyframes spin { to { transform: rotate(360deg); } }</style>

                <h3 style="font-size: 18px; font-weight: 600; color: #cbd5e1; margin-bottom: 16px;">Detalhes dos Erros:</h3>
                <div id="detalhes-erros-container"></div>
            `;
            formMessageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        let fullResponse = '';

        // Chama a Edge Function com streaming
        const trataRes = await fetch('/api/trataerro-stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataToSend)
        });

        if (!trataRes.ok) {
            const errorText = await trataRes.text();
            console.error('trataerro-stream error:', trataRes.status, errorText);
            if (formMessageEl) {
                formMessageEl.innerHTML = `<div class="text-red-400"><p>Erro ao processar correção: ${trataRes.status}</p><p class="text-sm">${errorText}</p></div>`;
            }
            return;
        }

        // Referências aos elementos que já estão na tela
        const textoContainer = document.getElementById('texto-corrigido-container');
        const statusAnalise = document.getElementById('status-analise');
        const detalhesContainer = document.getElementById('detalhes-erros-container');

        // Estado para processamento em tempo real
        let textoAtual = escapeHtml(text);
        const errosProcessados = new Set();
        const categoriasExibidas = new Set();
        let totalErrosExibidos = 0;

        // Adiciona CSS para animação
        const styleEl = document.createElement('style');
        styleEl.textContent = `
            @keyframes fadeInMark {
                from { opacity: 0; transform: scale(0.8); background-color: #fef08a; }
                to { opacity: 1; transform: scale(1); }
            }
            @keyframes slideInCard {
                from { opacity: 0; transform: translateX(-20px); }
                to { opacity: 1; transform: translateX(0); }
            }
            @keyframes pulseHighlight {
                0%, 100% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.4); }
                50% { box-shadow: 0 0 0 8px rgba(251, 191, 36, 0); }
            }
            .error-card-appear {
                animation: slideInCard 0.4s ease-out forwards;
            }
            .mark-highlight {
                animation: fadeInMark 0.5s ease-out, pulseHighlight 0.6s ease-out;
            }
        `;
        document.head.appendChild(styleEl);

        // Função para pintar uma palavra no texto
        function pintarPalavraNoTexto(palavra, corHex) {
            const markStyle = `background-color:${corHex}; color:#000000; padding:2px 4px; border-radius:3px;`;
            const markClass = 'mark-highlight';

            if (palavra.includes('...')) {
                const partes = palavra.split('...').map(p => p.trim()).filter(p => p);
                partes.forEach(parte => {
                    const escaped = parte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    textoAtual = textoAtual.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), (match) => {
                        return `<mark class="${markClass}" style="${markStyle}">${match}</mark>`;
                    });
                });
            } else {
                const escaped = palavra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                textoAtual = textoAtual.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), (match) => {
                    return `<mark class="${markClass}" style="${markStyle}">${match}</mark>`;
                });
            }

            if (textoContainer) {
                textoContainer.innerHTML = textoAtual;
            }
        }

        // Função para criar/obter container da categoria
        function getOrCreateCategoryContainer(catKey) {
            const existingContainer = document.getElementById(`cat-container-${catKey}`);
            if (existingContainer) return existingContainer;

            const cat = categorias[catKey];
            const catContainer = document.createElement('div');
            catContainer.id = `cat-container-${catKey}`;
            catContainer.className = 'error-card-appear';
            catContainer.style.cssText = 'margin-bottom: 24px;';
            catContainer.innerHTML = `
                <h4 style="font-size: 18px; font-weight: 700; color: ${cat.corHex}; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 3px solid ${cat.corHex}; display: flex; align-items: center; gap: 10px;">
                    <span style="display: inline-block; width: 12px; height: 12px; background: ${cat.corHex}; border-radius: 50%;"></span>
                    ${cat.nome}
                </h4>
                <div id="cat-errors-${catKey}"></div>
            `;

            if (detalhesContainer) {
                detalhesContainer.appendChild(catContainer);
            }
            categoriasExibidas.add(catKey);
            return catContainer;
        }

        // Função para exibir um erro (pintar palavra + mostrar card)
        function exibirErro(catKey, errObj) {
            const cat = categorias[catKey];
            const palavraErrada = (errObj.palavra_errada || errObj.palavra || '').trim();

            // Gera ID único para evitar duplicatas
            const erroId = `${catKey}-${palavraErrada}-${errObj.sugestao_correcao || ''}`;
            if (errosProcessados.has(erroId)) return;
            errosProcessados.add(erroId);

            // 1. Pinta a palavra no texto IMEDIATAMENTE
            if (palavraErrada) {
                pintarPalavraNoTexto(palavraErrada, cat.corHex);
            }

            // 2. Cria/obtém container da categoria
            getOrCreateCategoryContainer(catKey);
            const errorsContainer = document.getElementById(`cat-errors-${catKey}`);

            // 3. Extrai dados do erro
            const tituloErro = escapeHtml((errObj.topico_grammatical_nome || errObj.topico_gramatical_nome || '').trim());
            const palavraErradaEscaped = escapeHtml(palavraErrada);
            const sugestaoCorrecao = escapeHtml((errObj.sugestao_correcao || '').trim());
            const gramatica = escapeHtml((errObj.gramatica || '').trim());

            // 4. Cria o card do erro (formato anterior - mais simples)
            const cardDiv = document.createElement('div');
            cardDiv.className = 'error-card-appear';
            cardDiv.style.cssText = `background-color: #1e293b; border: 1px solid #475569; border-left: 4px solid ${cat.corHex}; border-radius: 8px; padding: 16px; margin-bottom: 12px;`;
            cardDiv.innerHTML = `
                ${tituloErro ? `
                    <div style="margin-bottom: 12px;">
                        <strong style="color: #a78bfa; font-size: 15px;">${tituloErro}</strong>
                    </div>` : ''}

                ${palavraErradaEscaped ? `
                    <p style="margin: 0 0 8px 0; font-size: 14px;">
                        <span style="color: #94a3b8;">Palavra Errada:</span>
                        <span style="color: #fca5a5; font-weight: 600;">${palavraErradaEscaped}</span>
                    </p>` : ''}

                ${sugestaoCorrecao ? `
                    <p style="margin: 0 0 8px 0; font-size: 14px;">
                        <span style="color: #94a3b8;">Correção:</span>
                        <span style="color: #86efac; font-weight: 600;">${sugestaoCorrecao}</span>
                    </p>` : ''}

                ${gramatica ? `
                    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #334155;">
                        <p style="margin: 0; color: #cbd5e1; font-size: 14px; line-height: 1.6;">${gramatica}</p>
                    </div>` : ''}
            `;

            if (errorsContainer) {
                errorsContainer.appendChild(cardDiv);
                cardDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }

            totalErrosExibidos++;

            // Atualiza status
            if (statusAnalise) {
                statusAnalise.innerHTML = `
                    <div class="text-yellow-400" style="display: flex; align-items: center; gap: 10px;">
                        <span class="loading-spinner" style="width: 20px; height: 20px; border: 2px solid #fbbf24; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></span>
                        <span>Analisando... ${totalErrosExibidos} erro(s) encontrado(s)</span>
                    </div>
                `;
            }
        }

        // Parser incremental para extrair erros do JSON em streaming
        const camposComConteudo = ['palavra_errada', 'palavra', 'sugestao_correcao', 'sugestao', 'gramatica', 'descricao_topico_gramatical', 'descricao', 'explicacao', 'explanation'];
        const categoryKeys = Object.keys(categorias);
        let lastProcessedLength = 0;

        function tentarExtrairErros(jsonStr) {
            // Para cada categoria, tenta extrair objetos de erro completos
            for (const catKey of categoryKeys) {
                // Procura pelo padrão "categoria": [...]
                const catPattern = new RegExp(`"${catKey}"\\s*:\\s*\\[`, 'g');
                let match;

                while ((match = catPattern.exec(jsonStr)) !== null) {
                    const startIdx = match.index + match[0].length;
                    let depth = 1;
                    let objStart = -1;
                    let i = startIdx;

                    while (i < jsonStr.length && depth > 0) {
                        const char = jsonStr[i];

                        if (char === '{') {
                            if (objStart === -1) objStart = i;
                            depth++;
                        } else if (char === '}') {
                            depth--;
                            if (depth === 1 && objStart !== -1) {
                                // Objeto completo encontrado
                                const objStr = jsonStr.substring(objStart, i + 1);
                                try {
                                    const errObj = JSON.parse(objStr);
                                    // Verifica se tem conteúdo válido
                                    const hasContent = camposComConteudo.some((field) =>
                                        typeof errObj[field] === 'string' && errObj[field].trim().length > 0
                                    );
                                    if (hasContent) {
                                        exibirErro(catKey, errObj);
                                    }
                                } catch (e) {
                                    // Objeto ainda incompleto, ignora
                                }
                                objStart = -1;
                            }
                        } else if (char === '[') {
                            depth++;
                        } else if (char === ']') {
                            depth--;
                        }
                        i++;
                    }
                }
            }
        }

        // Processa o stream em tempo real
        const reader = trataRes.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            fullResponse += chunk;

            // Tenta extrair erros do JSON acumulado
            if (fullResponse.length > lastProcessedLength + 50) {
                tentarExtrairErros(fullResponse);
                lastProcessedLength = fullResponse.length;
            }
        }

        // Processamento final - garante que todos os erros foram capturados
        tentarExtrairErros(fullResponse);

        console.log('trataerro-stream raw response:', fullResponse);

        // Mantém reload do perfil
        await loadUserProfile(currentUser);

        // Atualiza status final
        if (statusAnalise) {
            if (totalErrosExibidos === 0) {
                statusAnalise.innerHTML = `<div class="text-green-400"><p>Redação sem erros! Parabéns!</p></div>`;
            } else {
                statusAnalise.innerHTML = `
                    <div class="text-green-400" style="display: flex; align-items: center; gap: 10px;">
                        <span>✓ Análise completa! ${totalErrosExibidos} erro(s) encontrado(s).</span>
                    </div>
                `;
            }
        }

        // Salva a correção final no localStorage
        const htmlFinal = formMessageEl ? formMessageEl.innerHTML : '';
        ultimaCorrecaoHTML = htmlFinal;
        localStorage.setItem('ultimaCorrecaoHTML', htmlFinal);
        if (formMessageEl) {
            formMessageEl.setAttribute('data-correcao-salva', htmlFinal);
        }
        console.log('✅ Correção completa e salva.');

    } catch (err) {
        console.error('Erro ao corrigir:', err);
        if (formMessageEl) formMessageEl.innerHTML = `<p class="text-red-400">Erro: ${err.message}</p>`;
    }
}

    // Pequena função utilitária para escapar HTML (prevenção XSS simples)
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    async function handlePurchaseClick(event) {
        console.log('handlePurchaseClick called');
        const button = event.target.closest('.buy-credits-btn');
        console.log('Button found:', button);
        if (!button) return;

        const priceId = button.dataset.priceId;
        console.log('Price ID:', priceId);
        if (!priceId) {
            console.error('Price ID não encontrado no botão.');
            return;
        }

        button.disabled = true;
        const originalText = button.textContent;
        button.textContent = 'Aguarde...';

        try {
            console.log('Creating checkout session via Netlify function...');

            const response = await fetch('/.netlify/functions/create-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    priceId,
                    userId: currentUser?.id,
                    userEmail: currentUser?.email
                })
            });

            const data = await response.json();

            if (!response.ok) {
                console.error('Checkout error:', data);
                throw new Error(data.error || 'Não foi possível iniciar o pagamento.');
            }

            console.log('Session data:', data);

            // Redirecionar para o checkout do Stripe
            if (data.url) {
                // Redirecionar diretamente para a URL do checkout
                window.location.href = data.url;
            } else if (data.sessionId) {
                // Usar Stripe.js para redirecionar
                console.log('Redirecting to Stripe with session ID:', data.sessionId);
                await stripe.redirectToCheckout({ sessionId: data.sessionId });
            } else {
                throw new Error('A sessão de pagamento não pôde ser criada.');
            }

        } catch (error) {
            console.error('Erro ao processar compra:', error);
            alert(error.message || 'Erro ao processar compra.');
            button.disabled = false;
            button.textContent = originalText;
        }
    }

    async function handleAvatarUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const fileExt = file.name.split('.').pop();
        const fileName = `${currentUser.id}-${Date.now()}.${fileExt}`;
        const filePath = fileName;

        const { error: uploadError } = await _supabase.storage.from('avatar').upload(filePath, file, { upsert: true });

        if (uploadError) {
            console.error('Erro ao fazer upload da imagem:', uploadError);
            alert('Erro ao fazer upload da imagem. Tente novamente.');
            return;
        }

        const { error: updateError } = await _supabase.from('profiles').update({ avatar_url: filePath }).eq('id', currentUser.id);

        if (updateError) {
            console.error('Erro ao atualizar perfil:', updateError);
            return;
        }

        await loadUserProfile(currentUser);
    }

    function updateWordCount() {
        const redacaoTextarea = document.getElementById('redacao');
        const wordCounterEl = document.getElementById('word-counter');
        const formMessageEl = document.getElementById('form-message');
        if (!redacaoTextarea || !wordCounterEl) return;

        const text = redacaoTextarea.value;
        let words = text.trim().split(/\s+/).filter(Boolean);
        let wordCount = text.trim() === '' ? 0 : words.length;

        if (wordCount > 350) {
            wordCounterEl.textContent = `${wordCount} / 350 palavras (Limite excedido!)`;
            wordCounterEl.classList.add('text-red-400');
            wordCounterEl.classList.remove('text-slate-400');
            // MOSTRAR ERRO: Mostra o erro de limite no painel de mensagem
            if (formMessageEl) formMessageEl.innerHTML = '<p class="text-red-400">O texto excede o limite de 350 palavras.</p>';
        
        } else {
            wordCounterEl.textContent = `${wordCount} / 350 palavras`;
            wordCounterEl.classList.remove('text-red-400');
            wordCounterEl.classList.add('text-slate-400');
            
            // LIMPAR ERRO: Se a mensagem atual é a de erro, limpa.
            // Isso previne que a correção válida seja limpa.
            if (formMessageEl && formMessageEl.innerHTML.includes('text-red-400')) {
                formMessageEl.innerHTML = '';
            }
        }
        
        // LIMPAR CORREÇÃO ANTIGA: Se o usuário apagar todo o texto (começando de novo),
        // aí sim limpamos a correção antiga da tela e do localStorage.
        if (wordCount === 0) {
             if (formMessageEl && !formMessageEl.innerHTML.includes('text-red-400')) {
                 formMessageEl.innerHTML = ''; // Limpa a tela
             }
             // Limpa o cache para que a correção antiga não volte
             localStorage.removeItem('ultimaCorrecaoHTML');
             ultimaCorrecaoHTML = '';
        }
    }

    // =================================================================
    // FUNÇÕES PARA CARREGAR DADOS DE VOCABULÁRIO
    // =================================================================

    // Variável global para armazenar a lista ativa
    let activeListName = null;
    let allWordsByList = {};

    async function loadWordlistData() {
        console.log('=== loadWordlistData INICIADA ===');
        const listasMenu = document.getElementById('listas-menu');
        const totalListasCount = document.getElementById('total-listas-count');

        if (!listasMenu || !currentUser) {
            console.error('ERRO: listasMenu ou currentUser não disponível');
            return;
        }

        try {
            console.log('Buscando palavras do Supabase para user_id:', currentUser.id);

            const { data: words, error } = await _supabase
                .from('palavrasgerais')
                .select('*')
                .eq('user_id', currentUser.id);

            console.log('Resposta do Supabase:', { words, error });

            if (error) {
                console.error('ERRO ao buscar palavras:', error);
                throw error;
            }

            console.log('Total de palavras encontradas:', words ? words.length : 0);

            if (!words || words.length === 0) {
                console.log('Nenhuma palavra encontrada');
                listasMenu.innerHTML = '<p class="text-slate-400 text-sm text-center py-8">Nenhuma lista encontrada</p>';
                if (totalListasCount) {
                    totalListasCount.innerHTML = '<span class="font-semibold text-white">0</span> listas no total';
                }
                const contentDiv = document.getElementById('wordlist-content');
                if (contentDiv) {
                    contentDiv.innerHTML = '<p class="text-slate-400 text-center py-8">Nenhuma palavra encontrada. Comece adicionando suas primeiras palavras!</p>';
                }
                return;
            }

            // Agrupar palavras por lista
            allWordsByList = {};
            words.forEach(word => {
                const listName = word.lista || 'Sem Lista';
                if (!allWordsByList[listName]) {
                    allWordsByList[listName] = [];
                }
                allWordsByList[listName].push(word);
            });

            console.log('Palavras agrupadas por lista:', allWordsByList);
            console.log('Número de listas:', Object.keys(allWordsByList).length);

            // Renderizar menu de listas
            renderListasMenu();

            // Selecionar primeira lista automaticamente
            const firstListName = Object.keys(allWordsByList)[0];
            if (firstListName) {
                selectList(firstListName);
            }

        } catch (error) {
            console.error('ERRO ao carregar palavras:', error);
            listasMenu.innerHTML = `<p class="text-red-400 text-sm text-center py-4">Erro ao carregar listas</p>`;
        }
    }

    function renderListasMenu() {
        const listasMenu = document.getElementById('listas-menu');
        const totalListasCount = document.getElementById('total-listas-count');

        if (!listasMenu) return;

        const totalListas = Object.keys(allWordsByList).length;

        // Atualizar contador total
        if (totalListasCount) {
            totalListasCount.innerHTML = `<span class="font-semibold text-white">${totalListas}</span> lista${totalListas !== 1 ? 's' : ''} no total`;
        }

        // Renderizar botões das listas
        let html = '';
        Object.keys(allWordsByList).forEach(listName => {
            const wordCount = allWordsByList[listName].length;
            const isActive = listName === activeListName;

            html += `
                <div class="relative group">
                    <button
                        data-list-name="${escapeHtml(listName)}"
                        class="lista-btn w-full text-left px-4 py-3 rounded-lg transition-all ${
                            isActive
                                ? 'bg-gradient-to-r from-purple-600 to-pink-600 shadow-lg'
                                : 'bg-slate-700 hover:bg-slate-600'
                        }"
                    >
                        <div class="flex items-center justify-between">
                            <div class="flex-1 min-w-0">
                                <p class="font-semibold text-white truncate">${escapeHtml(listName)}</p>
                                <p class="text-xs ${isActive ? 'text-purple-100' : 'text-slate-400'} mt-1">
                                    ${wordCount} palavra${wordCount !== 1 ? 's' : ''}
                                </p>
                            </div>
                            <div class="ml-2 flex-shrink-0">
                                <span class="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
                                    isActive
                                        ? 'bg-white text-purple-600'
                                        : 'bg-purple-500 text-white'
                                }">
                                    ${wordCount}
                                </span>
                            </div>
                        </div>
                    </button>
                    <button
                        data-list-name="${escapeHtml(listName)}"
                        class="delete-list-btn absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-red-600 hover:bg-red-700 text-white p-1.5 rounded shadow-lg z-10"
                        title="Apagar lista"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </button>
                </div>
            `;
        });

        listasMenu.innerHTML = html;

        // Adicionar event listeners aos botões das listas
        document.querySelectorAll('.lista-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const listName = btn.dataset.listName;
                selectList(listName);
            });
        });

        // Adicionar event listeners aos botões de deletar
        document.querySelectorAll('.delete-list-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const listName = btn.dataset.listName;
                await deleteList(listName);
            });
        });
    }

    function selectList(listName) {
        console.log('Selecionando lista:', listName);
        activeListName = listName;

        // Atualizar visual do menu
        renderListasMenu();

        // Renderizar palavras da lista selecionada
        renderWordsOfList(listName);
    }

    async function deleteList(listName) {
        if (!confirm(`Tem certeza que deseja apagar a lista "${listName}"?\n\nTodas as ${allWordsByList[listName].length} palavras desta lista serão removidas permanentemente.`)) {
            return;
        }

        try {
            const wordsToDelete = allWordsByList[listName];
            const wordIds = wordsToDelete.map(w => w.id);

            // Deletar todas as palavras da lista do banco
            const { error } = await _supabase
                .from('palavrasgerais')
                .delete()
                .in('id', wordIds);

            if (error) {
                console.error('Erro ao deletar lista:', error);
                alert('Erro ao apagar a lista. Tente novamente.');
                return;
            }

            // Remover do objeto local
            delete allWordsByList[listName];

            // Se era a lista ativa, selecionar outra
            if (activeListName === listName) {
                const remainingLists = Object.keys(allWordsByList);
                if (remainingLists.length > 0) {
                    selectList(remainingLists[0]);
                } else {
                    activeListName = null;
                    renderListasMenu();
                    const contentDiv = document.getElementById('wordlist-content');
                    if (contentDiv) {
                        contentDiv.innerHTML = '<p class="text-slate-400 text-center py-8">Nenhuma palavra encontrada. Comece adicionando suas primeiras palavras!</p>';
                    }
                }
            } else {
                renderListasMenu();
            }

            console.log(`Lista "${listName}" deletada com sucesso`);
        } catch (error) {
            console.error('Erro ao deletar lista:', error);
            alert('Erro ao apagar a lista. Tente novamente.');
        }
    }

    function renderWordsOfList(listName) {
        const contentDiv = document.getElementById('wordlist-content');
        if (!contentDiv) return;

        const listWords = allWordsByList[listName] || [];

        if (listWords.length === 0) {
            contentDiv.innerHTML = '<p class="text-slate-400 text-center py-8">Nenhuma palavra nesta lista</p>';
            return;
        }

        console.log(`Renderizando ${listWords.length} palavras da lista "${listName}"`);

        let html = `
            <div class="bg-slate-800 p-6 rounded-lg shadow-lg">
                <h3 class="text-2xl font-bold mb-6 text-purple-400 flex items-center gap-3">
                    <svg class="w-7 h-7 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                    </svg>
                    ${escapeHtml(listName)}
                    <span class="text-sm font-normal text-slate-400">(${listWords.length} palavra${listWords.length !== 1 ? 's' : ''})</span>
                </h3>
                <div class="space-y-3">
        `;

        listWords.forEach(word => {
            const alemao = escapeHtml(word.palavra || word.alemao || '');
            const portugues = escapeHtml(word.descricao || word.portugues || '');
            const exemplo = word.exemplos || word.exemplo || '';
            const colorClass = getColorBorderClass(word.cartao);

            html += `
                <div class="bg-slate-700 rounded-lg p-4 flex justify-between items-center gap-4 ${colorClass}">
                    <div class="flex-1">
                        <p class="text-lg font-bold text-green-400">${alemao}</p>
                        <p class="text-slate-300">${portugues}</p>
                        ${exemplo ? `<p class="text-sm text-slate-400 italic mt-2">"${escapeHtml(exemplo)}"</p>` : ''}
                    </div>
                    <div class="flex items-center gap-4">
                        <div class="flex items-center gap-2 color-flags-container" data-word-id="${word.id}">
                            ${createColorFlagsHTML(word)}
                        </div>
                        <div class="flex items-center">
                            <button data-word-id="${word.id}" class="edit-word-btn text-blue-500 hover:text-blue-400 p-2">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z"></path></svg>
                            </button>
                            <button data-word-id="${word.id}" class="delete-word-btn text-red-500 hover:text-red-400 p-2">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        contentDiv.innerHTML = html;
        console.log('=== Palavras da lista renderizadas com sucesso ===');
    }

    function createColorFlagsHTML(word) {
        if (word.cartao) {
            const colorClass = {
                'vermelho': 'bg-red-500',
                'amarelo': 'bg-yellow-500',
                'verde': 'bg-green-500'
            }[word.cartao] || 'bg-slate-500';
            return `<div class="w-5 h-5 rounded-md cursor-pointer ${colorClass}" data-color="${word.cartao}" title="${word.cartao}"></div>`;
        } else {
            return `
                <div class="w-4 h-4 rounded-md cursor-pointer bg-red-500 hover:ring-2 ring-white/70" data-color="vermelho" title="Difícil"></div>
                <div class="w-4 h-4 rounded-md cursor-pointer bg-yellow-500 hover:ring-2 ring-white/70" data-color="amarelo" title="Aprendendo"></div>
                <div class="w-4 h-4 rounded-md cursor-pointer bg-green-500 hover:ring-2 ring-white/70" data-color="verde" title="Aprendido"></div>
            `;
        }
    }

    function getColorBorderClass(color) {
        const colorMap = {
            'vermelho': 'border-l-4 border-red-500',
            'amarelo': 'border-l-4 border-yellow-500',
            'verde': 'border-l-4 border-green-500'
        };
        return colorMap[color] || '';
    }

    async function loadArtigosData() {
        console.log('=== loadArtigosData INICIADA ===');
        const contentDiv = document.getElementById('artigos-content');
        console.log('contentDiv:', contentDiv);
        console.log('currentUser:', currentUser);

        if (!contentDiv || !currentUser) {
            console.error('ERRO: contentDiv ou currentUser não disponível para artigos');
            return;
        }

        contentDiv.innerHTML = '<p class="text-slate-400 text-center py-8">Carregando palavras com artigos...</p>';

        try {
            console.log('Buscando flashcards do Supabase para user_id:', currentUser.id);

            // Busca todos os flashcards do usuário (substantivos das redações)
            const { data: flashcards, error } = await _supabase
                .from('flashcards')
                .select('*')
                .eq('user_id', currentUser.id);

            console.log('Resposta do Supabase (flashcards):', { flashcards, error });

            if (error) {
                console.error('ERRO ao buscar flashcards:', error);
                throw error;
            }

            console.log('Total de flashcards encontrados:', flashcards ? flashcards.length : 0);

            if (!flashcards || flashcards.length === 0) {
                contentDiv.innerHTML = `
                    <div class="text-center py-8">
                        <p class="text-slate-400 mb-4">Nenhuma palavra com artigo encontrada.</p>
                        <p class="text-slate-500 text-sm">Envie redações na seção "Corrigir Redação" para construir seu vocabulário de artigos!</p>
                    </div>
                `;
                return;
            }

            // Agrupar por artigo
            const byArtigo = {
                'der': flashcards.filter(f => f.artigo === 'der'),
                'die': flashcards.filter(f => f.artigo === 'die'),
                'das': flashcards.filter(f => f.artigo === 'das')
            };

            // Função auxiliar para renderizar cada palavra
            const renderWord = (word, index, artigo, borderColor) => {
                const palavraTexto = word.palavra ? escapeHtml(word.palavra) : '';
                const traducaoTexto = word.traducao ? escapeHtml(word.traducao) : '';

                return `
                    <div class="bg-slate-700 hover:bg-slate-600 p-3 rounded-lg border-l-4 ${borderColor} cursor-pointer transition-all"
                         onclick="window.toggleTraducao('${artigo}-${index}')">
                        <p class="text-white font-semibold">${artigo} ${palavraTexto}</p>
                        <div id="${artigo}-${index}" class="text-slate-300 text-sm mt-2 hidden">
                            ${traducaoTexto ? `<p class="text-emerald-400">📚 ${traducaoTexto}</p>` : '<p class="text-slate-500 italic">Clique em Atualizar para obter a tradução</p>'}
                        </div>
                    </div>
                `;
            };

            // Renderizar no estilo da imagem: cores fortes APENAS nos labels, fundo escuro/neutro
            let html = '<div class="grid grid-cols-1 md:grid-cols-3 gap-6">';

            // DER - Masculino (Label azul, fundo escuro)
            html += `
                <div class="bg-slate-800 rounded-xl shadow-lg overflow-hidden">
                    <div class="bg-gradient-to-r from-blue-600 to-blue-700 p-4 text-center">
                        <h3 class="text-5xl font-bold text-white mb-1">DER</h3>
                        <p class="text-blue-100 text-sm">Masculino</p>
                        <p class="text-blue-200 text-xs mt-1">${byArtigo.der.length} palavra(s)</p>
                    </div>
                    <div class="p-4 space-y-2 max-h-96 overflow-y-auto">
            `;
            if (byArtigo.der.length === 0) {
                html += `<p class="text-slate-500 text-center text-sm py-4">Nenhuma palavra com DER</p>`;
            } else {
                byArtigo.der.forEach((word, index) => {
                    html += renderWord(word, index, 'der', 'border-blue-500');
                });
            }
            html += `</div></div>`;

            // DIE - Feminino (Label rosa, fundo escuro)
            html += `
                <div class="bg-slate-800 rounded-xl shadow-lg overflow-hidden">
                    <div class="bg-gradient-to-r from-pink-600 to-pink-700 p-4 text-center">
                        <h3 class="text-5xl font-bold text-white mb-1">DIE</h3>
                        <p class="text-pink-100 text-sm">Feminino</p>
                        <p class="text-pink-200 text-xs mt-1">${byArtigo.die.length} palavra(s)</p>
                    </div>
                    <div class="p-4 space-y-2 max-h-96 overflow-y-auto">
            `;
            if (byArtigo.die.length === 0) {
                html += `<p class="text-slate-500 text-center text-sm py-4">Nenhuma palavra com DIE</p>`;
            } else {
                byArtigo.die.forEach((word, index) => {
                    html += renderWord(word, index, 'die', 'border-pink-500');
                });
            }
            html += `</div></div>`;

            // DAS - Neutro (Label verde, fundo escuro)
            html += `
                <div class="bg-slate-800 rounded-xl shadow-lg overflow-hidden">
                    <div class="bg-gradient-to-r from-green-600 to-green-700 p-4 text-center">
                        <h3 class="text-5xl font-bold text-white mb-1">DAS</h3>
                        <p class="text-green-100 text-sm">Neutro</p>
                        <p class="text-green-200 text-xs mt-1">${byArtigo.das.length} palavra(s)</p>
                    </div>
                    <div class="p-4 space-y-2 max-h-96 overflow-y-auto">
            `;
            if (byArtigo.das.length === 0) {
                html += `<p class="text-slate-500 text-center text-sm py-4">Nenhuma palavra com DAS</p>`;
            } else {
                byArtigo.das.forEach((word, index) => {
                    html += renderWord(word, index, 'das', 'border-green-500');
                });
            }
            html += `</div></div>`;

            html += '</div>';

            console.log('HTML de artigos gerado, tamanho:', html.length);
            console.log('DER:', byArtigo.der.length, 'palavras');
            console.log('DIE:', byArtigo.die.length, 'palavras');
            console.log('DAS:', byArtigo.das.length, 'palavras');
            console.log('Injetando HTML de artigos no contentDiv...');

            contentDiv.innerHTML = html;

            console.log('=== loadArtigosData CONCLUÍDA COM SUCESSO ===');

        } catch (error) {
            console.error('ERRO ao carregar artigos:', error);
            contentDiv.innerHTML = '<p class="text-red-400 text-center py-8">Erro ao carregar artigos. Tente novamente.</p>';
        }
    }

    // Função global para toggle de tradução
    window.toggleTraducao = function(id) {
        console.log('toggleTraducao chamado com id:', id);
        const element = document.getElementById(id);
        console.log('Elemento encontrado:', element);
        if (element) {
            element.classList.toggle('hidden');
            console.log('Classes após toggle:', element.className);
        } else {
            console.error('Elemento não encontrado para id:', id);
        }
    };

    async function loadFlashcardsData() {
        console.log('Carregando flashcards...');
        // Mostrar a tela de escolha do tipo de jogo
        showScreen('flashcard-type-choice');
    }

    // =================================================================
    // INTEGRAÇÃO DO CHATBOT
    // =================================================================
    let chatbotInitialized = false;

    async function initializeChatbot() {
        const chatbotContainer = document.getElementById('chatbot-prompt-container');
        if (!chatbotContainer) {
            console.error('❌ Container do chatbot não encontrado');
            return;
        }

        // Verificar se o iframe já existe para preservar histórico
        const existingIframe = chatbotContainer.querySelector('#chatbot-iframe');
        if (existingIframe) {
            console.log('✅ Chatbot iframe já existe, preservando histórico...');
            return; // Não recriar, manter o histórico
        }

        console.log('🤖 Inicializando chatbot integrado...');
        loadChatbotIframe();
    }

    function attemptAlternativeChatbotIntegration() {
        const chatbotContainer = document.getElementById('chatbot-prompt-container');

        console.log('🔍 Procurando elementos do chatbot no DOM...');

        // Procurar por qualquer div do chatbot que possa ter sido criada
        const allDivs = document.querySelectorAll('body > div');
        console.log(`🧾 Total de divs encontrados no body: ${allDivs.length}`);

        let chatbotDiv = null;
        let foundElements = [];

        for (const div of allDivs) {
            const style = window.getComputedStyle(div);
            const hasIframe = div.querySelector('iframe');
            const hasButton = div.querySelector('button');
            const id = div.id || 'sem-id';
            const classes = div.className || 'sem-classes';

            // Log de todos os divs fixed para debug
            if (style.position === 'fixed') {
                foundElements.push({
                    id,
                    classes,
                    hasIframe: !!hasIframe,
                    hasButton: !!hasButton,
                    bottom: style.bottom,
                    zIndex: style.zIndex
                });
            }

            // Procurar widget do chatbot (geralmente tem iframe mas não é o bubble)
            if (hasIframe && style.position === 'fixed') {
                const isBottomPositioned = style.bottom !== 'auto' || div.style.bottom;
                const isLarge = div.offsetWidth > 300; // Widget é maior que bubble

                // Widget principal: tem iframe, é fixed, é grande, NÃO está no bottom-right como bubble
                if (isLarge && !hasButton) {
                    chatbotDiv = div;
                    console.log('✅ Widget do chatbot encontrado!', { id, classes });
                    break;
                }
            }
        }

        console.log('📄 Elementos fixed encontrados:', foundElements);

        if (chatbotDiv) {
            console.log('🔧 Integrando widget do chatbot...');

            // Limpar container
            chatbotContainer.innerHTML = '';

            // Remover posicionamento fixo e ajustar estilos
            chatbotDiv.style.position = 'relative';
            chatbotDiv.style.width = '100%';
            chatbotDiv.style.height = '100%';
            chatbotDiv.style.top = 'auto';
            chatbotDiv.style.left = 'auto';
            chatbotDiv.style.right = 'auto';
            chatbotDiv.style.bottom = 'auto';
            chatbotDiv.style.transform = 'none';
            chatbotDiv.style.borderRadius = '0';
            chatbotDiv.style.margin = '0';
            chatbotDiv.style.maxWidth = 'none';
            chatbotDiv.style.maxHeight = 'none';

            // Ajustar iframes internos
            const iframes = chatbotDiv.querySelectorAll('iframe');
            iframes.forEach(iframe => {
                iframe.style.width = '100%';
                iframe.style.height = '100%';
                iframe.style.borderRadius = '0';
                iframe.style.border = 'none';
            });

            // Mover para o container
            chatbotContainer.appendChild(chatbotDiv);

            chatbotInitialized = true;
            console.log('✅ Chatbot integrado com sucesso!');
        } else {
            console.error('❌ Widget do chatbot não encontrado no DOM');
            chatbotContainer.innerHTML = `
                <div class="text-center space-y-4">
                    <div class="text-6xl mb-4">⚠️</div>
                    <p class="text-red-400 text-lg font-semibold">Chatbot não carregado</p>
                    <p class="text-slate-400 text-sm">O script do chatbot pode não ter sido carregado corretamente.</p>
                    <button onclick="location.reload()" class="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold text-white transition-all">
                        Recarregar Página
                    </button>
                </div>
            `;
        }
    }

    function loadChatbotIframe() {
        const chatbotContainer = document.getElementById('chatbot-prompt-container');

        if (!chatbotContainer) {
            console.error('❌ Container do chatbot não encontrado');
            return;
        }

        console.log('🛠️ Criando interface do chatbot...');

        // Limpar container
        chatbotContainer.innerHTML = '';

        // Criar iframe que carrega o script do chatbot IMEDIATAMENTE
        const iframe = document.createElement('iframe');
                iframe.id = 'chatbot-iframe';
                iframe.style.width = '100%';
                iframe.style.height = '100%';
                iframe.style.border = 'none';
                iframe.style.borderRadius = '0';
                iframe.style.display = 'block';
                iframe.allow = 'microphone';
                iframe.title = 'Chatbot de Alemão';

                // Criar conteúdo HTML para o iframe
                const iframeContent = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <style>
                            body {
                                margin: 0;
                                padding: 0;
                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                                background: #0f172a;
                                color: white;
                                overflow: hidden;
                            }
                        </style>
                    </head>
                    <body>
                        <div id="chatbot-root"></div>
                        <script>
                            // Obter dados do usuário autenticado do parent window
                            const getUserData = () => {
                                try {
                                    const parentUser = window.parent.currentUser;
                                    if (parentUser) {
                                        console.log('✅ Dados do usuário obtidos do parent:', {
                                            userId: parentUser.id,
                                            email: parentUser.email
                                        });
                                        return {
                                            userId: parentUser.id,
                                            email: parentUser.email
                                        };
                                    } else {
                                        console.warn('⚠️ window.parent.currentUser não está disponível');
                                    }
                                } catch (e) {
                                    console.error('❌ Erro ao acessar dados do usuário:', e);
                                }
                                return { userId: null, email: null };
                            };

                            // Configuração do Chatbot Widget v051
                            window.ChatWidgetConfig = {
                                webhook: {
                                    url: '/.netlify/functions/chatbot',
                                },
                                getUserData: getUserData,
                                embedded: true,
                                showBubble: false,
                                autoOpen: true,
                                placeholder: 'Digite sua mensagem em alemão...',
                                sendButtonText: 'Enviar'
                            };
                        </script>
                        <script src="bot_051.js?v=${Date.now()}"></script>
                    </body>
                    </html>
                `;

                // Escrever conteúdo no iframe
                iframe.onload = () => {
                    console.log('✅ Iframe do chatbot carregado');
                    chatbotInitialized = true;
                };

                iframe.srcdoc = iframeContent;

        // Adicionar ao container
        chatbotContainer.appendChild(iframe);

        console.log('✅ Chatbot iframe criado!');
    }

    // Variável global para armazenar o ID da palavra sendo editada
    let currentWordToEditId = null;

    // Funções para gerenciar modais
    function showAddWordModal() {
        document.getElementById('add-word-modal').classList.remove('hidden');
        document.getElementById('add-word-form').reset();
        document.getElementById('add-word-error').textContent = '';

        // Se há uma lista ativa, preencher automaticamente o campo
        if (activeListName) {
            document.getElementById('word-lista').value = activeListName;
        }
    }

    function hideAddWordModal() {
        document.getElementById('add-word-modal').classList.add('hidden');
    }

    function showEditWordModal(wordId) {
        currentWordToEditId = wordId;

        // Buscar dados da palavra
        _supabase
            .from('palavrasgerais')
            .select('*')
            .eq('id', wordId)
            .single()
            .then(({ data: word, error }) => {
                if (error) {
                    console.error('Erro ao buscar palavra:', error);
                    return;
                }

                // Preencher formulário
                document.getElementById('edit-word-german').value = word.palavra || word.alemao || '';
                document.getElementById('edit-word-translation').value = word.descricao || word.portugues || '';
                document.getElementById('edit-word-example').value = word.exemplos || word.exemplo || '';

                // Mostrar modal
                document.getElementById('edit-word-modal').classList.remove('hidden');
                document.getElementById('edit-word-error').textContent = '';
            });
    }

    function hideEditWordModal() {
        document.getElementById('edit-word-modal').classList.add('hidden');
        currentWordToEditId = null;
    }

    // Funções para gerenciar modal de criar lista
    function showCreateListModal() {
        document.getElementById('create-list-modal').classList.remove('hidden');
        document.getElementById('create-list-form').reset();
        document.getElementById('create-list-error').textContent = '';
        // Focar no input
        setTimeout(() => {
            document.getElementById('list-name').focus();
        }, 100);
    }

    function hideCreateListModal() {
        document.getElementById('create-list-modal').classList.add('hidden');
    }

    async function handleCreateList(e) {
        e.preventDefault();
        const errorDiv = document.getElementById('create-list-error');
        errorDiv.textContent = '';

        const listName = document.getElementById('list-name').value.trim();

        if (!listName) {
            errorDiv.textContent = 'Por favor, digite um nome para a lista.';
            return;
        }

        // Verificar se já existe uma lista com este nome
        if (allWordsByList[listName]) {
            errorDiv.textContent = 'Já existe uma lista com este nome. Escolha outro nome.';
            return;
        }

        // Criar lista vazia (apenas adicionar ao objeto local)
        allWordsByList[listName] = [];

        // Fechar modal e renderizar menu
        hideCreateListModal();
        renderListasMenu();

        // Selecionar a nova lista
        selectList(listName);

        // Mostrar mensagem de sucesso
        const contentDiv = document.getElementById('wordlist-content');
        if (contentDiv) {
            contentDiv.innerHTML = `
                <div class="bg-slate-800 p-6 rounded-lg shadow-lg text-center">
                    <svg class="w-16 h-16 text-green-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <h3 class="text-2xl font-bold text-white mb-2">Lista "${escapeHtml(listName)}" criada com sucesso!</h3>
                    <p class="text-slate-400 mb-6">Comece adicionando suas primeiras palavras a esta lista.</p>
                    <button onclick="document.getElementById('btn-adicionar-palavra').click()" class="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-lg font-semibold text-white transition-all shadow-lg hover:shadow-xl">
                        Adicionar Primeira Palavra
                    </button>
                </div>
            `;
        }
    }

    async function handleAddWord(e) {
        e.preventDefault();
        const errorDiv = document.getElementById('add-word-error');
        errorDiv.textContent = '';

        const newWord = {
            lista: document.getElementById('word-lista').value.trim(),
            user_id: currentUser.id,
            palavra: document.getElementById('word-german').value.trim(),
            descricao: document.getElementById('word-translation').value.trim(),
            exemplos: document.getElementById('word-example').value.trim() || null,
            cartao: null
        };

        if (!newWord.palavra || !newWord.descricao || !newWord.lista) {
            errorDiv.textContent = 'Por favor, preencha todos os campos obrigatórios.';
            return;
        }

        // Verificar se a palavra já existe (em qualquer lista)
        const { data: existingWords, error: checkError } = await _supabase
            .from('palavrasgerais')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('palavra', newWord.palavra);

        if (checkError) {
            console.error('Erro ao verificar palavra:', checkError);
            errorDiv.textContent = 'Erro ao verificar palavra existente.';
            return;
        }

        if (existingWords && existingWords.length > 0) {
            const existingWord = existingWords[0];
            errorDiv.textContent = `A palavra "${newWord.palavra}" já existe na lista "${existingWord.lista}". Devido à restrição do banco de dados, cada palavra só pode existir uma vez. Você pode editar a palavra existente ou escolher outra palavra.`;
            return;
        }

        const { error } = await _supabase.from('palavrasgerais').insert(newWord);
        if (error) {
            console.error('Erro ao adicionar palavra:', error);
            errorDiv.textContent = `Erro ao salvar: ${error.message}`;
        } else {
            const savedListName = activeListName; // Preservar lista ativa
            hideAddWordModal();
            await loadWordlistData();
            // Reselecionar a lista onde a palavra foi adicionada ou a lista ativa anterior
            if (allWordsByList[newWord.lista]) {
                selectList(newWord.lista);
            } else if (savedListName && allWordsByList[savedListName]) {
                selectList(savedListName);
            }
        }
    }

    async function handleEditWord(e) {
        e.preventDefault();
        const errorDiv = document.getElementById('edit-word-error');
        errorDiv.textContent = '';

        const updatedWord = {
            palavra: document.getElementById('edit-word-german').value.trim(),
            descricao: document.getElementById('edit-word-translation').value.trim(),
            exemplos: document.getElementById('edit-word-example').value.trim() || null
        };

        if (!updatedWord.palavra || !updatedWord.descricao) {
            errorDiv.textContent = 'Os campos de palavra e tradução são obrigatórios.';
            return;
        }

        const { error } = await _supabase
            .from('palavrasgerais')
            .update(updatedWord)
            .eq('id', currentWordToEditId);

        if (error) {
            console.error('Erro ao atualizar palavra:', error);
            errorDiv.textContent = `Erro ao atualizar: ${error.message}`;
        } else {
            const savedListName = activeListName; // Preservar lista ativa
            hideEditWordModal();
            await loadWordlistData();
            // Reselecionar a mesma lista
            if (savedListName && allWordsByList[savedListName]) {
                selectList(savedListName);
            }
        }
    }

    async function handleDeleteWord(wordId) {
        // Substituir o confirm() por um modal customizado no futuro, se desejado.
        // Por enquanto, o confirm() é funcional, embora bloqueie a UI.
        if (!confirm('Tem certeza que deseja apagar esta palavra?')) {
            return;
        }

        const { error } = await _supabase
            .from('palavrasgerais')
            .delete()
            .eq('id', wordId);

        if (error) {
            console.error('Erro ao apagar palavra:', error);
            alert(`Erro ao apagar: ${error.message}`);
        } else {
            const savedListName = activeListName; // Preservar lista ativa
            await loadWordlistData();
            // Reselecionar a mesma lista se ainda existir
            if (savedListName && allWordsByList[savedListName]) {
                selectList(savedListName);
            }
        }
    }

    async function handleColorUpdate(wordId, color) {
        const { error } = await _supabase
            .from('palavrasgerais')
            .update({ cartao: color })
            .eq('id', wordId);

        if (error) {
            console.error('Erro ao atualizar cor:', error);
            alert(`Erro ao atualizar cor: ${error.message}`);
        } else {
            const savedListName = activeListName; // Preservar lista ativa
            await loadWordlistData();
            // Reselecionar a mesma lista
            if (savedListName && allWordsByList[savedListName]) {
                selectList(savedListName);
            }
        }
    }

    function showImportCsvModal() {
        alert('Funcionalidade de importar CSV em desenvolvimento...');
    }

    // =================================================================
    // ANEXAR EVENT LISTENERS
    // =================================================================

    function attachEventListeners() {
        const logoutButton = document.getElementById('logout-button');
        if (logoutButton) {
            logoutButton.addEventListener('click', handleLogout);
        }

        // Criar barra de navegação inferior APENAS para mobile portrait
        function shouldShowBottomNav() {
            const isPortrait = window.matchMedia('(orientation: portrait)').matches;
            return window.innerWidth <= 768 && isPortrait;
        }

        if (shouldShowBottomNav()) {
            createBottomNav();
        }

        // Recriar barra inferior ao redimensionar janela ou girar
        window.addEventListener('resize', () => {
            const existingBottomNav = document.querySelector('.bottom-nav');
            if (shouldShowBottomNav() && !existingBottomNav) {
                createBottomNav();
            } else if (!shouldShowBottomNav() && existingBottomNav) {
                existingBottomNav.remove();
            }
        });

        function createBottomNav() {
            // Verificar se já existe
            if (document.querySelector('.bottom-nav')) return;

            const bottomNav = document.createElement('div');
            bottomNav.className = 'bottom-nav';

            // Pegar todos os links da sidebar
            const sidebarLinks = document.querySelectorAll('.sidebar nav .sidebar-link');

            sidebarLinks.forEach(link => {
                const clone = link.cloneNode(true);
                // Remover classes do Tailwind que não precisamos
                clone.className = 'sidebar-link';
                bottomNav.appendChild(clone);
            });

            // Adicionar botão de sair no final
            const logoutBtn = document.getElementById('logout-button');
            if (logoutBtn) {
                const logoutLink = document.createElement('a');
                logoutLink.href = '#';
                logoutLink.className = 'sidebar-link';
                logoutLink.innerHTML = `
                    <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                    </svg>
                    <span>Sair</span>
                `;
                logoutLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    handleLogout();
                });
                bottomNav.appendChild(logoutLink);
            }

            document.body.appendChild(bottomNav);

            // Adicionar event listeners aos links clonados
            const bottomLinks = bottomNav.querySelectorAll('.sidebar-link');
            bottomLinks.forEach(link => {
                link.addEventListener('click', (e) => {
                    const sectionName = link.getAttribute('data-section');
                    if (sectionName) {
                        e.preventDefault();

                        // Usar a mesma lógica da sidebar para mostrar seções
                        // Remover classe active de todos os links (sidebar e bottom)
                        document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
                        link.classList.add('active');

                        // Esconder todas as seções
                        document.querySelectorAll('.content-section').forEach(section => {
                            section.classList.add('hidden');
                        });

                        // Mostrar a seção selecionada
                        const targetSection = document.getElementById(`section-${sectionName}`);
                        if (targetSection) {
                            targetSection.classList.remove('hidden');

                            // Carregar dados específicos de cada seção
                            if (sectionName === 'wordlist') {
                                loadWordlistData();
                            } else if (sectionName === 'artigos') {
                                loadArtigosData();
                            } else if (sectionName === 'flashcards') {
                                loadFlashcardsData();
                            } else if (sectionName === 'chatbot') {
                                initializeChatbot();
                            } else if (sectionName === 'conversacao') {
                                initializeConversacao();
                            }
                        }
                    }
                });
            });
        }

        const correctionForm = document.getElementById('correction-form');
        if (correctionForm) {
            correctionForm.addEventListener('submit', handleCorrectionSubmit);
        }

        // Paraphrase form
        const paraphraseForm = document.getElementById('paraphrase-form');
        if (paraphraseForm) {
            paraphraseForm.addEventListener('submit', handleParaphraseSubmit);
        }

        // Paraphrase word counter
        const paraphraseTextarea = document.getElementById('paraphrase-text');
        if (paraphraseTextarea) {
            paraphraseTextarea.addEventListener('input', updateParaphraseWordCount);
        }

        const buyButtons = document.querySelectorAll('.buy-credits-btn');
        buyButtons.forEach(btn => {
            btn.addEventListener('click', handlePurchaseClick);
        });

        const redacaoTextarea = document.getElementById('redacao');
        if (redacaoTextarea) {
            redacaoTextarea.addEventListener('input', updateWordCount);
        }

        document.body.addEventListener('change', (event) => {
            if (event.target.matches('#avatar-input-dashboard')) {
                handleAvatarUpload(event);
            }
        });

        // Listener para atualizar créditos quando a compra for bem-sucedida
        window.addEventListener('creditsUpdated', async () => {
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

        // Event listeners para navegação entre seções (sidebar)
        document.querySelectorAll('.sidebar-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();

                const sectionName = link.dataset.section;
                if (!sectionName) return;

                // Remover classe active de todos os links
                document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));

                // Adicionar classe active ao link clicado
                link.classList.add('active');

                // Esconder todas as seções
                document.querySelectorAll('.content-section').forEach(section => {
                    section.classList.add('hidden');
                });

                // Mostrar a seção selecionada
                const targetSection = document.getElementById(`section-${sectionName}`);
                if (targetSection) {
                    targetSection.classList.remove('hidden');

                    // Carregar dados específicos de cada seção
                    if (sectionName === 'wordlist') {
                        loadWordlistData();
                    } else if (sectionName === 'artigos') {
                        loadArtigosData();
                    } else if (sectionName === 'flashcards') {
                        loadFlashcardsData();
                    } else if (sectionName === 'chatbot') {
                        initializeChatbot();
                    } else if (sectionName === 'redacao') {
                        // Restaura a última correção se existir (de memória ou localStorage)
                        const correcaoSalva = ultimaCorrecaoHTML || localStorage.getItem('ultimaCorrecaoHTML');
                        if (correcaoSalva) {
                            const formMessageEl = document.getElementById('form-message');
                            if (formMessageEl) {
                                formMessageEl.innerHTML = correcaoSalva;
                                console.log('✅ Correção restaurada ao voltar para seção REDAÇÃO');
                            }
                        }
                    } else if (sectionName === 'conversacao') {
                        initializeConversacao();
                    }
                }
            });
        });

        // Event listeners para botões da seção de wordlist
        const btnJogarFlashcards = document.getElementById('btn-jogar-flashcards');
        if (btnJogarFlashcards) {
            btnJogarFlashcards.addEventListener('click', () => {
                // Navegar para a seção de flashcards
                document.querySelector('[data-section="flashcards"]').click();
            });
        }

        const btnImportarCsv = document.getElementById('btn-importar-csv');
        if (btnImportarCsv) {
            btnImportarCsv.addEventListener('click', showImportCsvModal);
        }

        const btnAdicionarPalavra = document.getElementById('btn-adicionar-palavra');
        if (btnAdicionarPalavra) {
            btnAdicionarPalavra.addEventListener('click', showAddWordModal);
        }

        const btnCriarLista = document.getElementById('btn-criar-lista');
        if (btnCriarLista) {
            btnCriarLista.addEventListener('click', showCreateListModal);
        }

        // Event listeners para modais de palavras
        const addWordForm = document.getElementById('add-word-form');
        if (addWordForm) {
            addWordForm.addEventListener('submit', handleAddWord);
        }

        const cancelAddWordBtn = document.getElementById('cancel-add-word-btn');
        if (cancelAddWordBtn) {
            cancelAddWordBtn.addEventListener('click', hideAddWordModal);
        }

        const editWordForm = document.getElementById('edit-word-form');
        if (editWordForm) {
            editWordForm.addEventListener('submit', handleEditWord);
        }

        const cancelEditWordBtn = document.getElementById('cancel-edit-word-btn');
        if (cancelEditWordBtn) {
            cancelEditWordBtn.addEventListener('click', hideEditWordModal);
        }

        // Event listeners para modal de criar lista
        const createListForm = document.getElementById('create-list-form');
        if (createListForm) {
            createListForm.addEventListener('submit', handleCreateList);
        }

        const cancelCreateListBtn = document.getElementById('cancel-create-list-btn');
        if (cancelCreateListBtn) {
            cancelCreateListBtn.addEventListener('click', hideCreateListModal);
        }

        // Event delegation para botões de editar/deletar/color flags que são criados dinamicamente
        document.addEventListener('click', (e) => {
            // Botão de editar palavra
            if (e.target.closest('.edit-word-btn')) {
                const wordId = e.target.closest('.edit-word-btn').dataset.wordId;
                showEditWordModal(wordId);
            }

            // Botão de deletar palavra
            if (e.target.closest('.delete-word-btn')) {
                const wordId = e.target.closest('.delete-word-btn').dataset.wordId;
                handleDeleteWord(wordId);
            }

            // Color flags
            const colorFlag = e.target.closest('.color-flags-container > div[data-color]');
            if (colorFlag) {
                const container = e.target.closest('.color-flags-container');
                const wordId = container.dataset.wordId;
                const color = colorFlag.dataset.color;
                handleColorUpdate(wordId, color);
            }
        });

        // Event listener para o botão de atualizar artigos
        const btnAtualizarArtigos = document.getElementById('btn-atualizar-artigos');
        if (btnAtualizarArtigos) {
            btnAtualizarArtigos.addEventListener('click', () => {
                loadArtigosData();
            });
        }

        // =====================================================================
        // SISTEMA DE FLASHCARDS COM SRS
        // =====================================================================

        let flashcardGameState = {
            type: null, // 'vocab' ou 'artigos'
            words: [],
            currentIndex: 0,
            correctCount: 0,
            wrongCount: 0,
            isFlipped: false
        };

        // Função para salvar estado do jogo
        function saveGameState() {
            localStorage.setItem('flashcardGameState', JSON.stringify({
                type: flashcardGameState.type,
                currentIndex: flashcardGameState.currentIndex,
                correctCount: flashcardGameState.correctCount,
                wrongCount: flashcardGameState.wrongCount,
                totalWords: flashcardGameState.words.length
            }));
        }

        // Função para limpar estado salvo
        function clearSavedGameState() {
            localStorage.removeItem('flashcardGameState');
        }

        // Navegação entre telas
        document.getElementById('btn-vocabulario-game')?.addEventListener('click', () => {
            showScreen('vocabulario-setup');
        });

        document.getElementById('btn-artigos-game')?.addEventListener('click', () => {
            showScreen('artigos-setup');
        });

        document.getElementById('back-from-vocab-setup')?.addEventListener('click', () => {
            showScreen('flashcard-type-choice');
        });

        document.getElementById('back-from-artigos-setup')?.addEventListener('click', () => {
            showScreen('flashcard-type-choice');
        });

        document.getElementById('exit-game-btn')?.addEventListener('click', () => {
            // Mostrar resultados parciais antes de sair
            saveGameState();
            showResults();
        });

        document.getElementById('restart-game-btn')?.addEventListener('click', () => {
            clearSavedGameState();
            resetGame();
            // Resetar flags de inicialização para permitir novo jogo
            _forcaGameInitializing = false;
            if (typeof forcaGameState !== 'undefined') {
                forcaGameState.gameStarting = false;
            }
            showScreen('flashcard-type-choice');
        });

        // Iniciar jogo de Vocabulário
        document.getElementById('start-vocab-game')?.addEventListener('click', async () => {
            const includeRed = document.getElementById('vocab-red').checked;
            const includeYellow = document.getElementById('vocab-yellow').checked;
            const includeGreen = document.getElementById('vocab-green').checked;

            if (!includeRed && !includeYellow && !includeGreen) {
                document.getElementById('vocab-setup-error').textContent = 'Selecione pelo menos um tipo de cartão!';
                return;
            }

            document.getElementById('vocab-setup-error').textContent = '';

            // Buscar palavras da tabela palavrasgerais
            const { data: words, error } = await _supabase
                .from('palavrasgerais')
                .select('*')
                .eq('user_id', currentUser.id);

            if (error) {
                console.error('Erro ao buscar palavras:', error);
                document.getElementById('vocab-setup-error').textContent = 'Erro ao carregar palavras!';
                return;
            }

            if (!words || words.length === 0) {
                document.getElementById('vocab-setup-error').textContent = 'Nenhuma palavra encontrada!';
                return;
            }

            // Filtrar por cartão (vermelho/amarelo/verde)
            let filteredWords = words.filter(word => {
                const cartao = word.cartao || '';
                if (cartao === 'vermelho' && includeRed) return true;
                if (cartao === 'amarelo' && includeYellow) return true;
                if (cartao === 'verde' && includeGreen) return true;
                // Se não tem cartão definido, incluir como vermelho
                if (!cartao && includeRed) return true;
                return false;
            });

            if (filteredWords.length === 0) {
                document.getElementById('vocab-setup-error').textContent = 'Nenhuma palavra com os filtros selecionados!';
                return;
            }

            // Aplicar SRS
            filteredWords = applySRS(filteredWords);

            flashcardGameState = {
                type: 'vocab',
                words: filteredWords,
                currentIndex: 0,
                correctCount: 0,
                wrongCount: 0,
                isFlipped: false
            };

            showScreen('flashcard-game-area');
            document.getElementById('vocab-flashcard-container').classList.remove('hidden');
            document.getElementById('artigos-flashcard-container').classList.add('hidden');
            document.getElementById('forca-game-container').classList.add('hidden');
            showCurrentCard();
        });

        // Iniciar jogo de Artigos (usando substantivos das redações)
        document.getElementById('start-artigos-game')?.addEventListener('click', async () => {
            document.getElementById('artigos-setup-error').textContent = '';

            // Buscar todos os flashcards de artigos das redações
            const { data: artigos, error } = await _supabase
                .from('flashcards')
                .select('*')
                .eq('user_id', currentUser.id);

            if (error) {
                console.error('Erro ao buscar artigos:', error);
                document.getElementById('artigos-setup-error').textContent = 'Erro ao carregar artigos!';
                return;
            }

            if (!artigos || artigos.length === 0) {
                document.getElementById('artigos-setup-error').textContent = 'Nenhuma palavra encontrada! Envie redações para começar.';
                return;
            }

            // Filtrar artigos válidos (que têm artigo e palavra)
            let filteredArtigos = artigos.filter(a => a.artigo && a.palavra);

            if (filteredArtigos.length === 0) {
                document.getElementById('artigos-setup-error').textContent = 'Nenhum artigo válido encontrado!';
                return;
            }

            // Embaralhar aleatoriamente (Fisher-Yates shuffle)
            for (let i = filteredArtigos.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [filteredArtigos[i], filteredArtigos[j]] = [filteredArtigos[j], filteredArtigos[i]];
            }

            flashcardGameState = {
                type: 'artigos',
                words: filteredArtigos,
                currentIndex: 0,
                correctCount: 0,
                wrongCount: 0,
                isFlipped: false
            };

            showScreen('flashcard-game-area');
            document.getElementById('vocab-flashcard-container').classList.add('hidden');
            document.getElementById('artigos-flashcard-container').classList.remove('hidden');
            document.getElementById('forca-game-container').classList.add('hidden');
            showCurrentCard();
        });

        // Flip do card de vocabulário (permitir virar e desvirar)
        window.flipVocabCard = function() {
            const wordEl = document.getElementById('vocab-word');
            const hintEl = document.getElementById('vocab-hint');
            const translationEl = document.getElementById('vocab-translation');
            const exampleEl = document.getElementById('vocab-example');

            if (!flashcardGameState.isFlipped) {
                // Virar: mostrar tradução
                wordEl.classList.add('hidden');
                hintEl.classList.add('hidden');
                translationEl.classList.remove('hidden');
                exampleEl.classList.remove('hidden');
                flashcardGameState.isFlipped = true;
            } else {
                // Desvirar: mostrar palavra
                wordEl.classList.remove('hidden');
                hintEl.classList.remove('hidden');
                translationEl.classList.add('hidden');
                exampleEl.classList.add('hidden');
                flashcardGameState.isFlipped = false;
            }
        };

        // Botões de acerto/erro para vocabulário
        document.getElementById('vocab-correct-btn')?.addEventListener('click', async () => {
            await handleVocabAnswer(true);
        });

        document.getElementById('vocab-wrong-btn')?.addEventListener('click', async () => {
            await handleVocabAnswer(false);
        });

        // Botões de artigos (der/die/das)
        document.querySelectorAll('.artigo-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const selectedArtigo = e.target.dataset.artigo;
                await handleArtigoAnswer(selectedArtigo);
            });
        });

        // Funções auxiliares
        function showScreen(screenId) {
            const screens = ['flashcard-type-choice', 'vocabulario-setup', 'artigos-setup', 'forca-setup', 'flashcard-game-area', 'flashcard-results'];
            screens.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('hidden');
            });

            // Esconder todos os containers de jogo quando não estiver na área de jogo
            if (screenId !== 'flashcard-game-area') {
                document.getElementById('vocab-flashcard-container')?.classList.add('hidden');
                document.getElementById('artigos-flashcard-container')?.classList.add('hidden');
                document.getElementById('forca-game-container')?.classList.add('hidden');
            }

            const targetScreen = document.getElementById(screenId);
            if (targetScreen) targetScreen.classList.remove('hidden');
        }

        function resetGame() {
            flashcardGameState = {
                type: null,
                words: [],
                currentIndex: 0,
                correctCount: 0,
                wrongCount: 0,
                isFlipped: false
            };
        }

        function applySRS(words) {
            const now = new Date();
            const wordsWithPriority = words.map(word => {
                let priority = 100;
                if (!word.ultimo_review) priority += 50;
                const errorRate = word.erros / Math.max(1, word.acertos + word.erros);
                priority += errorRate * 100;
                if (word.proximo_review) {
                    const nextReview = new Date(word.proximo_review);
                    if (nextReview <= now) priority += 200;
                }
                priority += (2.5 - (word.facilidade || 2.5)) * 50;
                return { ...word, priority };
            });
            wordsWithPriority.sort((a, b) => b.priority - a.priority);
            return wordsWithPriority;
        }

        function showCurrentCard() {
            const state = flashcardGameState;
            if (state.currentIndex >= state.words.length) {
                showResults();
                return;
            }

            const word = state.words[state.currentIndex];

            // Atualizar progresso
            document.getElementById('game-progress-text').textContent = `Palavra ${state.currentIndex + 1} de ${state.words.length}`;
            document.getElementById('game-correct-count').textContent = state.correctCount;
            document.getElementById('game-wrong-count').textContent = state.wrongCount;
            const progress = ((state.currentIndex + 1) / state.words.length) * 100;
            document.getElementById('game-progress-bar').style.width = `${progress}%`;

            if (state.type === 'vocab') {
                document.getElementById('vocab-word').textContent = word.palavra;
                document.getElementById('vocab-translation').textContent = word.descricao || 'Sem tradução';
                document.getElementById('vocab-example').textContent = word.exemplos ? `"${word.exemplos}"` : '';
                document.getElementById('vocab-word').classList.remove('hidden');
                document.getElementById('vocab-hint').classList.remove('hidden');
                document.getElementById('vocab-translation').classList.add('hidden');
                document.getElementById('vocab-example').classList.add('hidden');
                state.isFlipped = false;
            } else if (state.type === 'artigos') {
                // Resetar estado dos elementos
                document.getElementById('artigos-word').textContent = word.palavra;
                document.getElementById('artigos-question').classList.remove('hidden');
                document.getElementById('artigos-feedback').classList.add('hidden');
                document.getElementById('artigos-buttons').classList.remove('hidden');
            }
        }

        async function handleVocabAnswer(isCorrect) {
            const state = flashcardGameState;
            const word = state.words[state.currentIndex];

            if (isCorrect) {
                state.correctCount++;
            } else {
                state.wrongCount++;
            }

            // Salvar estado após cada resposta
            saveGameState();

            // Atualizar no banco (tabela palavrasgerais)
            await updateWordStats(word.id, isCorrect, 'palavrasgerais');

            state.currentIndex++;
            showCurrentCard();
        }

		async function handleArtigoAnswer(selectedArtigo) {
			const state = flashcardGameState;
			const word = state.words[state.currentIndex];
			const correctArtigo = word.artigo;
			const isCorrect = selectedArtigo === correctArtigo;

			const flashcardEl = document.getElementById('artigos-flashcard');
			const wordEl = document.getElementById('artigos-word');
			const questionEl = document.getElementById('artigos-question');
			const feedbackEl = document.getElementById('artigos-feedback');
			const buttonsEl = document.getElementById('artigos-buttons');

			// Limpa classes anteriores
			flashcardEl.classList.remove('artigos-correct', 'artigos-wrong', 'correct-animation', 'shake-animation');

			// Esconde pergunta e botões
			questionEl.classList.add('hidden');
			buttonsEl.classList.add('hidden');

			// Mostra palavra com artigo correto
			wordEl.textContent = `${correctArtigo} ${word.palavra}`;

			// Exibe feedback
			feedbackEl.classList.remove('hidden');

			if (isCorrect) {
				state.correctCount++;
				feedbackEl.textContent = `Correto! ${correctArtigo} ${word.palavra}`;
				feedbackEl.style.color = '#86efac';
				flashcardEl.classList.add('artigos-correct', 'correct-animation');
			} else {
				state.wrongCount++;
				feedbackEl.textContent = `Errado! O correto é ${correctArtigo} ${word.palavra}`;
				feedbackEl.style.color = '#fca5a5';
				flashcardEl.classList.add('artigos-wrong', 'shake-animation');
			}

			// Espera antes de avançar
			await new Promise(resolve => setTimeout(resolve, 1200));

			// Limpa feedback e classes
			feedbackEl.classList.add('hidden');
			flashcardEl.classList.remove('artigos-correct', 'artigos-wrong', 'correct-animation', 'shake-animation');

			// Avança flashcard e salva estado
			state.currentIndex++;
			showCurrentCard();
			saveGameState();
		}


        async function updateWordStats(wordId, isCorrect, table) {
            const now = new Date().toISOString();
            const { data: word } = await _supabase.from(table).select('*').eq('id', wordId).single();

            if (!word) return;

            const newAcertos = isCorrect ? (word.acertos || 0) + 1 : (word.acertos || 0);
            const newErros = !isCorrect ? (word.erros || 0) + 1 : (word.erros || 0);
            const repeticoes = (word.repeticoes || 0) + 1;
            const facilidade = word.facilidade || 2.5;
            const intervaloAtual = word.intervalo || 0;

            // Calcular nova facilidade
            const newFacilidade = isCorrect
                ? Math.min(facilidade + 0.1, 2.5)
                : Math.max(facilidade - 0.2, 1.3);

            // Calcular próximo intervalo (em dias) usando algoritmo SM-2
            let newIntervalo;
            if (!isCorrect) {
                newIntervalo = 0; // Reinicia se errou
            } else {
                if (repeticoes === 1) {
                    newIntervalo = 1;
                } else if (repeticoes === 2) {
                    newIntervalo = 6;
                } else {
                    newIntervalo = Math.round(intervaloAtual * newFacilidade);
                }
            }

            // Calcular próxima data de revisão
            const proximoReview = new Date();
            proximoReview.setDate(proximoReview.getDate() + newIntervalo);

            // Atualizar cartão baseado no desempenho
            let newCartao = word.cartao || 'vermelho';
            const errorRate = newErros / Math.max(1, newAcertos + newErros);
            if (errorRate < 0.2 && repeticoes > 3) {
                newCartao = 'verde';
            } else if (errorRate < 0.5) {
                newCartao = 'amarelo';
            } else {
                newCartao = 'vermelho';
            }

            await _supabase.from(table).update({
                acertos: newAcertos,
                erros: newErros,
                repeticoes: repeticoes,
                facilidade: newFacilidade,
                intervalo: newIntervalo,
                ultimo_review: now,
                proximo_review: proximoReview.toISOString(),
                cartao: newCartao
            }).eq('id', wordId);
        }

        function showResults() {
            document.getElementById('final-correct').textContent = flashcardGameState.correctCount;
            document.getElementById('final-wrong').textContent = flashcardGameState.wrongCount;
            showScreen('flashcard-results');
        }

        // =====================================================================
        // JOGO DA FORCA
        // =====================================================================

        let forcaGameState = {
            words: [],
            currentIndex: 0,
            currentWord: '',
            originalWord: '', // Palavra original para usar nas dicas da IA
            currentHint: '',
            currentExample: '', // Exemplo de uso da palavra
            guessedLetters: [],
            wrongLetters: [],
            errors: 0,
            maxErrors: 6,
            correctCount: 0,
            wrongCount: 0,
            gameOver: false,
            dicasRestantes: 3,
            dicaNivel: 0,
            dicasUsadas: [],
            dicasGeradas: [], // Array com as 3 dicas pré-geradas pela IA
            dicasCarregando: false, // Flag para saber se está carregando as dicas
            dicaRequestId: 0, // ID da requisição atual para evitar race conditions
            dicaPalavraAtual: '', // Palavra para verificação contra race conditions
            gameStarting: false // Flag para evitar cliques duplos no botão iniciar
        };

        const forcaPartes = [
            'forca-cabeca',
            'forca-corpo',
            'forca-braco-esq',
            'forca-braco-dir',
            'forca-perna-esq',
            'forca-perna-dir'
        ];

        // Navegação para setup da forca
        document.getElementById('btn-forca-game')?.addEventListener('click', () => {
            showScreen('forca-setup');
        });

        document.getElementById('back-from-forca-setup')?.addEventListener('click', () => {
            showScreen('flashcard-type-choice');
        });

        // Iniciar jogo da forca
        document.getElementById('start-forca-game')?.addEventListener('click', async () => {
            // Proteção contra clique duplo usando flag GLOBAL (fora do closure)
            // Isso garante sincronização mesmo se houver múltiplos event listeners
            if (_forcaGameInitializing) {
                console.log('[FORCA] Ignorando clique/listener duplicado - jogo já está iniciando (flag global)');
                return;
            }
            _forcaGameInitializing = true;
            console.log('[FORCA] Iniciando jogo - flag global ativada');

            const includeRed = document.getElementById('forca-red').checked;
            const includeYellow = document.getElementById('forca-yellow').checked;
            const includeGreen = document.getElementById('forca-green').checked;

            if (!includeRed && !includeYellow && !includeGreen) {
                document.getElementById('forca-setup-error').textContent = 'Selecione pelo menos um tipo de cartão!';
                _forcaGameInitializing = false;
                return;
            }

            document.getElementById('forca-setup-error').textContent = '';

            // Buscar palavras da tabela palavrasgerais
            const { data: words, error } = await _supabase
                .from('palavrasgerais')
                .select('*')
                .eq('user_id', currentUser.id);

            if (error) {
                console.error('Erro ao buscar palavras:', error);
                document.getElementById('forca-setup-error').textContent = 'Erro ao carregar palavras!';
                _forcaGameInitializing = false;
                return;
            }

            if (!words || words.length === 0) {
                document.getElementById('forca-setup-error').textContent = 'Nenhuma palavra encontrada!';
                _forcaGameInitializing = false;
                return;
            }

            // Filtrar por cartão (vermelho/amarelo/verde) E que tenha exemplos cadastrados
            let filteredWords = words.filter(word => {
                // IMPORTANTE: Só incluir palavras que têm exemplos cadastrados
                const temExemplo = word.exemplos && word.exemplos.trim().length > 0;
                if (!temExemplo) return false;

                const cartao = word.cartao || '';
                if (cartao === 'vermelho' && includeRed) return true;
                if (cartao === 'amarelo' && includeYellow) return true;
                if (cartao === 'verde' && includeGreen) return true;
                if (!cartao && includeRed) return true;
                return false;
            });

            if (filteredWords.length === 0) {
                document.getElementById('forca-setup-error').textContent = 'Nenhuma palavra com exemplos encontrada! Adicione exemplos às suas palavras.';
                _forcaGameInitializing = false;
                return;
            }

            // Embaralhar palavras
            for (let i = filteredWords.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [filteredWords[i], filteredWords[j]] = [filteredWords[j], filteredWords[i]];
            }

            // Inicializar estado do jogo
            forcaGameState = {
                words: filteredWords,
                currentIndex: 0,
                currentWord: '',
                originalWord: '', // Palavra original para usar nas dicas da IA
                currentHint: '',
                currentExample: '', // Exemplo de uso da palavra
                guessedLetters: [],
                wrongLetters: [],
                errors: 0,
                maxErrors: 6,
                correctCount: 0,
                wrongCount: 0,
                gameOver: false,
                dicasRestantes: 3,
                dicaNivel: 0,
                dicasUsadas: [],
                dicasGeradas: [], // Array com as 3 dicas pré-geradas pela IA
                dicasCarregando: false, // Flag para saber se está carregando as dicas
                dicaRequestIdCarregando: 0, // ID da requisição que está carregando (para verificar se é a mesma)
                dicaRequestId: 0, // ID da requisição atual para evitar race conditions
                dicaPalavraAtual: '', // Palavra para verificação contra race conditions
                gameStarting: false // Flag resetada após inicialização bem-sucedida
            };

            // Atualizar estado do flashcard game também para manter consistência
            flashcardGameState = {
                type: 'forca',
                words: filteredWords,
                currentIndex: 0,
                correctCount: 0,
                wrongCount: 0,
                isFlipped: false
            };

            showScreen('flashcard-game-area');
            document.getElementById('vocab-flashcard-container').classList.add('hidden');
            document.getElementById('artigos-flashcard-container').classList.add('hidden');
            document.getElementById('forca-game-container').classList.remove('hidden');

            initForcaWord();

            // Resetar flag global após inicialização bem-sucedida
            _forcaGameInitializing = false;
            console.log('[FORCA] Jogo iniciado com sucesso - flag global resetada');
        });

        function initForcaWord() {
            const word = forcaGameState.words[forcaGameState.currentIndex];

            // DEBUG: Log completo do estado
            console.log('[FORCA] initForcaWord chamado:', {
                currentIndex: forcaGameState.currentIndex,
                wordsLength: forcaGameState.words?.length,
                word: word,
                palavraRaw: word?.palavra,
                descricaoRaw: word?.descricao
            });

            if (!word) {
                showForcaResults();
                return;
            }

            // Verificar se a palavra tem conteúdo válido
            if (!word.palavra || word.palavra.trim() === '') {
                console.error('[FORCA] ERRO: Palavra vazia no índice', forcaGameState.currentIndex, word);
                // Pular para próxima palavra
                forcaGameState.currentIndex++;
                initForcaWord();
                return;
            }

            // Resetar estado para nova palavra
            // Limpar a palavra: normalizar espaços (manter apenas um espaço entre palavras para expressões)
            let palavraOriginal = word.palavra
                .trim()
                .replace(/[\r\n\t]/g, ' ') // Converte quebras de linha e tabs para espaço
                .replace(/\s+/g, ' '); // Normaliza múltiplos espaços para um único

            // Guardar palavra original para as dicas da IA (sem uppercase)
            forcaGameState.originalWord = palavraOriginal;
            // Converter para maiúsculas apenas para o jogo (comparação de letras)
            forcaGameState.currentWord = palavraOriginal.toUpperCase();
            forcaGameState.currentHint = word.descricao || '';
            forcaGameState.currentExample = word.exemplos || ''; // Guardar exemplo para usar nas dicas
            forcaGameState.guessedLetters = [];
            forcaGameState.wrongLetters = [];
            forcaGameState.errors = 0;
            forcaGameState.gameOver = false;

            // Resetar sistema de dicas
            forcaGameState.dicasRestantes = 3;
            forcaGameState.dicaNivel = 0;
            forcaGameState.dicasUsadas = [];
            forcaGameState.dicasGeradas = []; // Resetar dicas pré-geradas para nova palavra
            // IMPORTANTE: NÃO resetar dicasCarregando aqui!
            // Se uma requisição estiver em andamento, ela será invalidada pelo requestId
            // Resetar aqui causava race condition onde duas requisições podiam ser feitas simultaneamente
            // forcaGameState.dicasCarregando = false; <- REMOVIDO - era a causa do bug
            // IMPORTANTE: Incrementar requestId ao invés de resetar para 0
            // Isso invalida qualquer requisição pendente de palavras anteriores
            forcaGameState.dicaRequestId++;
            // Guardar a palavra atual para verificação adicional contra race conditions
            forcaGameState.dicaPalavraAtual = forcaGameState.originalWord;

            // Atualizar progresso
            document.getElementById('game-progress-text').textContent = `Palavra ${forcaGameState.currentIndex + 1} de ${forcaGameState.words.length}`;
            document.getElementById('game-correct-count').textContent = forcaGameState.correctCount;
            document.getElementById('game-wrong-count').textContent = forcaGameState.wrongCount;
            const progress = ((forcaGameState.currentIndex + 1) / forcaGameState.words.length) * 100;
            document.getElementById('game-progress-bar').style.width = `${progress}%`;

            // Resetar visual
            resetForcaVisual();

            // Limpar área de dica (não mostrar tradução) - desktop e mobile
            const dicaEl = document.getElementById('forca-dica');
            const dicaElMobile = document.getElementById('forca-dica-mobile');
            if (dicaEl) dicaEl.textContent = '';
            if (dicaElMobile) dicaElMobile.textContent = '';

            // Resetar botão de dicas - desktop e mobile
            const dicaBtn = document.getElementById('forca-dica-btn');
            const dicaBtnMobile = document.getElementById('forca-dica-btn-mobile');
            const dicasRestantesEl = document.getElementById('forca-dicas-restantes');
            const dicasRestantesMobileEl = document.getElementById('forca-dicas-restantes-mobile');

            [dicaBtn, dicaBtnMobile].forEach(btn => {
                if (btn) {
                    btn.disabled = false;
                    btn.classList.remove('opacity-50', 'cursor-not-allowed');
                }
            });
            [dicasRestantesEl, dicasRestantesMobileEl].forEach(el => {
                if (el) el.textContent = '3';
            });

            // Criar slots da palavra
            renderForcaPalavra();

            // Resetar teclado
            resetForcaTeclado();

            // Esconder botão próxima
            document.getElementById('forca-proxima-container').classList.add('hidden');

            // Limpar feedback
            document.getElementById('forca-feedback').textContent = '';
            document.getElementById('forca-feedback').style.color = '';
        }

        function resetForcaVisual() {
            // Esconder todas as partes do corpo
            forcaPartes.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.classList.add('hidden');
                    el.classList.remove('visible');
                }
            });

            // Limpar letras erradas
            document.getElementById('forca-letras-erradas').innerHTML = '';

            // Remover animações
            document.getElementById('forca-svg').classList.remove('forca-balanca', 'forca-vitoria');
        }

        function renderForcaPalavra() {
            const container = document.getElementById('forca-palavra');
            container.innerHTML = '';

            const palavra = forcaGameState.currentWord;
            // Contar apenas letras válidas para ajustar tamanho
            const letrasValidas = palavra.replace(/[^A-ZÄÖÜß-]/gi, '').length;

            // Determinar classe de tamanho baseada no comprimento da palavra
            let sizeClass = 'slot-normal';
            if (letrasValidas > 12) {
                sizeClass = 'slot-medium';
            }
            if (letrasValidas > 16) {
                sizeClass = 'slot-small';
            }

            for (const letra of palavra) {
                // Espaço - criar separador visual entre palavras
                if (letra === ' ') {
                    const spacer = document.createElement('span');
                    spacer.className = 'forca-espacador';
                    container.appendChild(spacer);
                    continue;
                }

                const slot = document.createElement('span');
                slot.className = 'forca-letra-slot ' + sizeClass;

                // Verificar se é letra válida (incluindo umlauts alemães)
                if (/[A-ZÄÖÜß]/i.test(letra)) {
                    // Comparar sempre em maiúsculas para consistência
                    const letraUpper = letra.toUpperCase();
                    if (forcaGameState.guessedLetters.includes(letraUpper)) {
                        slot.textContent = letraUpper;
                        slot.classList.add('revelada');
                    } else {
                        slot.textContent = '';
                    }
                } else if (letra === '-') {
                    // Hífen - mostrar diretamente
                    slot.textContent = letra;
                    slot.style.borderBottom = 'none';
                }
                // Ignorar outros caracteres inválidos
                else {
                    continue;
                }

                container.appendChild(slot);
            }
        }

        function resetForcaTeclado() {
            document.querySelectorAll('.forca-tecla').forEach(btn => {
                btn.disabled = false;
                btn.classList.remove('correta', 'errada');
            });
        }

        // Timestamp do último clique em dica (debounce)
        let ultimoCliqueDica = 0;

        // Função para pedir dica - usa sistema de batch (gera todas as 3 dicas de uma vez)
        async function pedirDicaForca() {
            // Evitar chamadas se já terminou ou não tem dicas
            if (forcaGameState.gameOver) return;
            if (forcaGameState.dicasRestantes <= 0) return;

            // PROTEÇÃO: Verificar se a palavra e tradução existem
            if (!forcaGameState.originalWord || forcaGameState.originalWord.trim() === '') {
                console.error('[DICA] ERRO: palavra vazia! originalWord:', forcaGameState.originalWord);
                console.error('[DICA] Estado atual:', JSON.stringify({
                    currentIndex: forcaGameState.currentIndex,
                    wordsLength: forcaGameState.words?.length,
                    currentWord: forcaGameState.currentWord
                }));
                return;
            }

            // Se está carregando as dicas para a palavra ATUAL, não faz nada
            // Mas se o requestId mudou (palavra mudou), permitir nova requisição
            if (forcaGameState.dicasCarregando) {
                if (forcaGameState.dicaRequestIdCarregando === forcaGameState.dicaRequestId) {
                    console.log('[DICA] Carregamento em andamento para esta palavra, ignorando clique');
                    return;
                } else {
                    console.log('[DICA] Requisição anterior (', forcaGameState.dicaRequestIdCarregando, ') ainda em andamento, mas palavra mudou. Permitindo nova requisição para requestId:', forcaGameState.dicaRequestId);
                }
            }

            // Debounce: ignorar cliques muito rápidos (500ms)
            const agora = Date.now();
            if (agora - ultimoCliqueDica < 500) {
                console.log('[DICA] Clique muito rápido, ignorando (debounce)');
                return;
            }
            ultimoCliqueDica = agora;

            const dicaBtn = document.getElementById('forca-dica-btn');
            const dicaBtnMobile = document.getElementById('forca-dica-btn-mobile');

            // IMPORTANTE: Desabilitar botões IMEDIATAMENTE para evitar cliques duplos
            if (dicaBtn) dicaBtn.disabled = true;
            if (dicaBtnMobile) dicaBtnMobile.disabled = true;
            const dicasRestantesEl = document.getElementById('forca-dicas-restantes');
            const dicasRestantesMobileEl = document.getElementById('forca-dicas-restantes-mobile');
            const dicaEl = document.getElementById('forca-dica');
            const dicaElMobile = document.getElementById('forca-dica-mobile');

            // Função helper para atualizar ambos os botões de dica
            function updateDicaBtns(disabled, html, addDisabledClass = false) {
                [dicaBtn, dicaBtnMobile].forEach(btn => {
                    if (btn) {
                        btn.disabled = disabled;
                        if (html) btn.innerHTML = html;
                        if (addDisabledClass) {
                            btn.classList.add('opacity-50', 'cursor-not-allowed');
                        }
                    }
                });
            }

            // Função helper para atualizar ambos os elementos de dica
            function updateDicaText(html) {
                [dicaEl, dicaElMobile].forEach(el => {
                    if (el) el.innerHTML = html;
                });
            }

            // Função para restaurar botões após ação
            function restaurarBotoes() {
                const desktopBtnHtml = `
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z"/>
                    </svg>
                    Pedir Dica
                    <span id="forca-dicas-restantes" class="bg-amber-800 text-amber-200 text-xs font-bold px-2 py-0.5 rounded-full">${forcaGameState.dicasRestantes}</span>
                `;
                const mobileBtnHtml = `
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z"/>
                    </svg>
                    Dica
                    <span id="forca-dicas-restantes-mobile" class="bg-amber-800 text-amber-200 text-xs font-bold px-1.5 py-0.5 rounded-full">${forcaGameState.dicasRestantes}</span>
                `;

                if (dicaBtn) {
                    dicaBtn.disabled = forcaGameState.dicasRestantes <= 0;
                    dicaBtn.innerHTML = desktopBtnHtml;
                    if (forcaGameState.dicasRestantes <= 0) {
                        dicaBtn.classList.add('opacity-50', 'cursor-not-allowed');
                    }
                }
                if (dicaBtnMobile) {
                    dicaBtnMobile.disabled = forcaGameState.dicasRestantes <= 0;
                    dicaBtnMobile.innerHTML = mobileBtnHtml;
                    if (forcaGameState.dicasRestantes <= 0) {
                        dicaBtnMobile.classList.add('opacity-50', 'cursor-not-allowed');
                    }
                }
            }

            // Se ainda não tem dicas geradas, buscar todas as 3 de uma vez
            if (forcaGameState.dicasGeradas.length === 0) {
                // Incrementar ID da requisição para evitar race conditions
                forcaGameState.dicaRequestId++;
                const currentRequestId = forcaGameState.dicaRequestId;
                const currentWordIndex = forcaGameState.currentIndex;
                // Capturar a palavra atual para verificação robusta contra race conditions
                const currentWord = forcaGameState.originalWord;

                console.log('[DICA] Gerando batch de 3 dicas... (requestId:', currentRequestId, ', wordIndex:', currentWordIndex, ', word:', currentWord, ')');
                forcaGameState.dicasCarregando = true;
                forcaGameState.dicaRequestIdCarregando = currentRequestId; // Marcar qual requisição está ativa

                // Mostrar loading
                const loadingHtml = `
                    <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Gerando...
                `;
                updateDicaBtns(true, loadingHtml);
                updateDicaText('<span class="text-gray-400 animate-pulse">Gerando dicas...</span>');

                try {
                    // LOG DETALHADO para debug
                    const dadosEnvio = {
                        palavra: forcaGameState.originalWord,
                        traducao: forcaGameState.currentHint
                    };
                    console.log('[DICA] ===== ENVIANDO PARA API =====');
                    console.log('[DICA] Palavra:', dadosEnvio.palavra);
                    console.log('[DICA] Tradução:', dadosEnvio.traducao);
                    console.log('[DICA] currentWord capturado:', currentWord);
                    console.log('[DICA] ================================');

                    const response = await fetch('/.netlify/functions/forca-dicas-batch', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(dadosEnvio)
                    });

                    const data = await response.json();
                    console.log('[DICA] ===== RESPOSTA DA API =====');
                    console.log('[DICA] Dicas:', data.dicas);
                    console.log('[DICA] palavraOrigem:', data.palavraOrigem);
                    console.log('[DICA] traducaoOrigem:', data.traducaoOrigem);
                    console.log('[DICA] ==============================');

                    // PROTEÇÃO CONTRA RACE CONDITIONS:
                    // Verificar se ainda estamos na mesma palavra e se é a mesma requisição
                    // Usar TRÊS verificações: requestId, índice e a palavra em si
                    if (currentRequestId !== forcaGameState.dicaRequestId ||
                        currentWordIndex !== forcaGameState.currentIndex ||
                        currentWord !== forcaGameState.originalWord) {
                        console.log('[DICA] Resposta descartada: palavra ou requisição mudou (expected:', currentWord, ', current:', forcaGameState.originalWord, ')');
                        return;
                    }

                    if (data.success && data.dicas && data.dicas.length >= 3) {
                        // VERIFICAÇÃO EXTRA: Confirmar que as dicas são para a palavra correta
                        if (data.palavraOrigem && data.palavraOrigem.toLowerCase() !== currentWord.toLowerCase()) {
                            console.log('[DICA] Dicas descartadas: palavraOrigem não corresponde (API:', data.palavraOrigem, ', esperado:', currentWord, ')');
                            updateDicaText('Erro de sincronização. Tente novamente.');
                            return;
                        }

                        // Armazenar as 3 dicas geradas
                        forcaGameState.dicasGeradas = data.dicas;
                        console.log('[DICA] Dicas armazenadas para', currentWord, ':', forcaGameState.dicasGeradas);

                        // Mostrar a primeira dica
                        mostrarProximaDica();
                    } else {
                        updateDicaText('Erro ao gerar dicas. Tente novamente.');
                    }
                } catch (error) {
                    console.error('[DICA] Erro ao buscar dicas:', error);
                    // Só mostrar erro se ainda for a mesma requisição e palavra
                    if (currentRequestId === forcaGameState.dicaRequestId &&
                        currentWordIndex === forcaGameState.currentIndex &&
                        currentWord === forcaGameState.originalWord) {
                        updateDicaText('Erro de conexão. Tente novamente.');
                    }
                } finally {
                    // Só resetar dicasCarregando se ESTA é a requisição que está marcada como ativa
                    // Isso evita que uma requisição antiga (invalidada) resete o flag de uma requisição nova
                    if (currentRequestId === forcaGameState.dicaRequestIdCarregando) {
                        forcaGameState.dicasCarregando = false;
                        console.log('[DICA] Requisição', currentRequestId, 'finalizada, dicasCarregando = false');
                    } else {
                        console.log('[DICA] Requisição', currentRequestId, 'finalizada (ignorada, não é a requisição ativa:', forcaGameState.dicaRequestIdCarregando, ')');
                    }

                    // Só restaurar os botões se ainda for a mesma requisição e palavra
                    if (currentRequestId === forcaGameState.dicaRequestId &&
                        currentWordIndex === forcaGameState.currentIndex &&
                        currentWord === forcaGameState.originalWord) {
                        restaurarBotoes();
                    }
                }
            } else {
                // Já tem dicas geradas, só mostrar a próxima
                mostrarProximaDica();
                restaurarBotoes();
            }

            // Função interna para mostrar a próxima dica do array
            function mostrarProximaDica() {
                if (forcaGameState.dicasRestantes <= 0) return;

                // Pegar a próxima dica (índice = 3 - dicasRestantes)
                const indiceDica = 3 - forcaGameState.dicasRestantes;
                const novaDica = forcaGameState.dicasGeradas[indiceDica];

                if (novaDica) {
                    // Atualizar contador e lista de dicas usadas
                    forcaGameState.dicasRestantes--;
                    forcaGameState.dicasUsadas.push(novaDica);

                    console.log('[DICA] Mostrando dica', indiceDica + 1, ':', novaDica);

                    // Mostrar todas as dicas usadas
                    const dicasHtml = forcaGameState.dicasUsadas.map((d, i) =>
                        `<span class="block mb-1"><strong>Dica ${i + 1}:</strong> ${d}</span>`
                    ).join('');
                    updateDicaText(dicasHtml);

                    // Atualizar contador visual
                    [dicasRestantesEl, dicasRestantesMobileEl].forEach(el => {
                        if (el) el.textContent = forcaGameState.dicasRestantes;
                    });
                }
            }
        }

        // Event listener para botão de dica (desktop e mobile)
        document.getElementById('forca-dica-btn')?.addEventListener('click', pedirDicaForca);
        document.getElementById('forca-dica-btn-mobile')?.addEventListener('click', pedirDicaForca);

        // Event listeners para teclas
        document.querySelectorAll('.forca-tecla').forEach(btn => {
            btn.addEventListener('click', () => {
                if (forcaGameState.gameOver) return;
                if (btn.disabled) return; // Evitar cliques duplicados

                const letra = btn.dataset.letra;
                handleForcaGuess(letra, btn);
            });
        });

        // Também aceitar input do teclado físico
        document.addEventListener('keydown', (e) => {
            // Só funcionar se o jogo da forca estiver ativo (container visível)
            const forcaContainer = document.getElementById('forca-game-container');
            if (!forcaContainer || forcaContainer.classList.contains('hidden')) return;
            if (forcaGameState.gameOver) return;

            const key = e.key.toUpperCase();
            // Aceitar letras alemãs e normais
            if (/^[A-ZÄÖÜß]$/.test(key)) {
                const btn = document.querySelector(`.forca-tecla[data-letra="${key}"]`);
                if (btn && !btn.disabled) {
                    handleForcaGuess(key, btn);
                }
            }
        });

        async function handleForcaGuess(letra, btnElement) {
            // Desabilitar botão IMEDIATAMENTE para evitar cliques duplos
            if (btnElement.disabled) return;
            btnElement.disabled = true;

            // Normalizar letra para comparação (ä=Ä, ö=Ö, ü=Ü, ß=ß)
            const letraUpper = letra.toUpperCase();

            // Verificar se já tentou esta letra (verificação adicional de segurança)
            if (forcaGameState.guessedLetters.includes(letraUpper) || forcaGameState.wrongLetters.includes(letraUpper)) {
                return; // Já tentou esta letra
            }

            if (forcaGameState.currentWord.includes(letraUpper)) {
                // Acertou!
                forcaGameState.guessedLetters.push(letraUpper);
                btnElement.classList.add('correta');
                renderForcaPalavra();

                // Verificar se ganhou
                if (checkForcaVitoria()) {
                    await handleForcaVitoria();
                }
            } else {
                // Errou!
                forcaGameState.wrongLetters.push(letraUpper);
                btnElement.classList.add('errada');

                // Mostrar letra errada
                const erradasContainer = document.getElementById('forca-letras-erradas');
                const span = document.createElement('span');
                span.textContent = letraUpper;
                span.className = 'text-red-400 font-bold text-lg';
                erradasContainer.appendChild(span);

                // Mostrar próxima parte do corpo
                if (forcaGameState.errors < forcaPartes.length) {
                    const parteId = forcaPartes[forcaGameState.errors];
                    const parteEl = document.getElementById(parteId);
                    if (parteEl) {
                        parteEl.classList.remove('hidden');
                        parteEl.classList.add('visible');
                    }
                }

                forcaGameState.errors++;

                // Animação de balançar
                document.getElementById('forca-svg').classList.add('forca-balanca');
                setTimeout(() => {
                    document.getElementById('forca-svg').classList.remove('forca-balanca');
                }, 500);

                // Verificar se perdeu
                if (forcaGameState.errors >= forcaGameState.maxErrors) {
                    await handleForcaDerrota();
                }
            }
        }

        function checkForcaVitoria() {
            for (const letra of forcaGameState.currentWord) {
                // Comparar sempre em maiúsculas para consistência
                if (/[A-ZÄÖÜß]/i.test(letra) && !forcaGameState.guessedLetters.includes(letra.toUpperCase())) {
                    return false;
                }
            }
            return true;
        }

        async function handleForcaVitoria() {
            forcaGameState.gameOver = true;
            forcaGameState.correctCount++;

            // Atualizar contadores
            document.getElementById('game-correct-count').textContent = forcaGameState.correctCount;
            flashcardGameState.correctCount = forcaGameState.correctCount;

            // Feedback visual
            document.getElementById('forca-feedback').textContent = '🎉 Parabéns! Você acertou!';
            document.getElementById('forca-feedback').style.color = '#86efac';

            // Animação de vitória
            document.getElementById('forca-svg').classList.add('forca-vitoria');

            // Atualizar estatísticas no banco
            const word = forcaGameState.words[forcaGameState.currentIndex];
            await updateWordStats(word.id, true, 'palavrasgerais');

            // Desabilitar teclado
            document.querySelectorAll('.forca-tecla').forEach(btn => btn.disabled = true);

            // Desabilitar botão de dica
            const dicaBtn = document.getElementById('forca-dica-btn');
            if (dicaBtn) {
                dicaBtn.disabled = true;
                dicaBtn.classList.add('opacity-50', 'cursor-not-allowed');
            }

            // Mostrar botão próxima
            showForcaProximaBtn();
        }

        async function handleForcaDerrota() {
            forcaGameState.gameOver = true;
            forcaGameState.wrongCount++;

            // Atualizar contadores
            document.getElementById('game-wrong-count').textContent = forcaGameState.wrongCount;
            flashcardGameState.wrongCount = forcaGameState.wrongCount;

            // Revelar palavra completa
            const container = document.getElementById('forca-palavra');
            const slots = container.querySelectorAll('.forca-letra-slot');

            // Filtrar apenas as letras válidas da palavra (mesma lógica do render)
            const letrasValidas = forcaGameState.currentWord.split('').filter(c => /[A-ZÄÖÜß-]/i.test(c));

            slots.forEach((slot, i) => {
                if (!slot.textContent && letrasValidas[i] && /[A-ZÄÖÜß]/i.test(letrasValidas[i])) {
                    slot.textContent = letrasValidas[i];
                    slot.classList.add('perdeu');
                }
            });

            // Feedback visual - mostrar palavra E tradução para debug
            document.getElementById('forca-feedback').innerHTML = `😢 Que pena! A palavra era: <strong>${forcaGameState.currentWord}</strong><br><small style="color:#94a3b8">Tradução: ${forcaGameState.currentHint}</small>`;
            document.getElementById('forca-feedback').style.color = '#fca5a5';

            // Atualizar estatísticas no banco
            const word = forcaGameState.words[forcaGameState.currentIndex];
            await updateWordStats(word.id, false, 'palavrasgerais');

            // Desabilitar teclado
            document.querySelectorAll('.forca-tecla').forEach(btn => btn.disabled = true);

            // Desabilitar botão de dica
            const dicaBtn = document.getElementById('forca-dica-btn');
            if (dicaBtn) {
                dicaBtn.disabled = true;
                dicaBtn.classList.add('opacity-50', 'cursor-not-allowed');
            }

            // Mostrar botão próxima
            showForcaProximaBtn();
        }

        function showForcaProximaBtn() {
            const container = document.getElementById('forca-proxima-container');
            container.classList.remove('hidden');

            // Verificar se é a última palavra
            if (forcaGameState.currentIndex >= forcaGameState.words.length - 1) {
                document.getElementById('forca-proxima-btn').textContent = 'Ver Resultados';
            } else {
                document.getElementById('forca-proxima-btn').textContent = 'Próxima Palavra →';
            }
        }

        document.getElementById('forca-proxima-btn')?.addEventListener('click', () => {
            forcaGameState.currentIndex++;
            flashcardGameState.currentIndex = forcaGameState.currentIndex;

            if (forcaGameState.currentIndex >= forcaGameState.words.length) {
                showForcaResults();
            } else {
                initForcaWord();
            }
        });

        function showForcaResults() {
            // Usar a tela de resultados existente
            document.getElementById('final-correct').textContent = forcaGameState.correctCount;
            document.getElementById('final-wrong').textContent = forcaGameState.wrongCount;
            showScreen('flashcard-results');
        }

        // Chama a função uma vez para definir o estado inicial
        updateWordCount();
    }

    // =================================================================
    // FUNCIONALIDADE DE PARAFRASEAMENTO
    // =================================================================

    function updateParaphraseWordCount() {
        const textarea = document.getElementById('paraphrase-text');
        const counter = document.getElementById('paraphrase-word-counter');
        if (textarea && counter) {
            const text = textarea.value.trim();
            const wordCount = text ? text.split(/\s+/).length : 0;
            counter.textContent = `${wordCount} palavra${wordCount !== 1 ? 's' : ''}`;
        }
    }

    async function handleParaphraseSubmit(event) {
        event.preventDefault();

        const textarea = document.getElementById('paraphrase-text');
        const resultDiv = document.getElementById('paraphrase-result');
        const submitBtn = document.getElementById('paraphrase-submit-btn');
        const selectedStyle = document.querySelector('input[name="paraphrase-style"]:checked');

        if (!textarea || !resultDiv || !selectedStyle) {
            console.error('Elementos do formulário de parafraseamento não encontrados');
            return;
        }

        const text = textarea.value.trim();
        const style = selectedStyle.value;

        if (!text) {
            resultDiv.innerHTML = `
                <div class="p-4 bg-red-900/30 border border-red-500/50 rounded-lg">
                    <p class="text-red-400">Por favor, insira um texto para parafrasear.</p>
                </div>
            `;
            return;
        }

        // Mostrar loading
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
            <svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Parafraseando...
        `;

        resultDiv.innerHTML = `
            <div class="flex flex-col items-center justify-center h-64">
                <svg class="w-12 h-12 animate-spin text-cyan-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p class="text-slate-400">Gerando versão ${getStyleLabel(style)}...</p>
            </div>
        `;

        try {
            const response = await fetch('/.netlify/functions/parafrasear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: text,
                    style: style,
                    user_id: currentUser?.id,
                    email: currentUser?.email
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao parafrasear o texto');
            }

            // Exibir resultado
            resultDiv.innerHTML = `
                <div class="space-y-4">
                    <div class="flex items-center gap-2 mb-4">
                        <span class="px-3 py-1 rounded-full text-sm font-medium ${getStyleBadgeClass(style)}">
                            ${getStyleLabel(style)}
                        </span>
                    </div>

                    <div class="bg-slate-800 border border-slate-700 rounded-lg p-4">
                        <div class="flex items-center justify-between mb-3">
                            <h3 class="text-sm font-medium text-slate-400">Texto Parafraseado</h3>
                            <button onclick="copyParaphraseResult()" class="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path>
                                </svg>
                                Copiar
                            </button>
                        </div>
                        <p id="paraphrase-output" class="text-white whitespace-pre-wrap leading-relaxed">${escapeHtml(data.paraphrased)}</p>
                    </div>

                    <div class="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
                        <h3 class="text-sm font-medium text-slate-400 mb-2">Texto Original</h3>
                        <p class="text-slate-300 text-sm whitespace-pre-wrap">${escapeHtml(text)}</p>
                    </div>
                </div>
            `;

        } catch (error) {
            console.error('Erro ao parafrasear:', error);
            resultDiv.innerHTML = `
                <div class="p-4 bg-red-900/30 border border-red-500/50 rounded-lg">
                    <p class="text-red-400 font-medium mb-2">Erro ao parafrasear</p>
                    <p class="text-red-300 text-sm">${error.message}</p>
                </div>
            `;
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
                Parafrasear texto
            `;
        }
    }

    function getStyleLabel(style) {
        const labels = {
            'formal': 'Formal',
            'educado': 'Educado',
            'despojado': 'Despojado',
            'original': 'Original',
            'emojis': 'Com Emojis',
            'simples': 'Simples'
        };
        return labels[style] || style;
    }

    function getStyleBadgeClass(style) {
        const classes = {
            'formal': 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
            'educado': 'bg-green-500/20 text-green-400 border border-green-500/30',
            'despojado': 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
            'original': 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
            'emojis': 'bg-pink-500/20 text-pink-400 border border-pink-500/30',
            'simples': 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
        };
        return classes[style] || 'bg-slate-500/20 text-slate-400';
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Função global para copiar resultado
    window.copyParaphraseResult = function() {
        const output = document.getElementById('paraphrase-output');
        if (output) {
            navigator.clipboard.writeText(output.textContent).then(() => {
                // Feedback visual
                const btn = output.parentElement.querySelector('button');
                if (btn) {
                    const originalText = btn.innerHTML;
                    btn.innerHTML = `
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                        Copiado!
                    `;
                    btn.classList.add('text-green-400');
                    setTimeout(() => {
                        btn.innerHTML = originalText;
                        btn.classList.remove('text-green-400');
                    }, 2000);
                }
            });
        }
    };

    // =====================================================================
    // SISTEMA DE PRÁTICA DE CONVERSAÇÃO - GEMINI LIVE API (WebSocket)
    // =====================================================================

    let conversacaoState = {
        // WebSocket connection
        ws: null,
        isConnected: false,
        isConnecting: false,
        apiKey: null,

        // Audio state
        isRecording: false,
        isPlaying: false,
        stream: null,
        audioContext: null,
        workletNode: null,

        // Playback
        playbackContext: null,
        audioQueue: [],
        isPlayingAudio: false,
        gainNode: null,
        lowPassFilter: null,
        compressor: null,

        // Session state
        startTime: null,
        timerInterval: null,
        totalSeconds: 0,
        conversationHistory: [],
        creditsUsed: 0,
        isAISpeaking: false,
        turnCount: 0,

        // Silence detection
        lastSoundTime: null,
        silenceCheckInterval: null,
        keepAliveInterval: null,
        connectionStartTime: null,
        SILENCE_TIMEOUT: 120000, // 2 minutos de silêncio para desconectar (era 5s)

        // Reconnection
        reconnectAttempts: 0,
        maxReconnectAttempts: 3,
        shouldReconnect: false,

        // Settings
        continuousMode: true,
        selectedVoice: 'Aoede', // Voz alemã

        // Ambient sound
        ambientAudio: null,
        ambientEnabled: false,

        // Correction tracking - acumula transcripts para análise no final
        totalCorrections: 0,
        transcripts: [], // Array de {timestamp, speaker, text}
        analysisTimer: null, // Timer de 5 minutos para análise
        analysisTriggered: false,

        // Acumulador de transcrição do usuário (junta fragmentos em frases)
        currentUserTranscript: '',
        transcriptFlushTimer: null
    };

    let conversacaoInitialized = false;

    // System instruction para o tutor de alemão - MODO CONVERSACIONAL NATURAL
    const GERMAN_TUTOR_INSTRUCTION = `Du bist ein neugieriger, freundlicher Gesprächspartner für Deutschübungen.

DEINE PERSÖNLICHKEIT:
- Du bist SEHR NEUGIERIG und willst ALLES über den Benutzer wissen
- Du stellst IMMER mindestens eine Frage am Ende deiner Antwort
- Du bist wie ein interessierter Freund, der wirklich zuhören will
- Du hältst das Gespräch am Laufen - NIE einsilbige Antworten

KRITISCH WICHTIG - HÖRE ZU:
- Reagiere NUR auf das, was der Benutzer TATSÄCHLICH sagt
- Wenn er "Brasilien" sagt, frage über BRASILIEN - nicht über andere Länder
- Wenn er "Pizza" sagt, frage über PIZZA - nicht über andere Essen
- NIEMALS das Thema wechseln ohne Grund

WIE DU ANTWORTEN SOLLST:
1. Reagiere kurz auf das, was er gesagt hat (1-2 Sätze)
2. Stelle IMMER eine Folgefrage, um mehr zu erfahren
3. Zeige echtes Interesse mit Wörtern wie "Oh!", "Interessant!", "Wow!"

BEISPIELE:
Benutzer: "Ich reise gern nach Brasilien"
DU: "Oh, Brasilien! Das klingt wunderbar! Was gefällt dir dort am besten? Der Strand, das Essen, die Menschen?"

Benutzer: "Ich mag den Strand"
DU: "Ah, der Strand! Welcher Strand in Brasilien ist dein Favorit? Warst du schon in Rio oder Florianópolis?"

Benutzer: "Ja"
DU: "Super! Und was machst du am liebsten am Strand? Schwimmst du gern oder entspannst du lieber?"

SPRACHE:
- Einfaches, natürliches Deutsch
- Kurze Sätze
- Bei Fehlern: kurz korrigieren und weitermachen`;

    function initializeConversacao() {
        if (conversacaoInitialized) return;
        conversacaoInitialized = true;

        console.log('Inicializando seção de conversação com Gemini Live API...');

        // Botão do microfone - agora conecta/desconecta
        const micBtn = document.getElementById('conv-mic-btn');
        if (micBtn) {
            micBtn.addEventListener('click', toggleConversation);
        }

        // Botão de mudo
        const muteBtn = document.getElementById('conv-mute-btn');
        if (muteBtn) {
            muteBtn.addEventListener('click', toggleMute);
        }

        // Toggle modo fluido (contínuo)
        const continuousModeToggle = document.getElementById('conv-continuous-mode');
        if (continuousModeToggle) {
            continuousModeToggle.checked = true;
            continuousModeToggle.addEventListener('change', (e) => {
                conversacaoState.continuousMode = e.target.checked;
                console.log('Modo fluido:', e.target.checked ? 'ativado' : 'desativado');
            });
        }

        // Toggle do submenu Restaurante
        const restauranteToggle = document.getElementById('restaurante-toggle');
        const restauranteSubmenu = document.getElementById('restaurante-submenu');
        const restauranteArrow = document.getElementById('restaurante-arrow');

        if (restauranteToggle && restauranteSubmenu) {
            restauranteToggle.addEventListener('click', () => {
                restauranteSubmenu.classList.toggle('hidden');
                restauranteArrow?.classList.toggle('rotate-180');
            });
        }

        // Dados dos cenários
        const scenarioData = {
            'restaurante-a2': {
                level: 'A2',
                levelColor: 'green',
                title: 'Almoço com Colegas',
                subtitle: 'Pratique pedir comida em um restaurante tradicional alemão',
                context: 'Você está em Berlim visitando a sede da sua empresa. Três colegas alemães (Anna, Markus e Sofia) convidam você para almoçar em um típico "Gasthaus" (restaurante tradicional). Você precisa pedir comida, fazer perguntas simples sobre o cardápio e conversar de forma básica sobre preferências alimentares.',
                objective: 'Pedir comida, fazer perguntas simples sobre o cardápio e conversar de forma básica sobre preferências alimentares.',
                vocabulary: [
                    { de: 'die Speisekarte', pt: 'o cardápio' },
                    { de: 'Ich hätte gern...', pt: 'Eu gostaria de...' },
                    { de: 'Was empfehlen Sie?', pt: 'O que você recomenda?' },
                    { de: 'das Tagesgericht', pt: 'o prato do dia' },
                    { de: 'Ich bin allergisch gegen...', pt: 'Sou alérgico a...' },
                    { de: 'Noch etwas zu trinken?', pt: 'Mais algo para beber?' },
                    { de: 'Zusammen oder getrennt?', pt: 'Juntos ou separado?' },
                    { de: 'Stimmt so', pt: 'Está certo assim (gorjeta)' },
                    { de: 'Das schmeckt ausgezeichnet!', pt: 'Isso está excelente!' }
                ],
                tip: 'A IA (Anna) vai falar devagar e usar frases simples. Ela corrigirá gentilmente seus erros de artigos e ordem das palavras. Não tenha medo de errar!'
            },
            'restaurante-b1': {
                level: 'B1',
                levelColor: 'yellow',
                title: 'Celebração com Problemas',
                subtitle: 'Pratique fazer reclamações educadas e negociar soluções',
                context: 'Você está em um restaurante mais sofisticado em Munique celebrando seu aniversário com amigos alemães. Surgem alguns problemas: seu prato chegou frio, o vinho não é o que você pediu, e você precisa negociar soluções com o garçom de forma educada mas firme.',
                objective: 'Reclamar de problemas de forma educada, usar o Konjunktiv II para pedidos corteses, e negociar soluções mantendo a calma.',
                vocabulary: [
                    { de: 'Entschuldigung, aber...', pt: 'Desculpe, mas...' },
                    { de: 'Das ist nicht in Ordnung', pt: 'Isso não está certo' },
                    { de: 'Könnten Sie bitte...', pt: 'Você poderia por favor...' },
                    { de: 'etwas reklamieren', pt: 'reclamar algo' },
                    { de: 'eine Beschwerde vorbringen', pt: 'apresentar uma reclamação' },
                    { de: 'inakzeptabel', pt: 'inaceitável' },
                    { de: 'eine Entschädigung', pt: 'uma compensação' },
                    { de: 'die Rechnung überprüfen', pt: 'verificar a conta' },
                    { de: 'Das lasse ich mir nicht gefallen', pt: 'Não vou aceitar isso' }
                ],
                tip: 'O garçom será inicialmente defensivo. Use o Konjunktiv II (könnten, würden) para ser mais educado - isso fará ele cooperar mais! Mantenha a calma mesmo quando frustrado.'
            }
        };

        // Estado do cenário atual
        let currentScenario = null;

        // Função para mostrar cenário
        function showScenario(scenarioId) {
            const data = scenarioData[scenarioId];
            if (!data) {
                // Se não tem dados específicos, usa comportamento antigo (inicia direto)
                return false;
            }

            currentScenario = scenarioId;

            // Esconder estado inicial, mostrar cenário
            document.getElementById('conv-no-scenario')?.classList.add('hidden');
            document.getElementById('conv-scenario-display')?.classList.remove('hidden');

            // Preencher dados
            const levelBadge = document.getElementById('scenario-level-badge');
            if (levelBadge) {
                levelBadge.textContent = data.level;
                levelBadge.className = `text-xs font-bold px-2 py-1 rounded ${data.levelColor === 'green' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`;
            }

            document.getElementById('scenario-title').textContent = data.title;
            document.getElementById('scenario-subtitle').textContent = data.subtitle;
            document.getElementById('scenario-context').textContent = data.context;
            document.getElementById('scenario-objective').textContent = data.objective;
            document.getElementById('scenario-tip').textContent = data.tip;

            // Preencher vocabulário
            const vocabContainer = document.getElementById('scenario-vocabulary');
            if (vocabContainer) {
                vocabContainer.innerHTML = data.vocabulary.map(v => `
                    <div class="px-3 py-2 bg-slate-900/50 rounded-lg">
                        <span class="text-cyan-300 font-medium">${v.de}</span>
                        <span class="text-slate-500 mx-2">→</span>
                        <span class="text-slate-400 text-sm">${v.pt}</span>
                    </div>
                `).join('');
            }

            return true;
        }

        // Função para esconder cenário
        function hideScenario() {
            currentScenario = null;
            document.getElementById('conv-no-scenario')?.classList.remove('hidden');
            document.getElementById('conv-scenario-display')?.classList.add('hidden');
        }

        // Botões de cenário (com data-scenario)
        const scenarioBtns = document.querySelectorAll('.conv-scenario-btn');
        scenarioBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const scenarioId = btn.dataset.scenario;
                if (scenarioId) {
                    showScenario(scenarioId);
                }
            });
        });

        // Botões de tópicos simples (sem cenário específico)
        const topicBtns = document.querySelectorAll('.conv-topic-btn');
        topicBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Pegar o texto do segundo span (nome do tema, sem emoji)
                const textSpan = btn.querySelectorAll('span')[1];
                const topic = textSpan ? textSpan.textContent.trim() : btn.textContent.trim();

                // Para temas simples, inicia direto a conversa
                startConversationWithTopic(topic);
            });
        });

        // Botão "Iniciar Conversa" do cenário
        const startScenarioBtn = document.getElementById('start-scenario-btn');
        if (startScenarioBtn) {
            startScenarioBtn.addEventListener('click', () => {
                if (currentScenario) {
                    startConversationWithTopic(currentScenario);
                    // Mostrar visualizador de áudio
                    document.getElementById('conv-audio-visual')?.classList.remove('hidden');
                }
            });
        }

        // Botão fechar cenário
        const closeScenarioBtn = document.getElementById('close-scenario-btn');
        if (closeScenarioBtn) {
            closeScenarioBtn.addEventListener('click', hideScenario);
        }

        // Voice select
        const voiceSelect = document.getElementById('conv-voice-select');
        if (voiceSelect) {
            voiceSelect.addEventListener('change', (e) => {
                conversacaoState.selectedVoice = e.target.value;
            });
        }

        // Botão de som ambiente
        const ambientBtn = document.getElementById('conv-ambient-btn');
        if (ambientBtn) {
            ambientBtn.addEventListener('click', toggleAmbientSound);
        }

        console.log('Seção de conversação inicializada');
    }

    // Toggle som ambiente
    function toggleAmbientSound() {
        const iconOff = document.getElementById('conv-ambient-icon-off');
        const iconOn = document.getElementById('conv-ambient-icon-on');
        const textEl = document.getElementById('conv-ambient-text');
        const btn = document.getElementById('conv-ambient-btn');

        if (conversacaoState.ambientEnabled) {
            // Desativar
            stopAmbientSound();
            iconOff?.classList.remove('hidden');
            iconOn?.classList.add('hidden');
            if (textEl) textEl.textContent = '🍽️ Som Ambiente';
            btn?.classList.remove('bg-cyan-600/30', 'border', 'border-cyan-500/50');
            btn?.classList.add('bg-slate-700');
        } else {
            // Ativar
            startAmbientSound();
            iconOff?.classList.add('hidden');
            iconOn?.classList.remove('hidden');
            if (textEl) textEl.textContent = '🔊 Tocando...';
            btn?.classList.remove('bg-slate-700');
            btn?.classList.add('bg-cyan-600/30', 'border', 'border-cyan-500/50');
        }
    }

    // Iniciar som ambiente
    function startAmbientSound() {
        if (conversacaoState.ambientAudio) {
            conversacaoState.ambientAudio.pause();
        }

        const audio = new Audio('/assets/audio/restaurant-ambient.mp3');
        audio.loop = true;
        audio.volume = 0.3; // Volume baixo para não atrapalhar a conversa

        audio.play().then(() => {
            conversacaoState.ambientAudio = audio;
            conversacaoState.ambientEnabled = true;
            console.log('🔊 Som ambiente iniciado');
        }).catch(err => {
            console.error('Erro ao tocar som ambiente:', err);
            // Tentar mostrar mensagem de erro
            const textEl = document.getElementById('conv-ambient-text');
            if (textEl) textEl.textContent = '❌ Arquivo não encontrado';
            setTimeout(() => {
                if (textEl) textEl.textContent = '🍽️ Som Ambiente';
            }, 2000);
        });
    }

    // Parar som ambiente
    function stopAmbientSound() {
        if (conversacaoState.ambientAudio) {
            conversacaoState.ambientAudio.pause();
            conversacaoState.ambientAudio.currentTime = 0;
            conversacaoState.ambientAudio = null;
        }
        conversacaoState.ambientEnabled = false;
        console.log('🔇 Som ambiente parado');
    }

    // Tocar efeito sonoro único (passos, pratos, etc.)
    function playSoundEffect(soundFile, volume = 0.5) {
        const audio = new Audio(`/assets/audio/${soundFile}`);
        audio.volume = volume;
        audio.play().catch(err => {
            console.log('Som não disponível:', soundFile);
        });
    }

    // Toggle entre conectar/desconectar da conversa
    async function toggleConversation() {
        if (conversacaoState.isConnected || conversacaoState.isConnecting) {
            disconnectConversation();
        } else {
            await connectConversation();
        }
    }

    // Conectar à Gemini Live API via WebSocket
    async function connectConversation() {
        if (conversacaoState.isConnecting || conversacaoState.isConnected) return;

        try {
            conversacaoState.isConnecting = true;
            updateStatus('Conectando...', 'connecting');
            updateConversacaoUI('connecting');

            // Limpar correções da sessão anterior (forçar reset completo)
            clearCorrections(true);

            // Obter API key do backend
            if (!conversacaoState.apiKey) {
                console.log('Obtendo API key para userId:', currentUser?.id);

                if (!currentUser?.id) {
                    throw new Error('Você precisa estar logado para usar a conversa.');
                }

                const keyResponse = await fetch('/.netlify/functions/get-gemini-key', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: currentUser.id })
                });

                console.log('Resposta get-gemini-key:', keyResponse.status);

                const keyData = await keyResponse.json();
                if (!keyResponse.ok) {
                    if (keyResponse.status === 402) {
                        throw new Error(`Créditos insuficientes (${keyData.credits || 0}). Você precisa de pelo menos 5 créditos.`);
                    } else if (keyResponse.status === 401) {
                        throw new Error('Usuário não autenticado. Faça login novamente.');
                    } else if (keyResponse.status === 500 && keyData.error === 'API key not configured') {
                        throw new Error('Serviço temporariamente indisponível. Tente novamente mais tarde.');
                    }
                    throw new Error(keyData.message || keyData.error || 'Erro ao obter credenciais');
                }

                if (!keyData.apiKey) {
                    throw new Error('API key não recebida do servidor.');
                }

                conversacaoState.apiKey = keyData.apiKey;
                console.log('API key obtida com sucesso. Créditos:', keyData.credits);
            }

            // Solicitar permissão do microfone
            conversacaoState.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });

            // Log das configurações reais do microfone
            const audioTrack = conversacaoState.stream.getAudioTracks()[0];
            const settings = audioTrack.getSettings();
            console.log('🎤 MICROFONE OBTIDO:');
            console.log('   - Sample Rate real:', settings.sampleRate || 'não disponível');
            console.log('   - Channels:', settings.channelCount || 'não disponível');
            console.log('   - Device:', settings.deviceId?.substring(0, 20) || 'padrão');

            // Conectar WebSocket ao Gemini Live API
            // Usando v1alpha que funciona com gemini-2.0-flash-exp
            const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${conversacaoState.apiKey}`;

            conversacaoState.ws = new WebSocket(wsUrl);

            // Timeout de conexão - 15 segundos
            const connectionTimeout = setTimeout(() => {
                if (conversacaoState.ws && conversacaoState.ws.readyState !== WebSocket.OPEN) {
                    console.error('Timeout de conexão WebSocket');
                    conversacaoState.ws.close();
                    showConversacaoError('Timeout na conexão. Verifique sua internet e tente novamente.');
                    cleanupConversation();
                }
            }, 15000);

            conversacaoState.ws.onopen = () => {
                clearTimeout(connectionTimeout);
                console.log('WebSocket conectado');

                // Enviar configuração de setup conforme documentação oficial
                // Modelo Gemini 2.5 Flash Native Audio
                // IMPORTANTE: responseModalities só pode ser AUDIO ou TEXT, não ambos!
                const setupMessage = {
                    setup: {
                        model: 'models/gemini-2.5-flash-native-audio-preview-12-2025',
                        generationConfig: {
                            responseModalities: ['AUDIO'],
                            speechConfig: {
                                voiceConfig: {
                                    prebuiltVoiceConfig: {
                                        voiceName: conversacaoState.selectedVoice || 'Aoede'
                                    }
                                }
                            }
                        },
                        systemInstruction: {
                            parts: [{ text: GERMAN_TUTOR_INSTRUCTION }]
                        },
                        // Ativar transcrição de entrada para melhor compreensão
                        inputAudioTranscription: {},
                        // Ativar transcrição de saída para debug
                        outputAudioTranscription: {}
                    }
                };

                conversacaoState.ws.send(JSON.stringify(setupMessage));
                console.log('Setup enviado:', setupMessage);
            };

            conversacaoState.ws.onmessage = (event) => {
                handleWebSocketMessage(event);
            };

            conversacaoState.ws.onerror = (error) => {
                clearTimeout(connectionTimeout);
                console.error('WebSocket error:', error);
                // Tentar reconectar automaticamente em caso de erro
                attemptReconnection('Erro na conexão');
            };

            conversacaoState.ws.onclose = (event) => {
                clearTimeout(connectionTimeout);
                console.log('⚠️ WebSocket fechado - Código:', event.code, '- Razão:', event.reason || 'não especificada');
                console.log('⚠️ WasClean:', event.wasClean, '- Tempo de conexão:', Math.round((Date.now() - (conversacaoState.connectionStartTime || Date.now())) / 1000), 's');

                // IMPORTANTE: Flush e dispara análise ANTES de limpar qualquer coisa
                flushUserTranscript();
                if (conversacaoState.transcripts && conversacaoState.transcripts.length > 0) {
                    console.log('📊 Conexão fechada - disparando análise com', conversacaoState.transcripts.length, 'transcripts');
                    triggerAnalysis();
                }

                // Códigos de erro que permitem reconexão
                const reconnectableCodes = [1006, 1001, 1011, 1012, 1013, 1014];
                const shouldTryReconnect = reconnectableCodes.includes(event.code) &&
                                           conversacaoState.isConnected &&
                                           conversacaoState.reconnectAttempts < conversacaoState.maxReconnectAttempts;

                // Códigos de erro específicos do WebSocket
                let errorMsg = '';
                if (event.code === 1006) {
                    errorMsg = 'Conexão perdida. Tentando reconectar...';
                } else if (event.code === 1008 || event.code === 1003) {
                    errorMsg = 'Sessão encerrada pelo servidor.';
                } else if (event.code === 4001) {
                    errorMsg = 'API key inválida ou expirada.';
                } else if (event.reason) {
                    errorMsg = `Conexão encerrada: ${event.reason}`;
                }

                if (shouldTryReconnect) {
                    // Tentar reconectar automaticamente
                    attemptReconnection(errorMsg);
                } else {
                    if (errorMsg && !conversacaoState.isConnected) {
                        showConversacaoError(errorMsg);
                    } else if (conversacaoState.isConnected) {
                        showConversacaoError('Conexão encerrada.');
                    }
                    cleanupConversation();
                }
            };

        } catch (error) {
            console.error('Erro ao conectar:', error);
            if (error.name === 'NotAllowedError') {
                showConversacaoError('Permissão de microfone negada.');
            } else {
                showConversacaoError('Erro ao conectar: ' + error.message);
            }
            cleanupConversation();
        }
    }

    // Processar mensagens recebidas do WebSocket
    async function handleWebSocketMessage(event) {
        try {
            // WebSocket pode enviar dados como Blob ou string
            let data = event.data;
            if (data instanceof Blob) {
                data = await data.text();
            }

            const message = JSON.parse(data);

            // Setup complete - pronto para conversar
            if (message.setupComplete) {
                console.log('✅ Setup completo - iniciando captura de áudio');
                conversacaoState.isConnected = true;
                conversacaoState.isConnecting = false;
                conversacaoState.reconnectAttempts = 0; // Reset contador de reconexão
                conversacaoState.connectionStartTime = Date.now(); // Registrar início da conexão
                updateStatus('Conectado - Fale agora!', 'connected');
                updateConversacaoUI('recording');
                startAudioCapture();
                startTimer();
                // Keep-alive desativado - o streaming de áudio já mantém a conexão
                // startKeepAlive();
            }

            // Resposta do servidor (texto ou áudio)
            if (message.serverContent) {
                // Interrupção - limpar fila de áudio
                if (message.serverContent.interrupted) {
                    console.log('Interrupção detectada - limpando fila de áudio');
                    conversacaoState.audioQueue = [];
                    return;
                }

                const parts = message.serverContent.modelTurn?.parts || [];

                for (const part of parts) {
                    // Texto da resposta
                    if (part.text) {
                        addMessageToHistory('ai', part.text);
                        conversacaoState.conversationHistory.push({
                            role: 'model',
                            text: part.text
                        });
                    }

                    // Áudio da resposta (como no exemplo oficial)
                    if (part.inlineData && part.inlineData.data) {
                        // Marcar que a IA está falando
                        if (!conversacaoState.isAISpeaking) {
                            console.log('🗣️ IA começou a falar...');
                            conversacaoState.isAISpeaking = true;
                        }
                        // Adicionar à fila de áudio
                        conversacaoState.audioQueue.push(part.inlineData.data);
                        // Iniciar playback se não estiver tocando
                        if (!conversacaoState.isPlayingAudio) {
                            playAudioQueue();
                        }
                    }
                }

                // Fim do turno do servidor
                if (message.serverContent.turnComplete) {
                    console.log('✅ Turno do servidor completo - IA terminou de falar');
                    console.log('👂 AGORA É SUA VEZ DE FALAR - O sistema está ouvindo...');
                    updateStatus('Sua vez de falar...', 'listening');
                    conversacaoState.isAISpeaking = false;
                    conversacaoState.turnCount = (conversacaoState.turnCount || 0) + 1;
                    console.log(`📊 Turno #${conversacaoState.turnCount} completo`);

                    // Atualizar créditos (aproximado)
                    conversacaoState.creditsUsed += 0.5;
                    updateCreditsUsed();
                }

                // Transcrição do que o usuário falou (entrada)
                if (message.serverContent.inputTranscription) {
                    const fragment = message.serverContent.inputTranscription.text || '';
                    console.log('🎤 VOCÊ DISSE:', fragment);

                    // Acumula fragmentos na frase atual
                    conversacaoState.currentUserTranscript += fragment;

                    // Reseta timer de flush
                    if (conversacaoState.transcriptFlushTimer) {
                        clearTimeout(conversacaoState.transcriptFlushTimer);
                    }

                    // Flush após 2 segundos sem novos fragmentos
                    conversacaoState.transcriptFlushTimer = setTimeout(() => {
                        flushUserTranscript();
                    }, 2000);
                }

                // Transcrição do que a IA falou (saída)
                if (message.serverContent.outputTranscription) {
                    const transcript = message.serverContent.outputTranscription.text;
                    console.log('🤖 IA DISSE:', transcript);
                    // Quando a IA fala, flush o transcript do usuário acumulado
                    flushUserTranscript();
                }

                // Generation complete - a IA terminou de gerar resposta
                if (message.serverContent.generationComplete) {
                    console.log('✅ Geração completa');
                }
            }

            // GoAway - servidor avisa que vai desconectar
            if (message.goAway) {
                const timeLeft = message.goAway.timeLeft;
                console.log(`⚠️ Servidor vai desconectar em ${timeLeft}`);
                updateStatus(`Reconectando em breve...`, 'warning');
            }

            // Erro
            if (message.error) {
                console.error('Erro do servidor:', message.error);
                showConversacaoError(message.error.message || 'Erro do servidor');
            }

            // Sessão terminando - reconectar automaticamente
            if (message.sessionEnd || message.close) {
                console.log('⚠️ Sessão encerrada pelo servidor');

                // Tentar reconectar automaticamente
                const savedApiKey = conversacaoState.apiKey;
                cleanupConversation();
                conversacaoState.apiKey = savedApiKey;

                // Reconectar após pequeno delay
                setTimeout(async () => {
                    console.log('🔄 Reconectando após encerramento...');
                    updateStatus('Reconectando...', 'connecting');
                    await connectConversation();
                }, 1000);
            }

            // Log completo para debug (apenas em casos sem tratamento específico)
            const handledKeys = ['setupComplete', 'serverContent', 'error', 'goAway', 'sessionEnd', 'close', 'usageMetadata'];
            const hasUnhandled = Object.keys(message).some(key => !handledKeys.includes(key));
            if (hasUnhandled) {
                console.log('📩 Mensagem com campos não tratados:', JSON.stringify(message).substring(0, 500));
            }

        } catch (error) {
            console.error('Erro ao processar mensagem:', error);
        }
    }

    // Iniciar captura de áudio do microfone com detecção de silêncio
    async function startAudioCapture() {
        try {
            // Criar AudioContext para captura
            conversacaoState.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 16000
            });

            // Criar worklet para processar áudio
            await conversacaoState.audioContext.audioWorklet.addModule(createAudioWorkletProcessor());

            const source = conversacaoState.audioContext.createMediaStreamSource(conversacaoState.stream);
            conversacaoState.workletNode = new AudioWorkletNode(conversacaoState.audioContext, 'audio-processor');

            // Inicializar timestamp do último som
            conversacaoState.lastSoundTime = Date.now();

            // Contador para log de debug
            let audioChunksSent = 0;
            let totalBytesEnviados = 0;

            conversacaoState.workletNode.port.onmessage = (event) => {
                if (conversacaoState.ws?.readyState === WebSocket.OPEN && conversacaoState.isConnected) {
                    const { audioData, hasSound, rmsLevel } = event.data;

                    // Atualizar timestamp se detectou som
                    if (hasSound) {
                        conversacaoState.lastSoundTime = Date.now();
                    }

                    // Converter para base64 e enviar
                    const audioBase64 = arrayBufferToBase64(audioData);
                    totalBytesEnviados += audioData.byteLength;

                    // Formato correto conforme documentação Gemini Live API
                    const audioMessage = {
                        realtimeInput: {
                            mediaChunks: [{
                                mimeType: 'audio/pcm;rate=16000',
                                data: audioBase64
                            }]
                        }
                    };

                    conversacaoState.ws.send(JSON.stringify(audioMessage));

                    // Log do primeiro chunk para confirmar que está funcionando
                    audioChunksSent++;
                    if (audioChunksSent === 1) {
                        console.log('🎤 PRIMEIRO CHUNK DE ÁUDIO ENVIADO!');
                        console.log('   - Tamanho do chunk:', audioData.byteLength, 'bytes');
                        console.log('   - Base64 length:', audioBase64.length);
                        console.log('   - RMS Level:', rmsLevel?.toFixed(6) || 'N/A');
                        console.log('   - Som detectado:', hasSound);
                    }

                    // Log a cada 50 chunks (~3 segundos de áudio)
                    if (audioChunksSent % 50 === 0) {
                        console.log(`🎙️ Áudio enviado: ${audioChunksSent} chunks (${Math.round(totalBytesEnviados/1024)}KB), som: ${hasSound}, RMS: ${rmsLevel?.toFixed(4) || 'N/A'}`);
                    }
                }
            };

            source.connect(conversacaoState.workletNode);
            conversacaoState.isRecording = true;

            // Removida verificação de silêncio - deixar o aluno decidir quando parar
            // startSilenceDetection();

            console.log('Captura de áudio iniciada');

        } catch (error) {
            console.error('Erro ao iniciar captura de áudio:', error);
            showConversacaoError('Erro ao capturar áudio: ' + error.message);
        }
    }

    // Iniciar detecção de silêncio
    // Keep-alive para manter a conexão WebSocket ativa
    function startKeepAlive() {
        // Limpar intervalo anterior se existir
        if (conversacaoState.keepAliveInterval) {
            clearInterval(conversacaoState.keepAliveInterval);
        }

        // Enviar um ping a cada 20 segundos para manter a conexão
        conversacaoState.keepAliveInterval = setInterval(() => {
            if (conversacaoState.ws?.readyState === WebSocket.OPEN) {
                try {
                    // Enviar mensagem vazia de keep-alive
                    const keepAliveMsg = {
                        clientContent: {
                            turns: [],
                            turnComplete: false
                        }
                    };
                    conversacaoState.ws.send(JSON.stringify(keepAliveMsg));
                    console.log('💓 Keep-alive enviado');
                } catch (err) {
                    console.error('Erro ao enviar keep-alive:', err);
                }
            }
        }, 20000); // A cada 20 segundos
    }

    function stopKeepAlive() {
        if (conversacaoState.keepAliveInterval) {
            clearInterval(conversacaoState.keepAliveInterval);
            conversacaoState.keepAliveInterval = null;
        }
    }

    function startSilenceDetection() {
        // Limpar intervalo anterior se existir
        if (conversacaoState.silenceCheckInterval) {
            clearInterval(conversacaoState.silenceCheckInterval);
        }

        conversacaoState.silenceCheckInterval = setInterval(() => {
            // Não verificar silêncio se estiver tocando áudio (IA está respondendo)
            if (conversacaoState.isPlayingAudio || !conversacaoState.isConnected) {
                conversacaoState.lastSoundTime = Date.now(); // Reset durante playback
                return;
            }

            const timeSinceLastSound = Date.now() - conversacaoState.lastSoundTime;

            if (timeSinceLastSound >= conversacaoState.SILENCE_TIMEOUT) {
                console.log('Silêncio detectado por 2 minutos - desconectando...');
                updateStatus('Desconectado por inatividade', 'idle');
                disconnectConversation();
            } else if (timeSinceLastSound >= conversacaoState.SILENCE_TIMEOUT - 30000) {
                // Avisar o usuário apenas nos últimos 30 segundos
                const remaining = Math.ceil((conversacaoState.SILENCE_TIMEOUT - timeSinceLastSound) / 1000);
                updateStatus(`Inatividade detectada... (${remaining}s)`, 'warning');
            }
        }, 5000); // Verificar a cada 5 segundos (não precisa ser tão frequente)
    }

    // Parar detecção de silêncio
    function stopSilenceDetection() {
        if (conversacaoState.silenceCheckInterval) {
            clearInterval(conversacaoState.silenceCheckInterval);
            conversacaoState.silenceCheckInterval = null;
        }
    }

    // Criar processador de áudio inline com detecção de silêncio
    function createAudioWorkletProcessor() {
        const processorCode = `
            class AudioProcessor extends AudioWorkletProcessor {
                constructor() {
                    super();
                    this.bufferSize = 4096;
                    this.buffer = new Float32Array(this.bufferSize);
                    this.bufferIndex = 0;
                    this.silenceThreshold = 0.0005; // Limiar MUITO baixo para detectar som
                }

                process(inputs, outputs, parameters) {
                    const input = inputs[0];
                    if (input.length > 0) {
                        const channelData = input[0];

                        // Calcular RMS (volume) do chunk atual
                        let sumSquares = 0;
                        for (let i = 0; i < channelData.length; i++) {
                            sumSquares += channelData[i] * channelData[i];
                        }
                        const rms = Math.sqrt(sumSquares / channelData.length);

                        for (let i = 0; i < channelData.length; i++) {
                            this.buffer[this.bufferIndex++] = channelData[i];

                            if (this.bufferIndex >= this.bufferSize) {
                                // Converter para PCM 16-bit
                                const pcmData = new Int16Array(this.bufferSize);
                                for (let j = 0; j < this.bufferSize; j++) {
                                    pcmData[j] = Math.max(-32768, Math.min(32767, this.buffer[j] * 32767));
                                }

                                // Enviar dados de áudio junto com indicador de som detectado
                                const hasSound = rms > this.silenceThreshold;
                                this.port.postMessage({
                                    audioData: pcmData.buffer,
                                    hasSound: hasSound,
                                    rmsLevel: rms // Enviar nível de RMS para debug
                                });
                                this.bufferIndex = 0;
                            }
                        }
                    }
                    return true;
                }
            }

            registerProcessor('audio-processor', AudioProcessor);
        `;

        const blob = new Blob([processorCode], { type: 'application/javascript' });
        return URL.createObjectURL(blob);
    }

    // Reproduzir fila de áudio de forma sequencial com melhor qualidade
    async function playAudioQueue() {
        if (conversacaoState.isPlayingAudio) return;
        conversacaoState.isPlayingAudio = true;
        updateConversacaoUI('playing');

        // Criar contexto de playback se não existir
        if (!conversacaoState.playbackContext) {
            conversacaoState.playbackContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 24000 // Gemini retorna áudio a 24kHz
            });

            // Criar nós de processamento para melhor qualidade
            conversacaoState.gainNode = conversacaoState.playbackContext.createGain();
            conversacaoState.gainNode.gain.value = 1.3; // Aumento de volume

            // Filtro passa-baixa mais suave - não cortar tanto a voz
            conversacaoState.lowPassFilter = conversacaoState.playbackContext.createBiquadFilter();
            conversacaoState.lowPassFilter.type = 'lowpass';
            conversacaoState.lowPassFilter.frequency.value = 12000; // Frequência mais alta para não cortar a voz
            conversacaoState.lowPassFilter.Q.value = 0.5; // Q mais baixo = transição mais suave

            // Compressor mais suave para não distorcer
            conversacaoState.compressor = conversacaoState.playbackContext.createDynamicsCompressor();
            conversacaoState.compressor.threshold.value = -24;
            conversacaoState.compressor.knee.value = 40;
            conversacaoState.compressor.ratio.value = 3;
            conversacaoState.compressor.attack.value = 0.01;
            conversacaoState.compressor.release.value = 0.3;

            // Conectar cadeia de áudio
            conversacaoState.gainNode.connect(conversacaoState.lowPassFilter);
            conversacaoState.lowPassFilter.connect(conversacaoState.compressor);
            conversacaoState.compressor.connect(conversacaoState.playbackContext.destination);
        }

        // Acumular TODOS os chunks primeiro para reprodução contínua sem tremor
        let allSamples = [];

        // Coletar todos os chunks disponíveis
        while (conversacaoState.audioQueue.length > 0) {
            const base64Data = conversacaoState.audioQueue.shift();

            try {
                // Decodificar base64 para ArrayBuffer
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }

                // Converter de Int16 para Float32 com normalização
                const int16Data = new Int16Array(bytes.buffer);
                const float32Data = new Float32Array(int16Data.length);

                for (let i = 0; i < int16Data.length; i++) {
                    float32Data[i] = int16Data[i] / 32768;
                }

                // NÃO aplicar fade em cada chunk - isso causa tremor!
                // Apenas acumular as amostras
                allSamples.push(...float32Data);

            } catch (error) {
                console.error('Erro ao processar chunk de áudio:', error);
            }
        }

        // Reproduzir todas as amostras acumuladas de uma vez
        if (allSamples.length > 0) {
            try {
                const samples = new Float32Array(allSamples);

                // Aplicar fade APENAS no início e fim do áudio completo (não em cada chunk)
                const fadeLength = Math.min(256, Math.floor(samples.length / 10));
                for (let i = 0; i < fadeLength; i++) {
                    const fadeMultiplier = i / fadeLength;
                    samples[i] *= fadeMultiplier; // Fade-in suave no início
                    samples[samples.length - 1 - i] *= fadeMultiplier; // Fade-out suave no fim
                }

                // Criar buffer e tocar
                const audioBuffer = conversacaoState.playbackContext.createBuffer(1, samples.length, 24000);
                audioBuffer.getChannelData(0).set(samples);

                const source = conversacaoState.playbackContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(conversacaoState.gainNode);

                // Esperar o áudio terminar
                await new Promise((resolve) => {
                    source.onended = resolve;
                    source.start();
                });

            } catch (error) {
                console.error('Erro ao reproduzir áudio:', error);
            }
        }

        // Verificar se chegaram mais chunks enquanto tocava
        if (conversacaoState.audioQueue.length > 0) {
            // Continuar reproduzindo novos chunks que chegaram
            conversacaoState.isPlayingAudio = false;
            playAudioQueue();
            return;
        }

        conversacaoState.isPlayingAudio = false;
        if (conversacaoState.isConnected) {
            updateConversacaoUI('recording');
        }
    }

    // Converter ArrayBuffer para Base64
    function arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    // Deduzir créditos após conversa (10 créditos por minuto)
    async function deductConversationCredits(durationSeconds) {
        if (!durationSeconds || durationSeconds <= 0) {
            console.log('⚠️ Sem duração para deduzir créditos');
            return;
        }

        if (!currentUser?.id) {
            console.log('⚠️ Usuário não identificado para deduzir créditos');
            return;
        }

        const minutes = durationSeconds / 60;
        const creditsToDeduct = Math.ceil(minutes * 10); // 10 créditos por minuto

        console.log(`💰 Deduzindo créditos: ${minutes.toFixed(2)} min = ${creditsToDeduct} créditos`);

        try {
            const response = await fetch('/.netlify/functions/deduct-credits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUser.id,
                    durationSeconds: durationSeconds,
                    type: 'conversation'
                })
            });

            const result = await response.json();

            if (response.ok) {
                console.log(`✅ Créditos deduzidos: ${result.creditsDeducted} (${result.previousCredits} → ${result.newCredits})`);
                // Atualizar display de créditos se existir
                const creditDisplay = document.querySelector('.credits-display, #credits-count');
                if (creditDisplay) {
                    creditDisplay.textContent = result.newCredits;
                }
            } else {
                console.error('❌ Erro ao deduzir créditos:', result.error);
            }
        } catch (error) {
            console.error('❌ Erro na chamada de dedução:', error);
        }
    }

    // Desconectar da conversa
    function disconnectConversation() {
        console.log('Desconectando...');

        // Guardar duração antes de limpar
        const conversationDuration = conversacaoState.totalSeconds;

        // Flush qualquer transcript pendente antes de desconectar
        flushUserTranscript();

        console.log('📊 Total de transcripts armazenados:', conversacaoState.transcripts.length);
        console.log('📊 Transcripts:', JSON.stringify(conversacaoState.transcripts, null, 2));
        console.log(`⏱️ Duração da conversa: ${conversationDuration} segundos`);

        if (conversacaoState.ws) {
            conversacaoState.ws.close();
        }

        // Dispara análise de erros ao desconectar (se houver transcripts)
        if (conversacaoState.transcripts && conversacaoState.transcripts.length > 0) {
            console.log('📊 Disparando análise de correções...');
            triggerAnalysis();
        } else {
            console.log('⚠️ Nenhum transcript para analisar!');
        }

        // Deduzir créditos baseado no tempo de conversa
        if (conversationDuration > 0) {
            deductConversationCredits(conversationDuration);
        }

        cleanupConversation();
        updateStatus('Desconectado', 'idle');
        updateConversacaoUI('idle');
        stopTimer();
    }

    // Limpar recursos
    function cleanupConversation() {
        conversacaoState.isConnected = false;
        conversacaoState.isConnecting = false;
        conversacaoState.isRecording = false;
        conversacaoState.ws = null;
        conversacaoState.connectionStartTime = null;

        // Parar timer, keep-alive, detecção de silêncio e som ambiente
        stopTimer();
        stopKeepAlive();
        stopSilenceDetection();
        // Não parar som ambiente automaticamente - deixar o usuário decidir
        // stopAmbientSound();

        if (conversacaoState.stream) {
            conversacaoState.stream.getTracks().forEach(track => track.stop());
            conversacaoState.stream = null;
        }

        if (conversacaoState.audioContext && conversacaoState.audioContext.state !== 'closed') {
            conversacaoState.audioContext.close().catch(() => {});
            conversacaoState.audioContext = null;
        }

        if (conversacaoState.playbackContext && conversacaoState.playbackContext.state !== 'closed') {
            conversacaoState.playbackContext.close().catch(() => {});
            conversacaoState.playbackContext = null;
        }

        // Limpar nós de áudio
        conversacaoState.workletNode = null;
        conversacaoState.gainNode = null;
        conversacaoState.lowPassFilter = null;
        conversacaoState.compressor = null;
    }

    // Tentar reconexão automática com backoff exponencial
    async function attemptReconnection(reason) {
        conversacaoState.reconnectAttempts++;

        if (conversacaoState.reconnectAttempts > conversacaoState.maxReconnectAttempts) {
            console.log('Máximo de tentativas de reconexão atingido');
            showConversacaoError('Conexão perdida. Clique no microfone para reconectar.');
            cleanupConversation();
            updateStatus('Desconectado', 'idle');
            updateConversacaoUI('idle');
            conversacaoState.reconnectAttempts = 0;
            return;
        }

        // Backoff exponencial: 2s, 4s, 8s
        const delay = Math.pow(2, conversacaoState.reconnectAttempts) * 1000;
        console.log(`Tentativa de reconexão ${conversacaoState.reconnectAttempts}/${conversacaoState.maxReconnectAttempts} em ${delay/1000}s...`);

        updateStatus(`Reconectando (${conversacaoState.reconnectAttempts}/${conversacaoState.maxReconnectAttempts})...`, 'connecting');

        // Limpar recursos antigos mas manter apiKey
        const savedApiKey = conversacaoState.apiKey;
        cleanupConversation();
        conversacaoState.apiKey = savedApiKey;

        // Aguardar antes de reconectar
        await new Promise(resolve => setTimeout(resolve, delay));

        // Tentar reconectar
        try {
            await connectConversation();
            // Se chegou aqui, conexão foi bem sucedida
            conversacaoState.reconnectAttempts = 0;
            console.log('Reconexão bem sucedida!');
        } catch (error) {
            console.error('Falha na reconexão:', error);
            // A próxima tentativa será feita pelo onclose/onerror
        }
    }

    // Iniciar conversa com um tópico
    async function startConversationWithTopic(topic) {
        // Primeiro conectar se não estiver conectado
        if (!conversacaoState.isConnected) {
            await connectConversation();

            // Esperar conexão estabelecer
            let attempts = 0;
            while (!conversacaoState.isConnected && attempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }

            if (!conversacaoState.isConnected) {
                showConversacaoError('Não foi possível conectar.');
                return;
            }
        }

        // Limpar histórico
        conversacaoState.conversationHistory = [];
        clearHistory();

        // Enviar mensagem de texto para iniciar o tópico
        if (conversacaoState.ws?.readyState === WebSocket.OPEN) {
            // Prompts específicos por tema que incentivam conversa natural
            const topicPrompts = {
                'Viagens': `Beginne ein lockeres Gespräch auf Deutsch über Reisen. Frage mich zuerst, wohin ICH gerne reisen möchte. WICHTIG: Wenn ich antworte, reagiere auf MEINE Antwort - wenn ich "Brasilien" sage, sprich über Brasilien, nicht über andere Orte.`,
                'Restaurante': `Beginne ein lockeres Gespräch auf Deutsch über Essen und Restaurants. Frage mich, was ICH gerne esse. WICHTIG: Wenn ich antworte, reagiere auf MEINE Antwort - bleib beim Thema, das ICH gewählt habe.`,
                'Apresentação': `Beginne ein lockeres Gespräch auf Deutsch, um mich kennenzulernen. Frage mich nach meinem Namen und woher ICH komme. WICHTIG: Höre genau zu was ich sage und stelle Folgefragen basierend auf MEINEN Antworten.`,
                'Moradia': `Beginne ein lockeres Gespräch auf Deutsch über Wohnen. Frage mich, wo ICH wohne. WICHTIG: Wenn ich antworte, reagiere auf MEINE Antwort und stelle Folgefragen dazu.`,
                'Trabalho': `Beginne ein lockeres Gespräch auf Deutsch über Arbeit. Frage mich, was ICH beruflich mache. WICHTIG: Wenn ich antworte, reagiere auf MEINE Antwort und zeige echtes Interesse.`,
                'Hobbies': `Beginne ein lockeres Gespräch auf Deutsch über Hobbys. Frage mich, was ICH in meiner Freizeit gerne mache. WICHTIG: Wenn ich antworte, reagiere auf MEINE Antwort.`,
                'Fazer Compras': `Beginne ein lockeres Gespräch auf Deutsch über Einkaufen. Frage mich, wo ICH gerne einkaufe. WICHTIG: Wenn ich antworte, reagiere auf MEINE Antwort und stelle Folgefragen dazu.`,
                'Rotina Diária': `Beginne ein lockeres Gespräch auf Deutsch über Tagesroutine. Frage mich, wie MEIN typischer Tag aussieht. WICHTIG: Wenn ich antworte, reagiere auf MEINE Antwort und zeige echtes Interesse.`,

                // ===== RESTAURANTE - CENÁRIO A2: Almoço com Colegas =====
                'restaurante-a2': `Du bist Anna, eine deutsche Kollegin. Wir sind in Berlin in einem traditionellen Gasthaus zum Mittagessen.

KONTEXT: Ich bin ein Besucher aus dem Ausland in der Berliner Firmenzentrale. Du und zwei andere Kollegen (Markus und Sofia) haben mich zum Mittagessen eingeladen.

DEINE ROLLE:
- Sei freundlich und geduldig mit meinem Deutsch (A2 Niveau)
- Stelle einfache, direkte Fragen
- Gib mir Zeit zu antworten
- Korrigiere sanft häufige A2-Fehler (Artikel, Wortstellung)
- Hilf mir, diese Vokabeln zu üben: die Speisekarte, Ich hätte gern..., Was empfehlen Sie?, das Tagesgericht, Zusammen oder getrennt?, Stimmt so

STARTE SO: Begrüße mich herzlich als Kollegin Anna und frage, ob ich schon Hunger habe. Dann zeig mir die Speisekarte und frage, was ich gerne essen möchte.

WICHTIG: Sprich langsam und deutlich. Verwende einfache Sätze. Wenn ich Fehler mache, korrigiere sie freundlich und erkläre kurz warum.`,

                // ===== RESTAURANTE - CENÁRIO B1: Celebração com Problemas =====
                'restaurante-b1': `Du bist ein Kellner in einem gehobenen Restaurant in München.

KONTEXT: Ich feiere meinen Geburtstag mit Freunden. Es gibt Probleme: mein Essen ist kalt, der Wein ist falsch, und ich muss höflich aber bestimmt Lösungen aushandeln.

DEINE ROLLE ALS KELLNER:
- Sei anfangs etwas defensiv bei Beschwerden
- Werde dann kooperativer, wenn ich höflich aber bestimmt bleibe
- Teste meine Fähigkeit, Beschwerden angemessen zu eskalieren
- Achte auf Konjunktiv II bei höflichen Bitten

VOKABELN ZUM ÜBEN: Entschuldigung, aber..., Das ist nicht in Ordnung, könnten Sie bitte..., etwas reklamieren, eine Beschwerde vorbringen, eine Entschädigung, die Rechnung überprüfen

STARTE SO: Bring mir mein Hauptgericht (das offensichtlich kalt ist) und frage freundlich "Hier ist Ihr Wiener Schnitzel. Darf es sonst noch etwas sein?"

WICHTIG - PROAKTIVES VERHALTEN:
- NIEMALS still bleiben und auf mich warten! Du musst die Szene lebendig halten.
- Wenn du sagst, dass du das Essen erwärmen wirst, geh weg und komm nach 2-3 Sekunden zurück mit einer Nachricht wie: "So, ich habe das Schnitzel in die Küche gebracht. Es wird etwa 5 Minuten dauern. Möchten Sie in der Zwischenzeit etwas trinken?"
- Simuliere die Bewegungen: "Ich gehe jetzt zur Küche..." dann nach einer Pause "...So, ich bin wieder da."
- Mach kleine Geräusche oder beschreibe was du tust: "Moment, ich räume hier kurz ab..."
- Halte die Konversation am Leben mit Fragen und Updates.

REAKTION AUF BESCHWERDEN: Wenn ich unhöflich werde, zeig dass das nicht funktioniert. Wenn ich den Konjunktiv II benutze, sei kooperativer. Gib mir am Ende Feedback zu meiner Kommunikation.`
            };

            const prompt = topicPrompts[topic] || `Beginne ein lockeres Gespräch auf Deutsch über: ${topic}. Frage mich zuerst nach meiner Meinung dazu. WICHTIG: Reagiere immer auf das, was ICH sage.`;

            const textMessage = {
                clientContent: {
                    turns: [{
                        role: 'user',
                        parts: [{ text: prompt }]
                    }],
                    turnComplete: true
                }
            };

            conversacaoState.ws.send(JSON.stringify(textMessage));
            addMessageToHistory('user', `Tema: ${topic}`);
            updateStatus('Aguardando resposta...', 'speaking');
        }
    }

    function updateConversacaoUI(state) {
        const micBtn = document.getElementById('conv-mic-btn');
        const micIcon = document.getElementById('conv-mic-icon');
        const stopIcon = document.getElementById('conv-stop-icon');
        const pulseRing = document.getElementById('conv-pulse-ring');
        const waveContainer = document.getElementById('conv-wave-container');
        const idleText = document.getElementById('conv-idle-text');
        const muteBtn = document.getElementById('conv-mute-btn');
        const audioVisual = document.getElementById('conv-audio-visual');

        if (!micBtn) return;

        switch (state) {
            case 'connecting':
                micBtn.classList.add('active');
                micIcon.classList.add('hidden');
                stopIcon.classList.remove('hidden');
                pulseRing?.classList.remove('opacity-0');
                if (idleText) idleText.classList.add('hidden');
                if (audioVisual) audioVisual.classList.remove('hidden');
                break;

            case 'recording':
                micBtn.classList.add('active');
                micIcon.classList.add('hidden');
                stopIcon.classList.remove('hidden');
                pulseRing?.classList.remove('opacity-0');
                waveContainer?.classList.add('conv-wave-active');
                waveContainer?.classList.remove('hidden');
                if (idleText) idleText.classList.add('hidden');
                if (muteBtn) muteBtn.disabled = false;
                if (audioVisual) audioVisual.classList.remove('hidden');
                break;

            case 'playing':
                waveContainer?.classList.add('conv-wave-active');
                pulseRing?.classList.add('opacity-0');
                break;

            case 'idle':
            default:
                micBtn.classList.remove('active');
                micIcon.classList.remove('hidden');
                stopIcon.classList.add('hidden');
                pulseRing?.classList.add('opacity-0');
                waveContainer?.classList.remove('conv-wave-active');
                if (conversacaoState.conversationHistory.length === 0) {
                    if (idleText) idleText.classList.remove('hidden');
                    waveContainer?.classList.add('hidden');
                }
                if (muteBtn) muteBtn.disabled = true;
                // Esconder audio visual quando desconectado
                if (audioVisual && !conversacaoState.isConnected) {
                    audioVisual.classList.add('hidden');
                }
                break;
        }
    }

    function updateStatus(text, state) {
        const statusDot = document.getElementById('conv-status-dot');
        const statusText = document.getElementById('conv-status-text');

        if (statusText) statusText.textContent = text;

        if (statusDot) {
            statusDot.className = 'w-2.5 h-2.5 rounded-full';
            switch (state) {
                case 'connecting':
                    statusDot.classList.add('connecting');
                    break;
                case 'connected':
                    statusDot.classList.add('connected');
                    break;
                case 'speaking':
                    statusDot.classList.add('speaking');
                    break;
                case 'listening':
                    statusDot.classList.add('listening');
                    break;
                default:
                    statusDot.classList.add('bg-slate-500');
            }
        }
    }

    function startTimer() {
        // Parar timer anterior se existir
        stopTimer();

        conversacaoState.totalSeconds = 0;
        updateTimerDisplay();
        conversacaoState.timerInterval = setInterval(() => {
            // Só contar se ainda conectado
            if (conversacaoState.isConnected) {
                conversacaoState.totalSeconds++;
                updateTimerDisplay();
            }
        }, 1000);
    }

    function stopTimer() {
        if (conversacaoState.timerInterval) {
            clearInterval(conversacaoState.timerInterval);
            conversacaoState.timerInterval = null;
        }
        console.log('⏱️ Timer parado');
    }

    function updateTimerDisplay() {
        const timerEl = document.getElementById('conv-timer');
        if (timerEl) {
            const minutes = Math.floor(conversacaoState.totalSeconds / 60);
            const seconds = conversacaoState.totalSeconds % 60;
            timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
    }

    function updateCreditsUsed() {
        const creditsEl = document.getElementById('conv-credits-used');
        if (creditsEl) {
            creditsEl.textContent = `${conversacaoState.creditsUsed.toFixed(1)} créditos usados`;
        }
    }

    // Cores das categorias de erro
    const CORRECTION_COLORS = {
        declinacao: { hex: '#f472b6', name: 'Declinação' },
        conjugacao: { hex: '#c084fc', name: 'Conjugação' },
        preposicoes: { hex: '#60a5fa', name: 'Preposições' },
        sintaxe: { hex: '#fb923c', name: 'Sintaxe' },
        vocabulario: { hex: '#4ade80', name: 'Vocabulário' }
    };

    // Função para fazer flush do transcript acumulado do usuário
    function flushUserTranscript() {
        if (conversacaoState.transcriptFlushTimer) {
            clearTimeout(conversacaoState.transcriptFlushTimer);
            conversacaoState.transcriptFlushTimer = null;
        }

        const accumulated = conversacaoState.currentUserTranscript.trim();
        conversacaoState.currentUserTranscript = '';

        // Só armazena se tiver conteúdo significativo (mais de 5 caracteres)
        if (accumulated.length > 5) {
            // Limpa ruídos e fragmentos inválidos
            const cleaned = accumulated
                .replace(/<noise>/g, '')
                .replace(/\s+/g, ' ')
                .trim();

            if (cleaned.length > 5) {
                storeTranscript(cleaned, 'user');
            }
        }
    }

    // Função para armazenar transcrição completa
    function storeTranscript(text, speaker) {
        if (!text || text.trim().length < 5) return;

        // Adiciona ao array de transcripts
        conversacaoState.transcripts.push({
            timestamp: Date.now(),
            speaker: speaker,
            text: text.trim()
        });

        console.log(`📝 FRASE COMPLETA ARMAZENADA (${speaker}):`, text);

        // Inicia timer de 5 minutos se ainda não foi iniciado
        if (!conversacaoState.analysisTimer && !conversacaoState.analysisTriggered) {
            conversacaoState.analysisTimer = setTimeout(() => {
                console.log('⏰ Timer de 5 minutos atingido - iniciando análise');
                triggerAnalysis();
            }, 5 * 60 * 1000); // 5 minutos
        }
    }

    // Função para disparar análise (chamada ao desconectar ou após 5 min)
    async function triggerAnalysis() {
        // Evita análises duplicadas
        if (conversacaoState.analysisTriggered) return;
        conversacaoState.analysisTriggered = true;

        // Limpa timer se existir
        if (conversacaoState.analysisTimer) {
            clearTimeout(conversacaoState.analysisTimer);
            conversacaoState.analysisTimer = null;
        }

        // Filtra apenas transcripts do usuário (não analisa a IA)
        const userTranscripts = conversacaoState.transcripts.filter(t => t.speaker === 'user');
        console.log('🔍 Transcripts do usuário para análise:', userTranscripts.length);
        console.log('🔍 Conteúdo:', userTranscripts.map(t => t.text).join(' | '));

        if (userTranscripts.length === 0) {
            console.log('📭 Nenhum transcript do usuário para analisar');
            showAnalysisStatus('Nenhuma frase sua foi captada para análise.');
            return;
        }

        // Mostra status de análise
        showAnalysisStatus('Analisando sua conversa...');

        try {
            const requestBody = {
                transcripts: userTranscripts,
                fullAnalysis: true
            };
            console.log('📤 Enviando para DeepSeek:', JSON.stringify(requestBody, null, 2));

            const response = await fetch('/.netlify/functions/conversacao-correcoes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            console.log('📥 Resposta status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Erro ao analisar correções:', response.status, errorText);
                showAnalysisStatus('Erro na análise. Tente novamente.');
                return;
            }

            const data = await response.json();
            console.log('📥 Resposta DeepSeek:', JSON.stringify(data, null, 2));

            if (data.corrections && data.corrections.length > 0) {
                console.log('✅ Encontrados', data.corrections.length, 'erros');
                displayCorrections(data.corrections);
            } else {
                console.log('✅ Nenhum erro encontrado');
                showAnalysisStatus('Parabéns! Nenhum erro encontrado na sua conversa.');
            }
        } catch (error) {
            console.error('Erro na análise de correções:', error);
            showAnalysisStatus('Erro na análise. Tente novamente.');
        }
    }

    // Mostra status da análise
    function showAnalysisStatus(message) {
        const correctionsEl = document.getElementById('conv-corrections');
        if (!correctionsEl) return;

        // Remover mensagem inicial se existir
        const emptyMsg = correctionsEl.querySelector('.text-center');
        if (emptyMsg) emptyMsg.remove();

        const statusDiv = document.createElement('div');
        statusDiv.className = 'analysis-status text-center py-4';
        statusDiv.innerHTML = `
            <div class="flex items-center justify-center gap-2 text-cyan-400">
                <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>${escapeHtml(message)}</span>
            </div>
        `;
        correctionsEl.appendChild(statusDiv);
    }

    // Função para exibir correções na UI com contexto completo
    function displayCorrections(corrections) {
        const correctionsEl = document.getElementById('conv-corrections');
        if (!correctionsEl) return;

        // Limpa tudo
        correctionsEl.innerHTML = '';

        // Mostrar contador de erros
        const errorCountEl = document.getElementById('conv-error-count');
        if (errorCountEl) {
            errorCountEl.classList.remove('hidden');
        }

        corrections.forEach(corr => {
            const color = CORRECTION_COLORS[corr.categoria] || CORRECTION_COLORS.vocabulario;
            conversacaoState.totalCorrections++;

            // Atualizar contador
            const totalEl = document.getElementById('conv-total-errors');
            if (totalEl) {
                totalEl.textContent = conversacaoState.totalCorrections;
            }

            // Criar card de correção com contexto
            const corrDiv = document.createElement('div');
            corrDiv.className = 'correction-card animate-fade-in';
            corrDiv.style.cssText = `
                background: #1e293b;
                border: 1px solid #475569;
                border-left: 4px solid ${color.hex};
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 12px;
                animation: slideIn 0.3s ease-out;
            `;

            // Destacar o erro no contexto
            let contextHtml = '';
            if (corr.contexto) {
                const contextoEscaped = escapeHtml(corr.contexto);
                const erroEscaped = escapeHtml(corr.erro || '');
                // Tenta destacar o erro no contexto
                if (erroEscaped && contextoEscaped.toLowerCase().includes(erroEscaped.toLowerCase())) {
                    const regex = new RegExp(`(${erroEscaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                    contextHtml = contextoEscaped.replace(regex, `<mark style="background: ${color.hex}; color: #000; padding: 1px 4px; border-radius: 3px;">$1</mark>`);
                } else {
                    contextHtml = contextoEscaped;
                }
            }

            corrDiv.innerHTML = `
                ${corr.contexto ? `
                <div style="margin-bottom: 10px; padding: 10px; background: #0f172a; border-radius: 6px; font-style: italic; color: #e2e8f0; font-size: 14px; line-height: 1.5;">
                    "${contextHtml}"
                </div>` : ''}
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                    <span style="display: inline-block; width: 10px; height: 10px; background: ${color.hex}; border-radius: 50%;"></span>
                    <span style="color: ${color.hex}; font-size: 12px; font-weight: 600; text-transform: uppercase;">${color.name}</span>
                </div>
                <div style="margin-bottom: 8px;">
                    <span style="color: #ef4444; text-decoration: line-through; font-weight: 500;">${escapeHtml(corr.erro || '')}</span>
                    <span style="color: #94a3b8; margin: 0 8px;">→</span>
                    <span style="color: #4ade80; font-weight: 600;">${escapeHtml(corr.correcao || '')}</span>
                </div>
                <p style="color: #cbd5e1; font-size: 13px; margin: 0; line-height: 1.5;">${escapeHtml(corr.explicacao || '')}</p>
            `;

            correctionsEl.appendChild(corrDiv);
        });

        correctionsEl.scrollTop = 0; // Volta ao topo para ver todas as correções
    }

    // Função legada - agora apenas armazena transcripts
    function addMessageToHistory(type, text) {
        // Não faz mais nada - a análise é feita no final
    }

    function clearHistory() {
        clearCorrections();
    }

    function clearCorrections(force = false) {
        // NÃO limpar se há análise em andamento (a menos que seja forçado)
        if (conversacaoState.analysisTriggered && !force) {
            console.log('⏳ Análise em andamento - mantendo transcripts');
            return;
        }

        const correctionsEl = document.getElementById('conv-corrections');
        if (correctionsEl) {
            correctionsEl.innerHTML = `
                <div class="text-center text-slate-500 py-4">
                    <p>Suas correções aparecerão aqui.</p>
                    <p class="text-sm mt-1">Ao final da conversa, seus erros serão analisados!</p>
                </div>
            `;
        }
        // Reset estado
        conversacaoState.totalCorrections = 0;
        conversacaoState.transcripts = [];
        conversacaoState.analysisTriggered = false;
        conversacaoState.currentUserTranscript = '';
        if (conversacaoState.transcriptFlushTimer) {
            clearTimeout(conversacaoState.transcriptFlushTimer);
            conversacaoState.transcriptFlushTimer = null;
        }
        if (conversacaoState.analysisTimer) {
            clearTimeout(conversacaoState.analysisTimer);
            conversacaoState.analysisTimer = null;
        }
        const totalEl = document.getElementById('conv-total-errors');
        if (totalEl) totalEl.textContent = '0';
        const errorCountEl = document.getElementById('conv-error-count');
        if (errorCountEl) errorCountEl.classList.add('hidden');
    }

    function showConversacaoError(message) {
        const correctionsEl = document.getElementById('conv-corrections');
        if (correctionsEl) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-center';
            errorDiv.innerHTML = `<p class="text-red-400 text-sm">${escapeHtml(message)}</p>`;
            correctionsEl.appendChild(errorDiv);
            correctionsEl.scrollTop = correctionsEl.scrollHeight;
        }
    }

    function toggleMute() {
        if (conversacaoState.stream) {
            const audioTrack = conversacaoState.stream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                const muteBtn = document.getElementById('conv-mute-btn');
                if (muteBtn) {
                    muteBtn.classList.toggle('bg-red-600', !audioTrack.enabled);
                    muteBtn.classList.toggle('bg-slate-700', audioTrack.enabled);
                }
            }
        }
    }
});


