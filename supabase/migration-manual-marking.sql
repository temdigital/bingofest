-- Bingo Fest v2 — marcação manual e uma nova cartela para cada prêmio
-- Execute este arquivo inteiro no SQL Editor do Supabase.

begin;

alter table public.cards
  add column if not exists prize_cards jsonb not null default '{}'::jsonb,
  add column if not exists marked_numbers jsonb not null default '{}'::jsonb,
  add column if not exists won_prizes integer[] not null default '{}'::integer[];

create or replace function public.generate_bingo_card()
returns jsonb
language plpgsql
volatile
set search_path = public
as $$
declare
  v_b integer[];
  v_i integer[];
  v_n integer[];
  v_g integer[];
  v_o integer[];
begin
  select array_agg(n) into v_b from (select n from generate_series(1,15) n order by random() limit 5) s;
  select array_agg(n) into v_i from (select n from generate_series(16,30) n order by random() limit 5) s;
  select array_agg(n) into v_n from (select n from generate_series(31,45) n order by random() limit 4) s;
  select array_agg(n) into v_g from (select n from generate_series(46,60) n order by random() limit 5) s;
  select array_agg(n) into v_o from (select n from generate_series(61,75) n order by random() limit 5) s;

  return jsonb_build_array(
    jsonb_build_array(v_b[1], v_i[1], v_n[1], v_g[1], v_o[1]),
    jsonb_build_array(v_b[2], v_i[2], v_n[2], v_g[2], v_o[2]),
    jsonb_build_array(v_b[3], v_i[3], 'CURINGA', v_g[3], v_o[3]),
    jsonb_build_array(v_b[4], v_i[4], v_n[3], v_g[4], v_o[4]),
    jsonb_build_array(v_b[5], v_i[5], v_n[4], v_g[5], v_o[5])
  );
end;
$$;

update public.cards
set prize_cards = jsonb_build_object(
      '1', numbers,
      '2', public.generate_bingo_card(),
      '3', public.generate_bingo_card(),
      '4', public.generate_bingo_card()
    )
where prize_cards = '{}'::jsonb;

update public.cards
set marked_numbers = jsonb_build_object(
      '1', '[]'::jsonb,
      '2', '[]'::jsonb,
      '3', '[]'::jsonb,
      '4', '[]'::jsonb
    )
where marked_numbers = '{}'::jsonb;

update public.cards
set won_prizes = case
  when won_prize is null then '{}'::integer[]
  else array[won_prize]
end
where cardinality(won_prizes) = 0;

create or replace function public.join_round(p_round_id uuid)
returns public.cards
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_round public.rounds;
  v_existing public.cards;
  v_card public.cards;
  v_name text;
  v_first_name text;
  v_seq integer;
  v_card_1 jsonb;
  v_card_2 jsonb;
  v_card_3 jsonb;
  v_card_4 jsonb;
  v_code text;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária.'; end if;

  select * into v_round
  from public.rounds
  where id = p_round_id
  for update;

  if v_round.id is null then raise exception 'Rodada não encontrada.'; end if;
  if v_round.status <> 'waiting' then raise exception 'Esta rodada não aceita novas cartelas.'; end if;

  select * into v_existing
  from public.cards
  where round_id = p_round_id and user_id = auth.uid();

  if v_existing.id is not null then return v_existing; end if;

  select name into v_name from public.profiles where id = auth.uid();
  if v_name is null then raise exception 'Perfil não encontrado.'; end if;

  v_card_1 := public.generate_bingo_card();
  v_card_2 := public.generate_bingo_card();
  v_card_3 := public.generate_bingo_card();
  v_card_4 := public.generate_bingo_card();

  select count(*)::integer + 1 into v_seq
  from public.cards
  where round_id = p_round_id;

  v_first_name := upper(regexp_replace(extensions.unaccent(split_part(trim(v_name), ' ', 1)), '[^A-Za-z0-9]', '', 'g'));
  if v_first_name = '' then v_first_name := 'JOGADOR'; end if;

  v_code := 'BINGO-' ||
    to_char(v_round.created_at at time zone 'America/Sao_Paulo', 'YYYYMMDD-HH24MI') ||
    '-' || v_first_name || '-R' || lpad(v_seq::text, 2, '0');

  insert into public.cards (
    round_id,
    user_id,
    card_code,
    numbers,
    prize_cards,
    marked_numbers,
    won_prizes
  ) values (
    p_round_id,
    auth.uid(),
    v_code,
    v_card_1,
    jsonb_build_object('1', v_card_1, '2', v_card_2, '3', v_card_3, '4', v_card_4),
    jsonb_build_object('1', '[]'::jsonb, '2', '[]'::jsonb, '3', '[]'::jsonb, '4', '[]'::jsonb),
    '{}'::integer[]
  )
  returning * into v_card;

  return v_card;
end;
$$;

create or replace function public.draw_number(p_round_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round public.rounds;
  v_number integer;
begin
  if not public.is_admin() then raise exception 'Acesso negado.'; end if;

  select * into v_round
  from public.rounds
  where id = p_round_id
  for update;

  if v_round.id is null then raise exception 'Rodada não encontrada.'; end if;
  if v_round.status <> 'active' then raise exception 'A rodada não está ativa.'; end if;

  if exists (
    select 1
    from jsonb_array_elements(v_round.prizes) as e(value)
    where (value->>'prize_number')::integer = v_round.current_prize
  ) then
    raise exception 'O prêmio atual já possui ganhador. Avance para o próximo sorteio.';
  end if;

  if cardinality(v_round.drawn_numbers) >= 75 then
    raise exception 'Todos os números já foram sorteados.';
  end if;

  select n into v_number
  from generate_series(1,75) n
  where not (n = any(v_round.drawn_numbers))
  order by random()
  limit 1;

  update public.rounds
  set drawn_numbers = array_append(drawn_numbers, v_number)
  where id = p_round_id
  returning * into v_round;

  return jsonb_build_object(
    'number', v_number,
    'round', to_jsonb(v_round),
    'winners', '[]'::jsonb
  );
end;
$$;

create or replace function public.mark_card_number(
  p_round_id uuid,
  p_card_id uuid,
  p_number integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round public.rounds;
  v_card public.cards;
  v_prize_key text;
  v_numbers jsonb;
  v_marks integer[] := '{}'::integer[];
  v_marked_json jsonb;
  v_number_exists boolean := false;
  v_won boolean := false;
  v_entry jsonb;
  v_prizes jsonb;
  v_winner jsonb;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária.'; end if;
  if p_number < 1 or p_number > 75 then raise exception 'Número inválido.'; end if;

  select * into v_round
  from public.rounds
  where id = p_round_id
  for update;

  select * into v_card
  from public.cards
  where id = p_card_id and round_id = p_round_id
  for update;

  if v_round.id is null then raise exception 'Rodada não encontrada.'; end if;
  if v_card.id is null or v_card.user_id <> auth.uid() then raise exception 'Cartela inválida.'; end if;
  if v_round.status <> 'active' then raise exception 'A rodada não está ativa.'; end if;

  v_prize_key := v_round.current_prize::text;
  v_numbers := coalesce(v_card.prize_cards -> v_prize_key, v_card.numbers);

  if not (p_number = any(v_round.drawn_numbers)) then
    raise exception 'Este número ainda não foi sorteado.';
  end if;

  select exists (
    select 1
    from jsonb_array_elements(v_numbers) as rows(row_value)
    cross join lateral jsonb_array_elements_text(rows.row_value) as cells(cell_value)
    where cells.cell_value <> 'CURINGA'
      and cells.cell_value::integer = p_number
  ) into v_number_exists;

  if not v_number_exists then
    raise exception 'Este número não existe na cartela atual.';
  end if;

  select coalesce(array_agg(value::integer order by value::integer), '{}'::integer[])
  into v_marks
  from jsonb_array_elements_text(
    coalesce(v_card.marked_numbers -> v_prize_key, '[]'::jsonb)
  ) as marks(value);

  if not (p_number = any(v_marks)) then
    v_marks := array_append(v_marks, p_number);
  end if;

  select coalesce(array_agg(distinct value order by value), '{}'::integer[])
  into v_marks
  from unnest(v_marks) as values_list(value);

  v_marked_json := jsonb_set(
    coalesce(v_card.marked_numbers, '{}'::jsonb),
    array[v_prize_key],
    to_jsonb(v_marks),
    true
  );

  update public.cards
  set marked_numbers = v_marked_json
  where id = v_card.id
  returning * into v_card;

  v_won := public.bingo_card_has_win(v_numbers, v_marks, v_round.current_prize);

  if v_won and not (v_round.current_prize = any(v_card.won_prizes)) then
    update public.cards
    set won_prizes = array_append(won_prizes, v_round.current_prize),
        won_prize = coalesce(won_prize, v_round.current_prize)
    where id = v_card.id
    returning * into v_card;

    select jsonb_build_object(
      'card_id', v_card.id,
      'user_id', v_card.user_id,
      'name', p.name,
      'card_code', v_card.card_code,
      'prize_number', v_round.current_prize,
      'won_prize', v_round.current_prize
    )
    into v_winner
    from public.profiles p
    where p.id = v_card.user_id;

    select value into v_entry
    from jsonb_array_elements(v_round.prizes) as e(value)
    where (value->>'prize_number')::integer = v_round.current_prize
    limit 1;

    if v_entry is null then
      update public.rounds
      set prizes = prizes || jsonb_build_array(jsonb_build_object(
        'prize_number', v_round.current_prize,
        'winner_ids', jsonb_build_array(v_card.id),
        'drawn_numbers', to_jsonb(v_round.drawn_numbers),
        'winners', jsonb_build_array(v_winner)
      ))
      where id = p_round_id
      returning * into v_round;
    else
      select jsonb_agg(
        case
          when (item->>'prize_number')::integer = v_round.current_prize then
            jsonb_set(
              jsonb_set(
                item,
                '{winner_ids}',
                coalesce(item->'winner_ids', '[]'::jsonb) || jsonb_build_array(v_card.id)
              ),
              '{winners}',
              coalesce(item->'winners', '[]'::jsonb) || jsonb_build_array(v_winner)
            )
          else item
        end
        order by ord
      )
      into v_prizes
      from jsonb_array_elements(v_round.prizes) with ordinality as e(item, ord);

      update public.rounds
      set prizes = v_prizes
      where id = p_round_id
      returning * into v_round;
    end if;
  end if;

  return jsonb_build_object(
    'success', true,
    'number', p_number,
    'won', v_won,
    'prize_number', v_round.current_prize,
    'card', to_jsonb(v_card),
    'round', to_jsonb(v_round)
  );
end;
$$;

create or replace function public.claim_win(p_round_id uuid, p_card_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Atualize a página. A vitória agora depende da marcação manual da cartela.';
end;
$$;

create or replace function public.get_round_results(p_round_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_round public.rounds;
  v_winners jsonb;
  v_cards jsonb;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária.'; end if;

  select * into v_round from public.rounds where id = p_round_id;
  if v_round.id is null then raise exception 'Rodada não encontrada.'; end if;
  if v_round.status not in ('finished','cancelled') and not public.is_admin() then
    raise exception 'O resultado ainda não está disponível.';
  end if;

  select coalesce(jsonb_agg(winner order by prize_number, winner->>'name'), '[]'::jsonb)
  into v_winners
  from (
    select
      (prize->>'prize_number')::integer as prize_number,
      winner
    from jsonb_array_elements(v_round.prizes) as prizes(prize)
    cross join lateral jsonb_array_elements(coalesce(prize->'winners', '[]'::jsonb)) as winners(winner)
  ) result_winners;

  select coalesce(jsonb_agg(jsonb_build_object(
    'card_id', c.id,
    'user_id', c.user_id,
    'name', p.name,
    'card_code', c.card_code,
    'won_prize', c.won_prize,
    'won_prizes', c.won_prizes,
    'numbers', c.numbers,
    'prize_cards', c.prize_cards,
    'marked_numbers', c.marked_numbers
  ) order by c.created_at), '[]'::jsonb)
  into v_cards
  from public.cards c
  join public.profiles p on p.id = c.user_id
  where c.round_id = p_round_id;

  return jsonb_build_object(
    'round', to_jsonb(v_round),
    'winners', v_winners,
    'cards', v_cards
  );
end;
$$;

create or replace function public.get_admin_round(p_round_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_round public.rounds;
  v_participants jsonb;
  v_winners jsonb;
begin
  if not public.is_admin() then raise exception 'Acesso negado.'; end if;

  select * into v_round from public.rounds where id = p_round_id;
  if v_round.id is null then raise exception 'Rodada não encontrada.'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'card_id', c.id,
    'user_id', c.user_id,
    'name', p.name,
    'email', u.email,
    'card_code', c.card_code,
    'won_prize', c.won_prize,
    'won_prizes', c.won_prizes
  ) order by c.created_at), '[]'::jsonb)
  into v_participants
  from public.cards c
  join public.profiles p on p.id = c.user_id
  join auth.users u on u.id = c.user_id
  where c.round_id = p_round_id;

  select coalesce(jsonb_agg(
    winner || jsonb_build_object('email', u.email)
    order by prize_number, winner->>'name'
  ), '[]'::jsonb)
  into v_winners
  from (
    select
      (prize->>'prize_number')::integer as prize_number,
      winner
    from jsonb_array_elements(v_round.prizes) as prizes(prize)
    cross join lateral jsonb_array_elements(coalesce(prize->'winners', '[]'::jsonb)) as winners(winner)
  ) result_winners
  left join auth.users u on u.id = (winner->>'user_id')::uuid;

  return jsonb_build_object(
    'round', to_jsonb(v_round),
    'participants', v_participants,
    'winners', v_winners
  );
end;
$$;

grant execute on function public.generate_bingo_card() to authenticated;
grant execute on function public.mark_card_number(uuid, uuid, integer) to authenticated;

commit;

select
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'cards'
  and column_name in ('prize_cards', 'marked_numbers', 'won_prizes')
order by column_name;
