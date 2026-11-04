package de.fitnessbuddy.app.widgets

import android.graphics.Bitmap
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.util.SizeF
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews
import de.fitnessbuddy.app.R
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.util.Locale

/*
 * Aktions-Widgets: je Widget genau eine Sache, große Knöpfe (mind. 48 dp), ein Tipp
 * öffnet die App direkt im passenden Ablauf (Deep Link fitnessbuddy://open/…).
 */

/** Mahlzeit nach Uhrzeit: Frühstück bis 11, Mittag bis 15, Abend bis 21 Uhr, danach Snack. */
internal fun mealFor(hour: Int): String = when {
    hour < 11 -> "Frühstück"
    hour < 15 -> "Mittagessen"
    hour < 21 -> "Abendessen"
    else -> "Snack"
}

/** Nächster Wechsel der Mahlzeit (11, 15, 21 Uhr oder Mitternacht) in Epoch-ms. */
private fun nextMealChange(now: LocalDateTime = LocalDateTime.now()): Long {
    val next = listOf(11, 15, 21).firstOrNull { now.hour < it }
        ?.let { now.toLocalDate().atTime(it, 0) }
        ?: LocalDate.now().plusDays(1).atStartOfDay()
    return next.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli() + 1_000
}

/** Schrift/Symbol auf der weißen Pille: App-Farbe abgedunkelt (wie heroPill). */
private val Kit.onWhite: Int get() = WidgetArt.mix(accent, Color.BLACK, 0.3f)

// ---------- Essen eintragen ----------

/**
 * Essen eintragen: 2×1 ein Knopf (Auswahl), 4×1 vier Knöpfe Foto · Sagen · Scannen · Suchen,
 * 2×2 als Raster. Mit genug Höhe steht oben die Mahlzeit („Frühstück eintragen“) und kcal übrig.
 */
class FoodLogWidget : BaseWidget() {
    override fun render(k: Kit, opts: Bundle): RemoteViews {
        if (k.s.bool("showNutrition", true)) WidgetStore.scheduleRefresh(k.ctx, nextMealChange(), WidgetStore.REQ_REFRESH_MEAL)
        val d = dims(opts, 300f, 90f)
        val art = k.actionArt(d.width, d.height)
        return sized(
            opts,
            SizeF(110f, 40f) to { single(k, art) },
            SizeF(220f, 56f) to { tiles(k, art, R.layout.widget_food_row, header = false, wide = true) },
            SizeF(220f, 90f) to { tiles(k, art, R.layout.widget_food_row, header = true, wide = true) },
            SizeF(110f, 112f) to { tiles(k, art, R.layout.widget_food_grid, header = false, wide = d.width >= 200f) },
            SizeF(110f, 150f) to { tiles(k, art, R.layout.widget_food_grid, header = true, wide = d.width >= 200f) },
        )
    }

    /** kcal, die heute noch übrig sind (nur mit Ziel und wenn noch etwas übrig ist). */
    private fun kcalLeft(s: Snap): Int? {
        val target = s.int("kcalTarget", 0)
        if (target <= 0) return null
        return (target - (s.daily("kcalEaten") ?: 0)).takeIf { it > 0 }
    }

    private fun single(k: Kit, art: Bitmap): RemoteViews {
        val v = RemoteViews(k.ctx.packageName, R.layout.widget_food_single)
        v.setImageViewBitmap(R.id.art, art)
        if (k.needsNutrition(v)) return v
        val hour = LocalDateTime.now().hour
        v.setTextViewText(R.id.title, mealFor(hour))
        v.setTextViewText(R.id.kcal, kcalLeft(k.s)?.let { "noch ${DE.format(it)} kcal" } ?: "eintragen")
        v.setInt(R.id.plus, "setColorFilter", k.onWhite)
        k.click(v, "/nutrition?add=menu", Req.FOOD_MENU)
        return v
    }

    private fun tiles(k: Kit, art: Bitmap, layout: Int, header: Boolean, wide: Boolean): RemoteViews {
        val v = RemoteViews(k.ctx.packageName, layout)
        v.setImageViewBitmap(R.id.art, art)
        if (k.needsNutrition(v)) return v
        val s = k.s
        // Ränder und Kopfzeile öffnen die Auswahl, die Knöpfe direkt den Ablauf
        k.click(v, "/nutrition?add=menu", Req.FOOD_MENU)
        k.click(v, "/nutrition?add=photo", Req.FOOD_PHOTO, R.id.food_photo)
        k.click(v, "/nutrition?add=aitext", Req.FOOD_VOICE, R.id.food_voice)
        k.click(v, "/nutrition?add=scan", Req.FOOD_SCAN, R.id.food_scan)
        k.click(v, "/nutrition?add=search", Req.FOOD_SEARCH, R.id.food_search)

        if (header) {
            val meal = mealFor(LocalDateTime.now().hour)
            v.setViewVisibility(R.id.header, View.VISIBLE)
            v.setTextViewText(R.id.title, if (wide) "$meal eintragen" else meal)
            val left = kcalLeft(s)
            if (left != null) {
                v.setTextViewText(R.id.kcal, "${DE.format(left)} kcal${if (wide) " übrig" else ""}")
                v.setViewVisibility(R.id.kcal, View.VISIBLE)
            } else {
                v.setViewVisibility(R.id.kcal, View.GONE)
            }
        } else {
            v.setViewVisibility(R.id.header, View.GONE)
        }

        // KI-Knöpfe nur ausblenden, wenn die App ausdrücklich meldet, dass KI fehlt
        if (!s.bool("aiAvailable", true)) {
            if (layout == R.layout.widget_food_grid) {
                v.setViewVisibility(R.id.food_ai_row, View.GONE)
            } else {
                v.setViewVisibility(R.id.food_photo, View.GONE)
                v.setViewVisibility(R.id.food_voice, View.GONE)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    v.setViewLayoutMargin(R.id.food_scan, RemoteViews.MARGIN_START, 0f, TypedValue.COMPLEX_UNIT_DIP)
                }
            }
        }
        return v
    }
}

// ---------- Training starten ----------

/** Training starten: nächstes Training und ein großer Start-Knopf (2×1 rund, 2×2 als Pille). */
class TrainingStartWidget : BaseWidget() {
    override fun render(k: Kit, opts: Bundle): RemoteViews {
        val d = dims(opts, 160f, 160f)
        val art = k.actionArt(d.width, d.height)
        return sized(
            opts,
            SizeF(110f, 40f) to { build(k, art, square = false) },
            SizeF(110f, 100f) to { build(k, art, square = true) },
        )
    }

    private fun build(k: Kit, art: Bitmap, square: Boolean): RemoteViews {
        val v = RemoteViews(k.ctx.packageName, if (square) R.layout.widget_train_start else R.layout.widget_train_start_row)
        v.setImageViewBitmap(R.id.art, art)
        val s = k.s
        k.click(v, "/", Req.TRAIN_START)
        k.click(v, "/", Req.TRAIN_START, R.id.btn)

        // Die App meldet ein heutiges Training als „Erledigt ✓“ statt des nächsten Namens
        val next = s.str("nextWorkout")
        val done = next?.startsWith("Erledigt") == true
        val rest = next == null && s.bool("restDay", false)
        val goal = s.int("weekGoal", 3).coerceAtLeast(1)
        val week = s.int("weekDone", 0).coerceAtLeast(0)
        val open = goal - week

        v.setTextViewText(R.id.overline, if (square) "Training · ${k.day}" else "Training")
        v.setTextViewText(
            R.id.title,
            when {
                done -> if (square) "Heute geschafft" else "Geschafft!"
                next != null -> next
                rest -> "Ruhetag"
                s.isEmpty -> "Los geht's"
                else -> "Freies Training"
            },
        )

        val ink = if (done) k.accent else k.onWhite
        v.setImageViewResource(R.id.btn_icon, if (done) R.drawable.ic_widget_check else R.drawable.ic_widget_play)
        v.setInt(R.id.btn_icon, "setColorFilter", ink)
        v.setContentDescription(R.id.btn, if (done) "Training erledigt – öffnen" else "Training starten")
        if (square) {
            // Haken kommt vom Symbol, daher ohne ✓ im Text
            v.setTextViewText(R.id.btn_text, if (done) "Erledigt" else "Starten")
            v.setTextColor(R.id.btn_text, ink)
            val hint = when {
                s.isEmpty -> null
                open <= 0 -> "Wochenziel geschafft"
                done -> "Noch $open diese Woche"
                rest -> "Heute ist Erholung dran"
                else -> "Noch $open ${if (open == 1) "Training" else "Trainings"} offen"
            }
            if (hint != null) v.setTextViewText(R.id.hint, hint) else v.setViewVisibility(R.id.hint, View.GONE)
        }
        return v
    }
}

// ---------- Gewicht eintragen ----------

/** Gewicht eintragen (1×1 / 2×1, ruhige Karte wie Wasser): ein Tipp öffnet das Eintragen. */
class WeightWidget : BaseWidget() {
    override fun render(k: Kit, opts: Bundle): RemoteViews = sized(
        opts,
        SizeF(40f, 40f) to { build(k, wide = false) },
        SizeF(110f, 40f) to { build(k, wide = true) },
    )

    private fun build(k: Kit, wide: Boolean): RemoteViews {
        val v = k.views(if (wide) R.layout.widget_weight_wide else R.layout.widget_weight)
        k.click(v, "/body?weigh=1", Req.WEIGHT)
        v.setInt(R.id.icon, "setColorFilter", k.accent)
        // Letztes Gewicht nur, wenn die App es mitschickt (sonst bleibt der Aufruf zum Wiegen)
        val kg = k.s.num("weightKg")?.takeIf { it in 20.0..400.0 }?.let { String.format(Locale.GERMANY, "%.1f kg", it) }
        if (wide) {
            v.setTextViewText(R.id.value, kg ?: "Gewicht")
            v.setTextViewText(R.id.hint, if (kg != null) "Neu eintragen" else "Kurz eintragen")
            v.setInt(R.id.add_bg, "setColorFilter", k.accent)
            v.setInt(R.id.add_icon, "setColorFilter", k.onAccent)
        } else {
            v.setTextViewText(R.id.value, kg ?: "Wiegen")
        }
        return v
    }
}
