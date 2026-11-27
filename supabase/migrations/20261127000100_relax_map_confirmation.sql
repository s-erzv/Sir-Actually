-- Upload gate moved to the app (lib/manuscript/documentGate.ts): missing
-- sections and an empty bibliography no longer block a Research Map.
-- Confirmation now only requires that the structure check ran.

create or replace function private.validate_map_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'confirmed' and old.status <> 'confirmed' then
    if new.completeness is null then
      raise exception 'Cek kelengkapan belum dijalankan.';
    end if;
  end if;
  return new;
end;
$$;
