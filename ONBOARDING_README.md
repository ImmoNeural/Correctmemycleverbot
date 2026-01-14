# Sistema de Onboarding - CorrectMe

## 📋 Visão Geral

Sistema de qualificação de leads implementado após o login do usuário. Coleta informações sobre o perfil do aluno para personalizar a experiência de aprendizado.

## 🎯 Funcionalidades

### 7 Etapas de Qualificação:

1. **Nível de Alemão** (`germanlevel`)
   - Básico (1) - A1
   - Intermediário (2) - A2-B1
   - Avançado (3) - B2-C1
   - Fluente (4) - C2

2. **Objetivo de Aprendizado** (`achievement`)
   - Aprender o básico (1)
   - Melhorar a escrita (2)
   - Escrever sem erros (3)
   - Não sei dizer (4)

3. **Motivo Principal** (`carreer`)
   - Viagens (1)
   - Negócios (2)
   - Morar fora (3)
   - Certificados oficiais (4)

4. **Tipo de Aprendizado** (`typelearning`)
   - Jogos e prática (1)
   - Exercícios escritos (2)
   - Conversação (3)
   - Estudo tradicional (4)

5. **Faixa Etária** (`age`)
   - 18-24 anos (1)
   - 25-34 anos (2)
   - 35-44 anos (3)
   - 45+ anos (4)

6. **Tempo de Estudo** (`timestudy`)
   - 10-15 minutos (1)
   - 30 minutos (2)
   - 1 hora (3)
   - Mais de 1 hora (4)

7. **Área Profissional** (`profession`)
   - Estudante (1)
   - Tecnologia (2)
   - Saúde (3)
   - Outros (4)

## 🔄 Fluxo de Navegação

```
Login/Registro
    ↓
Onboarding (7 perguntas)
    ↓
Dashboard (app principal)
```

### Lógica de Redirecionamento:

- **Novo usuário:** Login → Onboarding → Dashboard
- **Usuário existente:** Login → Dashboard (pula onboarding)
- **Tentativa de acesso direto ao dashboard:** Verifica se completou onboarding
  - ✅ Completou → Acessa dashboard
  - ❌ Não completou → Redireciona para onboarding

## 💾 Estrutura de Dados

### Tabela: `leads`

```sql
CREATE TABLE leads (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    updated_at TIMESTAMP DEFAULT NOW(),
    germanlevel INT4 DEFAULT 0,
    achievement INT4 DEFAULT 0,
    carreer INT4 DEFAULT 0,
    typelearning INT4 DEFAULT 0,
    age INT4 DEFAULT 0,
    timestudy INT4 DEFAULT 0,
    profession INT4 DEFAULT 0
);
```

**Nota:** O campo `carreer` está com grafia incorreta no banco (deveria ser `career`), mas mantive compatibilidade com a estrutura existente.

## 📁 Arquivos Modificados

1. **onboarding.html** (NOVO)
   - Interface completa de qualificação
   - 7 telas progressivas
   - Barra de progresso
   - Validação de respostas
   - Salvamento no Supabase

2. **login.html** (MODIFICADO)
   - Linha 299: Redirect OAuth para `onboarding.html`
   - Linhas 210-221: Verificação de onboarding após login com senha

3. **dashboard.js** (MODIFICADO)
   - Linhas 32-57: Verificação de onboarding antes de inicializar app
   - Redireciona para onboarding se dados não existirem

## 🎨 Design

- **Estilo:** Similar ao Duolingo/Grammarly (conforme imagens de referência)
- **Cores:** Gradiente roxo/índigo (#667eea, #764ba2)
- **Framework:** Tailwind CSS
- **Animações:** Transições suaves entre etapas
- **Responsivo:** Mobile-first design

## 🔒 Segurança

- ✅ Verificação de autenticação em todas as páginas
- ✅ Dados salvos com user ID do Supabase Auth
- ✅ Validação de sessão antes de salvar
- ✅ Redirecionamento automático se não autenticado

## 🚀 Como Testar

1. **Limpe os dados existentes** (se necessário):
   ```sql
   DELETE FROM leads WHERE id = 'seu-user-id';
   ```

2. **Faça logout** da aplicação

3. **Faça login novamente**
   - Você será redirecionado para `/onboarding.html`

4. **Complete as 7 etapas**
   - Selecione uma opção em cada pergunta
   - Clique em "Próximo" para avançar
   - Use "Voltar" para revisar respostas

5. **Ao finalizar:**
   - Dados são salvos na tabela `leads`
   - Redirecionamento automático para `dashboard.html`

6. **Teste de usuário existente:**
   - Faça logout e login novamente
   - Deve ir direto para o dashboard (pular onboarding)

## 📊 Análise de Dados

Os dados coletados podem ser usados para:

- ✅ Personalizar conteúdo por nível
- ✅ Recomendar exercícios baseados em objetivos
- ✅ Ajustar tempo de estudo sugerido
- ✅ Criar grupos de estudo por faixa etária
- ✅ Oferecer vocabulário específico por área profissional
- ✅ Segmentar campanhas de marketing
- ✅ Criar relatórios de perfil de usuário

## 🔧 Possíveis Melhorias Futuras

- [ ] Permitir editar respostas depois (página de configurações)
- [ ] Adicionar mais opções de personalização
- [ ] Analytics de abandono por etapa
- [ ] A/B testing de perguntas
- [ ] Gamificação (pontos por completar onboarding)
- [ ] Integração com sistema de recomendação
- [ ] Email marketing baseado no perfil

## ⚠️ Observações Importantes

1. **Primeira vez:** Todos os usuários novos ou existentes que não tenham registro na tabela `leads` verão o onboarding

2. **Campo `carreer`:** Mantido com grafia incorreta para compatibilidade com banco existente

3. **Google OAuth:** Sempre redireciona para onboarding (não tem como verificar antes do callback)

4. **Email/Senha:** Verifica antes de redirecionar (mais eficiente)

## 📞 Suporte

Em caso de problemas:
1. Verifique se a tabela `leads` existe no Supabase
2. Confirme que as colunas estão corretas (veja estrutura acima)
3. Verifique permissões RLS (Row Level Security) no Supabase
4. Teste em janela anônima (para evitar cache)
