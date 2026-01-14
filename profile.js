// Configuração do Cliente Supabase com suas credenciais
const SUPABASE_URL = 'https://timqizyevfkvqgzvcrlx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpbXFpenlldmZrdnFnenZjcmx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwMTkwMDYsImV4cCI6MjA2MTU5NTAwNn0.LfWFCPPgzTkh7Scf2Q2LjLmYcLnaWSAGKDiMT8eSuWM';

const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Seleção de Elementos do DOM
const userEmailEl = document.getElementById('user-email');
const userCreditsEl = document.getElementById('user-credits');
const profilePicEl = document.getElementById('profile-pic');
const avatarInput = document.getElementById('avatar-input');
const logoutButton = document.getElementById('logout-button');

let currentUser = null;

// Função para carregar os dados do perfil do usuário
async function loadUserProfile() {
    console.log("--- Iniciando loadUserProfile ---");
    const { data: { user } } = await _supabase.auth.getUser();

    if (user) {
        currentUser = user;
        userEmailEl.textContent = user.email;
        console.log("Usuário autenticado:", user.email);

        let { data: profile, error } = await _supabase
            .from('profiles')
            .select('credits, avatar_url')
            .eq('id', user.id)
            .single();
        
        console.log("Resultado da busca de perfil:", { profile, error });

        if (error && error.code === 'PGRST116') {
            console.log('Perfil não encontrado, criando um novo...');
            const { data: newProfile, error: insertError } = await _supabase
                .from('profiles')
                .insert([{ id: user.id, credits: 2, avatar_url: null }])
                .select()
                .single();
            
            if (insertError) {
                console.error('Erro ao criar perfil on-the-fly:', insertError);
            } else {
                profile = newProfile;
                console.log("Novo perfil criado:", profile);
            }
        }

        if (profile) {
            console.log("Dados do perfil a serem exibidos:", profile);
            userCreditsEl.textContent = profile.credits !== null ? profile.credits : 0;
            
            if (profile.avatar_url) {
                console.log("Encontrado avatar_url:", profile.avatar_url);
                
                const { data: urlData } = _supabase.storage.from('avatar').getPublicUrl(profile.avatar_url);
                console.log("Resultado de getPublicUrl:", urlData);
                
                if (urlData && urlData.publicUrl) {
                    const finalUrl = urlData.publicUrl + `?t=${new Date().getTime()}`;
                    console.log("URL final da imagem a ser definida:", finalUrl);
                    profilePicEl.src = finalUrl;
                } else {
                    console.error("ERRO CRÍTICO: Não foi possível obter a publicUrl da imagem.");
                }

            } else {
                 console.log("Nenhum avatar_url encontrado. Usando imagem placeholder.");
                 profilePicEl.src = 'https://placehold.co/150x150/172a45/ccd6f6?text=Foto';
            }
        } else {
            console.error("ERRO CRÍTICO: Objeto 'profile' está nulo ou indefinido após a busca.");
        }

    } else {
        console.log("Nenhum usuário logado. Redirecionando para index.html");
        window.location.href = 'index.html';
    }
    console.log("--- Finalizando loadUserProfile ---");
}

// Evento de logout
logoutButton.addEventListener('click', async () => {
    const { error } = await _supabase.auth.signOut();
    if (error) {
        console.error('Erro ao fazer logout:', error);
    } else {
        window.location.href = 'index.html';
    }
});

// Evento para upload de foto
avatarInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file || !currentUser) return;

    const uploadLabel = document.getElementById('upload-label');
    uploadLabel.textContent = 'Enviando...';
    uploadLabel.disabled = true;

    const fileExt = file.name.split('.').pop();
    const fileName = `${currentUser.id}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await _supabase.storage
        .from('avatar')
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true
        });

    if (uploadError) {
        console.error('Erro detalhado do Supabase no upload:', JSON.stringify(uploadError, null, 2));
        alert('Falha ao enviar a foto. Verifique o console para mais detalhes.');
    } else {
        console.log("Upload bem-sucedido. Atualizando perfil com o caminho:", filePath);
        const { error: updateError } = await _supabase
            .from('profiles')
            .update({ avatar_url: filePath })
            .eq('id', currentUser.id);

        if (updateError) {
            console.error('Erro ao atualizar o perfil na tabela:', updateError);
        } else {
            console.log("Perfil atualizado com sucesso. Recarregando dados do perfil...");
            await loadUserProfile();
        }
    }
    
    uploadLabel.textContent = 'Trocar Foto';
    uploadLabel.disabled = false;
});

// Carrega os dados do perfil assim que a página é carregada
document.addEventListener('DOMContentLoaded', loadUserProfile);
