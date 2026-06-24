-- Bingo Fest — correção da promoção do administrador
-- Execute este arquivo no SQL Editor do Supabase.

begin;

-- Permite que o SQL Editor/service role altere a role,
-- mas continua impedindo usuários comuns de promover perfis pelo frontend.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role is distinct from new.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Somente o administrador pode alterar perfis de acesso.';
  end if;
  return new;
end;
$$;

-- Cria ou atualiza o perfil administrativo vinculado ao usuário do Auth.
insert into public.profiles (id, name, role)
select id, 'Eros', 'admin'
from auth.users
where lower(email) = lower('eroscupido.ia@gmail.com')
on conflict (id) do update
set name = excluded.name,
    role = excluded.role;

commit;

-- Conferência final: deve retornar role = admin.
select
  u.id,
  u.email,
  u.email_confirmed_at,
  p.name,
  p.role
from auth.users u
left join public.profiles p on p.id = u.id
where lower(u.email) = lower('eroscupido.ia@gmail.com');
