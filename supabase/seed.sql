-- Optionaler Übungskatalog für den eingeloggten Nutzer.
-- Hinweis: Ersetze '<DEINE_USER_ID>' durch deine auth-User-ID
-- (Supabase Dashboard -> Authentication -> Users -> ID kopieren) und führe das
-- Skript im SQL-Editor aus. Alternativ legst du Übungen direkt in der App an.

insert into public.exercises (user_id, name, muscle_group, target_rep_min, target_rep_max)
values
  ('<DEINE_USER_ID>', 'Bankdrücken',        'Brust',     6, 10),
  ('<DEINE_USER_ID>', 'Kniebeuge',          'Beine',     5, 8),
  ('<DEINE_USER_ID>', 'Kreuzheben',         'Rücken',    4, 6),
  ('<DEINE_USER_ID>', 'Schulterdrücken',    'Schultern', 8, 12),
  ('<DEINE_USER_ID>', 'Klimmzüge',          'Rücken',    6, 12),
  ('<DEINE_USER_ID>', 'Langhantelrudern',   'Rücken',    8, 12),
  ('<DEINE_USER_ID>', 'Bizeps-Curls',       'Bizeps',    10, 15),
  ('<DEINE_USER_ID>', 'Trizepsdrücken',     'Trizeps',   10, 15),
  ('<DEINE_USER_ID>', 'Beinpresse',         'Beine',     10, 15);
