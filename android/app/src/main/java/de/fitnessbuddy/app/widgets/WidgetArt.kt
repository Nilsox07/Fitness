package de.fitnessbuddy.app.widgets

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.SweepGradient
import de.fitnessbuddy.app.R
import java.io.File
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Zeichnet Ringe, Balken, Punkte und den Akzent-Schein als kleine Bitmaps.
 * RemoteViews können Fortschrittsanzeigen erst ab Android 12 einfärben –
 * so sieht es überall gleich aus und trägt die Akzentfarbe der App.
 */
internal object WidgetArt {
    /** Längste Seite einer Bitmap in Pixeln (Speichergrenze der Widgets). */
    private const val MAX_PX = 400f

    const val BUDDY_FILE = "widget_buddy.png"

    /** Pixel je dp, gedeckelt, damit keine Bitmap größer als MAX_PX wird. */
    private fun scale(ctx: Context, wDp: Float, hDp: Float): Float =
        min(ctx.resources.displayMetrics.density, MAX_PX / max(wDp, hDp).coerceAtLeast(1f))

    private fun canvas(w: Float, h: Float): Pair<Bitmap, Canvas> {
        val b = Bitmap.createBitmap(w.roundToInt().coerceAtLeast(1), h.roundToInt().coerceAtLeast(1), Bitmap.Config.ARGB_8888)
        return b to Canvas(b)
    }

    private fun paint() = Paint(Paint.ANTI_ALIAS_FLAG)

    fun alpha(color: Int, a: Float): Int = Color.argb((a * 255).roundToInt().coerceIn(0, 255), Color.red(color), Color.green(color), Color.blue(color))

    /** Mischt zwei Farben (t = 0 → a, t = 1 → b). */
    fun mix(a: Int, b: Int, t: Float): Int = Color.rgb(
        (Color.red(a) + (Color.red(b) - Color.red(a)) * t).roundToInt(),
        (Color.green(a) + (Color.green(b) - Color.green(a)) * t).roundToInt(),
        (Color.blue(a) + (Color.blue(b) - Color.blue(a)) * t).roundToInt(),
    )

    /** Fortschrittsring mit weichem Verlauf (hell → Akzent) und runden Enden. */
    fun ring(ctx: Context, sizeDp: Float, pct: Float, color: Int, light: Int, track: Int, strokeDp: Float = sizeDp * 0.1f): Bitmap {
        val sc = scale(ctx, sizeDp, sizeDp)
        val size = sizeDp * sc
        val (b, c) = canvas(size, size)
        val sw = strokeDp.coerceIn(4f, 10f) * sc
        val r = RectF(sw / 2 + 1, sw / 2 + 1, size - sw / 2 - 1, size - sw / 2 - 1)
        val p = paint().apply {
            style = Paint.Style.STROKE
            strokeWidth = sw
            strokeCap = Paint.Cap.ROUND
            this.color = track
        }
        c.drawArc(r, 0f, 360f, false, p)
        val frac = pct.coerceIn(0f, 1f)
        if (frac > 0f) {
            val cx = size / 2
            p.color = color
            p.shader = SweepGradient(cx, cx, intArrayOf(light, color, color), floatArrayOf(0f, max(frac, 0.02f), 1f)).apply {
                // Start knapp vor 12 Uhr, damit die runde Kappe nicht die Endfarbe zeigt
                setLocalMatrix(Matrix().apply { setRotate(-96f, cx, cx) })
            }
            c.drawArc(r, -90f, 360f * frac, false, p)
        }
        return b
    }

    /** Waagrechter Balken mit runden Enden. */
    fun bar(ctx: Context, wDp: Float, hDp: Float, pct: Float, color: Int, track: Int): Bitmap {
        val sc = scale(ctx, wDp, hDp)
        val w = wDp * sc
        val h = hDp * sc
        val (b, c) = canvas(w, h)
        val p = paint().apply { this.color = track }
        c.drawRoundRect(RectF(0f, 0f, w, h), h / 2, h / 2, p)
        val frac = pct.coerceIn(0f, 1f)
        if (frac > 0f) {
            p.color = color
            c.drawRoundRect(RectF(0f, 0f, max(h, w * frac), h), h / 2, h / 2, p)
        }
        return b
    }

    /** Reihe aus Punkten, die ersten [done] gefüllt (Wochenziel, Quests …). */
    fun dots(ctx: Context, count: Int, done: Int, color: Int, track: Int, dotDp: Float = 10f, gapDp: Float = 6f): Bitmap {
        val n = count.coerceIn(1, 14)
        val wDp = n * dotDp + (n - 1) * gapDp
        val sc = scale(ctx, wDp, dotDp)
        val (b, c) = canvas(wDp * sc, dotDp * sc)
        val p = paint()
        val r = dotDp * sc / 2
        for (i in 0 until n) {
            p.color = if (i < done) color else track
            c.drawCircle(r + i * (dotDp + gapDp) * sc, r, r, p)
        }
        return b
    }

    /**
     * Akzent-Schein für die obere rechte Ecke der Karte. Die Ecke wird mit dem
     * Kartenradius abgerundet, damit nichts über den Rand ragt.
     */
    fun glow(ctx: Context, sizeDp: Float, color: Int, night: Boolean): Bitmap {
        val sc = scale(ctx, sizeDp, sizeDp)
        val s = sizeDp * sc
        val (b, c) = canvas(s, s)
        val radius = ctx.resources.getDimension(R.dimen.widget_radius) / ctx.resources.displayMetrics.density * sc
        val clip = Path().apply {
            addRoundRect(RectF(0f, 0f, s, s), floatArrayOf(0f, 0f, radius, radius, 0f, 0f, 0f, 0f), Path.Direction.CW)
        }
        c.clipPath(clip)
        val peak = if (night) 0.5f else 0.2f
        val p = paint().apply {
            shader = RadialGradient(
                s * 0.82f, s * 0.18f, s * 0.82f,
                intArrayOf(alpha(color, peak), alpha(color, peak * 0.35f), alpha(color, 0f)),
                floatArrayOf(0f, 0.45f, 1f),
                Shader.TileMode.CLAMP,
            )
        }
        c.drawRect(0f, 0f, s, s, p)
        return b
    }

    /** Runder Lichthof hinter dem Buddy. */
    fun halo(ctx: Context, sizeDp: Float, color: Int, night: Boolean): Bitmap {
        val sc = scale(ctx, sizeDp, sizeDp)
        val s = sizeDp * sc
        val (b, c) = canvas(s, s)
        val peak = if (night) 0.45f else 0.28f
        val p = paint().apply {
            shader = RadialGradient(
                s / 2, s / 2, s / 2,
                intArrayOf(alpha(color, peak), alpha(color, peak * 0.4f), alpha(color, 0f)),
                floatArrayOf(0f, 0.55f, 1f),
                Shader.TileMode.CLAMP,
            )
        }
        c.drawCircle(s / 2, s / 2, s / 2, p)
        return b
    }

    /** Wasserglas, von unten mit Akzent gefüllt. */
    fun glass(ctx: Context, wDp: Float, hDp: Float, pct: Float, color: Int, light: Int, track: Int): Bitmap {
        val sc = scale(ctx, wDp, hDp)
        val w = wDp * sc
        val h = hDp * sc
        val (b, c) = canvas(w, h)
        val inset = w * 0.12f
        val corner = w * 0.1f
        val path = Path().apply {
            moveTo(0f, 0f)
            lineTo(w, 0f)
            lineTo(w - inset, h - corner)
            quadTo(w - inset - corner * 0.1f, h, w - inset - corner, h)
            lineTo(inset + corner, h)
            quadTo(inset + corner * 0.1f, h, inset, h - corner)
            close()
        }
        val p = paint().apply { this.color = track }
        c.drawPath(path, p)
        val frac = pct.coerceIn(0f, 1f)
        if (frac > 0f) {
            c.save()
            c.clipPath(path)
            val top = h * (1f - frac)
            p.color = Color.BLACK // deckend, sonst erbt der Verlauf die Spur-Transparenz
            p.shader = LinearGradient(0f, top, 0f, h, light, color, Shader.TileMode.CLAMP)
            c.drawRect(0f, top, w, h, p)
            p.shader = null
            // Feine Wasserlinie
            p.color = alpha(Color.WHITE, 0.35f)
            c.drawRect(0f, top, w, top + max(1f, sc), p)
            c.restore()
        }
        return b
    }

    /** Gespeichertes Buddy-Bild laden (verkleinert) oder null. */
    fun buddy(ctx: Context, sizeDp: Float): Bitmap? = runCatching {
        val f = File(ctx.filesDir, BUDDY_FILE)
        if (!f.exists()) return null
        val target = (sizeDp * scale(ctx, sizeDp, sizeDp)).roundToInt().coerceAtLeast(16)
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(f.path, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
        var sample = 1
        while (max(bounds.outWidth, bounds.outHeight) / (sample * 2) >= target) sample *= 2
        val raw = BitmapFactory.decodeFile(f.path, BitmapFactory.Options().apply { inSampleSize = sample }) ?: return null
        val longest = max(raw.width, raw.height)
        if (longest <= target) raw
        else Bitmap.createScaledBitmap(raw, raw.width * target / longest, raw.height * target / longest, true)
    }.getOrNull()
}
