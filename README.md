# Bingo Fest

Bingo online de 75 bolas, multijogador, mobile-first e em tempo real, construído com HTML, CSS e JavaScript Vanilla, Supabase e GitHub Pages.

## Estado do projeto

**Projeto finalizado e instalado.**

- Frontend publicado pela branch `main`.
- Supabase configurado com autenticação, banco, RLS, RPCs e Realtime.
- Conta administrativa criada e promovida para a role `admin`.
- GitHub Pages configurado com GitHub Actions.
- Marca oficial da Família REI aplicada na abertura, no cabeçalho e no espaço do coringa.
- Mensagem de boa sorte assinada como **Família REI 👑**.

## Identidade visual

O arquivo oficial utilizado pelo sistema é:

```text
assets/images/logo.svg
```

A imagem foi otimizada para carregamento no navegador e é utilizada em:

- tela inicial;
- cabeçalho autenticado;
- apresentação da Família REI;
- centro das cartelas como coringa automático;
- ícone da página.

## Supabase

O banco completo está em:

```text
supabase/schema.sql
```

Ele contém:

- tabelas `profiles`, `rounds` e `cards`;
- índices;
- políticas de Row Level Security;
- integração com Supabase Realtime;
- geração segura de cartelas no servidor;
- sorteio seguro de números;
- validação de quinas e cartela cheia;
- reconhecimento de empates;
- cancelamento, avanço de prêmio e encerramento;
- consulta protegida de resultados e administração.

A configuração pública do projeto fica em `js/config.js`. Nunca inclua uma chave administrativa no frontend.

## Publicação

O workflow abaixo publica automaticamente a branch `main` no GitHub Pages:

```text
.github/workflows/pages.yml
```

## Segurança aplicada

- RLS ativo nas tabelas públicas.
- Cartelas geradas pela RPC `join_round`, sem escolha de números pelo navegador.
- Sorteios e empates resolvidos pela RPC `draw_number`.
- Operações administrativas validam a role diretamente no banco.
- Cada jogador visualiza apenas sua própria cartela durante a partida.
- Cartelas de outros participantes são reveladas apenas na tela de resultado.
- A senha administrativa não é armazenada no repositório.

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
assets/images/logo.svg
supabase/schema.sql
.github/workflows/pages.yml
```

## Teste operacional recomendado

1. Abra uma sessão como administrador e duas sessões privadas como jogadores.
2. Crie uma rodada e gere uma cartela para cada jogador.
3. Inicie a rodada.
4. Teste o modo manual e o automático.
5. Confirme as três quinas, a cartela cheia, um empate, o cancelamento e o encerramento forçado.
6. Verifique o histórico, a privacidade das cartelas e o resultado final.

---

**Família REI 👑**
