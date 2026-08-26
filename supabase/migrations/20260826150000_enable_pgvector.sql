-- pgvector: agrega el tipo `vector` y los operadores de similitud (<=>, <->,
-- <#>) que usa la búsqueda semántica de la sesión 4. Se instala en el schema
-- `extensions` (no en `public`), mismo patrón que pgcrypto en este proyecto;
-- `extensions` ya está en el search_path de la Data API (supabase/config.toml).
-- Viene incluida en el stack local de Supabase, por eso no requiere setup
-- adicional más allá de habilitarla.
create extension if not exists vector with schema extensions;
