// CSV-Export der eigenen Daten — „deine Daten gehören dir".

import type { Exercise, FoodEntry, SetWithDate } from '../types'
import { shareFile, type ShareOutcome } from './shareFile'

function toCsv(rows: (string | number | null)[][]): string {
  return rows
    .map((r) =>
      r
        .map((v) => {
          const s = v == null ? '' : String(v)
          return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
        })
        .join(';'),
    )
    .join('\n')
}

/** Im Browser herunterladen, in der App über das Teilen-Menü speichern/senden. */
function download(filename: string, content: string): Promise<ShareOutcome> {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' })
  return shareFile(blob, filename, { title: filename })
}

export function exportSetsCsv(sets: SetWithDate[], exercises: Exercise[]): Promise<ShareOutcome> {
  const name = new Map(exercises.map((e) => [e.id, e.name]))
  const rows: (string | number | null)[][] = [
    ['Datum', 'Übung', 'Satz', 'Typ', 'Wdh', 'Gewicht', 'Wdh_rechts', 'Gewicht_rechts', 'bis_Versagen'],
    ...[...sets]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => [
        s.date,
        name.get(s.exercise_id) ?? 'Übung',
        s.set_number,
        s.set_type,
        s.reps,
        s.weight,
        s.reps_right ?? '',
        s.weight_right ?? '',
        s.to_failure ? 'ja' : 'nein',
      ]),
  ]
  return download('training.csv', toCsv(rows))
}

export function exportNutritionCsv(entries: FoodEntry[]): Promise<ShareOutcome> {
  const rows: (string | number | null)[][] = [
    ['Datum', 'Name', 'Menge_g', 'kcal', 'Eiweiß', 'Kohlenhydrate', 'Fett'],
    ...[...entries]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => [e.date, e.name, e.amount_g ?? '', e.kcal, e.protein, e.carbs, e.fat]),
  ]
  return download('ernaehrung.csv', toCsv(rows))
}
