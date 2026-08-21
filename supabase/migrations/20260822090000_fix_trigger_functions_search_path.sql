-- Fix: pinning de search_path en las funciones trigger que quedaron sin él.
--
-- El resto de las funciones del proyecto (is_admin, handle_new_user,
-- create_order_from_cart, order_has_seller_item, order_belongs_to_buyer)
-- ya fijan `set search_path = public` por seguridad (evita que un
-- search_path manipulado en la sesión que dispara el trigger redirija
-- referencias sin calificar a objetos de otro schema). Estas 5 funciones
-- trigger quedaron sin ese pin por una aplicación inconsistente del mismo
-- criterio — el advisor de seguridad de Supabase lo señaló
-- (function_search_path_mutable) al revisar el proyecto ya desplegado.
-- No cambia el comportamiento: cada función ya calificaba sus referencias
-- con `public.` donde hacía falta (ej. `public.is_admin()`).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select auth.uid()) is not null
     and new.role is distinct from old.role
     and not public.is_admin()
  then
    raise exception 'No tienes permiso para cambiar tu propio rol';
  end if;
  return new;
end;
$$;

create or replace function public.lock_order_immutable_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select auth.uid()) is not null
     and (
       new.id is distinct from old.id
       or new.buyer_id is distinct from old.buyer_id
       or new.total is distinct from old.total
       or new.created_at is distinct from old.created_at
     )
  then
    raise exception 'orders: solo status es editable vía RLS (id, buyer_id, total y created_at son inmutables)';
  end if;
  return new;
end;
$$;

create or replace function public.lock_question_immutable_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select auth.uid()) is not null
     and (
       new.id is distinct from old.id
       or new.product_id is distinct from old.product_id
       or new.user_id is distinct from old.user_id
       or new.question is distinct from old.question
       or new.created_at is distinct from old.created_at
     )
  then
    raise exception 'questions: solo answer/answered_at son editables vía RLS';
  end if;
  return new;
end;
$$;

create or replace function public.lock_ticket_immutable_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select auth.uid()) is null or public.is_admin() then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.subject is distinct from old.subject
     or new.channel is distinct from old.channel
     or new.created_at is distinct from old.created_at
     or new.status is distinct from 'cerrado'
  then
    raise exception 'support_tickets: el dueño solo puede cerrar el ticket (status = ''cerrado''); ningún otro campo es editable';
  end if;
  return new;
end;
$$;
