-- Tiefe Auswertung der Uhr-Daten: Verläufe (verdichtet), Schlafphasen, Vitalwerte.

-- Teil 1: Aktivitäten
alter table public.health_activities
  add column if not exists active_kcal real,
  add column if not exists min_hr smallint,
  add column if not exists steps integer,
  add column if not exists avg_power real,
  add column if not exists max_power real,
  add column if not exists max_speed real,
  add column if not exists avg_cadence smallint,
  add column if not exists hr_series jsonb,      -- [[sekunde, bpm], …] max. 240 Punkte
  add column if not exists speed_series jsonb,   -- [[sekunde, m/s], …]
  add column if not exists power_series jsonb,   -- [[sekunde, watt], …]
  add column if not exists laps jsonb;           -- [{start_s, end_s, length_m}, …]

-- Teil 2: Schlaf
alter table public.health_sleep
  add column if not exists in_bed_min integer,
  add column if not exists latency_min integer,
  add column if not exists awakenings smallint,
  add column if not exists stages jsonb,         -- [[startMinute, dauer, phase 1–5], …]
  add column if not exists hr_avg real,
  add column if not exists hr_min smallint,
  add column if not exists hr_series jsonb,      -- [[minute, bpm], …]
  add column if not exists hrv_avg real,
  add column if not exists spo2_avg real,
  add column if not exists spo2_min real,
  add column if not exists resp_rate real,
  add column if not exists skin_temp_delta real;

-- Teil 3: Tageswerte
alter table public.health_daily
  add column if not exists distance_m integer,
  add column if not exists floors smallint,
  add column if not exists total_kcal integer,
  add column if not exists hr_min smallint,
  add column if not exists hr_max smallint,
  add column if not exists hr_avg smallint,
  add column if not exists hr_hourly jsonb,      -- 24 Werte (Ø-Puls je Stunde)
  add column if not exists spo2 real,
  add column if not exists resp_rate real,
  add column if not exists weight_kg real,
  add column if not exists body_fat_pct real,
  add column if not exists bp_sys smallint,
  add column if not exists bp_dia smallint,
  add column if not exists glucose_mmol real,
  add column if not exists body_temp_c real;
