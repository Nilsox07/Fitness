// CSV-Export der eigenen Daten — „deine Daten gehören dir".

import type { Exercise, FoodEntry, SetWithDate } from '../types'

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

function download(filename: string, content: string) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportSetsCsv(sets: SetWithDate[], exercises: Exercise[]) {
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
  download('training.csv', toCsv(rows))
}

export function exportNutritionCsv(entries: FoodEntry[]) {
  const rows: (string | number | null)[][] = [
    ['Datum', 'Name', 'Menge_g', 'kcal', 'Eiweiß', 'Kohlenhydrate', 'Fett'],
    ...[...entries]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => [e.date, e.name, e.amount_g ?? '', e.kcal, e.protein, e.carbs, e.fat]),
  ]
  download('ernaehrung.csv', toCsv(rows))
}
