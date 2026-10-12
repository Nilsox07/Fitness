-- =========================================================================
-- 0030 — Schnelle Reaktionen im Feed (💪 🔥 👏) statt nur Applaus
-- Eine Reaktion pro Person und Aktivität; bestehende Likes zählen als 👏.
-- Idempotent. RLS von activity_likes (0021) gilt weiter.
-- Bis diese Migration läuft, zeigt die App alle Reaktionen als 👏.
-- =========================================================================

alter table public.activity_likes
  add column if not exists emoji text not null default '👏';

alter table public.activity_likes drop constraint if exists activity_likes_emoji_check;
alter table public.activity_likes
  add constraint activity_likes_emoji_check check (emoji in ('💪', '🔥', '👏'));

-- Reaktion ändern (z. B. 👏 → 🔥) braucht ein UPDATE auf die eigene Zeile.
drop policy if exists "activity_likes_update_own" on public.activity_likes;
create policy "activity_likes_update_own" on public.activity_likes
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Trainings im Feed nachmachen: Übungen eines geteilten Trainings
-- ({"exercises":[{"name","muscle_group","sets","reps","weight"}]}).
alter table public.activities
  add column if not exists meta jsonb;
