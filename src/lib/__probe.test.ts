import libraryRaw from '../../public/exercise-library.json?raw'
import { it } from 'vitest'
import { suggestLinks, type LibraryExercise } from './exerciseLibrary'
const list = (JSON.parse(libraryRaw) as { exercises: LibraryExercise[] }).exercises
it('probe', () => {
  const qs: [string, string][] = [
    ['Bankdrücken','Brust'],['Brustpresse Maschine','Brust'],['Rudern Kabel eng','Rücken'],['Lat Pulldown','Rücken'],
    ['Pec Deck','Brust'],['Trizeps Pushdown Seil','Trizeps'],['Seitheben Kabel','Schultern'],['Beinstrecker','Beine'],
    ['Wadenheben sitzend','Waden'],['Hip Thrusts','Gesäß'],['Ausfallschritte','Beine'],['Klimmzüge','Rücken'],
    ['Schulterdrücken Maschine','Schultern'],['Beinpresse','Beine'],['Beinbeuger sitzend','Beinbeuger'],['Butterfly','Brust'],
    ['Bizeps Curls SZ','Bizeps'],['Face Pulls','Schultern'],['Crunch Maschine','Bauch'],['Plank','Bauch'],['Dips','Trizeps'],
    ['Kreuzheben','Rücken'],['Kniebeugen','Beine'],['Rudern','Rücken'],['Meine Spezialübung','Sonstige'],['Hammercurls','Bizeps'],
    ['Reverse Butterfly','Schultern'],['Schrägbankdrücken Kurzhantel','Brust'],['Trizepsdrücken','Trizeps'],['Curls','Bizeps'],
  ]
  for (const [n, m] of qs) console.log(n.padEnd(30), '→', suggestLinks(n, m, list).map((e) => `${e.id}`).join(' | '))
})
