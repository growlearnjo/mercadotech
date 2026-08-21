-- Extensiones necesarias para uuid v4 (gen_random_uuid). Idempotente: en
-- Supabase (local y hosted) pgcrypto ya viene preinstalada en el schema
-- `extensions`; este create extension if not exists es solo para que las
-- migraciones sean reproducibles fuera de ese entorno.
create extension if not exists pgcrypto;

-- Utilidad compartida: mantiene `updated_at` al día en cada UPDATE. La usan
-- products y support_articles (únicas tablas con esa columna).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
