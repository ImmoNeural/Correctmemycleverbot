// Sistema de Internacionalização (i18n) para CorrectMe
// Suporta: Português (pt-BR) e Inglês (en)

const translations = {
    'pt-BR': {
        // Sidebar - Menu
        sidebar: {
            corrigirRedacao: 'Corrigir Redação',
            parafrasear: 'Parafrasear Redação',
            chatbot: 'Treinar com o Chatbot',
            conversacao: 'Pratique Conversação',
            wordlist: 'Listas de Palavras',
            artigos: 'Artigos (der/die/das)',
            flashcards: 'Jogo de Flashcards',
            forca: 'Jogo da Forca',
            progresso: 'Progresso',
            sair: 'Sair'
        },

        // Perfil
        profile: {
            credits: 'Créditos',
            since: 'Desde',
            essays: 'Redações',
            logout: 'Sair'
        },

        // Corrigir Redação
        corrigir: {
            title: 'Corrija sua Redação',
            subtitle: 'Envie seu texto e receba uma análise detalhada em minutos.',
            creditsPerCorrection: 'créditos/correção',
            textareaLabel: 'Sua redação',
            textareaPlaceholder: 'Escreva seu texto aqui...',
            submitBtn: 'Corrigir agora!',
            tipsTitle: 'Dicas para Escrever Melhor',
            tipsAddition: 'Conectores de Adição',
            tipsContrast: 'Conectores de Contraste',
            tipsCause: 'Causa e Consequência',
            tipsSequence: 'Sequência e Tempo',
            tipsConclusion: 'Conclusão e Resumo',
            wordLimit: 'O texto excede o limite de 350 palavras.',
            analyzing: 'Analisando sua redação...',
            errorOccurred: 'Ocorreu um erro ao analisar sua redação.'
        },

        // Parafrasear
        parafrasear: {
            title: 'Parafrasear Texto',
            subtitle: 'Reescreva seu texto em alemão de diferentes formas mantendo o significado.',
            creditsPerUse: 'créditos/uso',
            originalText: 'Texto original',
            placeholder: 'Cole ou escreva seu texto em alemão aqui...',
            styleTitle: 'Estilo de reescrita',
            styleFormal: 'Formal',
            styleFormalDesc: 'Profissional',
            stylePolite: 'Educado',
            stylePoliteDesc: 'Cortês',
            styleCasual: 'Despojado',
            styleCasualDesc: 'Informal',
            styleOriginal: 'Original',
            styleOriginalDesc: 'Criativo',
            styleEmoji: 'Emojis',
            styleEmojiDesc: 'Divertido',
            styleSimple: 'Simples',
            styleSimpleDesc: 'Direto',
            submitBtn: 'Parafrasear texto',
            resultTitle: 'Texto Parafraseado',
            processing: 'Processando...'
        },

        // Chatbot
        chatbot: {
            title: 'Treinar com o Chatbot',
            subtitle: 'Pratique gramática e escrita em alemão',
            grammar: 'Gramática',
            writing: 'Escrita',
            credits: 'créditos'
        },

        // Conversação
        conversacao: {
            title: 'Pratique Conversação',
            subtitle: 'Converse em tempo real com IA para praticar seu alemão falado.',
            creditsPerMin: 'créditos/min',
            disconnected: 'Desconectado',
            connected: 'Conectado',
            connecting: 'Conectando...',
            mute: 'Mudo',
            fluid: 'Fluido',
            ambientSound: 'Som Ambiente',
            errorAnalysis: 'Análise de Erros',
            errorsWillAppear: 'Erros aparecerão aqui após a conversa.',
            errors: 'erro(s)',
            selectTopic: 'Selecione um Tema',
            selectTopicDesc: 'Escolha um tema à direita para ver o roteiro da conversa e começar a praticar.',
            context: 'Contexto',
            objective: 'Seu Objetivo',
            usefulVocab: 'Vocabulário Útil',
            startConversation: 'Iniciar Conversa',
            topicsTitle: 'Temas para Praticar',
            presentation: 'Apresentação'
        },

        // Listas de Palavras
        wordlist: {
            title: 'Listas de Palavras',
            subtitle: 'Organize e estude seu vocabulário em alemão.',
            addWord: 'Adicionar Palavra',
            createList: 'Criar Lista',
            allWords: 'Todas as Palavras',
            search: 'Buscar palavra...',
            word: 'Palavra',
            translation: 'Tradução',
            list: 'Lista',
            actions: 'Ações',
            noWords: 'Nenhuma palavra encontrada',
            addFirstWord: 'Adicione sua primeira palavra!',
            playFlashcards: 'Jogar Flashcards',
            importCsv: 'Importar CSV',
            myLists: 'Minhas Listas',
            newList: 'Nova Lista'
        },

        // Artigos
        artigos: {
            title: 'Artigos Alemães (der/die/das)',
            subtitle: 'Pratique e domine os artigos definidos em alemão',
            tip: 'Estas palavras são extraídas automaticamente das redações que você envia. Clique em cada palavra para ver a tradução!',
            update: 'Atualizar',
            translating: 'Traduzindo...',
            masculine: 'Masculino',
            feminine: 'Feminino',
            neuter: 'Neutro',
            words: 'palavra(s)',
            noWordsWithArticle: 'Nenhuma palavra com',
            loading: 'Carregando palavras com artigos...',
            noWords: 'Nenhuma palavra com artigo encontrada.',
            sendEssays: 'Envie redações na seção "Corrigir Redação" para construir seu vocabulário de artigos!',
            clickToTranslate: 'Clique em Atualizar para obter a tradução'
        },

        // Flashcards
        flashcards: {
            title: 'Jogo de Flashcards',
            subtitle: 'Teste seu conhecimento com flashcards interativos.',
            chooseGame: 'Escolha o tipo de jogo',
            vocabulary: 'Vocabulário',
            vocabDesc: 'Pratique palavras e traduções',
            articles: 'Artigos',
            articlesDesc: 'Adivinhe der, die ou das',
            hangman: 'Jogo da Forca',
            hangmanDesc: 'Adivinhe a palavra',
            back: 'Voltar',
            startGame: 'Iniciar Jogo',
            correct: 'Correto',
            wrong: 'Errado',
            showAnswer: 'Mostrar Resposta',
            next: 'Próximo',
            finish: 'Finalizar'
        },

        // Jogo da Forca
        forca: {
            title: 'Jogo da Forca',
            subtitle: 'Adivinhe palavras em alemão letra por letra.',
            attempts: 'tentativas',
            hint: 'Dica',
            getHint: 'Pedir Dica',
            won: 'Parabéns! Você acertou!',
            lost: 'Você perdeu! A palavra era:',
            playAgain: 'Jogar Novamente'
        },

        // Progresso
        progresso: {
            title: 'Seu Progresso',
            subtitle: 'Acompanhe sua evolução no aprendizado.',
            totalEssays: 'Total de Redações',
            commonErrors: 'Erros Mais Comuns',
            declension: 'Declinação',
            conjugation: 'Conjugação',
            syntax: 'Sintaxe',
            prepositions: 'Preposições',
            vocabulary: 'Vocabulário',
            errors: 'erros'
        },

        // Cenários de Conversação
        scenarios: {
            restaurant: 'Restaurante',
            restaurantA2: 'Almoço com Colegas (A2)',
            restaurantB1: 'Jantar Formal (B1)',
            supermarket: 'Supermercado',
            supermarketA2: 'Compras Básicas (A2)',
            doctor: 'Médico',
            doctorA2: 'Consulta Simples (A2)',
            transport: 'Transporte',
            transportA2: 'Comprando Passagem (A2)',
            party: 'Festa',
            partyA2: 'Festa de Aniversário (A2)',
            work: 'Trabalho/Estágio',
            workA2: 'Primeiro Dia (A2)',
            apartment: 'Apartamento',
            apartmentB1: 'Visita ao Apartamento (B1)',
            gym: 'Academia',
            gymB1: 'Matrícula na Academia (B1)',
            travel: 'Viagens',
            travelB1: 'Agência de Viagens (B1)',
            languageSchool: 'Escola de Idiomas',
            languageSchoolB1: 'Matrícula no Curso (B1)',
            technology: 'Tecnologia',
            technologyB1: 'Suporte Técnico (B1)',
            health: 'Saúde/Bem-Estar',
            healthB1: 'Farmácia (B1)'
        },

        // Modais
        modals: {
            addWord: 'Adicionar Palavra',
            editWord: 'Editar Palavra',
            createList: 'Criar Nova Lista',
            cancel: 'Cancelar',
            save: 'Salvar',
            delete: 'Excluir',
            confirm: 'Confirmar',
            close: 'Fechar'
        },

        // Mensagens Gerais
        general: {
            loading: 'Carregando...',
            error: 'Erro',
            success: 'Sucesso',
            warning: 'Atenção',
            noCredits: 'Créditos insuficientes',
            buyCredits: 'Comprar Créditos',
            words: 'palavras',
            word: 'palavra',
            listsTotal: 'listas no total',
            credits: 'créditos',
            resultPlaceholder: 'O texto parafraseado aparecerá aqui',
            clickTheme: 'Clique em um tema para ver os cenários'
        },

        // Tópicos de Conversação
        topics: {
            presentation: 'Apresentação',
            restaurant: 'Restaurante',
            shopping: 'Fazer Compras',
            health: 'Saúde',
            transport: 'Transporte',
            social: 'Social',
            work: 'Trabalho',
            housing: 'Moradia',
            sports: 'Esportes',
            education: 'Educação',
            technology: 'Tecnologia'
        },

        // Bot/Chatbot
        bot: {
            greeting: 'Olá! Sou seu assistente de alemão!',
            whatToLearn: 'O que você quer aprender?',
            studyGrammar: 'Estudar Gramática',
            practiceWriting: 'Treinar Escrita',
            chooseLevel: 'Qual é o seu nível de proficiência?',
            beginner: 'Iniciante (A1/A2)',
            intermediate: 'Intermediário (B1/B2)',
            advanced: 'Avançado (C1/C2)',
            chooseTopicGrammar: 'Aqui estão os tópicos para o nível',
            chooseTopicWriting: 'Sobre qual tema você gostaria de escrever?',
            selectOption: 'Por favor, selecione uma opção acima.',
            selectTopic: 'Por favor, selecione um tópico acima.',
            typeMessage: 'Digite sua mensagem...'
        }
    },

    'en': {
        // Sidebar - Menu
        sidebar: {
            corrigirRedacao: 'Correct Essay',
            parafrasear: 'Paraphrase Essay',
            chatbot: 'Train with Chatbot',
            conversacao: 'Practice Conversation',
            wordlist: 'Word Lists',
            artigos: 'Articles (der/die/das)',
            flashcards: 'Flashcards Game',
            forca: 'Hangman Game',
            progresso: 'Progress',
            sair: 'Logout'
        },

        // Perfil
        profile: {
            credits: 'Credits',
            since: 'Since',
            essays: 'Essays',
            logout: 'Logout'
        },

        // Corrigir Redação
        corrigir: {
            title: 'Correct Your Essay',
            subtitle: 'Submit your text and receive a detailed analysis in minutes.',
            creditsPerCorrection: 'credits/correction',
            textareaLabel: 'Your essay',
            textareaPlaceholder: 'Write your text here...',
            submitBtn: 'Correct now!',
            tipsTitle: 'Tips for Better Writing',
            tipsAddition: 'Addition Connectors',
            tipsContrast: 'Contrast Connectors',
            tipsCause: 'Cause and Effect',
            tipsSequence: 'Sequence and Time',
            tipsConclusion: 'Conclusion and Summary',
            wordLimit: 'Text exceeds the 350 word limit.',
            analyzing: 'Analyzing your essay...',
            errorOccurred: 'An error occurred while analyzing your essay.'
        },

        // Parafrasear
        parafrasear: {
            title: 'Paraphrase Text',
            subtitle: 'Rewrite your German text in different ways while keeping the meaning.',
            creditsPerUse: 'credits/use',
            originalText: 'Original text',
            placeholder: 'Paste or write your German text here...',
            styleTitle: 'Rewriting style',
            styleFormal: 'Formal',
            styleFormalDesc: 'Professional',
            stylePolite: 'Polite',
            stylePoliteDesc: 'Courteous',
            styleCasual: 'Casual',
            styleCasualDesc: 'Informal',
            styleOriginal: 'Original',
            styleOriginalDesc: 'Creative',
            styleEmoji: 'Emojis',
            styleEmojiDesc: 'Fun',
            styleSimple: 'Simple',
            styleSimpleDesc: 'Direct',
            submitBtn: 'Paraphrase text',
            resultTitle: 'Paraphrased Text',
            processing: 'Processing...'
        },

        // Chatbot
        chatbot: {
            title: 'Train with Chatbot',
            subtitle: 'Practice German grammar and writing',
            grammar: 'Grammar',
            writing: 'Writing',
            credits: 'credits'
        },

        // Conversação
        conversacao: {
            title: 'Practice Conversation',
            subtitle: 'Converse in real-time with AI to practice your spoken German.',
            creditsPerMin: 'credits/min',
            disconnected: 'Disconnected',
            connected: 'Connected',
            connecting: 'Connecting...',
            mute: 'Mute',
            fluid: 'Fluid',
            ambientSound: 'Ambient Sound',
            errorAnalysis: 'Error Analysis',
            errorsWillAppear: 'Errors will appear here after the conversation.',
            errors: 'error(s)',
            selectTopic: 'Select a Topic',
            selectTopicDesc: 'Choose a topic on the right to see the conversation script and start practicing.',
            context: 'Context',
            objective: 'Your Objective',
            usefulVocab: 'Useful Vocabulary',
            startConversation: 'Start Conversation',
            topicsTitle: 'Topics to Practice',
            presentation: 'Introduction'
        },

        // Listas de Palavras
        wordlist: {
            title: 'Word Lists',
            subtitle: 'Organize and study your German vocabulary.',
            addWord: 'Add Word',
            createList: 'Create List',
            allWords: 'All Words',
            search: 'Search word...',
            word: 'Word',
            translation: 'Translation',
            list: 'List',
            actions: 'Actions',
            noWords: 'No words found',
            addFirstWord: 'Add your first word!',
            playFlashcards: 'Play Flashcards',
            importCsv: 'Import CSV',
            myLists: 'My Lists',
            newList: 'New List'
        },

        // Artigos
        artigos: {
            title: 'German Articles (der/die/das)',
            subtitle: 'Practice and master definite articles in German',
            tip: 'These words are automatically extracted from the essays you submit. Click on each word to see the translation!',
            update: 'Update',
            translating: 'Translating...',
            masculine: 'Masculine',
            feminine: 'Feminine',
            neuter: 'Neuter',
            words: 'word(s)',
            noWordsWithArticle: 'No words with',
            loading: 'Loading words with articles...',
            noWords: 'No words with articles found.',
            sendEssays: 'Submit essays in the "Correct Essay" section to build your articles vocabulary!',
            clickToTranslate: 'Click Update to get the translation'
        },

        // Flashcards
        flashcards: {
            title: 'Flashcards Game',
            subtitle: 'Test your knowledge with interactive flashcards.',
            chooseGame: 'Choose game type',
            vocabulary: 'Vocabulary',
            vocabDesc: 'Practice words and translations',
            articles: 'Articles',
            articlesDesc: 'Guess der, die or das',
            hangman: 'Hangman',
            hangmanDesc: 'Guess the word',
            back: 'Back',
            startGame: 'Start Game',
            correct: 'Correct',
            wrong: 'Wrong',
            showAnswer: 'Show Answer',
            next: 'Next',
            finish: 'Finish'
        },

        // Jogo da Forca
        forca: {
            title: 'Hangman Game',
            subtitle: 'Guess German words letter by letter.',
            attempts: 'attempts',
            hint: 'Hint',
            getHint: 'Get Hint',
            won: 'Congratulations! You got it!',
            lost: 'You lost! The word was:',
            playAgain: 'Play Again'
        },

        // Progresso
        progresso: {
            title: 'Your Progress',
            subtitle: 'Track your learning evolution.',
            totalEssays: 'Total Essays',
            commonErrors: 'Most Common Errors',
            declension: 'Declension',
            conjugation: 'Conjugation',
            syntax: 'Syntax',
            prepositions: 'Prepositions',
            vocabulary: 'Vocabulary',
            errors: 'errors'
        },

        // Cenários de Conversação
        scenarios: {
            restaurant: 'Restaurant',
            restaurantA2: 'Lunch with Colleagues (A2)',
            restaurantB1: 'Formal Dinner (B1)',
            supermarket: 'Supermarket',
            supermarketA2: 'Basic Shopping (A2)',
            doctor: 'Doctor',
            doctorA2: 'Simple Appointment (A2)',
            transport: 'Transportation',
            transportA2: 'Buying a Ticket (A2)',
            party: 'Party',
            partyA2: 'Birthday Party (A2)',
            work: 'Work/Internship',
            workA2: 'First Day (A2)',
            apartment: 'Apartment',
            apartmentB1: 'Apartment Visit (B1)',
            gym: 'Gym',
            gymB1: 'Gym Membership (B1)',
            travel: 'Travel',
            travelB1: 'Travel Agency (B1)',
            languageSchool: 'Language School',
            languageSchoolB1: 'Course Enrollment (B1)',
            technology: 'Technology',
            technologyB1: 'Tech Support (B1)',
            health: 'Health/Wellness',
            healthB1: 'Pharmacy (B1)'
        },

        // Modais
        modals: {
            addWord: 'Add Word',
            editWord: 'Edit Word',
            createList: 'Create New List',
            cancel: 'Cancel',
            save: 'Save',
            delete: 'Delete',
            confirm: 'Confirm',
            close: 'Close'
        },

        // Mensagens Gerais
        general: {
            loading: 'Loading...',
            error: 'Error',
            success: 'Success',
            warning: 'Warning',
            noCredits: 'Insufficient credits',
            buyCredits: 'Buy Credits',
            words: 'words',
            word: 'word',
            listsTotal: 'lists total',
            credits: 'credits',
            resultPlaceholder: 'Paraphrased text will appear here',
            clickTheme: 'Click on a theme to see scenarios'
        },

        // Tópicos de Conversação
        topics: {
            presentation: 'Introduction',
            restaurant: 'Restaurant',
            shopping: 'Shopping',
            health: 'Health',
            transport: 'Transportation',
            social: 'Social',
            work: 'Work',
            housing: 'Housing',
            sports: 'Sports',
            education: 'Education',
            technology: 'Technology'
        },

        // Bot/Chatbot
        bot: {
            greeting: 'Hello! I\'m your German assistant!',
            whatToLearn: 'What would you like to learn?',
            studyGrammar: 'Study Grammar',
            practiceWriting: 'Practice Writing',
            chooseLevel: 'What is your proficiency level?',
            beginner: 'Beginner (A1/A2)',
            intermediate: 'Intermediate (B1/B2)',
            advanced: 'Advanced (C1/C2)',
            chooseTopicGrammar: 'Here are the topics for level',
            chooseTopicWriting: 'What topic would you like to write about?',
            selectOption: 'Please select an option above.',
            selectTopic: 'Please select a topic above.',
            typeMessage: 'Type your message...'
        }
    }
};

// Função para obter o idioma atual
function getCurrentLanguage() {
    return localStorage.getItem('correctme-language') || 'pt-BR';
}

// Função para definir o idioma
function setLanguage(lang) {
    localStorage.setItem('correctme-language', lang);
    applyTranslations();
    // Disparar evento para outros componentes
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));
}

// Função para obter uma tradução
function t(key) {
    const lang = getCurrentLanguage();
    const keys = key.split('.');
    let value = translations[lang];

    for (const k of keys) {
        if (value && value[k]) {
            value = value[k];
        } else {
            // Fallback para português
            value = translations['pt-BR'];
            for (const k2 of keys) {
                if (value && value[k2]) {
                    value = value[k2];
                } else {
                    return key; // Retorna a chave se não encontrar
                }
            }
            break;
        }
    }

    return value;
}

// Função para aplicar traduções a elementos com data-i18n
function applyTranslations() {
    const lang = getCurrentLanguage();

    // Atualizar todos os elementos com data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const translation = t(key);

        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            if (el.placeholder) {
                el.placeholder = translation;
            }
        } else {
            el.textContent = translation;
        }
    });

    // Atualizar placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });

    // Atualizar títulos (tooltips)
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        el.title = t(key);
    });

    // Atualizar seletor de bandeiras
    updateFlagSelector();
}

// Função para atualizar o seletor de bandeiras
function updateFlagSelector() {
    const lang = getCurrentLanguage();
    const brFlag = document.getElementById('flag-br');
    const enFlag = document.getElementById('flag-en');

    if (brFlag && enFlag) {
        if (lang === 'pt-BR') {
            brFlag.classList.add('ring-2', 'ring-cyan-400');
            brFlag.classList.remove('opacity-50');
            enFlag.classList.remove('ring-2', 'ring-cyan-400');
            enFlag.classList.add('opacity-50');
        } else {
            enFlag.classList.add('ring-2', 'ring-cyan-400');
            enFlag.classList.remove('opacity-50');
            brFlag.classList.remove('ring-2', 'ring-cyan-400');
            brFlag.classList.add('opacity-50');
        }
    }
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    applyTranslations();
});

// Exportar para uso global
window.translations = translations;
window.t = t;
window.getCurrentLanguage = getCurrentLanguage;
window.setLanguage = setLanguage;
window.applyTranslations = applyTranslations;
