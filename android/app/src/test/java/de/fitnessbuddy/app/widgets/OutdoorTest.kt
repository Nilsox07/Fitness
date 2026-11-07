package de.fitnessbuddy.app.widgets

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OutdoorTest {
    private fun h(hour: Int, temp: Double = 11.0, prob: Int = 5, mm: Double = 0.0, wind: Double = 8.0, day: Int = 0, gust: Double? = null) =
        Hour(day, hour, temp, prob, mm, wind, gust, "cloudy")

    @Test
    fun gefuehlteTemperatur() {
        assertEquals(20.0, Outdoor.feelsLike(20.0, 30.0), 0.01)
        assertEquals(-2.05, Outdoor.feelsLike(3.0, 25.0), 0.1)
        assertEquals(5.0, Outdoor.feelsLike(5.0, 2.0), 0.01)
    }

    @Test
    fun kleidung() {
        assertEquals("Langarm + Tights", Outdoor.clothing(2.0, false, Sport.RUN))
        assertEquals("Kurz + kurz + Regenjacke", Outdoor.clothing(18.0, true, Sport.RUN))
        assertEquals("Langarm + Weste", Outdoor.clothing(10.0, false, Sport.BIKE))
    }

    @Test
    fun besteStundeMeidetRegenUndDunkelheit() {
        val hours = listOf(h(14, prob = 80, mm = 1.2), h(15, prob = 10), h(16, prob = 5, temp = 9.0), h(18, prob = 0))
        // Sonnenuntergang 16:40 → 18 Uhr fällt raus
        val best = Outdoor.bestHour(hours, 14, 7 * 60, 16 * 60 + 40, Sport.RUN)
        assertEquals(15, best?.hour)
    }

    @Test
    fun abendsBesteStundeMorgen() {
        val hours = listOf(h(20), h(9, day = 1, prob = 60), h(11, day = 1, prob = 0))
        val best = Outdoor.bestHour(hours, 19, 7 * 60, 17 * 60, Sport.RUN)
        assertEquals(1, best?.dayOffset)
        assertEquals(11, best?.hour)
    }

    @Test
    fun ueberschriften() {
        val rain = listOf(h(10, prob = 90, mm = 2.0), h(11, prob = 70, mm = 0.5), h(12, prob = 10))
        assertEquals("Regen bis 12 Uhr", Outdoor.headline(rain, 10, Sport.RUN).first)
        val later = listOf(h(10), h(11), h(12, prob = 80, mm = 1.0))
        assertEquals("Ab 12 Uhr Regen", Outdoor.headline(later, 10, Sport.RUN).first)
        val ice = listOf(h(7, temp = 0.0, prob = 60, mm = 0.4))
        assertEquals(Verdict.BAD, Outdoor.headline(ice, 7, Sport.RUN).second)
        val nice = listOf(h(10, temp = 11.0, wind = 6.0))
        assertEquals("Top Laufwetter", Outdoor.headline(nice, 10, Sport.RUN).first)
        val windy = listOf(h(10, temp = 16.0, wind = 32.0))
        assertTrue(Outdoor.headline(windy, 10, Sport.BIKE).first.contains("Gegenwind"))
    }

    @Test
    fun trockenAbNurWennEsGeradeRegnet() {
        assertNull(Outdoor.dryFrom(listOf(h(10), h(11, prob = 90, mm = 1.0)), 10))
    }

    @Test
    fun sonnenzeitenBerlin() {
        // Berlin, 7. November (Tag 311), MEZ = UTC+60: Aufgang ~7:08, Untergang ~16:25
        val s = Outdoor.sun(52.52, 13.4, 311, 60)
        assertNotNull(s)
        assertEquals(7 * 60 + 8.0, s!!.first.toDouble(), 6.0)
        assertEquals(16 * 60 + 25.0, s.second.toDouble(), 6.0)
    }

    @Test
    fun windrichtung() {
        assertEquals("SW", Outdoor.windDir(225.0))
        assertEquals("N", Outdoor.windDir(355.0))
        assertEquals("", Outdoor.windDir(null))
    }
}
