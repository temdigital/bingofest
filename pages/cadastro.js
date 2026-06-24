// pages/cadastro.js
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🔍 Página de cadastro carregada');

    if (!window.supabaseClient) {
        console.error('❌ Supabase client não disponível');
        document.getElementById('message').innerHTML = 'Erro de configuração. Contate o administrador.';
        document.getElementById('message').classList.add('show', 'error');
        return;
    }

    // Mapeamento dos tipos para os IDs corretos (baseado no seu banco)
    const roleIdMap = {
        'admin': 5,
        'colunista': 6,
        'comerciante': 7,
        'cliente': 8
    };

    document.getElementById('cadastroForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const nome = document.getElementById('nome').value.trim();
        const email = document.getElementById('email').value.trim();
        const whatsapp = document.getElementById('whatsapp').value.trim();
        const dataNascimento = document.getElementById('dataNascimento')?.value || '';
        const senha = document.getElementById('senha').value;
        const confirmarSenha = document.getElementById('confirmarSenha').value;
        const tipoUsuario = document.getElementById('tipoUsuario').value;

        const messageDiv = document.getElementById('message');
        const submitBtn = document.getElementById('submitBtn');

        messageDiv.classList.remove('show', 'success', 'error');

        if (!nome || !email || !dataNascimento || !senha || !tipoUsuario) {
            messageDiv.textContent = 'Preencha todos os campos obrigatórios, incluindo a data de nascimento.';
            messageDiv.classList.add('show', 'error');
            return;
        }

        if (senha !== confirmarSenha) {
            messageDiv.textContent = 'As senhas não coincidem.';
            messageDiv.classList.add('show', 'error');
            return;
        }

        if (senha.length < 6) {
            messageDiv.textContent = 'A senha deve ter pelo menos 6 caracteres.';
            messageDiv.classList.add('show', 'error');
            return;
        }

        const roleId = roleIdMap[tipoUsuario];
        if (!roleId) {
            messageDiv.textContent = 'Tipo de usuário inválido.';
            messageDiv.classList.add('show', 'error');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cadastrando...';

        try {
            // 1. Criar usuário no Supabase Auth
            const { data: authData, error: authError } = await window.supabaseClient.auth.signUp({
                email,
                password: senha,
                options: {
                    data: {
                        nome: nome,
                        whatsapp: whatsapp,
                        data_nascimento: dataNascimento
                    }
                }
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error('Usuário não foi criado.');

            const userId = authData.user.id;

            // 2. Inserir na tabela usuarios (após o usuário estar logado, o que pode não ocorrer imediatamente)
            // Precisamos aguardar a sessão ser estabelecida? O signUp não loga automaticamente; temos que usar o mesmo cliente.
            // Vamos tentar inserir usando o mesmo client (que já tem a sessão do usuário recém-criado? Não, signUp não cria sessão)
            // Alternativa: inserir usando a chave de serviço (não recomendado) ou usar uma Edge Function.
            // A solução mais simples é confiar que o RLS vai permitir INSERT com auth.uid() = id.
            // Para isso, precisamos que o usuário esteja autenticado. Vamos fazer login em seguida.

            // Fazer login automaticamente após o cadastro (para obter a sessão)
            const { error: signInError } = await window.supabaseClient.auth.signInWithPassword({
                email,
                password: senha
            });
            if (signInError) throw signInError;

            // Agora estamos autenticados, podemos inserir na tabela usuarios
            const { error: usuarioError } = await window.supabaseClient
                .from('usuarios')
                .insert({
                    id: userId,
                    nome: nome,
                    email: email,
                    whatsapp: whatsapp || null,
                    data_nascimento: dataNascimento || null,
                    status: 'ativo',
                    pontos: 0,
                    created_at: new Date(),
                    updated_at: new Date()
                });

            if (usuarioError) throw usuarioError;

            // 3. Inserir na tabela usuarios_roles
            const { error: roleError } = await window.supabaseClient
                .from('usuarios_roles')
                .insert({
                    usuario_id: userId,
                    role_id: roleId,
                    created_at: new Date()
                });

            if (roleError) throw roleError;

            messageDiv.textContent = `✅ Cadastro realizado com sucesso! Um e-mail de confirmação foi enviado para ${email}. Verifique sua caixa de entrada (e spam) e clique no link para ativar sua conta.`;
            messageDiv.classList.add('show', 'success');
            document.getElementById('cadastroForm').reset();

            setTimeout(() => {
                window.location.href = '../admin/login.html';
            }, 5000);

        } catch (err) {
            console.error('❌ Erro no cadastro:', err);
            messageDiv.textContent = err.message || 'Erro ao realizar cadastro. Tente novamente.';
            messageDiv.classList.add('show', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> Cadastrar';
        }
    });
});