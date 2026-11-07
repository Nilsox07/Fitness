package de.fitnessbuddy.app.widgets

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin

/** Wettersymbole und Wochenbalken für die Outdoor-Widgets (auf der dunklen Karte: weiß, Sonne gold). */
internal object WeatherArt {
    private const val MAX_PX = 400f

    private fun bmp(ctx: Context, wDp: Float, hDp: Float): Triple<Bitmap, Canvas, Float> {
        val sc = min(ctx.resources.displayMetrics.density * 1.0f, MAX_PX / max(wDp, hDp))
        val b = Bitmap.createBitmap((wDp * sc).roundToInt().coerceAtLeast(1), (hDp * sc).roundToInt().coerceAtLeast(1), Bitmap.Config.ARGB_8888)
        return Triple(b, Canvas(b), sc)
    }

    private fun p(color: Int, fill: Boolean = true, stroke: Float = 0f) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        this.color = color
        style = if (fill) Paint.Style.FILL else Paint.Style.STROKE
        strokeWidth = stroke
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
    }

    /** Wettersymbol nach Bright-Sky-Code (clear-day, rain, …); unbekannt = Wolke. */
    fun icon(ctx: Context, sizeDp: Float, code: String?, gold: Int): Bitmap {
        val (b, c, sc) = bmp(ctx, sizeDp, sizeDp)
        val s = sizeDp * sc
        val white = Color.WHITE
        val soft = WidgetArt.alpha(Color.WHITE, 0.85f)
        when (code) {
            "clear-day" -> sun(c, s / 2, s / 2, s * 0.22f, s, gold)
            "clear-night" -> moon(c, s / 2, s / 2, s * 0.3f, white)
            "partly-cloudy-day" -> {
                sun(c, s * 0.64f, s * 0.36f, s * 0.15f, s * 0.7f, gold)
                cloud(c, s * 0.08f, s * 0.38f, s * 0.78f, s * 0.42f, white)
            }
            "partly-cloudy-night" -> {
                moon(c, s * 0.66f, s * 0.34f, s * 0.2f, soft)
                cloud(c, s * 0.08f, s * 0.38f, s * 0.78f, s * 0.42f, white)
            }
            "fog" -> {
                val pl = p(white, false, s * 0.08f)
                for (i in 0..2) c.drawLine(s * (0.18f + i * 0.05f), s * (0.36f + i * 0.16f), s * (0.82f - i * 0.05f), s * (0.36f + i * 0.16f), pl)
            }
            "wind" -> {
                val pl = p(white, false, s * 0.08f)
                c.drawLine(s * 0.15f, s * 0.35f, s * 0.7f, s * 0.35f, pl)
                c.drawLine(s * 0.15f, s * 0.52f, s * 0.85f, s * 0.52f, pl)
                c.drawLine(s * 0.15f, s * 0.69f, s * 0.6f, s * 0.69f, pl)
            }
            "rain", "sleet", "snow", "hail", "thunderstorm" -> {
                cloud(c, s * 0.1f, s * 0.12f, s * 0.8f, s * 0.42f, white)
                val y0 = s * 0.66f
                when (code) {
                    "rain" -> {
                        val pl = p(soft, false, s * 0.07f)
                        for (i in 0..2) {
                            val x = s * (0.3f + i * 0.2f)
                            c.drawLine(x, y0, x - s * 0.06f, y0 + s * 0.2f, pl)
                        }
                    }
                    "thunderstorm" -> {
                        val path = Path().apply {
                            moveTo(s * 0.55f, y0 - s * 0.04f)
                            lineTo(s * 0.4f, y0 + s * 0.14f)
                            lineTo(s * 0.52f, y0 + s * 0.14f)
                            lineTo(s * 0.44f, y0 + s * 0.3f)
                            lineTo(s * 0.64f, y0 + s * 0.08f)
                            lineTo(s * 0.52f, y0 + s * 0.08f)
                            close()
                        }
                        c.drawPath(path, p(gold))
                    }
                    else -> {
                        val pd = p(soft)
                        for (i in 0..2) c.drawCircle(s * (0.3f + i * 0.2f), y0 + s * (if (i == 1) 0.16f else 0.08f), s * 0.05f, pd)
                    }
                }
            }
            else -> cloud(c, s * 0.08f, s * 0.24f, s * 0.84f, s * 0.48f, white)
        }
        return b
    }

    private fun sun(c: Canvas, cx: Float, cy: Float, r: Float, s: Float, gold: Int) {
        val ray = p(gold, false, s * 0.06f)
        for (i in 0 until 8) {
            val a = Math.PI / 4 * i
            c.drawLine(
                cx + (r * 1.45f * cos(a)).toFloat(), cy + (r * 1.45f * sin(a)).toFloat(),
                cx + (r * 1.95f * cos(a)).toFloat(), cy + (r * 1.95f * sin(a)).toFloat(), ray,
            )
        }
        c.drawCircle(cx, cy, r, p(gold))
    }

    private fun moon(c: Canvas, cx: Float, cy: Float, r: Float, color: Int) {
        val full = Path().apply { addCircle(cx, cy, r, Path.Direction.CW) }
        val cut = Path().apply { addCircle(cx + r * 0.55f, cy - r * 0.35f, r * 0.85f, Path.Direction.CW) }
        full.op(cut, Path.Op.DIFFERENCE)
        c.drawPath(full, p(color))
    }

    /** Wolke im Rechteck (x, y, Breite, Höhe). */
    private fun cloud(c: Canvas, x: Float, y: Float, w: Float, h: Float, color: Int) {
        val path = Path().apply {
            addRoundRect(RectF(x, y + h * 0.45f, x + w, y + h), h * 0.28f, h * 0.28f, Path.Direction.CW)
            addCircle(x + w * 0.32f, y + h * 0.5f, h * 0.32f, Path.Direction.CW)
            addCircle(x + w * 0.6f, y + h * 0.38f, h * 0.38f, Path.Direction.CW)
        }
        c.drawPath(path, p(color))
    }

    /**
     * 7 Balken Mo–So (km je Tag), heute hervorgehoben, Buchstaben darunter.
     * Leere Tage als kleiner Punkt, damit die Woche lesbar bleibt.
     */
    fun week(ctx: Context, wDp: Float, hDp: Float, km: DoubleArray, today: Int, color: Int, track: Int): Bitmap {
        val (b, c, sc) = bmp(ctx, wDp, hDp)
        val w = wDp * sc
        val h = hDp * sc
        val label = 9f * sc
        val text = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            textSize = label
            textAlign = Paint.Align.CENTER
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val days = arrayOf("M", "D", "M", "D", "F", "S", "S")
        val max = km.maxOrNull()?.takeIf { it > 0 } ?: 1.0
        val col = w / 7
        val barW = min(col * 0.52f, 14f * sc)
        val barMax = h - label - 6f * sc
        for (i in 0 until 7) {
            val cx = col * i + col / 2
            val v = km.getOrElse(i) { 0.0 }
            val bh = if (v > 0) max(barW, (v / max * barMax).toFloat()) else barW * 0.6f
            val top = barMax - bh
            val fill = when {
                v <= 0 -> track
                i == today -> Color.WHITE
                else -> color
            }
            c.drawRoundRect(RectF(cx - barW / 2, top, cx + barW / 2, barMax), barW / 2, barW / 2, p(fill))
            text.color = if (i == today) Color.WHITE else WidgetArt.alpha(Color.WHITE, if (i > today) 0.4f else 0.65f)
            c.drawText(days[i], cx, h - 1f * sc, text)
        }
        return b
    }
}
