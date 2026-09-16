// Tages-Challenge & Ausreden — deterministisch aus dem Datum, kein Backend nötig.

const CHALLENGES = [
  '💪 Heute +1 Wdh auf allen Arbeitssätzen.',
  '🔥 Letzten Satz jeder Übung bis zum echten Versagen.',
  '⏱️ Pausen strikt einhalten — kein Handy zwischen den Sätzen.',
  '🎯 Eine Übung mit perfekter, langsamer Technik (3 Sek. runter).',
  '📈 Bei einer Übung eine Gewichtsstufe höher als letztes Mal.',
  '🧊 Ein Extra-Satz bei deiner Lieblingsübung.',
  '🫁 Zwischen den Sätzen bewusst tief atmen statt hetzen.',
  '💧 Heute genug trinken — mind. 2 Liter.',
  '🥩 Eiweißziel voll treffen.',
  '🧘 Nach dem Training 5 Min. dehnen.',
]

const EXCUSES = [
  'Meine Hanteln haben heute frei genommen. 🏖️',
  'Rest Day ist auch Gains Day… sagt man. 😇',
  'Die Couch hat mich zuerst gesehen. 🛋️',
  'Muskeln wachsen in der Pause — ich optimiere gerade. 🧠',
  'Zu viel Motivation, musste sie für morgen aufsparen. 💤',
  'Mein Trainingspartner ist ein Kissen geworden. 😴',
  'Beine? Kenne ich nur vom Zur-Bahn-Rennen. 🚌',
]

function daySeed(d = new Date()): number {
  return Number(`${d.getFullYear()}${d.getMonth() + 1}${d.getDate()}`)
}

export function challengeOfDay(d = new Date()): string {
  return CHALLENGES[daySeed(d) % CHALLENGES.length]
}

export function randomExcuse(): string {
  return EXCUSES[Math.floor(Math.random() * EXCUSES.length)]
}
