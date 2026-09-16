// Holt Schritte, Ruhepuls und Gewicht von Fitbit; importiert das Gewicht.
import { admin, getValidToken, userFromAuth } from '../_fitbit.js'

export default async function handler(req, res) {
  const user = await userFromAuth(req)
  if (!user) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }
  const token = await getValidToken(user.id)
  if (!token) {
    res.status(400).json({ error: 'not_connected' })
    return
  }

  // accept-language de_DE → metrische Einheiten (kg)
  const headers = { authorization: `Bearer ${token}`, 'accept-language': 'de_DE' }
  const get = async (url) => {
    const r = await fetch(url, { headers })
    return r.ok ? r.json() : null
  }

  const act = await get('https://api.fitbit.com/1/user/-/activities/date/today.json')
  const heart = await get('https://api.fitbit.com/1/user/-/activities/heart/date/today/1d.json')
  const weightData = await get(
    'https://api.fitbit.com/1/user/-/body/log/weight/date/today/30d.json',
  )

  const steps = act?.summary?.steps ?? null
  const caloriesOut = act?.summary?.caloriesOut ?? null
  const restingHr = heart?.['activities-heart']?.[0]?.value?.restingHeartRate ?? null
  const weights = (weightData?.weight ?? []).map((w) => ({ date: w.date, weight_kg: w.weight }))

  if (weights.length) {
    const db = admin()
    for (const w of weights) {
      await db
        .from('body_weights')
        .upsert({ user_id: user.id, date: w.date, weight_kg: w.weight_kg }, { onConflict: 'user_id,date' })
    }
  }

  const latest = weights.length ? weights[weights.length - 1].weight_kg : null
  res.status(200).json({ steps, caloriesOut, restingHr, weight: latest, importedWeights: weights.length })
}
