-- Bingo Fest — banco, RLS, Realtime e RPCs
-- Execute este arquivo inteiro no SQL Editor do Supabase.

begin;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists unaccent with schema extensions;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 80),
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 3 and 80),
  status text not null default 'waiting' check (status in ('waiting', 'active', 'finished', 'cancelled')),
  current_prize integer not null default 1 check (current_prize between 1 and 4),
  drawn_numbers integer[] not null default '{}'::integer[],
  prizes jsonb not null default '[]'::jsonb check (jsonb_typeof(prizes) = 'array'),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  constraint valid_drawn_numbers check (
    array_position(drawn_numbers, null) is null
    and coalesce(array_length(drawn_numbers, 1), 0) <= 75
  )
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  card_code text not null unique,
  numbers jsonb not null check (jsonb_typeof(numbers) = 'array' and jsonb_array_length(numbers) = 5),
  won_prize integer check (won_prize between 1 and 4),
  created_at timestamptz not null default now(),
  unique (round_id, user_id)
);

create index if not exists rounds_status_created_at_idx on public.rounds(status, created_at desc);
create index if not exists cards_user_created_at_idx on public.cards(user_id, created_at desc);
create index if not exists cards_round_id_idx on public.cards(round_id);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)),
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role is distinct from new.role and not public.is_admin() then
    raise exception 'Somente o administrador pode alterar perfis de acesso.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role_trigger on public.profiles;
create trigger protect_profile_role_trigger
before update on public.profiles
for each row execute function public.protect_profile_role();

create or replace function public.bingo_card_has_win(
  p_numbers jsonb,
  p_drawn_numbers integer[],
  p_prize integer
)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  r integer;
  c integer;
  v text;
  ok boolean;
begin
  if p_numbers is null or jsonb_typeof(p_numbers) <> 'array' or jsonb_array_length(p_numbers) <> 5 then
    return false;
  end if;

  if p_prize = 4 then
    for r in 0..4 loop
      if jsonb_typeof(p_numbers -> r) <> 'array' or jsonb_array_length(p_numbers -> r) <> 5 then return false; end if;
      for c in 0..4 loop
        v := p_numbers -> r ->> c;
        if v <> 'CURINGA' and not ((v::integer) = any(coalesce(p_drawn_numbers, '{}'::integer[]))) then
          return false;
        end if;
      end loop;
    end loop;
    return true;
  end if;

  for r in 0..4 loop
    ok := true;
    for c in 0..4 loop
      v := p_numbers -> r ->> c;
      if v <> 'CURINGA' and not ((v::integer) = any(coalesce(p_drawn_numbers, '{}'::integer[]))) then ok := false; exit; end if;
    end loop;
    if ok then return true; end if;
  end loop;

  for c in 0..4 loop
    ok := true;
    for r in 0..4 loop
      v := p_numbers -> r ->> c;
      if v <> 'CURINGA' and not ((v::integer) = any(coalesce(p_drawn_numbers, '{}'::integer[]))) then ok := false; exit; end if;
    end loop;
    if ok then return true; end if;
  end loop;

  ok := true;
  for r in 0..4 loop
    v := p_numbers -> r ->> r;
    if v <> 'CURINGA' and not ((v::integer) = any(coalesce(p_drawn_numbers, '{}'::integer[]))) then ok := false; exit; end if;
  end loop;
  if ok then return true; end if;

  ok := true;
  for r in 0..4 loop
    v := p_numbers -> r ->> (4-r);
    if v <> 'CURINGA' and not ((v::integer) = any(coalesce(p_drawn_numbers, '{}'::integer[]))) then ok := false; exit; end if;
  end loop;
  return ok;
exception when others then
  return false;
end;
$$;

create or replace function public.create_round(p_name text)
returns public.rounds
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_round public.rounds;
begin
  if not public.is_admin() then raise exception 'Acesso negado.'; end if;
  if char_length(trim(p_name)) < 3 then raise exception 'O nome deve ter pelo menos 3 caracteres.'; end if;
  insert into public.rounds (name, created_by)
  values (trim(p_name), auth.uid())
  returning * into v_round;
  return v_round;
end;
$$;

create or replace function public.start_round(p_round_id uuid)
returns public.rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round public.rounds;
begin
  if not public.is_admin() then raise exception 'Acesso negado.'; end if;
  update public.rounds
     set status = 'active', started_at = coalesce(started_at, now())
   where id = p_round_id and status = 'waiting'
   returning * into v_round;
  if v_round.id is null then raise exception 'A rodada não está em espera.'; end if;
  return v_round;
end;
$$;

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
  v_b integer[];
  v_i integer[];
  v_n integer[];
  v_g integer[];
  v_o integer[];
  v_numbers jsonb;
  v_code text;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária.'; end if;
  select * into v_round from public.rounds where id = p_round_id for update;
  if v_round.id is null then raise exception 'Rodada não encontrada.'; end if;
  if v_round.status <> 'waiting' then raise exception 'Esta rodada não aceita novas cartelas.'; end if;

  select * into v_existing from public.cards where round_id = p_round_id and user_id = auth.uid();
  if v_existing.id is not null then return v_existing; end if;

  select name into v_name from public.profiles where id = auth.uid();
  if v_name is null then raise exception 'Perfil não encontrado.'; end if;

  select array_agg(n) into v_b from (select n from generate_series(1,15) n order by random() limit 5) s;
  select array_agg(n) into v_i from (select n from generate_series(16,30) n order by random() limit 5) s;
  select array_agg(n) into v_n from (select n from generate_series(31,45) n order by random() limit 4) s;
  select array_agg(n) into v_g from (select n from generate_series(46,60) n order by random() limit 5) s;
  select array_agg(n) into v_o from (select n from generate_series(61,75) n order by random() limit 5) s;

  v_numbers := jsonb_build_array(
    jsonb_build_array(v_b[1], v_i[1], v_n[1], v_g[1], v_o[1]),
    jsonb_build_array(v_b[2], v_i[2], v_n[2], v_g[2], v_o[2]),
    jsonb_build_array(v_b[3], v_i[3], 'CURINGA', v_g[3], v_o[3]),
    jsonb_build_array(v_b[4], v_i[4], v_n[3], v_g[4], v_o[4]),
    jsonb_build_array(v_b[5], v_i[5], v_n[4], v_g[5], v_o[5])
  );

  select count(*)::integer + 1 into v_seq from public.cards where round_id = p_round_id;
  v_first_name := upper(regexp_replace(extensions.unaccent(split_part(trim(v_name), ' ', 1)), '[^A-Za-z0-9]', '', 'g'));
  if v_first_name = '' then v_first_name := 'JOGADOR'; end if;
  v_code := 'BINGO-' || to_char(v_round.created_at at time zone 'America/Sao_Paulo', 'YYYYMMDD-HH24MI') || '-' || v_first_name || '-R' || lpad(v_seq::text, 2, '0');

  insert into public.cards (round_id, user_id, card_code, numbers)
  values (p_round_id, auth.uid(), v_code, v_numbers)
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
  v_winner_ids uuid[];
  v_winners jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then raise exception 'Acesso negado.'; end if;
  select * into v_round from public.rounds where id = p_round_id for update;
  if v_round.id is null then raise exception 'Rodada não encontrada.'; end if;
  if v_round.status <> 'active' then raise exception 'A rodada não está ativa.'; end if;
  if exists (select 1 from jsonb_array_elements(v_round.prizes) as e(value) where (value->>'prize_number')::integer = v_round.current_prize) then
    raise exception 'O prêmio atual já possui ganhador. Avance para o próximo sorteio.';
  end if;
  if cardinality(v_round.drawn_numbers) >= 75 then raise exception 'Todos os números já foram sorteados.'; end if;

  select n into v_number from generate_series(1,75) n
   where not (n = any(v_round.drawn_numbers)) order by random() limit 1;

  update public.rounds set drawn_numbers = array_append(drawn_numbers, v_number)
   where id = p_round_id returning * into v_round;

  select array_agg(c.id order by c.created_at) into v_winner_ids
    from public.cards c
   where c.round_id = p_round_id
     and c.won_prize is null
     and public.bingo_card_has_win(c.numbers, v_round.drawn_numbers, v_round.current_prize);

  if v_winner_ids is not null and cardinality(v_winner_ids) > 0 then
    update public.cards set won_prize = v_round.current_prize where id = any(v_winner_ids);
    select coalesce(jsonb_agg(jsonb_build_object(
      'card_id', c.id, 'user_id', c.user_id, 'name', p.name,
      'card_code', c.card_code, 'won_prize', c.won_prize
    ) order by c.created_at), '[]'::jsonb)
    into v_winners
    from public.cards c join public.profiles p on p.id = c.user_id
    where c.id = any(v_winner_ids);

    update public.rounds set prizes = prizes || jsonb_build_array(jsonb_build_object(
      'prize_number', v_round.current_prize,
      'winner_ids', to_jsonb(v_winner_ids),
      'drawn_numbers', to_jsonb(v_round.drawn_numbers),
      'winners', v_winners
    )) where id = p_round_id returning * into v_round;
  end if;

  return jsonb_build_object('number', v_number, 'round', to_jsonb(v_round), 'winners', v_winners);
end;
$$;

create or replace function public.claim_win(p_round_id uuid, p_card_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round public.rounds;
  v_card public.cards;
  v_entry jsonb;
  v_winners jsonb;
  v_prizes jsonb;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária.'; end if;
  select * into v_round from public.rounds where id = p_round_id for update;
  select * into v_card from public.cards where id = p_card_id and round_id = p_round_id for update;

  if v_card.id is null or v_card.user_id <> auth.uid() then raise exception 'Cartela inválida.'; end if;
  if v_round.status <> 'active' then raise exception 'A rodada não está ativa.'; end if;
  if v_card.won_prize = v_round.current_prize then
    return jsonb_build_object('success', true, 'already_registered', true, 'prize_number', v_card.won_prize, 'card_code', v_card.card_code);
  end if;
  if v_card.won_prize is not null then raise exception 'Esta cartela já ganhou um prêmio anterior.'; end if;
  if not public.bingo_card_has_win(v_card.numbers, v_round.drawn_numbers, v_round.current_prize) then raise exception 'A condição de vitória ainda não foi atendida.'; end if;

  update public.cards set won_prize = v_round.current_prize where id = v_card.id returning * into v_card;
  select value into v_entry from jsonb_array_elements(v_round.prizes) as e(value)
   where (value->>'prize_number')::integer = v_round.current_prize limit 1;

  if v_entry is null then
    select jsonb_build_array(jsonb_build_object('card_id', v_card.id, 'user_id', v_card.user_id, 'name', p.name, 'card_code', v_card.card_code, 'won_prize', v_card.won_prize))
      into v_winners from public.profiles p where p.id = v_card.user_id;
    update public.rounds set prizes = prizes || jsonb_build_array(jsonb_build_object(
      'prize_number', v_round.current_prize,
      'winner_ids', jsonb_build_array(v_card.id),
      'drawn_numbers', to_jsonb(v_round.drawn_numbers),
      'winners', v_winners
    )) where id = p_round_id;
  else
    select jsonb_agg(
      case when (item->>'prize_number')::integer = v_round.current_prize then
        jsonb_set(
          jsonb_set(item, '{winner_ids}', coalesce(item->'winner_ids','[]'::jsonb) || jsonb_build_array(v_card.id)),
          '{winners}',
          coalesce(item->'winners','[]'::jsonb) || (
            select jsonb_build_array(jsonb_build_object('card_id', v_card.id, 'user_id', v_card.user_id, 'name', p.name, 'card_code', v_card.card_code, 'won_prize', v_card.won_prize))
            from public.profiles p where p.id = v_card.user_id
          )
        )
      else item end order by ord
    ) into v_prizes
    from jsonb_array_elements(v_round.prizes) with ordinality as e(item, ord);
    update public.rounds set prizes = v_prizes where id = p_round_id;
  end if;

  return jsonb_build_object('success', true, 'already_registered', false, 'prize_number', v_card.won_prize, 'card_code', v_card.card_code);
end;
$$;

create or replace function public.advance_prize(p_round_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round public.rounds;
begin
  if not public.is_admin() then raise exception 'Acesso negado.'; end if;
  select * into v_round from public.rounds where id = p_round_id for update;
  if v_round.id is null or v_round.status <> 'active' then raise exception 'Rodada ativa não encontrada.'; end if;
  if not exists (select 1 from jsonb_array_elements(v_round.prizes) as e(value) where (value->>'prize_number')::integer = v_round.current_prize) then
    raise exception 'O prêmio atual ainda não possui ganhador.';
  end if;
  if v_round.current_prize = 4 then
    update public.rounds set status = 'finished', finished_at = now() where id = p_round_id;
  else
    update public.rounds set current_prize = current_prize + 1, drawn_numbers = '{}'::integer[] where id = p_round_id;
  end if;
end;
$$;

create or replace function public.cancel_round(p_round_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado.'; end if;
  update public.rounds set status = 'cancelled', finished_at = now()
   where id = p_round_id and status in ('waiting','active');
  if not found then raise exception 'A rodada não pode ser cancelada.'; end if;
end;
$$;

create or replace function public.finish_round(p_round_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado.'; end if;
  update public.rounds set status = 'finished', finished_at = now()
   where id = p_round_id and status in ('waiting','active');
  if not found then raise exception 'A rodada não pode ser encerrada.'; end if;
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
  if v_round.status not in ('finished','cancelled') and not public.is_admin() then raise exception 'O resultado ainda não está disponível.'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'card_id', c.id, 'user_id', c.user_id, 'name', p.name, 'card_code', c.card_code,
    'won_prize', c.won_prize, 'numbers', c.numbers
  ) order by c.won_prize, c.created_at) filter (where c.won_prize is not null), '[]'::jsonb),
  coalesce(jsonb_agg(jsonb_build_object(
    'card_id', c.id, 'user_id', c.user_id, 'name', p.name, 'card_code', c.card_code,
    'won_prize', c.won_prize, 'numbers', c.numbers
  ) order by c.created_at), '[]'::jsonb)
  into v_winners, v_cards
  from public.cards c join public.profiles p on p.id = c.user_id
  where c.round_id = p_round_id;

  return jsonb_build_object('round', to_jsonb(v_round), 'winners', v_winners, 'cards', v_cards);
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
    'card_id', c.id, 'user_id', c.user_id, 'name', p.name, 'email', u.email,
    'card_code', c.card_code, 'won_prize', c.won_prize
  ) order by c.created_at), '[]'::jsonb),
  coalesce(jsonb_agg(jsonb_build_object(
    'card_id', c.id, 'user_id', c.user_id, 'name', p.name, 'email', u.email,
    'card_code', c.card_code, 'won_prize', c.won_prize
  ) order by c.won_prize, c.created_at) filter (where c.won_prize is not null), '[]'::jsonb)
  into v_participants, v_winners
  from public.cards c
  join public.profiles p on p.id = c.user_id
  join auth.users u on u.id = c.user_id
  where c.round_id = p_round_id;

  return jsonb_build_object('round', to_jsonb(v_round), 'participants', v_participants, 'winners', v_winners);
end;
$$;

alter table public.profiles enable row level security;
alter table public.rounds enable row level security;
alter table public.cards enable row level security;

drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin on public.profiles for update to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists rounds_select_authenticated on public.rounds;
create policy rounds_select_authenticated on public.rounds for select to authenticated using (true);

drop policy if exists cards_select_self_or_admin on public.cards;
create policy cards_select_self_or_admin on public.cards for select to authenticated
using (user_id = auth.uid() or public.is_admin());

revoke all on public.profiles, public.rounds, public.cards from anon;
revoke all on public.profiles, public.rounds, public.cards from authenticated;
grant select on public.profiles, public.rounds, public.cards to authenticated;
grant update (name) on public.profiles to authenticated;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.create_round(text) to authenticated;
grant execute on function public.start_round(uuid) to authenticated;
grant execute on function public.join_round(uuid) to authenticated;
grant execute on function public.draw_number(uuid) to authenticated;
grant execute on function public.claim_win(uuid, uuid) to authenticated;
grant execute on function public.advance_prize(uuid) to authenticated;
grant execute on function public.cancel_round(uuid) to authenticated;
grant execute on function public.finish_round(uuid) to authenticated;
grant execute on function public.get_round_results(uuid) to authenticated;
grant execute on function public.get_admin_round(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rounds'
  ) then
    alter publication supabase_realtime add table public.rounds;
  end if;
end $$;

commit;

-- APÓS criar o usuário pelo painel Authentication, promova-o a admin:
-- update public.profiles
-- set name = 'Eros', role = 'admin'
-- where id = (select id from auth.users where email = 'eroscupido.ia@gmail.com');
