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

/** Kalorien-Ring mit „übrig“ bzw. „drüber“ (dann in Gold). */
private fun Kit.kcal(v: RemoteViews, ringDp: Float) {
    val target = s.int("kcalTarget", 0)
    val eaten = s.daily("kcalEaten") ?: 0
    val left = target - eaten
    v.setTextViewText(R.id.kcal_left, DE.format(abs(left)))
    v.setTextViewText(R.id.kcal_label, if (left >= 0) "kcal übrig" else "kcal drüber")
    if (left < 0) ring(v, R.id.ring, ringDp, 1f, gold, gold) else ring(v, R.id.ring, ringDp, ratio(eaten, target))
}

private fun Kit.proteinText(v: RemoteViews) {
    v.setTextViewText(R.id.protein_val, "${s.daily("proteinEaten") ?: 0} / ${s.int("proteinTarget", 0)} g")
}

/** Level-Zeile + Balken (Buddy, Quests); ohne Level ausgeblendet. */
private fun Kit.level(v: RemoteViews, barWDp: Float, barHDp: Float) {
    val level = s.int("level")
    val pct = s.num("levelPct")?.toFloat()?.coerceIn(0f, 100f)
    if (level == null) {
        v.setViewVisibility(R.id.level, View.GONE)
        v.setViewVisibility(R.id.level_pct, View.GONE)
        v.setViewVisibility(R.id.level_bar, View.GONE)
        return
    }
    v.setTextViewText(R.id.level, "Level $level")
    if (pct == null) {
        v.setViewVisibility(R.id.level_pct, View.GONE)
        v.setViewVisibility(R.id.level_bar, View.GONE)
    } else {
        v.setTextViewText(R.id.level_pct, "${pct.roundToInt()} %")
        bar(v, R.id.level_bar, barWDp, barHDp, pct / 100f)
    }
}

// ---------- Buddy ----------

/** Buddy (2×2 bis 4×2): Maskottchen mit Sprechblase und Level. */
class BuddyWidget : BaseWidget() {
    override fun render(k: Kit, opts: Bundle): RemoteViews = sized(
        opts,
        SizeF(110f, 110f) to { build(k, wide = false) },
        SizeF(250f, 110f) to { build(k, wide = true) },
    )

    private fun build(k: Kit, wide: Boolean): RemoteViews {
        val v = k.views(if (wide) R.layout.widget_buddy_wide else R.layout.widget_buddy)
        k.click(v, "/today", Req.BUDDY)
        k.buddy(v, if (wide) 104f else 52f, if (wide) 88f else 46f)
        val s = k.s
        v.setTextViewText(R.id.line, s.str("buddyLine")?.take(90) ?: moodLine(s.str("buddyMood"), s.isEmpty))
        k.level(v, if (wide) 200f else 120f, if (wide) 5f else 4f)
        val stage = s.str("stageLabel")
        if (wide) {
            v.setTextViewText(R.id.stage, stage?.let { "· $it" } ?: "")
        } else {
            if (stage != null) v.setTextViewText(R.id.overline, stage)
            if (s.int("level") == null) {
                // Ohne Level: Titel zeigt einfach „Dein Buddy“
                v.setViewVisibility(R.id.level, View.VISIBLE)
                v.setTextViewText(R.id.level, "Dein Buddy")
                v.setTextViewText(R.id.overline, stage ?: "Fitness-Buddy")
            }
        }
        return v
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

/** Tagesübersicht (4×2): Kalorien-Ring, Eiweiß, Wasser mit +250 ml. */
class TodayWidget : BaseWidget() {
    override fun render(k: Kit, opts: Bundle): RemoteViews {
        val v = k.views(R.layout.widget_today)
        if (k.needsData(v) || k.needsNutrition(v)) return v
        val s = k.s
        if (!s.has("kcalTarget")) {
            k.click(v, "/profile?s=goal", Req.TODAY)
            k.empty(v, "Noch keine Ziele", "In der App unter Ziel & Körperdaten")
            return v
        }
        k.click(v, "/nutrition", Req.TODAY)
        k.kcal(v, 100f)
        k.proteinText(v)
        k.bar(v, R.id.protein_bar, 170f, 6f, ratio(s.daily("proteinEaten") ?: 0, s.int("proteinTarget", 0)))
        val wT = s.int("waterTarget", 2500)
        val wM = s.daily("waterMl") ?: 0
        v.setTextViewText(R.id.water_val, "${liters(wM).removeSuffix(" l")} / ${liters(wT)}")
        k.bar(v, R.id.water_bar, 90f, 6f, ratio(wM, wT), if (wM >= wT) k.success else k.accent)
        k.pill(v, R.id.water_add_bg, R.id.water_add_text)
        v.setOnClickPendingIntent(R.id.water_add, addWaterIntent(k.ctx))
        return v
    }
}

/** Wasser (1×1 tippen = +250 ml, 2×1 mit Knopf). */
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

/** Kalorien (2×2): großer Ring und Eiweiß. */
class CaloriesWidget : BaseWidget() {
    override fun render(k: Kit, opts: Bundle): RemoteViews {
        val v = k.views(R.layout.widget_kcal)
        if (k.needsData(v) || k.needsNutrition(v)) return v
        if (!k.s.has("kcalTarget")) {
            k.click(v, "/profile?s=goal", Req.CALORIES)
            k.empty(v, "Noch keine Ziele", "In der App unter Ziel & Körperdaten")
            return v
        }
        k.click(v, "/nutrition", Req.CALORIES)
        k.kcal(v, 88f)
        k.proteinText(v)
        return v
    }
}

/** Intervallfasten (2×2): Phase, Live-Countdown, Fortschritts-Ring. */
class FastingWidget : BaseWidget() {
    override fun render(k: Kit, opts: Bundle): RemoteViews {
        val v = k.views(R.layout.widget_fasting)
        if (k.needsData(v) || k.needsNutrition(v)) return v
        val f = k.s.obj("fasting")
        val endsAt = f?.optLong("endsAt", 0) ?: 0
        if (f == null || endsAt <= 0) {
            k.click(v, "/profile?s=goal", Req.FASTING)
            k.empty(v, "Kein Intervallfasten aktiv", "In der App unter Ziel & Körperdaten")
            return v
        }
        k.click(v, "/nutrition", Req.FASTING)
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
            k.ring(v, R.id.ring, 44f, pct)
        } else {
            pct = 1f
            v.setViewVisibility(R.id.countdown, View.GONE)
            v.setViewVisibility(R.id.done, View.VISIBLE)
            v.setTextViewText(R.id.done, if (fasting) "Geschafft!" else "Fenster zu")
            v.setTextViewText(R.id.until, "seit ${clock(endsAt)} Uhr")
            if (fasting) k.ring(v, R.id.ring, 44f, 1f, k.success, k.success) else k.ring(v, R.id.ring, 44f, 1f)
        }
        v.setTextViewText(R.id.pct, "${(pct * 100).roundToInt()}%")
        return v
    }
}

/** Supplemente (2×2): was als Nächstes dran ist, heute genommen. */
class SupplementsWidget : BaseWidget() {
    override fun render(k: Kit, opts: Bundle): RemoteViews {
        val v = k.views(R.layout.widget_supps)
        if (k.needsData(v) || k.needsNutrition(v)) return v
        val s = k.s
        k.click(v, "/nutrition", Req.SUPPLEMENTS)
        val total = s.int("supplementsTotal") ?: 0
        val done = (s.daily("supplementsDone") ?: 0).coerceAtMost(total.coerceAtLeast(0))
        val next = s.obj("supplementNext")
        val name = next?.optString("name")?.trim()?.takeIf { it.isNotEmpty() && it != "null" }
        if (total <= 0 && name == null) {
            k.empty(v, "Keine Supplemente geplant", "In der App unter Ernährung anlegen")
            return v
        }
        if (name != null && next != null) {
            v.setTextViewText(R.id.name, name)
            val time = next.optString("time").trim().takeIf { it.isNotEmpty() && it != "null" }
            if (time != null) {
                v.setTextViewText(R.id.time, "um $time Uhr")
                v.setTextColor(R.id.time, k.accent)
            } else {
                v.setViewVisibility(R.id.time, View.GONE)
            }
        } else {
            v.setTextViewText(R.id.next_label, "Heute")
            v.setTextViewText(R.id.name, "Alles genommen")
            v.setTextColor(R.id.name, k.success)
            v.setViewVisibility(R.id.time, View.GONE)
        }
        if (total in 1..14) {
            k.dots(v, R.id.dots, total, done, if (done >= total) k.success else k.accent)
        } else {
            v.setViewVisibility(R.id.dots, View.GONE)
        }
        v.setTextViewText(R.id.progress, if (total > 0) "$done von $total genommen" else "")
        return v
    }
}

// ---------- Training & Fortschritt ----------

/** Training (2×2): nächstes Training, Serie, Wochenziel als Punkte. */
class TrainingWidget : BaseWidget() {
    override fun render(k: Kit, opts: Bundle): RemoteViews {
        val v = k.views(R.layout.widget_training)
        if (k.needsData(v)) return v
        val s = k.s
        k.click(v, "/", Req.TRAINING)
        val next = s.str("nextWorkout")
        v.setTextViewText(
            R.id.next,
            when {
                next != null -> next
                s.bool("restDay", false) -> "Ruhetag – gönn dir Erholung"
                else -> "Freies Training"
            },
        )
        val weeks = s.int("streakWeeks", 0)
        if (weeks > 0) {
            v.setTextViewText(R.id.streak, "$weeks ${if (weeks == 1) "Woche" else "Wochen"} Serie")
        } else {
            v.setViewVisibility(R.id.flame, View.GONE)
            v.setTextViewText(R.id.streak, "Starte deine Serie")
        }
        val goal = s.int("weekGoal", 3).coerceAtLeast(1)
        val done = s.int("weekDone", 0).coerceAtLeast(0)
        val reached = done >= goal
        k.dots(v, R.id.dots, goal, done.coerceAtMost(goal), if (reached) k.success else k.accent)
        if (reached) {
            v.setTextViewText(R.id.week, "Wochenziel geschafft")
            v.setTextColor(R.id.week, k.success)
        } else {
            v.setTextViewText(R.id.week, "$done von $goal diese Woche")
        }
        return v
    }
}

/** Tägliche Quests (2×2): erledigt/gesamt, Level. */
class QuestsWidget : BaseWidget() {
    override fun render(k: Kit, opts: Bundle): RemoteViews {
        val v = k.views(R.layout.widget_quests)
        if (k.needsData(v)) return v
        val s = k.s
        k.click(v, "/today", Req.QUESTS)
        val total = s.int("questsTotal") ?: 0
        if (total <= 0) {
            k.empty(v, "Keine Quests heute", "Schau in der App vorbei")
            return v
        }
        val done = (s.daily("questsDone") ?: 0).coerceIn(0, total)
        val all = done >= total
        v.setTextViewText(R.id.done, done.toString())
        v.setTextViewText(R.id.total, "/ $total")
        if (all) {
            v.setTextViewText(R.id.hint, "Alle geschafft!")
            v.setTextColor(R.id.hint, k.success)
        } else {
            val open = total - done
            v.setTextViewText(R.id.hint, "Noch $open ${if (open == 1) "Quest" else "Quests"} offen")
        }
        if (total <= 14) {
            k.dots(v, R.id.dots, total, done, if (all) k.success else k.accent)
        } else {
            k.bar(v, R.id.dots, 120f, 6f, ratio(done, total), if (all) k.success else k.accent)
        }
        k.level(v, 120f, 4f)
        return v
    }
}

// ---------- Uhr ----------

/** Tagesform von der Uhr (2×2): Ring mit Wert, Tipp, zwei Kennzahlen. */
class ReadinessWidget : BaseWidget() {
    override fun render(k: Kit, opts: Bundle): RemoteViews {
        val v = k.views(R.layout.widget_readiness)
        if (k.needsData(v) || k.needsWatch(v)) return v
        val s = k.s
        k.click(v, "/sleep", Req.READINESS)
        val score = s.int("readiness")?.coerceIn(0, 100)
        v.setTextViewText(R.id.score, score?.toString() ?: "–")
        k.ring(v, R.id.ring, 54f, (score ?: 0) / 100f, if (score != null && score < 50) k.gold else k.accent)
        v.setTextViewText(
            R.id.advice,
            when {
                score == null -> "Noch keine Nacht erfasst"
                score >= 75 -> "Gib heute Gas"
                score >= 50 -> "Normal trainieren"
                else -> "Heute eher locker"
            },
        )
        // Nur Werte zeigen, die die Uhr wirklich liefert
        val stats = buildList {
            s.int("sleepMin")?.takeIf { it > 0 }?.let { add("Schlaf" to "${hm(it)} h") }
            s.daily("steps")?.let { add("Schritte" to DE.format(it)) }
            s.int("restingHr")?.takeIf { it > 0 }?.let { add("Ruhepuls" to "$it") }
            s.int("hrv")?.takeIf { it > 0 }?.let { add("HRV" to "$it ms") }
        }
        val rows = listOf(
            Triple(R.id.stat1, R.id.stat1_label, R.id.stat1_value),
            Triple(R.id.stat2, R.id.stat2_label, R.id.stat2_value),
        )
        rows.forEachIndexed { i, (row, label, value) ->
            val st = stats.getOrNull(i)
            if (st == null) {
                v.setViewVisibility(row, View.GONE)
            } else {
                v.setTextViewText(label, st.first)
                v.setTextViewText(value, st.second)
            }
        }
        return v
    }
}

/** Schritte (2×1 flach, 2×2 mit großem Ring). */
class StepsWidget : BaseWidget() {
    override fun render(k: Kit, opts: Bundle): RemoteViews = sized(
        opts,
        SizeF(110f, 40f) to { build(k, square = false) },
        SizeF(110f, 100f) to { build(k, square = true) },
    )

    private fun build(k: Kit, square: Boolean): RemoteViews {
        val v = k.views(if (square) R.layout.widget_steps else R.layout.widget_steps_row)
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
        val color = if (reached) k.success else k.accent
        v.setTextViewText(R.id.steps, DE.format(steps))
        v.setTextViewText(R.id.goal, "von ${DE.format(goal)}")
        if (square) {
            if (reached) k.ring(v, R.id.ring, 88f, 1f, color, color) else k.ring(v, R.id.ring, 88f, ratio(steps, goal))
            val km = s.num("cardioWeekKm")
            v.setTextViewText(
                R.id.hint,
                when {
                    reached && km != null && km > 0 -> "Ziel geschafft · ${String.format(Locale.GERMANY, "%.1f", km)} km/Woche"
                    reached -> "Ziel geschafft!"
                    else -> "Noch ${DE.format(goal - steps)} bis zum Ziel"
                },
            )
            if (reached) v.setTextColor(R.id.hint, k.success)
        } else {
            if (reached) k.ring(v, R.id.ring, 44f, 1f, color, color) else k.ring(v, R.id.ring, 44f, ratio(steps, goal))
            v.setTextViewText(R.id.pct, "${(ratio(steps, goal) * 100).roundToInt().coerceAtMost(999)}%")
        }
        return v
    }
}

/** Schlaf (2×2): letzte Nacht groß, Balken gegen 8 Stunden. */
class SleepWidget : BaseWidget() {
    override fun render(k: Kit, opts: Bundle): RemoteViews {
        val v = k.views(R.layout.widget_sleep)
        if (k.needsData(v) || k.needsWatch(v)) return v
        val s = k.s
        k.click(v, "/sleep", Req.SLEEP)
        val min = s.int("sleepMin")?.takeIf { it > 0 }
        if (min == null) {
            k.empty(v, "Noch keine Nacht", "Trag die Uhr beim Schlafen")
            return v
        }
        v.setTextViewText(R.id.duration, hm(min))
        v.setTextViewText(
            R.id.hint,
            when {
                min < 360 -> "Eher kurz – heute früher ins Bett?"
                min < 420 -> "Fast genug Schlaf"
                else -> "Gut ausgeschlafen"
            },
        )
        if (min >= 420) v.setTextColor(R.id.hint, k.success)
        k.bar(v, R.id.bar, 130f, 6f, min / 480f)
        val score = s.int("readiness")
        v.setTextViewText(R.id.extra, score?.let { "Tagesform $it" } ?: "")
        return v
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
