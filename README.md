# Bingo Fest

Bingo online de 75 bolas, multijogador, mobile-first e em tempo real, construído com HTML, CSS, JavaScript Vanilla, Supabase e GitHub Pages.

## Estado do projeto

O frontend da versão 2 está instalado na branch `main`.

A versão atual acrescenta:

- marcação manual dos números pelo jogador;
- validação da marcação no servidor;
- uma cartela diferente para cada um dos quatro prêmios;
- possibilidade de o mesmo jogador ganhar mais de um prêmio;
- suporte a empates durante a pausa antes do próximo sorteio;
- histórico com as quatro cartelas e as marcações realizadas;
- resultados completos por prêmio.

## Atualização obrigatória do Supabase

Depois do banco inicial, execute integralmente no SQL Editor:

```text
supabase/migration-manual-marking.sql
```

Essa migração adiciona `prize_cards`, `marked_numbers` e `won_prizes` em `cards`, gera quatro cartelas no servidor, cria a RPC `mark_card_number` e registra a vitória somente depois da marcação manual.

## Funcionamento da partida

1. O jogador entra na rodada e recebe quatro cartelas geradas no servidor.
2. A primeira cartela é apresentada para a 1ª Quina.
3. Quando uma bola é sorteada, o número correspondente fica destacado.
4. O jogador precisa clicar no número para marcá-lo.
5. A vitória usa somente os números realmente marcados.
6. No próximo prêmio, os números sorteados são reiniciados e uma nova cartela é liberada.
7. O processo se repete até a Cartela Cheia.

## Identidade visual

A marca oficial está em:

```text
assets/images/rei-oficial.png
```

## Arquivos principais

```text
index.html
css/style.css
css/fixes.css
css/manual-game.css
js/config.js
js/app.js
js/auth.js
js/lobby.js
js/waiting-room.js
js/game.js
js/admin.js
js/history.js
js/utils.js
assets/images/rei-oficial.png
supabase/schema.sql
supabase/migration-manual-marking.sql
.github/workflows/pages.yml
```

## Segurança

- RLS permanece ativo.
- As cartelas são geradas no PostgreSQL.
- A RPC confirma autenticação, propriedade da cartela, rodada ativa, número sorteado e presença do número na cartela atual.
- A vitória depende das marcações persistidas no banco.
- Operações administrativas continuam protegidas pela role `admin`.

## Verificação recomendada

1. Execute `supabase/migration-manual-marking.sql`.
2. Crie uma rodada nova.
3. Entre com pelo menos dois jogadores.
4. Confirme que a marcação só ocorre por clique.
5. Confirme que um número não sorteado não pode ser marcado.
6. Avance para verificar a troca completa da cartela.
7. Repita até a Cartela Cheia e confira histórico, resultados e empates.

---

**Família REI 👑**
