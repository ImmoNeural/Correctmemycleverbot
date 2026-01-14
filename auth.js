// Configuração do Cliente Supabase com suas credenciais
const SUPABASE_URL = 'https://timqizyevfkvqgzvcrlx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpbXFpenlldmZrdnFnenZjcmx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwMTkwMDYsImV4cCI6MjA2MTU5NTAwNn0.LfWFCPPgzTkh7Scf2Q2LjLmYcLnaWSAGKDiMT8eSuWM';

const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Seleção de Elementos do DOM
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginError = document.getElementById('login-error');
const registerError = document.getElementById('register-error');

const toggleToRegister = document.getElementById('toggle-to-register');
const toggleToLogin = document.getElementById('toggle-to-login');

// Lógica para alternar entre formulários
toggleToRegister.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.style.display = 'none';
    toggleToRegister.style.display = 'none';
    registerForm.style.display = 'flex';
    toggleToLogin.style.display = 'block';
});

toggleToLogin.addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.style.display = 'none';
    toggleToLogin.style.display = 'none';
    loginForm.style.display = 'flex';
    toggleToRegister.style.display = 'block';
});

// Evento de submit do formulário de registro
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    registerError.textContent = '';

    const { data, error } = await _supabase.auth.signUp({
        email: email,
        password: password
    });

    if (error) {
        registerError.textContent = `Erro: ${error.message}`;
    } else if (data.user) {
        // Cria o perfil inicial para este usuário
        const { error: profileError } = await _supabase
            .from('profiles')
            .insert([
                { id: data.user.id, credits: 2, avatar_url: null }
            ]);

        if (profileError) {
            console.error('Erro ao criar o perfil do usuário:', profileError);
            registerError.textContent = 'Registro bem-sucedido, mas houve um erro ao criar o perfil.';
        } else {
            alert('Registro realizado! Verifique seu e-mail para confirmar a conta antes de fazer o login.');
            window.location.reload(); 
        }
    }
});

// Evento de submit do formulário de login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    loginError.textContent = '';

    const { data, error } = await _supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        loginError.textContent = `Erro: ${error.message}`;
    } else if (data.user) {
        // CORREÇÃO: Garante que o redirecionamento é para dashboard.html
        window.location.href = 'dashboard-new.html';
    }
});

// Verifica se o usuário já está logado ao carregar a página
async function checkUserSession() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) {
        // CORREÇÃO: Garante que o redirecionamento é para dashboard.html
        window.location.href = 'dashboard-new.html';
    }
}

// Executa a verificação ao carregar o script
document.addEventListener('DOMContentLoaded', checkUserSession);
