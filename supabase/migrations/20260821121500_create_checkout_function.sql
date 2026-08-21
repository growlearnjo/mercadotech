-- create_order_from_cart: única vía para crear un pedido (el INSERT directo
-- del cliente en orders/order_items queda bloqueado por RLS en la Fase 2.3).
-- Corre como una única transacción implícita (el cuerpo de una función
-- plpgsql se ejecuta atómicamente dentro de la llamada):
--   1. Falla si el carrito está vacío.
--   2. Bloquea (`for update of p`) las filas de products involucradas para
--      serializar checkouts concurrentes sobre el mismo stock.
--   3. Falla con mensaje claro si algún producto está inactivo o sin stock.
--   4. Crea el order ('pendiente') y los order_items con snapshots.
--   5. Descuenta stock y vacía el carrito.
--
-- SECURITY DEFINER: corre con los privilegios del owner (postgres), que es
-- dueño de las tablas y por tanto bypasea RLS — es el mecanismo intencional
-- para que esta función pueda escribir en orders/order_items aunque el rol
-- authenticated no tenga INSERT directo sobre esas tablas.
-- set search_path fijo por seguridad (evita hijacking vía search_path).
create or replace function public.create_order_from_cart(p_buyer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_total numeric(12, 2) := 0;
  v_item record;
  v_has_items boolean := false;
begin
  if p_buyer_id is distinct from auth.uid() then
    raise exception 'No autorizado: p_buyer_id no coincide con el usuario autenticado';
  end if;

  if not exists (select 1 from public.cart_items where user_id = p_buyer_id) then
    raise exception 'El carrito está vacío';
  end if;

  for v_item in
    select ci.product_id, ci.quantity, p.title, p.price, p.stock, p.is_active
    from public.cart_items ci
    join public.products p on p.id = ci.product_id
    where ci.user_id = p_buyer_id
    for update of p
  loop
    v_has_items := true;

    if not v_item.is_active then
      raise exception 'El producto "%" ya no está disponible', v_item.title;
    end if;

    if v_item.stock < v_item.quantity then
      raise exception 'Stock insuficiente para "%": disponible %, solicitado %',
        v_item.title, v_item.stock, v_item.quantity;
    end if;

    v_total := v_total + (v_item.price * v_item.quantity);
  end loop;

  -- Defensivo: cart_items no vacío pero el join no produjo filas (ej.
  -- producto ya borrado) — no debería ocurrir por las FKs, pero evita un
  -- pedido con total 0 y sin order_items si sucediera.
  if not v_has_items then
    raise exception 'El carrito está vacío';
  end if;

  insert into public.orders (buyer_id, status, total)
  values (p_buyer_id, 'pendiente', v_total)
  returning id into v_order_id;

  insert into public.order_items
    (order_id, product_id, seller_id, title_snapshot, price_snapshot, quantity)
  select v_order_id, p.id, p.seller_id, p.title, p.price, ci.quantity
  from public.cart_items ci
  join public.products p on p.id = ci.product_id
  where ci.user_id = p_buyer_id;

  update public.products p
  set stock = p.stock - ci.quantity
  from public.cart_items ci
  where ci.user_id = p_buyer_id
    and ci.product_id = p.id;

  delete from public.cart_items where user_id = p_buyer_id;

  return v_order_id;
end;
$$;

revoke execute on function public.create_order_from_cart(uuid) from public;
revoke execute on function public.create_order_from_cart(uuid) from anon;
grant execute on function public.create_order_from_cart(uuid) to authenticated;
