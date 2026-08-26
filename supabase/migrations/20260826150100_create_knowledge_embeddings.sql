-- knowledge_embeddings: el "fichero" del bibliotecario (sesión 4, Fase 4.1).
-- UNA tabla para las dos fuentes (products y support_articles), discriminada
-- por source_type: más simple que dos tablas gemelas y permite búsquedas
-- conjuntas con un solo RPC (match_knowledge). Ver razonamiento SECURITY
-- INVOKER vs DEFINER en la migración del RPC.
--
-- source_id SIN foreign key: apunta a dos tablas origen distintas
-- (products.id o support_articles.id según source_type), y Postgres no
-- soporta una FK condicional a "una u otra tabla". Consecuencia: si el
-- producto o artículo de origen se borra, su ficha queda huérfana en esta
-- tabla. El service de búsqueda (vector-search.service, Fase 4.4) descarta
-- esas fichas al hidratar contra la tabla origen; el endpoint de reindexado
-- (Fase 4.3) también las limpia cuando detecta que la fuente ya no existe.
--
-- Supuesto: chunk_index existe desde ya (default 0, cada fuente es un solo
-- chunk en esta sesión) para no requerir una migración de esquema el día que
-- se trocee contenido largo en varios pedazos.
create table public.knowledge_embeddings (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('producto', 'articulo_soporte')),
  source_id uuid not null,
  chunk_index integer not null default 0,
  content text not null,
  -- Cambiar de modelo de embeddings a uno con otra dimensión (hoy 384,
  -- sentence-transformers/all-MiniLM-L6-v2) exige una migración nueva:
  -- ALTER COLUMN embedding TYPE extensions.vector(N), recrear el índice HNSW
  -- (está atado a la dimensión) y recrear match_knowledge (su firma fija
  -- vector(384)). No es un cambio de una sola variable de entorno.
  embedding extensions.vector(384) not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (source_type, source_id, chunk_index)
);

alter table public.knowledge_embeddings enable row level security;

-- Índice HNSW con vector_cosine_ops: coherente con el operador `<=>` (
-- distancia coseno) que usa match_knowledge para ordenar por similitud.
create index knowledge_embeddings_embedding_hnsw_idx
  on public.knowledge_embeddings
  using hnsw (embedding extensions.vector_cosine_ops);

create index knowledge_embeddings_source_type_idx
  on public.knowledge_embeddings (source_type);
