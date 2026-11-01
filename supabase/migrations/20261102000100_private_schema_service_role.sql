-- Server-side inserts use the service_role key. Triggers on claims/citations
-- call helpers in the private schema, so service_role needs USAGE there.
-- Without this, POST /api/manuscripts fails with:
--   permission denied for schema private
grant usage on schema private to service_role;
grant execute on all functions in schema private to service_role;
alter default privileges in schema private grant execute on functions to service_role;
