package de.fitnessbuddy.app.widgets

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.SystemClock
import android.util.SizeF
import android.view.View
import android.widget.RemoteViews
import de.fitnessbuddy.app.R
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToInt

private val HHMM: DateTimeFormatter = DateTimeFormatter.ofPattern("HH:mm")

private fun clock(epochMs: Long): String = Instant.ofEpochMilli(epochMs).atZone(ZoneId.systemDefault()).format(HHMM)

private fun ratio(a: Int, b: Int): Float = if (b > 0) a.toFloat() / b else 0f

/** Standard-Karte 2×2: Buddy (64 dp) oben rechts in der Karte. */
private fun BaseWidget.square(opts: Bundle): HeroSpec {
    val d = dims(opts, 160f, 160f)
    return HeroSpec(d.width, d.height, 64f)
}

/** Kalorien „übrig“ bzw. „drüber“ (Balken dann in Gold). Gibt den Rest zurück. */
private fun Kit.kcal(v: RemoteViews, barWDp: Float): Int {
    val target = s.int("kcalTarget", 0)
    val eaten = s.daily("kcalEaten") ?: 0
    val left = target - eaten
    v.setTextViewText(R.id.kcal_left, DE.format(abs(left)))
    v.setTextViewText(R.id.kcal_label, if (left >= 0) "kcal übrig" else "kcal drüber")
    if (left < 0) heroBar(v, R.id.bar, barWDp, 5f, 1f, WidgetArt.GOLD) else heroBar(v, R.id.bar, barWDp, 5f, ratio(eaten, target))
    return left
}

/** Eiweiß als Kennzahl (ohne Ziel nur die Menge, ohne beides nichts). */
private fun Kit.protein(): Pair<String, String>? {
    val eaten = s.daily("proteinEaten") ?: 0
    val target = s.int("proteinTarget", 0)
    return when {
        target > 0 -> "$eaten/$target g" to "Eiweiß"
        eaten > 0 -> "$eaten g" to "Eiweiß"
        else -> null
    }
}

// ---------- Buddy ----------

/** Buddy (2×2 bis 4×2): ragt oben aus der Karte, Spruch, Level mit Fortschritt. */
class BuddyWidget : BaseWidget() {
    override fun render(k: Kit, opts: Bundle): RemoteViews = sized(
        opts,
        SizeF(110f, 110f) to { build(k, opts, wide = false) },
        SizeF(250f, 110f) to { build(k, opts, wide = true) },
    )

    private fun build(k: Kit, opts: Bundle, wide: Boolean): RemoteViews {
        val d = if (wide) dims(opts, 330f, 170f, minW = 250f) else dims(opts, 160f, 170f, maxW = 249f)
        val spec =
            if (wide) HeroSpec(d.width, d.height, 132f, overlap = 20f, buddyTop = 0f, buddyEnd = 4f)
            else HeroSpec(d.width, d.height, 92f, overlap = 20f, buddyTop = 0f, buddyEnd = 2f)
        return k.hero(if (wide) R.layout.widget_buddy_wide else R.layout.widget_buddy, spec) { v ->
            val s = k.s
            k.click(v, "/today", Req.BUDDY)
            v.setTextViewText(R.id.line, s.str("buddyLine")?.take(90) ?: moodLine(s.str("buddyMood"), s.isEmpty))
            val stage = s.str("stageLabel")
            val level = s.int("level")
            val pct = s.num("levelPct")?.toFloat()?.coerceIn(0f, 100f)
            if (wide) {
                v.setTextViewText(R.id.overline, stage?.let { "Dein Buddy · $it" } ?: "Dein Buddy")
                if (level != null) v.setTextViewText(R.id.level, "Level $level") else v.setViewVisibility(R.id.level, View.GONE)
            } else {
                v.setTextViewText(R.id.overline, if (level != null) stage ?: "Dein Buddy" else stage ?: "Fitness-Buddy")
                v.setTextViewText(R.id.level, if (level != null) "Level $level" else "Dein Buddy")
            }
            if (level != null && pct != null) {
                v.setTextViewText(R.id.level_pct, "${pct.roundToInt()} %")
                k.heroBar(v, R.id.level_bar, if (wide) d.width - 170f else d.width - 70f, 5f, pct / 100f)
            } else {
                v.setViewVisibility(R.id.level_pct, View.GONE)
                v.setViewVisibility(R.id.level_bar, View.GONE)
            }
            level?.toString()
        }
    }

    private fun moodLine(mood: String?, noData: Boolean): String = when {
        noData -> "Hi! Öffne die App, dann leg ich los."
        else -> when (mood) {
            "happy" -> "Schön, dass du da bist!"
            "proud" -> "Ich bin richtig stolz auf dich!"
            "cheer" -> "Komm, das schaffst du!"
            "sleepy" -> "Gähn … erst mal wach werden."
            "sad" -> "Ich hab dich vermisst. Heute was Kleines?"
            "hungry" -> "Hast du heute schon was gegessen?"
            "tired" -> "Heute darf's ruhig locker sein."
            "focus" -> "Fokus an – los geht's!"
            else -> "Lass uns heute was schaffen!"
        }
    }
}

// ---------- Ernährung ----------

/** Tagesübersicht (4×2): kcal übrig groß, Eiweiß, Wasser mit +250 ml. */
class TodayWidget : BaseWidget() {
    override fun render(k: Kit, opts: Bundle): RemoteViews {
        val d = dims(opts, 330f, 160f)
        return k.hero(R.layout.widget_today, HeroSpec(d.width, d.height, 84f)) { v ->
            if (k.needsData(v) || k.needsNutrition(v)) return@hero null
            val s = k.s
            if (!s.has("kcalTarget")) {
                k.click(v, "/profile?s=goal", Req.TODAY)
                k.empty(v, "Noch keine Ziele", "In der App unter Ziel & Körperdaten")
                return@hero null
            }
            k.click(v, "/nutrition", Req.TODAY)
            k.over(v, "Ernährung", HeroSpec(d.width, d.height, 84f), 92f)
            val left = k.kcal(v, d.width - 120f)
            val wT = s.int("waterTarget", 2500)
            val wM = s.daily("waterMl") ?: 0
            val water = "${liters(wM).removeSuffix(" l")}/${liters(wT)}${if (wM >= wT) " ✓" else ""}"
            val eaten = s.daily("kcalEaten") ?: 0
            k.stats(v, listOfNotNull(k.protein(), water to "Wasser", DE.format(eaten) to "Gegessen"))
            k.heroPill(v, R.id.water_add_bg, R.id.water_add_text)
            v.setOnClickPendingIntent(R.id.water_add, addWaterIntent(k.ctx))
            abs(left).toString()
        }
    }
}

/** Wasser (1×1 tippen = +250 ml, 2×1 mit Knopf) – kleine, ruhige Karte. */
class WaterWidget : BaseWidget() {
    override fun render(k: Kit, opts: Bundle): RemoteViews = sized(
        opts,
        SizeF(40f, 40f) to { build(k, wide = false) },
        SizeF(110f, 40f) to { build(k, wide = true) },
    )

    private fun build(k: Kit, wide: Boolean): RemoteViews {
        val v = k.views(if (wide) R.layout.widget_water_wide else R.layout.widget_water)
        if (k.needsData(v) || k.needsNutrition(v)) return v
        val s = k.s
        val wT = s.int("waterTarget", 2500)
        val wM = s.daily("waterMl") ?: 0
        val done = wM >= wT
        val fill = if (done) k.success else k.accent
        v.setTextViewText(R.id.amount, liters(wM))
        if (wide) {
            v.setImageViewBitmap(R.id.glass, WidgetArt.glass(k.ctx, 24f, 32f, ratio(wM, wT), fill, if (done) fill else k.accentLight, k.track))
            v.setTextViewText(R.id.target, if (done) "geschafft!" else "von ${liters(wT)}")
            if (done) v.setTextColor(R.id.target, k.success)
            k.click(v, "/nutrition", Req.WATER)
            k.pill(v, R.id.water_add_bg, R.id.water_add_text)
            v.setOnClickPendingIntent(R.id.water_add, addWaterIntent(k.ctx))
        } else {
            v.setImageViewBitmap(R.id.glass, WidgetArt.glass(k.ctx, 22f, 28f, ratio(wM, wT), fill, if (done) fill else k.accentLight, k.track))
            v.setTextColor(R.id.add_hint, k.accent)
            v.setOnClickPendingIntent(android.R.id.background, addWaterIntent(k.ctx))
        }
        return v
    }
}

/** Kalorien (2×2): übrig groß, Balken, Gegessen und Eiweiß. */
class CaloriesWidget : BaseWidget() {
    override fun render(k: Kit, opts: Bundle): RemoteViews {
        val spec = square(opts)
        return k.hero(R.layout.widget_kcal, spec) { v ->
            if (k.needsData(v) || k.needsNutrition(v)) return@hero null
            if (!k.s.has("kcalTarget")) {
                k.click(v, "/profile?s=goal", Req.CALORIES)
                k.empty(v, "Noch keine Ziele", "In der App unter Ziel & Körperdaten")
                return@hero null
            }
            k.click(v, "/nutrition", Req.CALORIES)
            k.over(v, "Kalorien", spec)
            val left = k.kcal(v, spec.w - 28f)
            val eaten = k.s.daily("kcalEaten") ?: 0
            k.stats(v, listOfNotNull(DE.format(eaten) to "Gegessen", k.protein()))
            abs(left).toString()
        }
    }
}

/** Intervallfasten (2×2): Phase, Live-Countdown, Fortschritts-Balken. */
class FastingWidget : BaseWidget() {
    override fun render(k: Kit, opts: Bundle): RemoteViews {
        val spec = square(opts)
        return k.hero(R.layout.widget_fasting, spec) { v ->
            if (k.needsData(v) || k.needsNutrition(v)) return@hero null
            val f = k.s.obj("fasting")
            val endsAt = f?.optLong("endsAt", 0) ?: 0
            if (f == null || endsAt <= 0) {
                k.click(v, "/profile?s=goal", Req.FASTING)
                k.empty(v, "Kein Intervallfasten aktiv", "In der App unter Ziel & Körperdaten")
                return@hero null
            }
            k.click(v, "/nutrition", Req.FASTING)
            k.over(v, "Fasten", spec)
            val fasting = f.optString("phase") != "eating"
            val label = f.optString("label").trim().takeIf { it.isNotEmpty() && it != "null" }
            v.setTextViewText(R.id.phase, label ?: if (fasting) "Fastenzeit" else "Essenszeit")
            val now = System.currentTimeMillis()
            val remaining = endsAt - now
            // Ohne Startzeit: übliche 16:8-Fenster annehmen
            val startsAt = f.optLong("startsAt", 0).takeIf { it in 1 until endsAt }
                ?: (endsAt - (if (fasting) 16L else 8L) * 3_600_000L)
            var pct = ((now - startsAt).toFloat() / (endsAt - startsAt)).coerceIn(0f, 1f)
            if (remaining > 0) {
                v.setChronometer(R.id.countdown, SystemClock.elapsedRealtime() + remaining, null, true)
                v.setChronometerCountDown(R.id.countdown, true)
                v.setTextViewText(R.id.until, "noch · bis ${clock(endsAt)} Uhr")
                WidgetStore.scheduleRefresh(k.ctx, endsAt + 1_000)
            } else {
                pct = 1f
                v.setViewVisibility(R.id.countdown, View.GONE)
                v.setViewVisibility(R.id.done, View.VISIBLE)
                v.setTextViewText(R.id.done, if (fasting) "Geschafft!" else "Fenster zu")
                v.setTextViewText(R.id.until, "seit ${clock(endsAt)} Uhr")
            }
            k.heroBar(v, R.id.bar, spec.w - 28f, 5f, pct)
            v.setTextViewText(R.id.pct, "${(pct * 100).roundToInt()}%")
            // Große Zahl: Länge des Fensters in Stunden (z. B. 16)
            ((endsAt - startsAt) / 3_600_000.0).roundToInt().takeIf { it in 1..99 }?.toString()
        }
    }
}

/** Supplemente (2×2): was als Nächstes dran ist, heute genommen. */
class SupplementsWidget : BaseWidget() {
    override fun render(k: Kit, opts: Bundle): RemoteViews {
        val spec = square(opts)
        return k.hero(R.layout.widget_supps, spec) { v -> fill(k, v, spec) }
    }

    private fun fill(k: Kit, v: RemoteViews, spec: HeroSpec): String? {
        if (k.needsData(v) || k.needsNutrition(v)) return null
        val s = k.s
        k.click(v, "/nutrition", Req.SUPPLEMENTS)
        k.over(v, "Supplemente", spec)
        val total = s.int("supplementsTotal") ?: 0
        val done = (s.daily("supplementsDone") ?: 0).coerceAtMost(total.coerceAtLeast(0))
        val next = s.obj("supplementNext")
        val name = next?.optString("name")?.trim()?.takeIf { it.isNotEmpty() && it != "null" }
        if (total <= 0 && name == null) {
            k.empty(v, "Keine Supplemente geplant", "In der App unter Ernährung anlegen")
            return null
        }
        if (name != null && next != null) {
            v.setTextViewText(R.id.name, name)
            val time = next.optString("time").trim().takeIf { it.isNotEmpty() && it != "null" }
            if (time != null) v.setTextViewText(R.id.time, "um $time Uhr") else v.setViewVisibility(R.id.time, View.GONE)
        } else {
            v.setTextViewText(R.id.next_label, "Heute")
            v.setTextViewText(R.id.name, "Alles genommen")
            v.setViewVisibility(R.id.time, View.GONE)
        }
        if (total in 1..14) k.heroDots(v, R.id.dots, total, done) else v.setViewVisibility(R.id.dots, View.GONE)
        if (total > 0) v.setTextViewText(R.id.progress, "$done von $total genommen") else v.setViewVisibility(R.id.progress, View.GONE)
        return if (total > 0) done.toString() else null
    }
}

// ---------- Training & Fortschritt ----------

/** Training (2×2): nächstes Training, Wochenziel, Serie (ab 2 Wochen als goldenes Siegel). */
class TrainingWidget : BaseWidget() {
    override fun render(k: Kit, opts: Bundle): RemoteViews {
        val spec = square(opts)
        return k.hero(R.layout.widget_training, spec) { v -> fill(k, v, spec) }
    }

    private fun fill(k: Kit, v: RemoteViews, spec: HeroSpec): String? {
        if (k.needsData(v)) return null
        val s = k.s
        k.click(v, "/", Req.TRAINING)
        k.over(v, "Training", spec)
        val next = s.str("nextWorkout")
        val rest = next == null && s.bool("restDay", false)
        v.setTextViewText(R.id.next, next ?: if (rest) "Ruhetag" else "Freies Training")
        val weeks = s.int("streakWeeks", 0).coerceAtLeast(0)
        val goal = s.int("weekGoal", 3).coerceAtLeast(1)
        val done = s.int("weekDone", 0).coerceAtLeast(0)
        val open = goal - done
        v.setTextViewText(
            R.id.week,
            when {
                open <= 0 -> "Wochenziel geschafft"
                rest -> "Gönn dir Erholung"
                else -> "Noch $open ${if (open == 1) "Training" else "Trainings"} offen"
            },
        )
        val stats = mutableListOf("${done.coerceAtMost(99)}/$goal" to "Woche")
        when {
            weeks >= 2 -> k.seal(v, weeks.toString(), "Wochen")
            weeks == 1 -> stats += "1 Woche" to "Serie"
        }
        k.stats(v, stats)
        return when {
            weeks > 0 -> weeks.toString()
            done > 0 -> done.toString()
            else -> null
        }
    }
}

/** Tägliche Quests (2×2): erledigt/gesamt, Level; Siegel wenn alle geschafft. */
class QuestsWidget : BaseWidget() {
    override fun render(k: Kit, opts: Bundle): RemoteViews {
        val spec = square(opts)
        return k.hero(R.layout.widget_quests, spec) { v ->
            if (k.needsData(v)) return@hero null
            val s = k.s
            k.click(v, "/today", Req.QUESTS)
            val total = s.int("questsTotal") ?: 0
            if (total <= 0) {
                k.empty(v, "Keine Quests heute", "Schau in der App vorbei")
                return@hero null
            }
            k.over(v, "Quests", spec)
            val done = (s.daily("questsDone") ?: 0).coerceIn(0, total)
            val all = done >= total
            v.setTextViewText(R.id.done, done.toString())
            v.setTextViewText(R.id.total, "/ $total")
            val open = total - done
            v.setTextViewText(R.id.hint, if (all) "Alle geschafft!" else "Noch $open ${if (open == 1) "Quest" else "Quests"} offen")
            if (total <= 14) k.heroDots(v, R.id.dots, total, done) else k.heroBar(v, R.id.dots, spec.w - 28f, 5f, ratio(done, total))
            val level = s.int("level")
            val pct = s.num("levelPct")?.toFloat()?.coerceIn(0f, 100f)
            k.stats(v, listOfNotNull(level?.let { (if (pct != null) "$it · ${pct.roundToInt()} %" else "$it") to "Level" }))
            if (all) k.seal(v, "$total", "Geschafft")
            done.toString()
        }
    }
}

// ---------- Uhr ----------

/** Tagesform von der Uhr (2×2): Wert groß, Tipp, bis zu drei Kennzahlen (nur was die Uhr liefert). */
class ReadinessWidget : BaseWidget() {
    override fun render(k: Kit, opts: Bundle): RemoteViews {
        val spec = square(opts)
        return k.hero(R.layout.widget_readiness, spec) { v -> fill(k, v, spec) }
    }

    private fun fill(k: Kit, v: RemoteViews, spec: HeroSpec): String? {
        if (k.needsData(v) || k.needsWatch(v)) return null
        val s = k.s
        k.click(v, "/sleep", Req.READINESS)
        k.over(v, "Tagesform", spec)
        val score = s.int("readiness")?.coerceIn(0, 100)
        if (score == null) {
            v.setViewVisibility(R.id.score_row, View.GONE)
        } else {
            v.setTextViewText(R.id.score, score.toString())
            if (score < 50) v.setTextColor(R.id.score, WidgetArt.GOLD)
        }
        v.setTextViewText(
            R.id.advice,
            when {
                score == null -> "Trag die Uhr heute Nacht"
                score >= 75 -> "Gib heute Gas"
                score >= 50 -> "Normal trainieren"
                else -> "Heute eher locker"
            },
        )
        // Nur Werte zeigen, die die Uhr wirklich liefert; schmal passen zwei Spalten
        k.stats(
            v,
            buildList {
                s.int("sleepMin")?.takeIf { it > 0 }?.let { add("${hm(it)} h" to "Schlaf") }
                s.int("restingHr")?.takeIf { it > 0 }?.let { add("$it" to "Ruhepuls") }
                s.int("hrv")?.takeIf { it > 0 }?.let { add("$it ms" to "HRV") }
                s.daily("steps")?.takeIf { it > 0 }?.let { add(DE.format(it) to "Schritte") }
            }.take(if (spec.w >= 200f) 3 else 2),
        )
        return score?.toString()
    }
}

/** Schritte (2×1 flach und ruhig, 2×2 als Buddy-Karte). */
class StepsWidget : BaseWidget() {
    override fun render(k: Kit, opts: Bundle): RemoteViews = sized(
        opts,
        SizeF(110f, 40f) to { row(k) },
        SizeF(110f, 100f) to { square(k, opts) },
    )

    private fun square(k: Kit, opts: Bundle): RemoteViews {
        val d = dims(opts, 160f, 160f)
        return k.hero(R.layout.widget_steps, HeroSpec(d.width, d.height, 64f)) { v ->
            if (k.needsData(v) || k.needsWatch(v)) return@hero null
            val s = k.s
            k.click(v, "/cardio", Req.STEPS)
            val steps = s.daily("steps")
            if (steps == null) {
                k.empty(v, "Noch keine Schritte", "Deine Uhr meldet sich beim nächsten Abgleich")
                return@hero null
            }
            k.over(v, "Schritte", HeroSpec(d.width, d.height, 64f))
            val goal = s.int("stepsGoal", 8000).coerceAtLeast(1)
            val pct = (ratio(steps, goal) * 100).roundToInt().coerceAtMost(999)
            v.setTextViewText(R.id.steps, DE.format(steps))
            v.setTextViewText(R.id.goal, "von ${DE.format(goal)}")
            k.heroBar(v, R.id.bar, d.width - 28f, 5f, ratio(steps, goal))
            val km = s.num("cardioWeekKm")?.takeIf { it > 0 }?.let { String.format(Locale.GERMANY, "%.1f km", it) to "Woche" }
            if (steps >= goal) {
                k.seal(v, "$pct%", "Ziel")
                k.stats(v, listOfNotNull("+${DE.format(steps - goal)}" to "Extra", km))
            } else {
                k.stats(v, listOfNotNull(DE.format(goal - steps) to "Noch", "$pct %" to "Vom Ziel", km))
            }
            DE.format(steps)
        }
    }

    private fun row(k: Kit): RemoteViews {
        val v = k.views(R.layout.widget_steps_row)
        if (k.needsData(v) || k.needsWatch(v)) return v
        val s = k.s
        k.click(v, "/cardio", Req.STEPS)
        val steps = s.daily("steps")
        if (steps == null) {
            k.empty(v, "Noch keine Schritte", "Deine Uhr meldet sich beim nächsten Abgleich")
            return v
        }
        val goal = s.int("stepsGoal", 8000).coerceAtLeast(1)
        val reached = steps >= goal
        v.setTextViewText(R.id.steps, DE.format(steps))
        v.setTextViewText(R.id.goal, "von ${DE.format(goal)}")
        if (reached) k.ring(v, R.id.ring, 44f, 1f, k.success, k.success) else k.ring(v, R.id.ring, 44f, ratio(steps, goal))
        v.setTextViewText(R.id.pct, "${(ratio(steps, goal) * 100).roundToInt().coerceAtMost(999)}%")
        return v
    }
}

/** Schlaf (2×2): letzte Nacht groß, Balken gegen 8 Stunden, Werte der Uhr. */
class SleepWidget : BaseWidget() {
    override fun render(k: Kit, opts: Bundle): RemoteViews {
        val spec = square(opts)
        return k.hero(R.layout.widget_sleep, spec) { v ->
            if (k.needsData(v) || k.needsWatch(v)) return@hero null
            val s = k.s
            k.click(v, "/sleep", Req.SLEEP)
            val min = s.int("sleepMin")?.takeIf { it > 0 }
            if (min == null) {
                k.empty(v, "Noch keine Nacht", "Trag die Uhr beim Schlafen")
                return@hero null
            }
            k.over(v, "Schlaf", spec)
            v.setTextViewText(R.id.duration, hm(min))
            v.setTextViewText(
                R.id.hint,
                when {
                    min < 360 -> "Eher kurz – heute früher ins Bett?"
                    min < 420 -> "Fast genug Schlaf"
                    else -> "Gut ausgeschlafen"
                },
            )
            k.heroBar(v, R.id.bar, spec.w - 28f, 5f, min / 480f)
            k.stats(
                v,
                listOfNotNull(
                    s.int("readiness")?.let { "$it" to "Tagesform" },
                    s.int("hrv")?.takeIf { it > 0 }?.let { "$it ms" to "HRV" },
                    "8 h" to "Ziel",
                ),
            )
            (min / 60).toString()
        }
    }
}

/** „+250 ml“ im Widget – bucht sofort, ohne die App zu öffnen. */
class WaterAddReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        if (intent.action == ACTION) WidgetStore.addWater(ctx, 250)
    }

    companion object {
        const val ACTION = "de.fitnessbuddy.app.WATER_ADD"
    }
}
