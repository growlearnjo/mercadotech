-- categories: árbol simple de categorías tecnológicas.
--
-- Supuesto: parent_id on delete set null (no lo especifica la spec). Borrar
-- una categoría padre no debe arrastrar sus hijas: quedan huérfanas (root)
-- en vez de perderse, para que un admin las reubique.
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  parent_id uuid references public.categories (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;
