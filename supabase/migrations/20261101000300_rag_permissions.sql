-- RAG retrieval RPCs are called from server routes with the service role.
-- RLS bypass does not imply EXECUTE permission, so grant it explicitly.

grant execute on function public.search_manuscript_chunks_fts(text, uuid, integer, integer)
  to service_role;

grant execute on function public.match_manuscript_chunks(extensions.vector, uuid, integer, integer, text)
  to service_role;
