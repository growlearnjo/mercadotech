-- profiles: 1:1 con auth.users. Mismo UUID como PK y FK, on delete cascade
-- (si se borra el usuario de auth, su perfil desaparece con él).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  phone text,
  role text not null default 'buyer' check (role in ('buyer', 'seller', 'admin')),
  avatar_path text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Políticas RLS: Fase 2.3. Sin políticas, esta tabla es inaccesible vía
-- PostgREST hasta entonces (esperado).

-- Trigger handle_new_user: crea el profile automáticamente al registrarse un
-- usuario en auth.users. SECURITY DEFINER porque el rol `authenticated` no
-- tiene permiso para escribir en auth.users ni, en ese instante, en profiles
-- (aún sin políticas); set search_path fijo por seguridad (evita hijacking
-- vía search_path en funciones SECURITY DEFINER).
--
-- Supuesto: no hay formulario de registro hasta la sesión 3, así que
-- display_name se inicializa con el prefijo del email; el usuario lo edita
-- después desde su perfil.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
