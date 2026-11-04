package de.fitnessbuddy.app.widgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.util.SizeF
import android.view.View
import android.widget.RemoteViews
import de.fitnessbuddy.app.MainActivity
import de.fitnessbuddy.app.R
import org.json.JSONObject
import java.text.NumberFormat
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.util.Locale
import kotlin.math.roundToInt

internal val DE: NumberFormat = NumberFormat.getIntegerInstance(Locale.GERMANY)

/** Tippen öffnet die App direkt auf der passenden Seite (Deep Link fitnessbuddy://open/…). */
internal fun openApp(ctx: Context, path: String, req: Int): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("fitnessbuddy://open$path"), ctx, MainActivity::class.java)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    return PendingIntent.getActivity(ctx, req, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
}

/** „+250 ml“ als Broadcast – bucht, ohne die App zu öffnen. */
internal fun addWaterIntent(ctx: Context): PendingIntent = PendingIntent.getBroadcast(
    ctx,
    Req.WATER_ADD,
    Intent(ctx, WaterAddReceiver::class.java).setAction(WaterAddReceiver.ACTION),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
)

/** Feste Request-Codes, damit sich die PendingIntents nicht gegenseitig überschreiben. */
internal object Req {
    const val TODAY = 1
    const val WATER_ADD = 2
    const val TRAINING = 3
    const val READINESS = 4
    const val BUDDY = 5
    const val WATER = 6
    const val CALORIES = 7
    const val STEPS = 8
    const val SLEEP = 9
    const val FASTING = 10
    const val QUESTS = 11
    const val SUPPLEMENTS = 12
    const val MODULES = 13
    const val FOOD_PHOTO = 20
    const val FOOD_VOICE = 21
    const val FOOD_SCAN = 22
    const val FOOD_SEARCH = 23
    const val FOOD_MENU = 24
    const val TRAIN_START = 25
    const val WEIGHT = 26
}

/** 7:05 */
internal fun hm(min: Int) = "${min / 60}:${(min % 60).toString().padStart(2, '0')}"

/** 1,25 l / 2,5 l */
internal fun liters(ml: Int): String {
    val s = String.format(Locale.GERMANY, "%.2f", ml / 1000.0).trimEnd('0').trimEnd(',')
    return "$s l"
}

/** Lesezugriff auf den Snapshot: fehlende, leere oder veraltete Felder werden still ersetzt. */
internal class Snap(private val j: JSONObject) {
    val isEmpty = j.length() == 0

    /** Stammt der Stand von heute? Sonst zählen Tageswerte als 0. */
    val fresh = isToday(j.optLong("updatedAt", 0))

    fun has(k: String) = j.has(k) && !j.isNull(k)

    fun num(k: String): Double? = if (has(k)) j.optDouble(k).takeIf { !it.isNaN() } else null

    fun int(k: String): Int? = num(k)?.roundToInt()

    fun int(k: String, def: Int): Int = int(k) ?: def

    /** Tageswert: von gestern → 0. */
    fun daily(k: String): Int? = int(k)?.let { if (fresh) it else 0 }

    fun str(k: String): String? =
        if (has(k)) j.optString(k).trim().takeIf { it.isNotEmpty() && it != "null" } else null

    fun bool(k: String, def: Boolean) = if (has(k)) j.optBoolean(k, def) else def

    fun obj(k: String): JSONObject? = if (has(k)) j.optJSONObject(k) else null

    fun color(k: String): Int? = str(k)?.let { runCatching { Color.parseColor(it) }.getOrNull() }

    companion object {
        fun load(ctx: Context) = Snap(WidgetStore.snapshot(ctx))

        fun isToday(epochMs: Long): Boolean =
            epochMs > 0 && Instant.ofEpochMilli(epochMs).atZone(ZoneId.systemDefault()).toLocalDate() == LocalDate.now()
    }
}

/**
 * Maße einer Buddy-Karte in dp (muss zum Layout passen). [overlap] = so weit ragt Buddy oben
 * über die Karte hinaus; [buddyTop]/[buddyEnd] = Abstand von Buddy zur Widget-Ecke.
 */
internal class HeroSpec(
    val w: Float,
    val h: Float,
    val buddy: Float,
    val overlap: Float = 0f,
    val buddyTop: Float = 4f,
    val buddyEnd: Float = 4f,
) {
    val cardH get() = h - overlap
}

/** Farben + Zeichen-Helfer für einen Durchlauf (ein Snapshot, ein Hell/Dunkel-Zustand). */
internal class Kit(val ctx: Context, val s: Snap) {
    val night = (ctx.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
    val accent = s.color("accent") ?: DEFAULT_ACCENT
    val accentLight = s.color("accentLight") ?: WidgetArt.mix(accent, Color.WHITE, 0.35f)
    val accentDark = WidgetArt.mix(accent, Color.BLACK, 0.16f)
    val onAccent = s.color("onAccent") ?: Color.WHITE
    val track = WidgetArt.alpha(accent, if (night) 0.22f else 0.15f)

    /** „Erledigt“ folgt der App-Farbe (wie in der App). */
    val success = accent
    val gold = ctx.getColor(R.color.widget_gold)

    /** Auf der dunklen Karte: Weiß als Füllung, Spur halb durchsichtig. */
    private val heroTrack = WidgetArt.alpha(Color.WHITE, 0.18f)

    /** Kurzer Wochentag für die Überzeile („TRAINING · MO“). */
    val day: String = arrayOf("MO", "DI", "MI", "DO", "FR", "SA", "SO")[LocalDate.now().dayOfWeek.value - 1]

    private val glowBitmap: Bitmap by lazy { WidgetArt.glow(ctx, GLOW_DP, accent, night) }

    /** Neue Ansicht mit ruhiger Karte und Akzent-Schein (kleine Widgets). */
    fun views(layout: Int): RemoteViews = RemoteViews(ctx.packageName, layout).also { v ->
        v.setImageViewBitmap(R.id.glow, glowBitmap)
    }

    /**
     * Buddy-Karte: [fill] befüllt die Ansicht und gibt die große Hintergrund-Zahl zurück
     * (null = keine). Danach wird die Karte passend dazu gezeichnet.
     */
    fun hero(layout: Int, spec: HeroSpec, fill: (RemoteViews) -> String?): RemoteViews {
        val v = RemoteViews(ctx.packageName, layout)
        buddy(v, spec.buddy)
        val big = fill(v)
        v.setImageViewBitmap(
            R.id.art,
            WidgetArt.card(
                ctx, spec.w, spec.cardH, accent, accentDark, big,
                glowX = spec.w - spec.buddyEnd - spec.buddy / 2,
                glowY = spec.buddyTop - spec.overlap + spec.buddy / 2,
                glowR = spec.buddy * 1.05f,
            ),
        )
        return v
    }

    /**
     * Aktions-Karte ohne Buddy: gleicher Verlauf wie die Buddy-Karte, nur ein leichter Schein oben
     * rechts. Eine Bitmap für alle Größen-Varianten (wird beim Senden nur einmal übertragen).
     */
    fun actionArt(wDp: Float, hDp: Float): Bitmap = WidgetArt.card(
        ctx, wDp, hDp, accent, accentDark, null,
        glowX = wDp - 24f,
        glowY = 8f,
        glowR = minOf(wDp, hDp) * 0.7f,
    )

    fun heroBar(v: RemoteViews, id: Int, wDp: Float, hDp: Float, pct: Float, color: Int = Color.WHITE) =
        v.setImageViewBitmap(id, WidgetArt.bar(ctx, wDp, hDp, pct, color, heroTrack))

    fun heroDots(v: RemoteViews, id: Int, count: Int, done: Int) =
        v.setImageViewBitmap(id, WidgetArt.dots(ctx, count, done, Color.WHITE, heroTrack, 8f, 5f))

    /** Weißer Knopf auf der Karte (Akzent-Fläche würde unten links im Verlauf verschwinden). */
    fun heroPill(v: RemoteViews, bgId: Int, textId: Int) {
        v.setInt(bgId, "setColorFilter", Color.WHITE)
        v.setTextColor(textId, WidgetArt.mix(accent, Color.BLACK, 0.3f))
    }

    /**
     * Überzeile („TRAINING · MI“). Der Wochentag kommt nur dazu, wenn er neben Buddy noch Platz hat
     * ([endDp] = Abstand rechts im Layout); grob 7 dp je Großbuchstabe.
     */
    fun over(v: RemoteViews, title: String, spec: HeroSpec, endDp: Float = 54f) {
        val full = "$title · $day"
        v.setTextViewText(R.id.overline, if (full.length * 7f <= spec.w - 28f - endDp) full else title)
    }

    /** Bis zu drei Kennzahlen (Wert + Label); fehlende Spalten verschwinden, ohne Werte die ganze Zeile. */
    fun stats(v: RemoteViews, items: List<Pair<String, String>>) {
        val cols = listOf(
            Triple(R.id.stat1, R.id.stat1_value, R.id.stat1_label),
            Triple(R.id.stat2, R.id.stat2_value, R.id.stat2_label),
            Triple(R.id.stat3, R.id.stat3_value, R.id.stat3_label),
        )
        cols.forEachIndexed { i, (col, value, label) ->
            val st = items.getOrNull(i)
            if (st == null) {
                v.setViewVisibility(col, View.GONE)
            } else {
                v.setViewVisibility(col, View.VISIBLE)
                v.setTextViewText(value, st.first)
                v.setTextViewText(label, st.second)
            }
        }
        if (items.isEmpty()) {
            v.setViewVisibility(R.id.stats, View.GONE)
            v.setViewVisibility(R.id.divider, View.GONE)
        }
    }

    /** Goldenes Siegel unten rechts (Serie, alles geschafft). Platzhalter in der Kennzahlen-Zeile hält Abstand. */
    fun seal(v: RemoteViews, value: String, label: String) {
        v.setImageViewBitmap(R.id.seal, WidgetArt.seal(ctx, SEAL_DP, value, label))
        v.setViewVisibility(R.id.seal, View.VISIBLE)
        v.setViewVisibility(R.id.seal_space, View.VISIBLE)
    }

    fun ring(v: RemoteViews, id: Int, sizeDp: Float, pct: Float, color: Int = accent, light: Int = accentLight) =
        v.setImageViewBitmap(id, WidgetArt.ring(ctx, sizeDp, pct, color, light, track))

    fun bar(v: RemoteViews, id: Int, wDp: Float, hDp: Float, pct: Float, color: Int = accent) =
        v.setImageViewBitmap(id, WidgetArt.bar(ctx, wDp, hDp, pct, color, track))

    fun dots(v: RemoteViews, id: Int, count: Int, done: Int, color: Int = accent) =
        v.setImageViewBitmap(id, WidgetArt.dots(ctx, count, done, color, track))

    /** Akzent-Knopf: Fläche einfärben, Schrift in onAccent. */
    fun pill(v: RemoteViews, bgId: Int, textId: Int) {
        v.setInt(bgId, "setColorFilter", accent)
        v.setTextColor(textId, onAccent)
    }

    /** Buddy-Bild (der Lichtschein steckt in der Karte); ohne Bild das Emoji. */
    fun buddy(v: RemoteViews, buddyDp: Float) {
        val img = WidgetArt.buddy(ctx, buddyDp)
        if (img != null) {
            v.setImageViewBitmap(R.id.buddy, img)
            v.setViewVisibility(R.id.buddy, View.VISIBLE)
            v.setViewVisibility(R.id.buddy_emoji, View.GONE)
        } else {
            v.setViewVisibility(R.id.buddy, View.GONE)
            v.setViewVisibility(R.id.buddy_emoji, View.VISIBLE)
            v.setTextViewText(R.id.buddy_emoji, s.str("buddyEmoji") ?: "🐤")
        }
    }

    /** Inhalt ausblenden und Hinweis zeigen. */
    fun empty(v: RemoteViews, title: String, hint: String? = null) {
        v.setViewVisibility(R.id.content, View.GONE)
        v.setViewVisibility(R.id.seal, View.GONE)
        v.setViewVisibility(R.id.empty, View.VISIBLE)
        v.setTextViewText(R.id.empty_title, title)
        v.setTextViewText(R.id.empty_hint, hint ?: "")
        v.setViewVisibility(R.id.empty_hint, if (hint.isNullOrEmpty()) View.GONE else View.VISIBLE)
    }

    fun click(v: RemoteViews, path: String, req: Int, id: Int = android.R.id.background) =
        v.setOnClickPendingIntent(id, openApp(ctx, path, req))

    /** Typische Hinweise. true = Hinweis gezeigt, Widget fertig. */
    fun needsData(v: RemoteViews): Boolean {
        if (!s.isEmpty) return false
        empty(v, "Noch keine Daten", "Öffne die App einmal, dann geht's los")
        click(v, "/", Req.MODULES)
        return true
    }

    fun needsNutrition(v: RemoteViews): Boolean {
        if (s.bool("showNutrition", true)) return false
        empty(v, "Ernährung ist aus", "Unter Profil → Bereiche einschalten")
        click(v, "/profile?s=modules", Req.MODULES)
        return true
    }

    fun needsWatch(v: RemoteViews): Boolean {
        if (s.bool("hasWatch", false)) return false
        empty(v, "Uhr verbinden", "Profil → Bereiche → Smartwatch")
        click(v, "/profile?s=modules", Req.MODULES)
        return true
    }

    companion object {
        val DEFAULT_ACCENT = Color.parseColor("#E11D48")
        const val GLOW_DP = 170f
        const val SEAL_DP = 54f
    }
}

/**
 * Basis aller Widgets: liest den Snapshot, zeichnet bei Updates und
 * Größenänderung neu. Fehler in einem Widget dürfen die anderen nicht stören.
 */
abstract class BaseWidget : AppWidgetProvider() {
    internal abstract fun render(k: Kit, opts: Bundle): RemoteViews

    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) {
        val k = Kit(ctx, Snap.load(ctx))
        for (id in ids) push(k, mgr, id)
    }

    override fun onAppWidgetOptionsChanged(ctx: Context, mgr: AppWidgetManager, id: Int, newOptions: Bundle) {
        push(Kit(ctx, Snap.load(ctx)), mgr, id)
    }

    private fun push(k: Kit, mgr: AppWidgetManager, id: Int) {
        runCatching { mgr.updateAppWidget(id, render(k, mgr.getAppWidgetOptions(id))) }
            .onFailure { Log.w("Widgets", "${javaClass.simpleName}: ${it.message}") }
    }

    /**
     * Mehrere Layouts je Größe. Ab Android 12 wählt der Launcher selbst,
     * davor entscheiden wir anhand der gemeldeten Größe (Hochformat).
     */
    /**
     * Ungefähre Widget-Größe in dp (Hochformat: Mindestbreite × Höchsthöhe), begrenzt auf den
     * Bereich der Layout-Variante. Ohne Angabe gilt [defW] × [defH].
     */
    internal fun dims(opts: Bundle, defW: Float, defH: Float, minW: Float = 0f, maxW: Float = Float.MAX_VALUE): SizeF {
        val w = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH).toFloat().takeIf { it > 0f } ?: defW
        val h = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT).toFloat().takeIf { it > 0f } ?: defH
        return SizeF(w.coerceIn(minW, maxW), h.coerceIn(80f, 600f))
    }

    internal fun sized(opts: Bundle, vararg variants: Pair<SizeF, () -> RemoteViews>): RemoteViews {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return RemoteViews(variants.associate { it.first to it.second() })
        }
        val w = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH)
        val h = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT)
        val fit = variants.filter { w >= it.first.width && h >= it.first.height }
            .maxByOrNull { it.first.width * it.first.height }
        return (fit ?: variants.minBy { it.first.width * it.first.height }).second()
    }
}
