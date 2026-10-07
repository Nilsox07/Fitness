import { useEffect, useRef, useState } from 'react'
import { ClipboardPaste, ExternalLink, Image as ImageIcon, Link2, Loader2, TriangleAlert } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { useAddRecipe } from '../../hooks/useRecipes'
import {
  extractUrl,
  fetchSharedPost,
  recipeFromPost,
  recipeFromScreenshot,
  type ImportedRecipe,
} from '../../lib/ai'

/** Bild verkleinern (spart KI-Kosten und Upload-Zeit). */
function fileToDataUrl(file: File, maxDim = 1280): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Bild konnte nicht gelesen werden'))
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(reader.result as string)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.onerror = () => resolve(reader.result as string)
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

type Phase = 'idle' | 'loading-post' | 'reading' | 'done'

/**
 * Rezept aus TikTok, Instagram, YouTube, Pinterest oder einer Rezeptseite übernehmen:
 * Link (oder ganzen geteilten Text) einfügen, alternativ Screenshot. Startet sofort,
 * wenn der Inhalt über das Teilen-Menü kam.
 */
export function ImportRecipeForm({ initialText = '', onDone }: { initialText?: string; onDone: () => void }) {
  const { user } = useAuth()
  const addRecipe = useAddRecipe()
  const [text, setText] = useState(initialText)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [recipe, setRecipe] = useState<ImportedRecipe | null>(null)
  const started = useRef(false)
  const busy = phase === 'loading-post' || phase === 'reading'

  async function run(input: string) {
    const value = input.trim()
    if (!value || busy) return
    setError(null)
    setRecipe(null)
    try {
      const url = extractUrl(value)
      const rest = url ? value.replace(url, '').trim() : value
      let post = null
      if (url) {
        setPhase('loading-post')
        post = await fetchSharedPost(url)
      }
      setPhase('reading')
      // Längerer Zusatztext (z. B. kopierte Bildunterschrift) geht mit an die KI.
      setRecipe(await recipeFromPost(post, rest.length > 20 ? rest : ''))
      setPhase('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import fehlgeschlagen')
      setPhase('idle')
    }
  }

  async function fromScreenshot(file: File | undefined) {
    if (!file || busy) return
    setError(null)
    setRecipe(null)
    setPhase('reading')
    try {
      setRecipe(await recipeFromScreenshot(await fileToDataUrl(file)))
      setPhase('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Screenshot konnte nicht gelesen werden')
      setPhase('idle')
    }
  }

  // Über das Teilen-Menü geöffnet → direkt loslegen.
  useEffect(() => {
    if (started.current || !initialText.trim()) return
    started.current = true
    void run(initialText)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialText])

  async function paste() {
    try {
      const t = await navigator.clipboard.readText()
      if (t) {
        setText(t)
        void run(t)
      }
    } catch {
      setError('Einfügen nicht erlaubt – bitte lange ins Feld tippen und „Einfügen" wählen.')
    }
  }

  async function save() {
    if (!recipe) return
    setError(null)
    try {
      await addRecipe.mutateAsync({
        title: recipe.title,
        servings: recipe.servings,
        ingredients: recipe.ingredients,
        steps: recipe.url ? [...recipe.steps, `Original: ${recipe.source} – ${recipe.url}`] : recipe.steps,
        kcal: recipe.nutrition.kcal,
        protein: recipe.nutrition.protein,
        carbs: recipe.nutrition.carbs,
        fat: recipe.nutrition.fat,
        fiber: recipe.nutrition.fiber,
        sugar: recipe.nutrition.sugar,
        sat_fat: recipe.nutrition.sat_fat,
        salt: recipe.nutrition.salt,
        shared: false,
        author_name: user?.email?.split('@')[0] ?? null,
      })
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen')
    }
  }

  return (
    <div className="space-y-3">
      {!recipe && (
        <>
          <p className="text-sm text-cocoa-light">
            Link von TikTok, Instagram, YouTube, Pinterest oder einer Rezeptseite einfügen – oder die Bildunterschrift
            selbst.
          </p>
          <div className="relative">
            <Link2 size={18} className="pointer-events-none absolute left-3 top-3 text-cocoa-muted" />
            <textarea
              className="input min-h-[5.5rem] resize-none pl-10"
              placeholder="https://www.tiktok.com/@… oder Rezepttext"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-ghost gap-1.5" onClick={paste} disabled={busy}>
              <ClipboardPaste size={16} /> Einfügen
            </button>
            <label className={`btn-ghost cursor-pointer gap-1.5 ${busy ? 'pointer-events-none opacity-60' : ''}`}>
              <ImageIcon size={16} /> Screenshot
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void fromScreenshot(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </label>
          </div>
          <button className="btn-primary w-full gap-1.5" onClick={() => run(text)} disabled={busy || !text.trim()}>
            {busy && <Loader2 size={16} className="animate-spin" />}
            {phase === 'loading-post' ? 'Lade Beitrag…' : phase === 'reading' ? 'Lese Rezept…' : 'Rezept übernehmen'}
          </button>
        </>
      )}

      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

      {recipe && (
        <div className="anim-fade space-y-3">
          <div className="space-y-2 rounded-xl bg-sand-light p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold">{recipe.title}</div>
              <span className="shrink-0 rounded-full bg-sand px-2 py-0.5 text-[11px] font-semibold text-cocoa-light">
                {recipe.source}
              </span>
            </div>
            <div className="tabular text-xs text-cocoa-light">
              {recipe.nutrition.kcal} kcal · E {recipe.nutrition.protein} / K {recipe.nutrition.carbs} / F{' '}
              {recipe.nutrition.fat} g pro Portion · {recipe.servings} Portion(en)
            </div>
            {recipe.guessed && (
              <p className="flex gap-1.5 rounded-lg bg-gold/10 p-2 text-xs text-cocoa">
                <TriangleAlert size={14} className="mt-px shrink-0 text-gold" />
                Im Beitrag standen keine vollständigen Mengen – Buddy hat ein typisches Rezept ergänzt. Bitte kurz
                prüfen.
              </p>
            )}
            {recipe.ingredients.length > 0 && (
              <div>
                <div className="text-sm font-semibold">Zutaten</div>
                <ul className="list-disc pl-5 text-sm">
                  {recipe.ingredients.map((it, i) => (
                    <li key={i}>{it}</li>
                  ))}
                </ul>
              </div>
            )}
            {recipe.steps.length > 0 && (
              <div>
                <div className="text-sm font-semibold">Zubereitung</div>
                <ol className="list-decimal space-y-1 pl-5 text-sm">
                  {recipe.steps.map((st, i) => (
                    <li key={i}>{st}</li>
                  ))}
                </ol>
              </div>
            )}
            {recipe.url && (
              <a
                href={recipe.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand"
              >
                <ExternalLink size={12} /> Original ansehen
              </a>
            )}
          </div>
          <button className="btn-primary w-full" onClick={save} disabled={addRecipe.isPending}>
            {addRecipe.isPending ? 'Speichert…' : 'In meine Rezepte speichern'}
          </button>
          <button
            className="w-full text-center text-sm text-cocoa-light"
            onClick={() => {
              setRecipe(null)
              setPhase('idle')
            }}
          >
            Anderen Link probieren
          </button>
        </div>
      )}
    </div>
  )
}
