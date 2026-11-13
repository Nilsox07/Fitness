-- Push an die Android-App (Firebase Cloud Messaging) – in derselben Tabelle wie Web-Push.
-- Android-Zeilen: endpoint = 'fcm:<token>', platform = 'android', ohne Web-Push-Schlüssel.
-- local_until: bis zu diesem Tag hat die App ihre Erinnerungen selbst geplant – solange schickt der
-- Server dem Gerät nur Freundes-Pushes, danach übernimmt er (App länger nicht geöffnet).
-- Keine neue Tabelle → keine neuen GRANTs nötig; Zugriff weiter über RLS „push_subs_own“.

alter table public.push_subscriptions alter column p256dh drop not null;
alter table public.push_subscriptions alter column auth drop not null;
alter table public.push_subscriptions add column if not exists platform text not null default 'web';
alter table public.push_subscriptions add column if not exists local_until date;
