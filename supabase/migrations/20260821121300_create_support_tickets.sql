-- support_tickets: tickets de soporte (los usa el agente de voz, sesión 8).
--
-- Supuesto: user_id on delete cascade — igual criterio que questions.
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject text not null,
  status text not null default 'abierto'
    check (status in ('abierto', 'en_proceso', 'resuelto', 'cerrado')),
  channel text not null default 'chat' check (channel in ('chat', 'voz')),
  created_at timestamptz not null default now()
);

alter table public.support_tickets enable row level security;

create index support_tickets_user_id_idx on public.support_tickets (user_id);
