package de.fitnessbuddy.app

import android.content.Intent
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.aggregate.AggregateMetric
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.BloodGlucoseRecord
import androidx.health.connect.client.records.BloodPressureRecord
import androidx.health.connect.client.records.BodyFatRecord
import androidx.health.connect.client.records.BodyTemperatureRecord
import androidx.health.connect.client.records.CyclingPedalingCadenceRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ElevationGainedRecord
import androidx.health.connect.client.records.ExerciseRouteResult
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.FloorsClimbedRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.HeartRateVariabilityRmssdRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.records.PowerRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.RespiratoryRateRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SkinTemperatureRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.SpeedRecord
import androidx.health.connect.client.records.StepsCadenceRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.records.Vo2MaxRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.AggregateGroupByDurationRequest
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.Period
import java.time.ZoneId
import kotlin.math.roundToInt
import kotlin.reflect.KClass

/**
 * Health Connect → App: alles, was die Uhr liefert – als kompakte Zusammenfassungen.
 *  - Aktivitäten: Kennzahlen, Puls-/Tempo-Verlauf, Strecke mit Höhe und Zeit, Runden, Trittfrequenz, Leistung
 *  - Schlaf: Phasen-Verlauf, Puls/HRV/Sauerstoff/Atmung in der Nacht, Hauttemperatur
 *  - Tageswerte: Schritte, Strecke, Etagen, Kalorien, Puls (min/max/Ø, stündlich), Ruhepuls, HRV, SpO₂,
 *    Atemfrequenz, VO₂max, Gewicht, Körperfett, Blutdruck, Blutzucker, Körpertemperatur
 * Jeder Datentyp ist optional: fehlt eine Berechtigung, bleibt das Feld einfach leer.
 */
@CapacitorPlugin(name = "HealthBridge")
class HealthBridgePlugin : Plugin() {
    private companion object {
        const val READ_ROUTES = "android.permission.health.READ_EXERCISE_ROUTES"
        /** Daten älter als 30 Tage (vor der ersten Freigabe) */
        const val READ_HISTORY = "android.permission.health.READ_HEALTH_DATA_HISTORY"
        const val SERIES_POINTS = 240
        const val ROUTE_POINTS = 400
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /** Ohne diese Grundrechte gilt die Uhr als „nicht verbunden“. */
    private val coreTypes: List<KClass<out Record>> = listOf(
        ExerciseSessionRecord::class,
        HeartRateRecord::class,
        SleepSessionRecord::class,
        StepsRecord::class,
    )
    private val extraTypes: List<KClass<out Record>> = listOf(
        DistanceRecord::class,
        TotalCaloriesBurnedRecord::class,
        ActiveCaloriesBurnedRecord::class,
        RestingHeartRateRecord::class,
        HeartRateVariabilityRmssdRecord::class,
        ElevationGainedRecord::class,
        FloorsClimbedRecord::class,
        Vo2MaxRecord::class,
        SpeedRecord::class,
        PowerRecord::class,
        StepsCadenceRecord::class,
        CyclingPedalingCadenceRecord::class,
        OxygenSaturationRecord::class,
        RespiratoryRateRecord::class,
        SkinTemperatureRecord::class,
        WeightRecord::class,
        BodyFatRecord::class,
        BloodPressureRecord::class,
        BloodGlucoseRecord::class,
        BodyTemperatureRecord::class,
    )
    private val corePermissions = coreTypes.map { HealthPermission.getReadPermission(it) }.toSet()
    private val permissions: Set<String> =
        corePermissions + extraTypes.map { HealthPermission.getReadPermission(it) } + READ_ROUTES + READ_HISTORY

    private val optional = setOf(READ_ROUTES, READ_HISTORY, HealthPermission.getReadPermission(SkinTemperatureRecord::class))

    private fun client() = HealthConnectClient.getOrCreate(context)

    @PluginMethod
    fun availability(call: PluginCall) {
        val status = when (HealthConnectClient.getSdkStatus(context)) {
            HealthConnectClient.SDK_AVAILABLE -> "available"
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "update_required"
            else -> "not_installed"
        }
        call.resolve(JSObject().put("status", status))
    }

    @PluginMethod
    fun hasPermissions(call: PluginCall) {
        if (HealthConnectClient.getSdkStatus(context) != HealthConnectClient.SDK_AVAILABLE) {
            return call.resolve(JSObject().put("granted", false))
        }
        scope.launch {
            val granted = runCatching { client().permissionController.getGrantedPermissions() }.getOrDefault(emptySet())
            call.resolve(
                JSObject()
                    .put("granted", granted.containsAll(corePermissions))
                    .put("history", READ_HISTORY in granted)
                    // Nur echte Lücken melden – Verlauf, Strecken und Hauttemperatur gibt es nicht auf jedem Gerät
                    .put("missing", JSArray((permissions - granted - optional).map { it.substringAfterLast('.') })),
            )
        }
    }

    @PluginMethod
    fun connect(call: PluginCall) {
        if (HealthConnectClient.getSdkStatus(context) != HealthConnectClient.SDK_AVAILABLE) {
            return call.reject("Health Connect ist nicht installiert")
        }
        val intent = PermissionController.createRequestPermissionResultContract().createIntent(context, permissions)
        startActivityForResult(call, intent, "onPermissionResult")
    }

    @ActivityCallback
    private fun onPermissionResult(call: PluginCall, result: ActivityResult) {
        hasPermissions(call)
    }

    @PluginMethod
    fun openSettings(call: PluginCall) {
        val intent = Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        runCatching { context.startActivity(intent) }
        call.resolve()
    }

    @PluginMethod
    fun read(call: PluginCall) {
        val since = runCatching { Instant.parse(call.getString("since")) }
            .getOrDefault(Instant.now().minus(Duration.ofDays(30)))
        scope.launch {
            try {
                val now = Instant.now()
                val out = JSObject()
                out.put("activities", readActivities(since, now))
                out.put("sleep", readSleep(since, now))
                out.put("daily", readDaily(since, now))
                call.resolve(out)
            } catch (e: Exception) {
                call.reject("Health Connect lesen fehlgeschlagen: ${e.message}")
            }
        }
    }

    // ---------- Aktivitäten ----------

    private fun typeOf(t: Int): String? = when (t) {
        ExerciseSessionRecord.EXERCISE_TYPE_RUNNING, ExerciseSessionRecord.EXERCISE_TYPE_RUNNING_TREADMILL -> "run"
        ExerciseSessionRecord.EXERCISE_TYPE_BIKING, ExerciseSessionRecord.EXERCISE_TYPE_BIKING_STATIONARY -> "ride"
        ExerciseSessionRecord.EXERCISE_TYPE_WALKING -> "walk"
        ExerciseSessionRecord.EXERCISE_TYPE_HIKING -> "hike"
        ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_POOL, ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_OPEN_WATER -> "swim"
        ExerciseSessionRecord.EXERCISE_TYPE_ROWING, ExerciseSessionRecord.EXERCISE_TYPE_ROWING_MACHINE -> "row"
        // Krafttraining tracken wir selbst – keine Doppelten
        ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING, ExerciseSessionRecord.EXERCISE_TYPE_WEIGHTLIFTING -> null
        else -> "other"
    }

    private suspend fun readActivities(since: Instant, now: Instant): JSArray {
        val list = JSArray()
        for (s in readAll(ExerciseSessionRecord::class, since, now)) {
            val type = typeOf(s.exerciseType) ?: continue
            val start = s.startTime
            val range = TimeRangeFilter.between(s.startTime, s.endTime)
            val agg = aggregate(
                range,
                DistanceRecord.DISTANCE_TOTAL,
                TotalCaloriesBurnedRecord.ENERGY_TOTAL,
                ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL,
                HeartRateRecord.BPM_AVG,
                HeartRateRecord.BPM_MAX,
                HeartRateRecord.BPM_MIN,
                ElevationGainedRecord.ELEVATION_GAINED_TOTAL,
                StepsRecord.COUNT_TOTAL,
                PowerRecord.POWER_AVG,
                PowerRecord.POWER_MAX,
                SpeedRecord.SPEED_MAX,
            )
            val sec = { t: Instant -> Duration.between(start, t).seconds.toDouble() }

            val hr = readAll(HeartRateRecord::class, s.startTime, s.endTime)
                .flatMap { r -> r.samples.map { sec(it.time) to it.beatsPerMinute.toDouble() } }
            val speed = readAll(SpeedRecord::class, s.startTime, s.endTime)
                .flatMap { r -> r.samples.map { sec(it.time) to it.speed.inMetersPerSecond } }
            val cadence = (
                readAll(StepsCadenceRecord::class, s.startTime, s.endTime).flatMap { r -> r.samples.map { it.rate } } +
                    readAll(CyclingPedalingCadenceRecord::class, s.startTime, s.endTime)
                        .flatMap { r -> r.samples.map { it.revolutionsPerMinute } }
                ).filter { it > 0 }
            val power = readAll(PowerRecord::class, s.startTime, s.endTime)
                .flatMap { r -> r.samples.map { sec(it.time) to it.power.inWatts } }

            val o = JSObject()
                .put("source_id", s.metadata.id)
                .put("source", appLabel(s.metadata.dataOrigin.packageName))
                .put("type", type)
                .put("title", s.title)
                .put("started_at", s.startTime.toString())
                .put("duration_s", Duration.between(s.startTime, s.endTime).seconds)
                .put("distance_m", agg?.get(DistanceRecord.DISTANCE_TOTAL)?.inMeters)
                .put("kcal", agg?.get(TotalCaloriesBurnedRecord.ENERGY_TOTAL)?.inKilocalories)
                .put("active_kcal", agg?.get(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL)?.inKilocalories)
                .put("avg_hr", agg?.get(HeartRateRecord.BPM_AVG))
                .put("max_hr", agg?.get(HeartRateRecord.BPM_MAX))
                .put("min_hr", agg?.get(HeartRateRecord.BPM_MIN))
                .put("elevation_m", agg?.get(ElevationGainedRecord.ELEVATION_GAINED_TOTAL)?.inMeters)
                .put("steps", agg?.get(StepsRecord.COUNT_TOTAL))
                .put("avg_power", agg?.get(PowerRecord.POWER_AVG)?.inWatts)
                .put("max_power", agg?.get(PowerRecord.POWER_MAX)?.inWatts)
                .put("max_speed", agg?.get(SpeedRecord.SPEED_MAX)?.inMetersPerSecond)
                .put("avg_cadence", if (cadence.isEmpty()) JSObject.NULL else cadence.average().roundToInt())
                .put("hr_series", series(hr, s.duration(), 0))
                .put("speed_series", series(speed, s.duration(), 2))
                .put("power_series", series(power, s.duration(), 0))

            // Strecke: [lat, lng, höhe, sekunde] – für Karte, Höhenprofil und Kilometer-Zeiten
            val route = (s.exerciseRouteResult as? ExerciseRouteResult.Data)?.exerciseRoute?.route
            if (!route.isNullOrEmpty()) {
                val step = (route.size / ROUTE_POINTS).coerceAtLeast(1)
                val pts = JSArray()
                route.filterIndexed { i, _ -> i % step == 0 || i == route.lastIndex }.forEach {
                    pts.put(
                        JSArray()
                            .put(round(it.latitude, 5))
                            .put(round(it.longitude, 5))
                            .put(it.altitude?.inMeters?.let { a -> round(a, 1) } ?: JSObject.NULL)
                            .put(sec(it.time).toLong()),
                    )
                }
                o.put("route", pts)
            } else {
                o.put("route", JSObject.NULL)
            }

            // Runden (z. B. automatisch je Kilometer von der Uhr)
            if (s.laps.isNotEmpty()) {
                val laps = JSArray()
                s.laps.forEach {
                    laps.put(
                        JSObject()
                            .put("start_s", sec(it.startTime).toLong())
                            .put("end_s", sec(it.endTime).toLong())
                            .put("length_m", it.length?.inMeters ?: JSObject.NULL),
                    )
                }
                o.put("laps", laps)
            } else {
                o.put("laps", JSObject.NULL)
            }
            list.put(o)
        }
        return list
    }

    // ---------- Schlaf ----------

    private suspend fun readSleep(since: Instant, now: Instant): JSArray {
        val list = JSArray()
        val zone = ZoneId.systemDefault()
        // Pro Aufwach-Tag die längste Schlafphase (Mittagsschlaf zählt nicht als Nacht)
        val byDay = readAll(SleepSessionRecord::class, since, now)
            .groupBy { it.endTime.atZone(zone).toLocalDate() }
            .mapValues { (_, v) -> v.maxBy { Duration.between(it.startTime, it.endTime) } }
        for ((day, s) in byDay) {
            fun minutes(vararg types: Int) = s.stages
                .filter { it.stage in types }
                .sumOf { Duration.between(it.startTime, it.endTime).toMinutes() }
            val inBed = Duration.between(s.startTime, s.endTime).toMinutes()
            val awake = minutes(SleepSessionRecord.STAGE_TYPE_AWAKE, SleepSessionRecord.STAGE_TYPE_OUT_OF_BED, SleepSessionRecord.STAGE_TYPE_AWAKE_IN_BED)
            val hasStages = s.stages.isNotEmpty()
            val min = { t: Instant -> Duration.between(s.startTime, t).toMinutes() }

            // Phasen-Verlauf: [startMinute, dauer, phase] – 1 wach, 2 leicht, 3 tief, 4 REM, 5 Schlaf (unbekannt)
            val stages = JSArray()
            s.stages.sortedBy { it.startTime }.forEach {
                val code = when (it.stage) {
                    SleepSessionRecord.STAGE_TYPE_AWAKE, SleepSessionRecord.STAGE_TYPE_OUT_OF_BED,
                    SleepSessionRecord.STAGE_TYPE_AWAKE_IN_BED -> 1
                    SleepSessionRecord.STAGE_TYPE_LIGHT -> 2
                    SleepSessionRecord.STAGE_TYPE_DEEP -> 3
                    SleepSessionRecord.STAGE_TYPE_REM -> 4
                    else -> 5
                }
                stages.put(JSArray().put(min(it.startTime)).put(Duration.between(it.startTime, it.endTime).toMinutes()).put(code))
            }
            val firstSleep = s.stages.filter { it.stage !in listOf(SleepSessionRecord.STAGE_TYPE_AWAKE, SleepSessionRecord.STAGE_TYPE_OUT_OF_BED, SleepSessionRecord.STAGE_TYPE_AWAKE_IN_BED) }
                .minByOrNull { it.startTime }
            val awakenings = s.stages.count {
                it.stage == SleepSessionRecord.STAGE_TYPE_AWAKE && firstSleep != null && it.startTime > firstSleep.startTime
            }

            // Körperwerte während der Nacht
            val hr = readAll(HeartRateRecord::class, s.startTime, s.endTime)
                .flatMap { r -> r.samples.map { min(it.time).toDouble() to it.beatsPerMinute.toDouble() } }
            val hrv = readAll(HeartRateVariabilityRmssdRecord::class, s.startTime, s.endTime).map { it.heartRateVariabilityMillis }
            val spo2 = readAll(OxygenSaturationRecord::class, s.startTime, s.endTime).map { it.percentage.value }
            val resp = readAll(RespiratoryRateRecord::class, s.startTime, s.endTime).map { it.rate }
            val skin = readAll(SkinTemperatureRecord::class, s.startTime, s.endTime)
                .flatMap { r -> r.deltas.map { it.delta.inCelsius } }

            list.put(
                JSObject()
                    .put("date", day.toString())
                    .put("start_at", s.startTime.toString())
                    .put("end_at", s.endTime.toString())
                    .put("in_bed_min", inBed)
                    .put("asleep_min", inBed - awake)
                    .put("deep_min", if (hasStages) minutes(SleepSessionRecord.STAGE_TYPE_DEEP) else JSObject.NULL)
                    .put("rem_min", if (hasStages) minutes(SleepSessionRecord.STAGE_TYPE_REM) else JSObject.NULL)
                    .put("light_min", if (hasStages) minutes(SleepSessionRecord.STAGE_TYPE_LIGHT) else JSObject.NULL)
                    .put("awake_min", if (hasStages) awake else JSObject.NULL)
                    .put("latency_min", firstSleep?.let { min(it.startTime) } ?: JSObject.NULL)
                    .put("awakenings", if (hasStages) awakenings else JSObject.NULL)
                    .put("stages", if (hasStages) stages else JSObject.NULL)
                    .put("hr_avg", avgOrNull(hr.map { it.second }))
                    .put("hr_min", hr.minOfOrNull { it.second }?.roundToInt() ?: JSObject.NULL)
                    .put("hr_series", series(hr, s.duration().toMinutes(), 0, 120))
                    .put("hrv_avg", avgOrNull(hrv))
                    .put("spo2_avg", avgOrNull(spo2))
                    .put("spo2_min", spo2.minOrNull()?.let { round(it, 1) } ?: JSObject.NULL)
                    .put("resp_rate", avgOrNull(resp))
                    .put("skin_temp_delta", avgOrNull(skin, 2))
                    .put("source", appLabel(s.metadata.dataOrigin.packageName)),
            )
        }
        return list
    }

    // ---------- Tageswerte ----------

    private suspend fun readDaily(since: Instant, now: Instant): JSArray {
        val zone = ZoneId.systemDefault()
        val from = since.atZone(zone).toLocalDate()
        val to = LocalDate.now(zone).plusDays(1)
        val days = mutableMapOf<LocalDate, JSObject>()
        fun day(d: LocalDate) = days.getOrPut(d) { JSObject().put("date", d.toString()) }

        val metrics: Set<AggregateMetric<*>> = setOf(
            StepsRecord.COUNT_TOTAL,
            DistanceRecord.DISTANCE_TOTAL,
            FloorsClimbedRecord.FLOORS_CLIMBED_TOTAL,
            ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL,
            TotalCaloriesBurnedRecord.ENERGY_TOTAL,
            RestingHeartRateRecord.BPM_AVG,
            HeartRateRecord.BPM_MIN,
            HeartRateRecord.BPM_MAX,
            HeartRateRecord.BPM_AVG,
        )
        // Einzeln abfragen: fehlt eine Berechtigung, scheitert nur dieser Wert
        for (m in metrics) {
            val groups = runCatching {
                client().aggregateGroupByPeriod(
                    AggregateGroupByPeriodRequest(
                        metrics = setOf(m),
                        timeRangeFilter = TimeRangeFilter.between(from.atStartOfDay(), to.atStartOfDay()),
                        timeRangeSlicer = Period.ofDays(1),
                    ),
                )
            }.getOrDefault(emptyList())
            for (g in groups) {
                val v = g.result[m] ?: continue
                val d = day(g.startTime.toLocalDate())
                when (m) {
                    StepsRecord.COUNT_TOTAL -> d.put("steps", v)
                    DistanceRecord.DISTANCE_TOTAL -> d.put("distance_m", (v as androidx.health.connect.client.units.Length).inMeters.roundToInt())
                    FloorsClimbedRecord.FLOORS_CLIMBED_TOTAL -> d.put("floors", (v as Double).roundToInt())
                    ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL -> d.put("active_kcal", (v as androidx.health.connect.client.units.Energy).inKilocalories.roundToInt())
                    TotalCaloriesBurnedRecord.ENERGY_TOTAL -> d.put("total_kcal", (v as androidx.health.connect.client.units.Energy).inKilocalories.roundToInt())
                    RestingHeartRateRecord.BPM_AVG -> d.put("resting_hr", v)
                    HeartRateRecord.BPM_MIN -> d.put("hr_min", v)
                    HeartRateRecord.BPM_MAX -> d.put("hr_max", v)
                    HeartRateRecord.BPM_AVG -> d.put("hr_avg", v)
                }
            }
        }

        // Puls je Stunde (Tagesverlauf)
        val hourly = runCatching {
            client().aggregateGroupByDuration(
                AggregateGroupByDurationRequest(
                    metrics = setOf(HeartRateRecord.BPM_AVG),
                    timeRangeFilter = TimeRangeFilter.between(since, now),
                    timeRangeSlicer = Duration.ofHours(1),
                ),
            )
        }.getOrDefault(emptyList())
        hourly.groupBy { it.startTime.atZone(zone).toLocalDate() }.forEach { (d, rows) ->
            val arr = arrayOfNulls<Long>(24)
            rows.forEach { r -> r.result[HeartRateRecord.BPM_AVG]?.let { arr[r.startTime.atZone(zone).hour] = it } }
            val js = JSArray()
            arr.forEach { js.put(it ?: JSObject.NULL) }
            day(d).put("hr_hourly", js)
        }

        // Einzelmessungen → Tagesmittel bzw. letzter Wert des Tages
        fun <T : Record> perDay(rows: List<T>, time: (T) -> Instant) = rows.groupBy { time(it).atZone(zone).toLocalDate() }
        perDay(readAll(HeartRateVariabilityRmssdRecord::class, since, now)) { it.time }
            .forEach { (d, v) -> day(d).put("hrv_ms", round(v.map { it.heartRateVariabilityMillis }.average(), 1)) }
        perDay(readAll(OxygenSaturationRecord::class, since, now)) { it.time }
            .forEach { (d, v) -> day(d).put("spo2", round(v.map { it.percentage.value }.average(), 1)) }
        perDay(readAll(RespiratoryRateRecord::class, since, now)) { it.time }
            .forEach { (d, v) -> day(d).put("resp_rate", round(v.map { it.rate }.average(), 1)) }
        perDay(readAll(Vo2MaxRecord::class, since, now)) { it.time }
            .forEach { (d, v) -> day(d).put("vo2max", round(v.maxBy { it.time }.vo2MillilitersPerMinuteKilogram, 1)) }
        perDay(readAll(WeightRecord::class, since, now)) { it.time }
            .forEach { (d, v) -> day(d).put("weight_kg", round(v.maxBy { it.time }.weight.inKilograms, 1)) }
        perDay(readAll(BodyFatRecord::class, since, now)) { it.time }
            .forEach { (d, v) -> day(d).put("body_fat_pct", round(v.maxBy { it.time }.percentage.value, 1)) }
        perDay(readAll(BloodPressureRecord::class, since, now)) { it.time }.forEach { (d, v) ->
            val last = v.maxBy { it.time }
            day(d).put("bp_sys", last.systolic.inMillimetersOfMercury.roundToInt())
                .put("bp_dia", last.diastolic.inMillimetersOfMercury.roundToInt())
        }
        perDay(readAll(BloodGlucoseRecord::class, since, now)) { it.time }
            .forEach { (d, v) -> day(d).put("glucose_mmol", round(v.map { it.level.inMillimolesPerLiter }.average(), 1)) }
        perDay(readAll(BodyTemperatureRecord::class, since, now)) { it.time }
            .forEach { (d, v) -> day(d).put("body_temp_c", round(v.maxBy { it.time }.temperature.inCelsius, 1)) }

        val keys = listOf(
            "steps", "distance_m", "floors", "active_kcal", "total_kcal", "resting_hr", "hr_min", "hr_max", "hr_avg",
            "hr_hourly", "hrv_ms", "spo2", "resp_rate", "vo2max", "weight_kg", "body_fat_pct", "bp_sys", "bp_dia",
            "glucose_mmol", "body_temp_c",
        )
        val list = JSArray()
        for (d in days.values) {
            for (k in keys) if (!d.has(k)) d.put(k, JSObject.NULL)
            list.put(d)
        }
        return list
    }

    // ---------- Hilfen ----------

    /** Alle Einträge eines Typs; fehlt die Berechtigung, eine leere Liste statt eines Fehlers. */
    private suspend fun <T : Record> readAll(type: KClass<T>, since: Instant, now: Instant): List<T> {
        val out = mutableListOf<T>()
        var token: String? = null
        try {
            do {
                val res = client().readRecords(
                    ReadRecordsRequest(type, TimeRangeFilter.between(since, now), pageSize = 1000, pageToken = token),
                )
                out += res.records
                token = res.pageToken
            } while (token != null && out.size < 20000)
        } catch (_: SecurityException) {
            return emptyList()
        } catch (_: IllegalStateException) {
            return out
        }
        return out
    }

    private suspend fun aggregate(range: TimeRangeFilter, vararg metrics: AggregateMetric<*>) = runCatching {
        // Erst alles zusammen; scheitert das (fehlende Berechtigung), einzeln mit dem, was erlaubt ist
        client().aggregate(AggregateRequest(metrics = metrics.toSet(), timeRangeFilter = range))
    }.getOrNull() ?: runCatching {
        val granted = client().permissionController.getGrantedPermissions()
        val ok = metrics.filter { m ->
            val t = when (m) {
                DistanceRecord.DISTANCE_TOTAL -> DistanceRecord::class
                TotalCaloriesBurnedRecord.ENERGY_TOTAL -> TotalCaloriesBurnedRecord::class
                ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL -> ActiveCaloriesBurnedRecord::class
                ElevationGainedRecord.ELEVATION_GAINED_TOTAL -> ElevationGainedRecord::class
                StepsRecord.COUNT_TOTAL -> StepsRecord::class
                PowerRecord.POWER_AVG, PowerRecord.POWER_MAX -> PowerRecord::class
                SpeedRecord.SPEED_MAX -> SpeedRecord::class
                else -> HeartRateRecord::class
            }
            HealthPermission.getReadPermission(t) in granted
        }
        if (ok.isEmpty()) null else client().aggregate(AggregateRequest(metrics = ok.toSet(), timeRangeFilter = range))
    }.getOrNull()

    /** Zeitreihe auf höchstens `points` Mittelwerte verdichten: [[zeit, wert], …] */
    private fun series(samples: List<Pair<Double, Double>>, total: Long, decimals: Int, points: Int = SERIES_POINTS): Any {
        if (samples.isEmpty()) return JSObject.NULL
        val span = total.coerceAtLeast(1).toDouble()
        val n = minOf(points, samples.size)
        val buckets = Array(n) { mutableListOf<Double>() }
        samples.forEach { (t, v) -> buckets[((t / span) * n).toInt().coerceIn(0, n - 1)].add(v) }
        val out = JSArray()
        buckets.forEachIndexed { i, b ->
            if (b.isNotEmpty()) out.put(JSArray().put(((i + 0.5) * span / n).roundToInt()).put(round(b.average(), decimals)))
        }
        return out
    }

    private fun ExerciseSessionRecord.duration(): Long = Duration.between(startTime, endTime).seconds
    private fun SleepSessionRecord.duration(): Duration = Duration.between(startTime, endTime)

    private fun avgOrNull(v: List<Double>, decimals: Int = 1): Any =
        if (v.isEmpty()) JSObject.NULL else round(v.average(), decimals)

    private fun round(v: Double, decimals: Int): Double {
        var f = 1.0
        repeat(decimals) { f *= 10 }
        return Math.round(v * f) / f
    }

    private fun appLabel(pkg: String): String = runCatching {
        val pm = context.packageManager
        pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
    }.getOrDefault(pkg)
}
