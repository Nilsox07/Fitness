package de.fitnessbuddy.app.widgets

import kotlin.math.abs
import kotlin.math.acos
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.tan

/** Sportart für Wetter-Tipps (aus dem Ausdauer-Plan der App). */
enum class Sport(val noun: String) {
    RUN("Laufwetter"),
    BIKE("Radwetter"),
    WALK("Wetter zum Gehen");

    companion object {
        fun of(kind: String?) = when (kind) {
            "bike" -> BIKE
            "walk" -> WALK
            else -> RUN
        }
    }
}

/** Eine Stunde Vorhersage. [hour] = lokale Stunde 0–23, [dayOffset] 0 = heute, 1 = morgen. */
data class Hour(
    val dayOffset: Int,
    val hour: Int,
    val temp: Double,
    val rainProb: Int?,
    val rainMm: Double,
    val wind: Double,
    val gust: Double?,
    val icon: String?,
)

/** Wie gut ist das Wetter gerade? */
enum class Verdict { GREAT, GOOD, MEH, BAD }

/**
 * Reine Wetter-Logik für die Outdoor-Widgets (ohne Android-Abhängigkeiten, getestet in OutdoorTest).
 * Faustregeln aus dem Lauf-/Radsport: gefühlte Temperatur + ~10 °C beim Laufen, Wind zählt beim Rad doppelt.
 */
object Outdoor {
    /** Gefühlte Temperatur (Windchill nach DWD/NWS-Formel unter 10 °C und ab ~5 km/h Wind). */
    fun feelsLike(temp: Double, windKmh: Double): Double {
        if (temp > 10 || windKmh < 4.8) return temp
        val v = windKmh.pow(0.16)
        return 13.12 + 0.6215 * temp - 11.37 * v + 0.3965 * temp * v
    }

    private fun wet(h: Hour) = (h.rainProb ?: 0) >= 50 || h.rainMm >= 0.3

    /** Kleidungstipp nach gefühlter Temperatur. */
    fun clothing(feels: Double, rain: Boolean, sport: Sport): String {
        val base = when (sport) {
            Sport.BIKE -> when {
                feels >= 20 -> "Trikot kurz"
                feels >= 14 -> "Kurz + Armlinge"
                feels >= 8 -> "Langarm + Weste"
                feels >= 2 -> "Lang + Windjacke"
                else -> "Winterjacke + Handschuhe"
            }
            Sport.WALK -> when {
                feels >= 18 -> "T-Shirt"
                feels >= 10 -> "Leichte Jacke"
                feels >= 3 -> "Jacke"
                else -> "Warme Jacke + Mütze"
            }
            Sport.RUN -> when {
                feels >= 16 -> "Kurz + kurz"
                feels >= 10 -> "Shirt + kurze Hose"
                feels >= 5 -> "Langarm + kurze Hose"
                feels >= 0 -> "Langarm + Tights"
                else -> "Lagen, Mütze, Handschuhe"
            }
        }
        return if (rain) "$base + Regenjacke" else base
    }

    /** Strafpunkte einer Stunde (kleiner = besser). */
    fun penalty(h: Hour, sport: Sport): Double {
        val feels = feelsLike(h.temp, h.wind)
        val ideal = when (sport) {
            Sport.RUN -> 11.0
            Sport.BIKE -> 18.0
            Sport.WALK -> 17.0
        }
        val windFrom = if (sport == Sport.BIKE) 12.0 else 20.0
        val windW = if (sport == Sport.BIKE) 2.5 else 1.2
        val gust = max(0.0, (h.gust ?: 0.0) - 50) * 1.5
        return (h.rainProb ?: if (h.rainMm > 0.1) 70 else 10) * 0.8 +
            h.rainMm * 25 +
            max(0.0, h.wind - windFrom) * windW +
            gust +
            abs(feels - ideal) * 1.6
    }

    fun verdictOf(penalty: Double): Verdict = when {
        penalty < 18 -> Verdict.GREAT
        penalty < 35 -> Verdict.GOOD
        penalty < 60 -> Verdict.MEH
        else -> Verdict.BAD
    }

    /**
     * Beste Stunde ab jetzt (heute, bei Tageslicht und zwischen 6 und 21 Uhr).
     * Ist heute nichts mehr drin, die beste Stunde morgen. [sunrise]/[sunset] in Minuten seit Mitternacht.
     */
    fun bestHour(hours: List<Hour>, nowHour: Int, sunrise: Int?, sunset: Int?, sport: Sport): Hour? {
        fun ok(h: Hour) = h.hour in 6..21 &&
            (sunrise == null || h.hour * 60 + 30 >= sunrise) &&
            (sunset == null || h.hour * 60 + 30 <= sunset)
        val today = hours.filter { it.dayOffset == 0 && it.hour >= nowHour && ok(it) }
        val pool = today.ifEmpty { hours.filter { it.dayOffset == 1 && ok(it) } }
        return pool.minByOrNull { penalty(it, sport) }
    }

    /** Ab wann hört es auf zu regnen? null = regnet gerade nicht oder hört in der Vorhersage nicht auf. */
    fun dryFrom(hours: List<Hour>, nowHour: Int): Hour? {
        val next = hours.filter { it.dayOffset > 0 || it.hour >= nowHour }
        if (next.isEmpty() || !wet(next.first())) return null
        return next.firstOrNull { !wet(it) }
    }

    /** Ab wann regnet es (in den nächsten Stunden)? */
    fun rainFrom(hours: List<Hour>, nowHour: Int, within: Int = 3): Hour? {
        val next = hours.filter { it.dayOffset == 0 && it.hour >= nowHour }.take(within + 1)
        return next.firstOrNull { wet(it) }
    }

    /**
     * Kurze Einschätzung für jetzt, z. B. „Top Laufwetter“, „Regen bis 16 Uhr“, „Glatt möglich“.
     */
    fun headline(hours: List<Hour>, nowHour: Int, sport: Sport): Pair<String, Verdict> {
        val cur = hours.firstOrNull { it.dayOffset == 0 && it.hour == nowHour } ?: hours.firstOrNull()
            ?: return "Keine Vorhersage" to Verdict.MEH
        if (cur.temp <= 1 && (wet(cur) || (cur.rainProb ?: 0) >= 30)) return "Glatt möglich – vorsichtig" to Verdict.BAD
        if ((cur.gust ?: 0.0) >= 60) return "Sturmböen – lieber drinnen" to Verdict.BAD
        dryFrom(hours, nowHour)?.let { return "Regen bis ${it.hour} Uhr" to Verdict.MEH }
        if (wet(cur)) return "Regen – Jacke einpacken" to Verdict.BAD
        rainFrom(hours, nowHour)?.let { return "Ab ${it.hour} Uhr Regen" to Verdict.GOOD }
        val v = verdictOf(penalty(cur, sport))
        val text = when (v) {
            Verdict.GREAT -> "Top ${sport.noun}"
            Verdict.GOOD -> "Gutes ${sport.noun}"
            Verdict.MEH -> if (sport == Sport.BIKE && cur.wind >= 25) "Viel Gegenwind" else "Geht so draußen"
            Verdict.BAD -> "Eher ungemütlich"
        }
        return text to v
    }

    /** Windrichtung als Kürzel (N, NO, O …). */
    fun windDir(deg: Double?): String {
        if (deg == null) return ""
        val dirs = arrayOf("N", "NO", "O", "SO", "S", "SW", "W", "NW")
        return dirs[(((deg % 360) + 360) % 360 / 45.0).roundToInt() % 8]
    }

    /**
     * Sonnenauf- und -untergang (NOAA-Näherung, ±2 min) in Minuten seit Mitternacht lokaler Zeit.
     * null = Polartag/-nacht.
     */
    fun sun(lat: Double, lon: Double, dayOfYear: Int, utcOffsetMin: Int): Pair<Int, Int>? {
        val rad = Math.PI / 180
        val g = 2 * Math.PI / 365 * (dayOfYear - 1)
        val eqt = 229.18 * (0.000075 + 0.001868 * cos(g) - 0.032077 * sin(g) - 0.014615 * cos(2 * g) - 0.040849 * sin(2 * g))
        val decl = 0.006918 - 0.399912 * cos(g) + 0.070257 * sin(g) - 0.006758 * cos(2 * g) +
            0.000907 * sin(2 * g) - 0.002697 * cos(3 * g) + 0.00148 * sin(3 * g)
        val cosH = cos(90.833 * rad) / (cos(lat * rad) * cos(decl)) - tan(lat * rad) * tan(decl)
        if (cosH < -1 || cosH > 1) return null
        val ha = acos(cosH) / rad
        val noon = 720 - 4 * lon - eqt + utcOffsetMin
        return (noon - 4 * ha).roundToInt() to (noon + 4 * ha).roundToInt()
    }
}
