# Bingo Fest

Bingo online de 75 bolas, multijogador, mobile-first e em tempo real, construído com HTML, CSS e JavaScript Vanilla, Supabase e GitHub Pages.

## Estado da instalação

O código da aplicação, o banco, as políticas RLS, as RPCs, o Realtime e o fluxo de publicação estão incluídos. Restam apenas as credenciais do seu Supabase e a criação manual da conta administrativa.

## 1. Configurar o Supabase

1. Crie um projeto no Supabase.
2. Abra **SQL Editor** e execute integralmente `supabase/schema.sql`.
3. Em **Authentication > Providers > Email**, mantenha apenas e-mail/senha. Para o MVP, a confirmação de e-mail pode ser desativada.
4. Em **Authentication > Users**, crie o usuário administrador usando o e-mail definido no documento do projeto. Não armazene a senha no repositório.
5. Execute no SQL Editor:

```sql
update public.profiles
set name = 'Eros', role = 'admin'
where id = (
  select id from auth.users
  where email = 'eroscupido.ia@gmail.com'
);
```

6. Em **Project Settings > API**, copie a URL do projeto e a chave pública `anon`.
7. Edite `js/config.js`:

```js
supabaseUrl: "https://SEU-PROJETO.supabase.co",
supabaseAnonKey: "SUA_CHAVE_ANON"
```

> Nunca coloque a chave `service_role` no frontend.

## 2. Publicar no GitHub Pages

O workflow `.github/workflows/pages.yml` publica a branch `main`.

No GitHub, abra **Settings > Pages > Build and deployment** e selecione **GitHub Actions**. Após o próximo push, o endereço aparecerá no workflow de Pages.

## 3. Imagens oficiais

A instalação inclui imagens vetoriais provisórias para que o sistema funcione imediatamente:

- `assets/images/logo.svg`
- `assets/images/coringa.svg`
- `assets/images/familia-rei.svg`

Quando os arquivos oficiais forem fornecidos, substitua-os mantendo os mesmos nomes ou atualize as referências no código.

## Segurança aplicada

- RLS ativo em `profiles`, `rounds` e `cards`.
- Cartelas são geradas no servidor pela RPC `join_round`, impedindo escolha/manipulação de números pelo navegador.
- Sorteios e empates são resolvidos atomicamente pela RPC `draw_number`.
- Operações administrativas validam a role no banco.
- Cada usuário vê apenas a própria cartela durante a partida.
- As cartelas dos demais participantes são reveladas somente em resultados concluídos ou cancelados.

## Estrutura

```text
index.html
css/style.css
js/config.js
js/app.js
js/auth.js
js/lobby.js
js/waiting-room.js
js/game.js
js/admin.js
js/history.js
js/utils.js
assets/images/
supabase/schema.sql
.github/workflows/pages.yml
```

## Teste recomendado

1. Abra uma sessão como admin e duas sessões anônimas como jogadores.
2. Crie a rodada e faça os dois jogadores participarem.
3. Inicie a rodada.
4. Teste sorteio manual, automático, troca de prêmio, empate, cancelamento e encerramento forçado.
5. Confirme histórico, privacidade das cartelas e resultado final.
