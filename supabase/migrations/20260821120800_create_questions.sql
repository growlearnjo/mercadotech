-- questions: preguntas y respuestas estilo Mercado Libre. `answer` y
-- `answered_at` quedan null hasta que el vendedor responde.
--
-- Supuesto: user_id on delete cascade — a diferencia de orders, una
-- pregunta no es un registro financiero; puede desaparecer con el perfil.
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  question text not null,
  answer text,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.questions enable row level security;

create index questions_product_id_idx on public.questions (product_id);
