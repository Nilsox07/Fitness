// Texte aller Erinnerungen – gemeinsam für Web-Push (api/_notify.js) und die Android-App
// (src/lib/localReminders.ts), damit beide gleich klingen.
// Leitlinien: konkret mit echten Zahlen, ein kleiner nächster Schritt, kein schlechtes Gewissen,
// keine bestimmten Lebensmittel vorschreiben, Abwechslung (je Tag ein anderer Text).

const pick = (arr, seed) => arr[Math.abs(Math.floor(seed)) % arr.length]
const de = (n, d = 0) => (typeof n === 'string' ? n : Number(n).toLocaleString('de-DE', { maximumFractionDigits: d }))

/**
 * Titel + Text je Art. `seed` (z. B. Tag des Jahres) wählt die Variante.
 * ctx: kcalLeft, drankL, targetL, missing (g Eiweiß), plan, days, weeks, name, dose, end, bedAt, need
 */
export function reminderCopy(kind, ctx = {}, seed = 0) {
  switch (kind) {
    case 'breakfast':
      return pick(
        [
          { title: 'Guten Morgen! Was gab’s?', body: 'Ein Foto reicht – den Rest rechnet Buddy.' },
          {
            title: 'Frühstück schon eingetragen?',
            body: 'Mit „Nochmal“ geht’s in zwei Sekunden, wenn du das Gleiche hattest.',
          },
          { title: 'Kurz das Frühstück festhalten', body: 'Wer morgens einträgt, hat abends den Überblick.' },
        ],
        seed,
      )
    case 'lunch':
      return pick(
        [
          { title: 'Mittag eingetragen?', body: 'Jetzt weißt du noch genau, was es war – kurz festhalten.' },
          { title: 'Wie war das Mittagessen?', body: 'Foto oder ein Satz genügt, Buddy schätzt die Nährwerte.' },
        ],
        seed,
      )
    case 'dinner':
      return ctx.kcalLeft > 0
        ? {
            title: `Noch ${de(ctx.kcalLeft)} kcal für heute`,
            body: pick(
              [
                'Trag dein Abendessen ein – dann siehst du, wie dein Tag war.',
                'Passt genau für ein ordentliches Abendessen.',
              ],
              seed,
            ),
          }
        : { title: 'Abendessen eintragen?', body: 'Dann ist dein Tag komplett – auch an Tagen über dem Ziel.' }
    case 'water':
      return {
        title: `${de(ctx.drankL, 2)} von ${de(ctx.targetL, 2)} l getrunken`,
        body: pick(
          [
            'Ein großes Glas jetzt und du bist ein gutes Stück weiter.',
            'Kurze Trinkpause? Konzentration und Training danken es dir.',
          ],
          seed,
        ),
      }
    case 'protein':
      return {
        title: `Noch ${de(ctx.missing)} g Eiweiß bis zum Ziel`,
        body: pick(
          [
            'Plan die nächste Mahlzeit eiweißreich – dann passt es heute noch.',
            'Dein Ziel ist in Reichweite. Ein eiweißreicher Snack reicht oft schon.',
            'Eiweiß hilft deinen Muskeln beim Erholen – die nächste Mahlzeit zählt.',
          ],
          seed,
        ),
      }
    case 'fasting_open':
      return {
        title: 'Dein Essensfenster ist offen',
        body: ctx.end ? `Bis ${ctx.end} Uhr. Guten Appetit!` : 'Guten Appetit!',
      }
    case 'fasting_close':
      return { title: 'Noch 30 Minuten Essensfenster', body: 'Zeit für deine letzte Mahlzeit heute.' }
    case 'workout':
      return ctx.plan
        ? {
            title: `Heute: ${ctx.plan}`,
            body: pick(
              [
                'Das Schwerste ist der Weg ins Gym – der Rest läuft.',
                'Dein Plan ist bereit. Ich zähl die Sätze mit.',
                'Kleine Steigerung heute? Ich zeig dir dein Ziel-Gewicht.',
              ],
              seed,
            ),
          }
        : {
            title: 'Heute ist Trainingstag',
            body: 'Dein Rhythmus sagt: heute. Schon 30 Minuten machen den Unterschied.',
          }
    case 'streak':
      return ctx.danger
        ? {
            title: ctx.weeks > 1 ? `${ctx.weeks} Wochen Serie – noch 1 Training` : 'Noch 1 Training diese Woche',
            body: pick(
              ['Auch eine kurze Einheit zählt. Heute?', 'Keine Zeit fürs Gym? 15 Minuten Home-Workout zählen auch.'],
              seed,
            ),
          }
        : {
            title: `${ctx.days} Tage Pause – Lust auf Bewegung?`,
            body: pick(
              [
                'Kein Druck. Eine kurze Einheit bringt dich zurück in den Rhythmus.',
                '15 Minuten reichen, um wieder reinzukommen.',
              ],
              seed,
            ),
          }
    case 'supplement':
      return {
        title: `Zeit für ${ctx.name}`,
        body: ctx.dose ? `${ctx.dose} – kurz abhaken, dann ist’s erledigt.` : 'Kurz abhaken, dann ist’s erledigt.',
      }
    case 'weigh':
      return pick(
        [
          {
            title: 'Kurz auf die Waage',
            body: 'Nüchtern nach dem Aufstehen. Der Trend zählt, nicht der einzelne Tag.',
          },
          { title: 'Wiegen dauert 10 Sekunden', body: 'Regelmäßig gewogen wird deine Trendkurve genau.' },
        ],
        seed,
      )
    case 'review':
      return {
        title: 'Deine Woche in Zahlen',
        body: 'Was lief gut, was nimmst du dir vor? Buddy hat’s zusammengefasst.',
      }
    case 'bedtime':
      return {
        title: `In 30 Minuten ins Bett`,
        body: pick(
          [
            `Um ${ctx.bedAt} – dann passen ${ctx.need} Schlaf bis morgen früh.`,
            `${ctx.need} Schlaf brauchst du heute. Handy weg, Licht runter.`,
          ],
          seed,
        ),
      }
    case 'body':
      return {
        title: 'Zeit für ein Vergleichsfoto',
        body: 'Seit dem letzten sind 8 Wochen vergangen – jetzt sieht man Veränderungen.',
      }
    default:
      return null
  }
}

/** Tag des Jahres als Variante (wechselt täglich, bleibt am Tag gleich). */
export function daySeed(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 0)
  return Math.floor((date.getTime() - start.getTime()) / 86400000)
}
