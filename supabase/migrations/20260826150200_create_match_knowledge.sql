-- match_knowledge: dado el embedding de una pregunta, devuelve las fichas
-- más parecidas de knowledge_embeddings.
--
-- SECURITY INVOKER (a diferencia de create_order_from_cart, que es SECURITY
-- DEFINER): create_order_from_cart necesita SALTARSE RLS porque authenticated
-- no tiene INSERT directo en orders/order_items (solo esa función puede
-- escribir ahí). match_knowledge, en cambio, solo LEE knowledge_embeddings, y
-- la política de esa tabla (SELECT para authenticated, decisión 1 de la
-- spec: la IA exige sesión) es exactamente el control de acceso que se
-- quiere aplicar aquí — no hay nada que saltarse. SECURITY INVOKER respeta
-- la visibilidad del caller: si mañana se restringe RLS por vendedor o rol,
-- esta función lo hereda gratis, sin tocarla.
-- set search_path fijo: mismo motivo que en el resto del proyecto (evita
-- hijacking vía search_path), aunque el riesgo es menor en INVOKER que en
-- DEFINER.
create or replace function public.match_knowledge(
  query_embedding extensions.vector(384),
  p_source_type text default null,
  match_count int default 5,
  similarity_threshold float default 0.3
)
returns table (
  source_type text,
  source_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    ke.source_type,
    ke.source_id,
    ke.content,
    ke.metadata,
    1 - (ke.embedding <=> query_embedding) as similarity
  from public.knowledge_embeddings ke
  where (p_source_type is null or ke.source_type = p_source_type)
    and 1 - (ke.embedding <=> query_embedding) >= similarity_threshold
  order by ke.embedding <=> query_embedding
  limit match_count;
$$;

revoke execute on function public.match_knowledge(extensions.vector, text, int, float) from public;
revoke execute on function public.match_knowledge(extensions.vector, text, int, float) from anon;
grant execute on function public.match_knowledge(extensions.vector, text, int, float) to authenticated;
