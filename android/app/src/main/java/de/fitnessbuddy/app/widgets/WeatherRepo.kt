package de.fitnessbuddy.app.widgets

import android.content.Context
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.abs

/**
 * Wetter für die Outdoor-Widgets: Bright Sky (offene Daten des Deutschen Wetterdienstes, ohne Schlüssel).
 * Der Ort kommt aus der App (grob gerundet, nur auf dem Gerät). Abruf höchstens alle 30 min,
 * Ergebnis im Zwischenspeicher, damit das Widget auch offline etwas zeigt.
 */
object WeatherRepo {
    private const val PREFS = "weather"
    private const val KEY = "cache"
    private const val KEY_TRY = "lastTry"
    private const val MAX_AGE_MS = 30 * 60_000L
    private const val RETRY_MS = 10 * 60_000L
    private val busy = AtomicBoolean(false)

    class Now(val temp: Double, val wind: Double, val windDeg: Double?, val gust: Double?, val icon: String?)

    class Cache(val lat: Double, val lon: Double, val fetchedAt: Long, val now: Now?, val hours: List<Hour>)

    /** Ort aus dem Snapshot der App ({"weather": {"lat":…, "lon":…}}). */
    internal fun location(s: Snap): Pair<Double, Double>? {
        val o = s.obj("weather") ?: return null
        val lat = o.optDouble("lat")
        val lon = o.optDouble("lon")
        if (lat.isNaN() || lon.isNaN() || abs(lat) > 90 || abs(lon) > 180) return null
        return lat to lon
    }

    fun load(ctx: Context): Cache? = runCatching {
        val j = JSONObject(prefs(ctx).getString(KEY, null) ?: return null)
        val nowJ = j.optJSONObject("now")
        val today = LocalDate.now().toString()
        val day = j.optString("day")
        // Stunden liegen als Datum + Stunde vor, damit „heute/morgen“ auch nach Mitternacht stimmt
        val hours = j.optJSONArray("hours")?.let { arr ->
            (0 until arr.length()).mapNotNull { i ->
                val h = arr.getJSONObject(i)
                val date = h.optString("date")
                val offset = when (date) {
                    today -> 0
                    LocalDate.now().plusDays(1).toString() -> 1
                    else -> return@mapNotNull null
                }
                Hour(
                    offset,
                    h.getInt("h"),
                    h.getDouble("t"),
                    if (h.has("p")) h.getInt("p") else null,
                    h.optDouble("mm", 0.0),
                    h.optDouble("w", 0.0),
                    if (h.has("g")) h.getDouble("g") else null,
                    h.optString("i").ifEmpty { null },
                )
            }
        } ?: emptyList()
        Cache(
            j.getDouble("lat"),
            j.getDouble("lon"),
            j.getLong("at"),
            nowJ?.let {
                Now(
                    it.getDouble("t"),
                    it.optDouble("w", 0.0),
                    if (it.has("d")) it.getDouble("d") else null,
                    if (it.has("g")) it.getDouble("g") else null,
                    it.optString("i").ifEmpty { null },
                )
            }.takeIf { day == today },
            hours,
        )
    }.getOrNull()

    /** Braucht es einen neuen Abruf (kein/alter Stand, anderer Ort)? */
    fun stale(ctx: Context, lat: Double, lon: Double): Boolean {
        val lastTry = prefs(ctx).getLong(KEY_TRY, 0)
        if (System.currentTimeMillis() - lastTry < RETRY_MS) return false
        val c = load(ctx) ?: return true
        val moved = abs(c.lat - lat) > 0.05 || abs(c.lon - lon) > 0.05
        return moved || System.currentTimeMillis() - c.fetchedAt > MAX_AGE_MS
    }

    /** Im Hintergrund laden, danach [done] (auch bei Fehlern). */
    fun refreshAsync(ctx: Context, lat: Double, lon: Double, done: () -> Unit) {
        if (!busy.compareAndSet(false, true)) return done()
        prefs(ctx).edit().putLong(KEY_TRY, System.currentTimeMillis()).apply()
        Thread {
            try {
                fetch(ctx, lat, lon)
            } catch (e: Exception) {
                Log.w("Weather", "Abruf fehlgeschlagen: ${e.message}")
            } finally {
                busy.set(false)
                done()
            }
        }.start()
    }

    private fun get(url: String): JSONObject {
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 8000
        c.readTimeout = 8000
        c.setRequestProperty("User-Agent", "FitnessBuddy-Android")
        c.setRequestProperty("Accept", "application/json")
        try {
            if (c.responseCode != 200) throw IllegalStateException("HTTP ${c.responseCode}")
            return JSONObject(c.inputStream.bufferedReader().use { it.readText() })
        } finally {
            c.disconnect()
        }
    }

    private fun fetch(ctx: Context, lat: Double, lon: Double) {
        val zone = ZoneId.systemDefault()
        val tz = URLEncoder.encode(zone.id, "UTF-8")
        val ll = "lat=${"%.3f".format(java.util.Locale.US, lat)}&lon=${"%.3f".format(java.util.Locale.US, lon)}"
        val today = LocalDate.now(zone)
        val cur = runCatching { get("https://api.brightsky.dev/current_weather?$ll&tz=$tz").optJSONObject("weather") }.getOrNull()
        val fc = get("https://api.brightsky.dev/weather?$ll&date=$today&last_date=${today.plusDays(2)}&tz=$tz")
            .optJSONArray("weather") ?: JSONArray()

        val hours = JSONArray()
        for (i in 0 until fc.length()) {
            val w = fc.getJSONObject(i)
            val t = w.optDouble("temperature")
            if (t.isNaN()) continue
            val at = OffsetDateTime.parse(w.getString("timestamp")).atZoneSameInstant(zone)
            hours.put(
                JSONObject()
                    .put("date", at.toLocalDate().toString())
                    .put("h", at.hour)
                    .put("t", t)
                    .put("mm", w.optDouble("precipitation", 0.0).let { if (it.isNaN()) 0.0 else it })
                    .put("w", w.optDouble("wind_speed", 0.0).let { if (it.isNaN()) 0.0 else it })
                    .put("i", w.optString("icon").takeIf { it != "null" } ?: "")
                    .apply {
                        if (!w.isNull("precipitation_probability")) put("p", w.getInt("precipitation_probability"))
                        if (!w.isNull("wind_gust_speed")) put("g", w.getDouble("wind_gust_speed"))
                    },
            )
        }
        val now = cur?.let { w ->
            val t = w.optDouble("temperature")
            if (t.isNaN()) null else JSONObject()
                .put("t", t)
                .put("w", w.optDouble("wind_speed_10", 0.0).let { if (it.isNaN()) 0.0 else it })
                .put("i", w.optString("icon").takeIf { it != "null" } ?: "")
                .apply {
                    if (!w.isNull("wind_direction_10")) put("d", w.getDouble("wind_direction_10"))
                    if (!w.isNull("wind_gust_speed_10")) put("g", w.getDouble("wind_gust_speed_10"))
                }
        }
        val j = JSONObject()
            .put("lat", lat)
            .put("lon", lon)
            .put("at", System.currentTimeMillis())
            .put("day", today.toString())
            .put("hours", hours)
        if (now != null) j.put("now", now)
        prefs(ctx).edit().putString(KEY, j.toString()).apply()
    }

    private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
