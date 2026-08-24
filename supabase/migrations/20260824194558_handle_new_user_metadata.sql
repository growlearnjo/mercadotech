-- ============================================================
-- Fase 3.3 — El registro debe poder elegir rol (comprador / vendedor)
-- ============================================================
--
-- POR QUÉ ESTA MIGRACIÓN EXISTE
--
-- La versión original de handle_new_user (Fase 2.2) inserta solo
-- (id, display_name), así que `role` cae siempre al default 'buyer' de la
-- columna. Elegir "quiero vender" en el formulario no tenía ningún efecto.
--
-- Y no se puede arreglar desde el cliente con un UPDATE posterior: el trigger
-- protect_profile_role (Fase 2.3) lanza excepción cuando auth.uid() no es
-- null, el role cambia y quien lo cambia no es admin — exactamente el caso de
-- alguien que acaba de registrarse intentando promoverse a vendedor.
--
-- De ahí que el ÚNICO instante en que `role` puede fijarse sea el INSERT de
-- este trigger, que corre SECURITY DEFINER y por tanto bypasea RLS y el
-- trigger de protección (que es BEFORE UPDATE, no BEFORE INSERT).
--
-- No se edita el archivo de la Fase 2.2: se reemplaza la función desde aquí
-- con `create or replace`, que mantiene intacto el trigger on_auth_user_created
-- ya asociado a ella.
--
-- SEGURIDAD: `role` se lee de raw_user_meta_data, que el cliente controla
-- (viaja en options.data del signUp y es manipulable desde DevTools). Por eso
-- se filtra con una lista blanca de DOS valores: cualquier otra cosa —incluido
-- 'admin', una cadena vacía o la ausencia del campo— degrada a 'buyer'.
-- Registrarse como admin es imposible por construcción, no por convención.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    -- nullif() cubre el caso "el campo viene, pero vacío": sin él un
    -- display_name = '' pasaría el coalesce y dejaría el perfil sin nombre.
    coalesce(
      nullif(new.raw_user_meta_data->>'display_name', ''),
      split_part(new.email, '@', 1)
    ),
    case
      when new.raw_user_meta_data->>'role' in ('buyer', 'seller')
        then new.raw_user_meta_data->>'role'
      else 'buyer'
    end
  );
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Crea el profile al registrarse un usuario. Lee display_name y role de '
  'raw_user_meta_data; role se restringe a buyer|seller (nunca admin).';
