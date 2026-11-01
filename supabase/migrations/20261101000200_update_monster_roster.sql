-- Update monster roster to canon fantasy names & hierarchy
-- 01. Veylith — Gap Hunter (The Void Stalker)
-- 02. Draeven — The Aligner (The Dreadfang)
-- 03. Kryvax — Methodologist (The Twisted Brood)
-- 04. Morvane — The Auditor (The Gravebound)
-- 05. Nyxara — Ghost Library (The Forgotten Keeper)
-- 06. Eldravos — Final Boss (The Ancient Sovereign)
-- Minions: Varkul, Nethrix, Zorveth, Thalgrim, Xyrath, Othrak, Velmora, Grivak

insert into public.bosses (slug, name, floor_order, dimension, base_hp, rubric_id, sprite_key)
values
  -- Canon Fantasy Boss Roster
  ('veylith', 'Veylith — The Void Stalker', 1, 'gap', 100, 'gap', 'boss-gap'),
  ('draeven', 'Draeven — The Dreadfang', 2, 'align', 100, 'align', 'boss-align'),
  ('kryvax', 'Kryvax — The Twisted Brood', 3, 'method', 100, 'method', 'boss-method'),
  ('morvane', 'Morvane — The Gravebound', 4, 'audit', 100, 'audit', 'boss-audit'),
  ('nyxara', 'Nyxara — The Forgotten Keeper', 5, 'ghost', 100, 'ghost', 'boss-ghost'),
  ('eldravos', 'Eldravos — The Ancient Sovereign', 6, 'final', 100, 'final', 'boss-sir'),
  -- Legacy / role alias slugs
  ('gap_hunter', 'Veylith (Gap Hunter)', 1, 'gap', 100, 'gap', 'boss-gap'),
  ('aligner', 'Draeven (The Aligner)', 2, 'align', 100, 'align', 'boss-align'),
  ('methodologist', 'Kryvax (Methodologist)', 3, 'method', 100, 'method', 'boss-method'),
  ('auditor', 'Morvane (The Auditor)', 4, 'audit', 100, 'audit', 'boss-audit'),
  ('ghost', 'Nyxara (Ghost Library)', 5, 'ghost', 100, 'ghost', 'boss-ghost'),
  ('sir_actually', 'Eldravos (The Sovereign)', 6, 'final', 100, 'final', 'boss-sir'),
  -- Minions / Dungeon Creatures
  ('minion', 'Dungeon Minion', 0, 'minion', 100, 'gap', 'minion-default'),
  ('minion-varkul', 'Varkul (Brutish beast)', 0, 'minion', 100, 'gap', 'minion-varkul'),
  ('minion-nethrix', 'Nethrix (Shadow crawler)', 0, 'minion', 100, 'gap', 'minion-nethrix'),
  ('minion-zorveth', 'Zorveth (Armored creature)', 0, 'minion', 100, 'align', 'minion-zorveth'),
  ('minion-thalgrim', 'Thalgrim (Stone guardian)', 0, 'minion', 100, 'align', 'minion-thalgrim'),
  ('minion-xyrath', 'Xyrath (Winged predator)', 0, 'minion', 100, 'method', 'minion-xyrath'),
  ('minion-othrak', 'Othrak (Undead warrior)', 0, 'minion', 100, 'method', 'minion-othrak'),
  ('minion-velmora', 'Velmora (Cursed spirit)', 0, 'minion', 100, 'audit', 'minion-velmora'),
  ('minion-grivak', 'Grivak (Small dungeon beast)', 0, 'minion', 100, 'audit', 'minion-grivak')
on conflict (slug) do update set
  name = excluded.name,
  floor_order = excluded.floor_order,
  dimension = excluded.dimension,
  base_hp = excluded.base_hp,
  rubric_id = excluded.rubric_id,
  sprite_key = excluded.sprite_key;
