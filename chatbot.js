// Chat Widget for CorrectMe - German Learning Assistant
(function() {
    'use strict';

    // Add widget styles
    const widgetStyles = document.createElement('style');
    widgetStyles.textContent = `
        :root {
            --chat-color-primary-pink: #f06292;
            --chat-color-secondary-pink: #f8bbd0;
            --chat-color-text-dark: #374151;
            --chat-color-text-light: #6b7280;
            --chat-color-background-light: #f9fafb;
            --chat-color-background-user: #fffbeb;
            --chat-color-background-bot: #fce7f3;
            --chat-color-border: #e5e7eb;
            --chat-radius-sm: 8px;
            --chat-radius-md: 12px;
            --chat-radius-lg: 16px;
            --chat-radius-full: 9999px;
            --chat-transition: all 0.2s ease-in-out;
            --chat-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            --chat-shadow-hover: 0 6px 16px rgba(0, 0, 0, 0.12);
        }

        .chat-assist-widget * {
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }

        .chat-assist-widget .chat-window {
            position: fixed;
            bottom: 100px;
            width: 380px;
            height: 600px;
            background: white;
            border-radius: var(--chat-radius-lg);
            box-shadow: var(--chat-shadow);
            display: none;
            flex-direction: column;
            overflow: hidden;
            z-index: 10000;
            border: 1px solid var(--chat-color-border);
        }

        .chat-assist-widget .chat-window.active {
            display: flex;
        }

        .chat-assist-widget .chat-header {
            padding: 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            background: linear-gradient(to bottom, #ddd6fe 0%, #ffffff 30%, #ffffff 70%, #fffde7 100%);
            color: var(--chat-color-text-dark);
            position: relative;
            flex-shrink: 0;
            border-bottom: 1px solid var(--chat-color-border);
        }
        
        .chat-assist-widget .header-content {
            display: flex;
            flex-direction: column;
        }

        .chat-assist-widget .chat-header-logo {
            height: 90px;
            width: auto;
            object-fit: contain;
            flex-shrink: 0;
        }

        .chat-assist-widget .chat-header-title {
            font-size: 16px;
            font-weight: 700;
            line-height: 1.2;
            color: var(--chat-color-text-dark);
        }
        
        .chat-assist-widget .slogan-container {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 4px;
        }
        
        .chat-assist-widget .chat-header-slogan {
            font-size: 11px;
            color: var(--chat-color-text-light);
        }
        
        .chat-assist-widget .flag-icon {
            width: 16px;
            height: auto;
            border-radius: 2px;
            box-shadow: 0 0 2px rgba(0,0,0,0.2);
        }

        .chat-assist-widget .chat-close-btn {
            position: absolute;
            right: 12px;
            top: 12px;
            background: transparent;
            border: none;
            color: var(--chat-color-text-light);
            cursor: pointer;
            padding: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: var(--chat-transition);
            border-radius: var(--chat-radius-full);
            width: 32px;
            height: 32px;
        }

        .chat-assist-widget .chat-close-btn:hover {
            background: #f3f4f6;
            color: var(--chat-color-text-dark);
        }

        .chat-assist-widget .chat-body {
            display: flex;
            flex-direction: column;
            height: 100%;
            overflow: hidden;
        }
        
        .chat-assist-widget .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            background: var(--chat-color-background-light);
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .chat-assist-widget .message-container {
            display: flex;
            gap: 10px;
            align-items: flex-end;
            max-width: 85%;
        }

        .chat-assist-widget .message-container.user-message {
            flex-direction: row-reverse;
            align-self: flex-end;
        }

        .chat-assist-widget .message-icon {
            width: 32px;
            height: 32px;
            border-radius: var(--chat-radius-full);
            object-fit: cover;
            flex-shrink: 0;
            border: 2px solid var(--chat-color-border);
        }

        .chat-assist-widget .message-content {
            display: flex;
            flex-direction: column;
        }

        .chat-assist-widget .user-message .message-content {
            align-items: flex-end;
        }

        .chat-assist-widget .chat-bubble {
            padding: 10px 14px;
            border-radius: var(--chat-radius-md);
            max-width: 100%;
            word-wrap: break-word;
            line-height: 1.5;
            font-size: 14px;
            position: relative;
        }

        .chat-assist-widget .bot-bubble {
            background: var(--chat-color-background-bot);
            color: var(--chat-color-text-dark);
            border-radius: 0 var(--chat-radius-md) var(--chat-radius-md) var(--chat-radius-md);
        }

        .chat-assist-widget .user-bubble {
            background: var(--chat-color-background-user);
            color: var(--chat-color-text-dark);
            border-radius: var(--chat-radius-md) 0 var(--chat-radius-md) var(--chat-radius-md);
        }
        
        .chat-assist-widget .markdown-content h3 {
            font-size: 16px;
            font-weight: 600;
            margin-top: 0;
            margin-bottom: 12px;
        }
        .chat-assist-widget .markdown-content p {
            margin-top: 0;
            margin-bottom: 8px;
            line-height: 1.5;
        }
        .chat-assist-widget .markdown-content ul {
            list-style-type: disc;
            padding-left: 20px;
            margin-top: 0;
            margin-bottom: 8px;
        }
        .chat-assist-widget .markdown-content strong {
            font-weight: 600;
        }
        .chat-assist-widget .markdown-content em {
            font-style: italic;
        }
        .chat-assist-widget .markdown-content p:last-child {
            margin-bottom: 0;
        }

        .chat-assist-widget .timestamp {
            font-size: 11px;
            color: var(--chat-color-text-light);
            margin-top: 6px;
            padding: 0 4px;
        }

        .chat-assist-widget .chat-controls {
            padding: 12px 16px;
            background: white;
            border-top: 1px solid var(--chat-color-border);
            display: flex;
            gap: 10px;
            align-items: center;
        }

        .chat-assist-widget .chat-input-area {
            flex: 1;
            display: flex;
            align-items: center;
            background: #f3f4f6;
            border-radius: var(--chat-radius-full);
            padding: 4px;
            border: 1px solid transparent;
            transition: var(--chat-transition);
        }
        
        .chat-assist-widget .chat-input-area:focus-within {
             border-color: var(--chat-color-secondary-pink);
             background: white;
        }
        
        .chat-assist-widget .chat-input-area.disabled {
            background: #f9fafb;
            cursor: not-allowed;
        }
        .chat-assist-widget .chat-input-area.disabled .chat-textarea {
            cursor: not-allowed;
            background: transparent;
        }

        .chat-assist-widget .chat-textarea {
            flex: 1;
            border: none;
            background: transparent;
            padding: 8px 12px;
            resize: none;
            font-family: inherit;
            font-size: 14px;
            line-height: 1.4;
            max-height: 100px;
            min-height: 24px;
            outline: none;
            color: var(--chat-color-text-dark);
        }

        .chat-assist-widget .control-btn {
            width: 36px;
            height: 36px;
            background: transparent;
            border: none;
            border-radius: var(--chat-radius-full);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--chat-color-text-light);
            transition: var(--chat-transition);
            flex-shrink: 0;
        }

        .chat-assist-widget .control-btn:hover {
            color: var(--chat-color-text-dark);
            background: #e5e7eb;
        }

        .chat-assist-widget .chat-submit {
            background: var(--chat-color-primary-pink);
            color: white;
        }
        
        .chat-assist-widget .chat-submit:hover {
             background: #ec407a;
             color: white;
        }

        .chat-assist-widget .chat-submit:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            background: #e5e7eb;
        }

        .chat-assist-widget .control-btn svg {
            width: 20px;
            height: 20px;
        }

        .chat-assist-widget .file-upload-input {
            display: none;
        }

        .chat-assist-widget .chat-launcher {
            position: fixed;
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, var(--chat-color-primary-pink), #ec407a);
            border: none;
            border-radius: var(--chat-radius-full);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            box-shadow: var(--chat-shadow);
            transition: var(--chat-transition);
            z-index: 9999;
        }

        .chat-assist-widget .chat-launcher:hover {
            transform: translateY(-2px) scale(1.05);
            box-shadow: var(--chat-shadow-hover);
        }

        .chat-assist-widget .chat-launcher svg {
            width: 32px;
            height: 32px;
        }

        .chat-assist-widget .action-buttons-container {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-top: 12px;
        }

        .chat-assist-widget .action-button {
            background: linear-gradient(135deg, var(--chat-color-secondary-pink), var(--chat-color-primary-pink));
            color: white;
            border: none;
            padding: 12px 16px;
            border-radius: var(--chat-radius-md);
            cursor: pointer;
            font-weight: 600;
            transition: var(--chat-transition);
            text-align: center;
        }

        .chat-assist-widget .action-button:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(240, 98, 146, 0.3);
        }

        .chat-assist-widget .dynamic-buttons-container {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 12px;
        }

        .chat-assist-widget .dynamic-button {
            background: #ffffff;
            color: var(--chat-color-text-dark);
            border: 1px solid var(--chat-color-border);
            padding: 8px 12px;
            border-radius: var(--chat-radius-full);
            cursor: pointer;
            font-size: 13px;
            transition: var(--chat-transition);
        }

        .chat-assist-widget .dynamic-button:hover {
            background: var(--chat-color-secondary-pink);
            color: var(--chat-color-text-dark);
            border-color: var(--chat-color-primary-pink);
            transform: translateY(-2px);
            box-shadow: 0 2px 8px rgba(240, 98, 146, 0.2);
        }
        
        .thinking-indicator .dot {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: var(--chat-color-text-light);
            margin: 0 2px;
            animation: dot-flash 1.4s infinite ease-in-out both;
        }
        .thinking-indicator .dot:nth-child(2) {
            animation-delay: 0.2s;
        }
        .thinking-indicator .dot:nth-child(3) {
            animation-delay: 0.4s;
        }
        @keyframes dot-flash {
            0%, 80%, 100% { opacity: 0; transform: scale(0.8); }
            40% { opacity: 1; transform: scale(1); }
        }

        /* POSICIONAMENTO PARA DESKTOP (ESQUERDA) */
        @media (min-width: 1024px) {
            .chat-assist-widget .chat-window,
            .chat-assist-widget .chat-launcher {
                right: auto;
                left: 20px;
                bottom: 20px;
            }
            .chat-assist-widget .chat-window {
                 bottom: 100px;
            }
        }

        /* POSICIONAMENTO E LAYOUT PARA MOBILE */
        @media (max-width: 1023px) {
            .chat-assist-widget .chat-window {
                width: 95vw !important;
                height: calc(100% - 80px); 
                top: 60px;
                left: 2.5vw !important;
                right: 2.5vw !important;
                bottom: auto;
            }
            
            .chat-assist-widget .chat-launcher {
                right: auto;
                bottom: auto;
                width: 48px;
                height: 48px;
            }
            .chat-assist-widget .chat-launcher svg {
                width: 24px;
                height: 24px;
            }
        }
    `;
    document.head.appendChild(widgetStyles);

    // Default configuration
    const defaultSettings = {
        webhook: { url: '' },
        branding: {
            logo: 'https://neureka-ai.com/wp-content/uploads/2025/08/LogoPretofundotransparente.png',
            name: 'Do erro à excelência, palavra por palavra',
            slogan: 'Escreva alemão com confiança.'
        },
    };

    const userConfig = window.ChatWidgetConfig || {};
    const settings = {
        ...defaultSettings,
        ...userConfig,
        branding: { ...defaultSettings.branding, ...(userConfig.branding || {}) },
        webhook: { ...defaultSettings.webhook, ...(userConfig.webhook || {}) }
    };

    // Session tracking
    let conversationId = '';
    let isWaitingForResponse = false;
    let isChatInitialized = false;
    let currentLevel = '';
    let currentTopic = '';
    let currentUserId = null;
    let currentUserEmail = null;

    // Create widget DOM structure
    const widgetRoot = document.createElement('div');
    widgetRoot.className = 'chat-assist-widget';
    
    const chatWindow = document.createElement('div');
    chatWindow.className = `chat-window`;
    
    const icons = {
        close: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
        launcher: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 21 1.65-3.8a9 9 0 1 1 3.4 2.9l-5.05.9"></path><path d="m9 10 2 2 4-4"></path></svg>',
        attachment: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>',
        send: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>',
        flagDe: `<svg class="flag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 3"><rect width="5" height="3" y="0" fill="#000"/><rect width="5" height="2" y="1" fill="#D00"/><rect width="5" height="1" y="2" fill="#FFCE00"/></svg>`,
        flagBr: `<svg class="flag-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9 6"><rect width="9" height="6" fill="#009B3A"/><path d="M4.5 0.5L8.5 3L4.5 5.5L0.5 3Z" fill="#FFCC29"/><circle cx="4.5" cy="3" r="1.75" fill="#002776"/></svg>`
    };
    
    const headerHTML = `
        <div class="chat-header">
             <img class="chat-header-logo" src="${settings.branding.logo}" alt="${settings.branding.name}">
             <div class="header-content">
                <span class="chat-header-title">${settings.branding.name}</span>
                <div class="slogan-container">
                    <span class="chat-header-slogan">${settings.branding.slogan}</span>
                    ${icons.flagDe}
                    ${icons.flagBr}
                </div>
            </div>
            <button class="chat-close-btn">${icons.close}</button>
        </div>
    `;

    const chatInterfaceHTML = `
        <div class="chat-body">
            <div class="chat-messages"></div>
            <div class="chat-controls">
                <div class="chat-input-area">
                    <label for="chat-file-upload" class="control-btn file-upload-label">
                        ${icons.attachment}
                    </label>
                    <input type="file" id="chat-file-upload" class="file-upload-input">
                    <textarea class="chat-textarea" placeholder="Digite sua mensagem..." rows="1"></textarea>
                </div>
                <button class="control-btn chat-submit">${icons.send}</button>
            </div>
        </div>
    `;
    
    chatWindow.innerHTML = headerHTML + chatInterfaceHTML;
    
    const launchButton = document.createElement('button');
    launchButton.className = `chat-launcher`;
    launchButton.innerHTML = icons.launcher;
    
    widgetRoot.appendChild(chatWindow);
    widgetRoot.appendChild(launchButton);
    document.body.appendChild(widgetRoot);

    const messagesContainer = widgetRoot.querySelector('.chat-messages');
    const messageTextarea = widgetRoot.querySelector('.chat-textarea');
    const sendButton = widgetRoot.querySelector('.chat-submit');
    const fileInput = widgetRoot.querySelector('#chat-file-upload');
    const chatInputArea = widgetRoot.querySelector('.chat-input-area');

    const createSessionId = () => crypto.randomUUID();

    const grammarTopicsData = {
        'Iniciante (A1/A2)': ["O Alfabeto (ä, ö, ü, ß)", "Gênero (Genus)", "Declinação de Substantivos", "Verbos", "Preposições", "Pronomes Pessoais", "Conjugação de Verbos", "Os Verbos haben e sein", "Verbos Separáveis e Inseparáveis", "Estrutura Verbal", "Verbos Modais", "Infinitivo sem zu", "Verbos Reflexivos", "Verbos Recíprocos", "Presente (Gegenwart)", "Perfeito (Vergangenheit)", "Particípio II", "Sein e haben no Perfeito e Präteritum", "Verbos Modais no Perfeito e Präteritum", "Futuro I (Zukunft)", "Sintaxe", "Conjunções", "Subjunções", "Advérbios Conjuntivos", "Elementos da Frase", "Regra de Construção de Frases", "Negação", "Imperativo", "Pronomes Interrogativos", "Pronomes Demonstrativos", "O Pronome Indefinido man", "O Impessoal es", "Numerais Cardinais", "Numerais Ordinais", "Frações"],
        'Intermediário (B1/B2)': ["Orações Relativas", "Orações de Infinitivo", "Tendências de Construção", "Declinação de Adjetivos", "Grau Comparativo de Adjetivos", "Comparação", "Substantivação de Adjetivos", "Präteritum", "Plusquamperfekt", "Futuro II", "Visão Geral dos Tempos", "Voz Passiva", "Konjunktiv II", "Outros Temas Gramaticais Centrais", "Discurso Direto e Indireto", "Pronomes Indefinidos", "Explicação das Partículas", "Partículas Modais", "Numerais Iterativos", "Numerais Multiplicativos", "Numerais Coletivos", "Numerais de Espécie", "Numerais Indefinidos", "Palavras Compostas", "Tipos de Frases", "Forma Progressiva", "Erros Frequentes", "Artigo Zero", "Viel e wenig"],
        'Avançado (C1/C2)': ["Konjunktiv I", "Tempos do Konjunktiv", "Sintaxe Avançada e Aspectos Estilísticos", "Explicações Avançadas"]
    };

    const conversationTopicsData = ["Apresentações pessoais (nome, nacionalidade, profissão)", "Alfabeto e soletração", "Números, datas e horas", "Família e relações pessoais", "Cores e objetos do dia a dia", "Profissões e local de trabalho", "Países, línguas e nacionalidades", "Hobbies e tempo livre", "Comidas e bebidas (em casa e no restaurante)", "Compras no supermercado ou loja", "Moradia e descrição da casa/apartamento", "Transporte e meios de locomoção", "Dar direções e perguntar caminhos", "Dias da semana e rotinas diárias", "Clima e estações do ano", "Planejar viagens e férias", "Atividades culturais (cinema, museu, teatro)", "Saúde e doenças simples (ir ao médico, sintomas)", "Festas e celebrações (aniversário, feriados)", "Escrever e-mails e cartas simples", "Vida escolar e universitária", "Rotina de trabalho e entrevistas de emprego", "Mídia e tecnologia básica (telefone, computador)", "Compras online e reclamações", "Descrições físicas e de personalidade", "Animais de estimação e natureza", "Esportes e hábitos saudáveis", "Erros comuns e mal-entendidos", "Tradições e costumes em países de língua alemã", "Sonhos e planos para o futuro", "Vida em diferentes países e culturas", "Educação e sistema escolar alemão", "Meio ambiente e sustentabilidade", "Problemas do cotidiano (roubo, perda, acidentes)", "Tecnologia e redes sociais", "Entrevistas e currículos profissionais", "Voluntariado e engajamento social", "Expressar sentimentos e opiniões", "Histórias de vida e biografias", "Contar experiências passadas com detalhes", "Discussões sobre política e sociedade", "Trabalho e economia (mercado de trabalho, carreira)", "Ciência e inovação tecnológica", "Mídia e fake news", "Mudança climática e problemas globais", "Imigração e multiculturalismo", "Arte, literatura e música", "Filosofia cotidiana e dilemas morais", "Estilo de vida saudável e nutrição consciente", "Tendências culturais e sociais atuais"];

    const startChat = () => {
        if (isChatInitialized) return;
        isChatInitialized = true;
        conversationId = createSessionId();
        
        addBotMessage(`Hallo! 😊 Ich bin dein deutscher Sprachassistent! / Olá! Sou seu assistente de alemão!<br><br>Was möchtest du lernen? / O que você quer aprender?`, [
            { text: 'Estudar Gramática 📚', action: 'showLevelSelection' },
            { text: 'Treinar Escrita ✍️', action: 'showWritingTopics' }
        ]);
        toggleTextInput(true, 'Por favor, selecione uma opção acima.');
    };
    
    const addBotMessage = (text, buttons = []) => {
        hideThinkingIndicator();
        const messageContainer = document.createElement('div');
        messageContainer.className = 'message-container bot-message';
        
        const buttonsHTML = buttons.map(btn => `<button class="action-button" data-action="${btn.action}">${btn.text}</button>`).join('');
        const buttonsContainer = buttons.length > 0 ? `<div class="action-buttons-container">${buttonsHTML}</div>` : '';
        
        const formattedText = typeof window.renderMarkdown === 'function'
            ? window.renderMarkdown(text)
            : text.replace(/\n/g, '<br>');

        messageContainer.innerHTML = `
            <img src="https://cdn-icons-png.flaticon.com/512/4140/4140047.png" class="message-icon" alt="Bot icon">
            <div class="message-content">
                <div class="chat-bubble bot-bubble">
                    <div class="markdown-content">${formattedText}</div>
                    ${buttonsContainer}
                </div>
                <span class="timestamp">${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
        `;
        messagesContainer.appendChild(messageContainer);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        const isWritingFlow = currentLevel === 'escrita';
        const hasButtons = buttons.length > 0;

        if (isWritingFlow && !hasButtons) {
            toggleTextInput(false, 'Digite sua mensagem...');
        } else {
            toggleTextInput(true, 'Por favor, selecione uma opção acima.');
        }

        messageContainer.querySelectorAll('.action-button').forEach(button => {
            button.addEventListener('click', () => {
                const action = button.dataset.action;
                const text = button.textContent;
                handleAction(action, text);
            });
        });
    };
    
    const addUserMessage = (text) => {
        const messageContainer = document.createElement('div');
        messageContainer.className = 'message-container user-message';
        messageContainer.innerHTML = `
            <img src="https://cdn-icons-png.flaticon.com/512/4140/4140051.png" class="message-icon" alt="User icon">
            <div class="message-content">
                <div class="chat-bubble user-bubble"><p>${text}</p></div>
                <span class="timestamp">${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
        `;
        messagesContainer.appendChild(messageContainer);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };

    const handleAction = (action, text) => {
        addUserMessage(text);
        
        if (action === 'showLevelSelection') {
            currentTopic = '';
            showLevelSelection();
            return;
        }
        if (action === 'showGrammarTopics') {
            if (text.includes('Iniciante')) currentLevel = 'iniciante';
            else if (text.includes('Intermediário')) currentLevel = 'intermediario';
            else if (text.includes('Avançado')) currentLevel = 'avancado';
            showGrammarTopics(text);
            return;
        }
        if (action === 'showWritingTopics') {
            currentLevel = 'escrita';
            showWritingTopics();
            return;
        }
        
        if (action === 'selectTopic' || action === 'textInput') {
            if (action === 'selectTopic') {
                currentTopic = text;
            }
            const payload = {
                message: text,
                workflow: currentLevel,
                tema: currentTopic || 'texto_livre',
                thread: conversationId
            };
            submitPayloadToN8n(payload);
        }
    };
    
    const submitPayloadToN8n = async (payload) => {
        showThinkingIndicator();
        isWaitingForResponse = true;
        sendButton.disabled = true;

        try {
            let responseData = await sendToN8n(payload);
            
            if (Array.isArray(responseData) && responseData.length > 0) {
                responseData = responseData[0];
            }

            let finalOutput = '';

            if (responseData && responseData.output) {
                try {
                    const parsedOutput = JSON.parse(responseData.output);
                    if (parsedOutput && parsedOutput.output) {
                        finalOutput = parsedOutput.output;
                    } else {
                        finalOutput = responseData.output;
                    }
                } catch (e) {
                    finalOutput = responseData.output;
                }
                addBotMessage(finalOutput);

            } else if (!responseData) {
                // Error already handled
            } else {
                console.error("Formato de resposta inesperado do n8n:", responseData);
                addBotMessage("Recebi uma resposta, mas o formato é inválido. Por favor, verifique a configuração do n8n.");
            }
        } catch (error) {
            console.error("Error submitting payload:", error);
        } finally {
            hideThinkingIndicator();
            isWaitingForResponse = false;
            sendButton.disabled = false;
        }
    };
    
    const showLevelSelection = () => {
        addBotMessage('Excelente! Qual é o seu nível de proficiência?', [
            { text: 'Iniciante (A1/A2)', action: 'showGrammarTopics' },
            { text: 'Intermediário (B1/B2)', action: 'showGrammarTopics' },
            { text: 'Avançado (C1/C2)', action: 'showGrammarTopics' }
        ]);
    };

    const showGrammarTopics = (level) => {
        const topics = grammarTopicsData[level];
        if (!topics) return;

        const container = document.createElement('div');
        container.className = 'dynamic-buttons-container';
        container.innerHTML = topics.map(topic => `<button class="dynamic-button" data-action="selectTopic">${topic}</button>`).join('');
        
        addBotMessage(`Ótimo! Aqui estão os tópicos para o nível ${level}. Escolha um para começar:`, []);
        messagesContainer.lastChild.querySelector('.chat-bubble .markdown-content').appendChild(container);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        toggleTextInput(true, 'Por favor, selecione um tópico acima.');

        container.querySelectorAll('.dynamic-button').forEach(button => {
            button.addEventListener('click', () => handleAction('selectTopic', button.textContent));
        });
    };

    const showWritingTopics = () => {
        const container = document.createElement('div');
        container.className = 'dynamic-buttons-container';
        container.innerHTML = conversationTopicsData.map(topic => `<button class="dynamic-button" data-action="selectTopic">${topic}</button>`).join('');

        addBotMessage('Ótima escolha! Sobre qual tema você gostaria de escrever?', []);
        messagesContainer.lastChild.querySelector('.chat-bubble .markdown-content').appendChild(container);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        toggleTextInput(true, 'Por favor, selecione um tema acima.');

        container.querySelectorAll('.dynamic-button').forEach(button => {
            button.addEventListener('click', () => handleAction('selectTopic', button.textContent));
        });
    };
    
    const sendToN8n = async (payload) => {
        if (!settings.webhook.url) {
            console.warn("Webhook URL not configured. Using mock response.");
            await new Promise(resolve => setTimeout(resolve, 1500));
            if (payload.workflow) {
                 return { output: `### **Tópico Recebido** \n\nRecebi o seu pedido para falar sobre **${payload.message}** no fluxo **${payload.workflow}**. A integração com o n8n está pronta!` };
            }
            return {};
        }

        try {
            const response = await fetch(settings.webhook.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUserId,
                    email: currentUserEmail,
                    sessionId: conversationId,
                    message: payload.message,
                    workflow: payload.workflow,
                    tema: payload.tema,
                    thread: payload.thread,
                    timestamp: new Date().toISOString()
                }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`HTTP error! status: ${response.status}, message: ${errorText}`);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Webhook Error:', error);
            addBotMessage("Desculpe, ocorreu um erro de comunicação. Tente novamente.");
            return null;
        }
    };
    
    const handleTextInput = () => {
        const text = messageTextarea.value.trim();
        if(!text) return;
        
        handleAction('textInput', text);

        messageTextarea.value = '';
        resizeTextarea();
    };

    const showThinkingIndicator = () => {
        hideThinkingIndicator();
        const indicator = document.createElement('div');
        indicator.className = 'message-container bot-message thinking-indicator-container';
        indicator.innerHTML = `
            <img src="https://cdn-icons-png.flaticon.com/512/4140/4140047.png" class="message-icon" alt="Bot icon">
            <div class="message-content">
                <div class="chat-bubble bot-bubble thinking-indicator">
                    <span class="dot"></span><span class="dot"></span><span class="dot"></span>
                </div>
            </div>
        `;
        messagesContainer.appendChild(indicator);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };

    const hideThinkingIndicator = () => {
        const indicator = messagesContainer.querySelector('.thinking-indicator-container');
        if (indicator) {
            indicator.remove();
        }
    };

    const toggleTextInput = (disabled, placeholder = 'Digite sua mensagem...') => {
        messageTextarea.disabled = disabled;
        messageTextarea.placeholder = placeholder;
        if (disabled) {
            chatInputArea.classList.add('disabled');
        } else {
            chatInputArea.classList.remove('disabled');
        }
    };

    // Event listeners
    launchButton.addEventListener('click', () => {
        chatWindow.classList.toggle('active');
        if (!isChatInitialized) {
            startChat();
        }
    });

    widgetRoot.querySelector('.chat-close-btn').addEventListener('click', () => {
        chatWindow.classList.remove('active');
    });

    messageTextarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleTextInput();
        }
    });

    const resizeTextarea = () => {
        messageTextarea.style.height = 'auto';
        messageTextarea.style.height = `${messageTextarea.scrollHeight}px`;
    };

    messageTextarea.addEventListener('input', resizeTextarea);

    sendButton.addEventListener('click', handleTextInput);

    const positionMobileLauncher = () => {
        if (window.innerWidth < 1023) {
            const header = document.querySelector('.lg\\:hidden.sticky.top-0');
            if (header) {
                const headerRect = header.getBoundingClientRect();
                launchButton.style.top = `${headerRect.top + (headerRect.height / 2)}px`;
                
                const logo = header.querySelector('a > img');
                const logoutButton = header.querySelector('#logout-button-mobile');

                if (logo && logoutButton) {
                    const logoRect = logo.getBoundingClientRect();
                    const logoutRect = logoutButton.getBoundingClientRect();
                    const centerPoint = logoRect.right + ((logoutRect.left - logoRect.right) / 2);
                    launchButton.style.left = `${centerPoint}px`;
                    launchButton.style.transform = 'translate(-75%, -50%)';
                } else {
                    launchButton.style.left = '50%';
                    launchButton.style.transform = 'translate(-75%, -50%)';
                }
            }
        } else {
            launchButton.style.top = '';
            launchButton.style.left = '';
            launchButton.style.transform = '';
        }
    };

    window.addEventListener('userAuthenticated', (event) => {
        const user = event.detail.user;
        if (user) {
            currentUserId = user.id;
            currentUserEmail = user.email;
        }
    });

    window.addEventListener('resize', positionMobileLauncher);
    window.addEventListener('load', positionMobileLauncher);
    setTimeout(positionMobileLauncher, 100);

})();