package de.fitnessbuddy.app

import android.content.Intent
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ElevationGainedRecord
import androidx.health.connect.client.records.ExerciseRouteResult
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.HeartRateVariabilityRmssdRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.records.Vo2MaxRecord
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
import kotlin.reflect.KClass

/**
 * Health Connect → App: Ausdauer-Einheiten (mit Strecke), Schlaf und Tageswerte.
 * Liefert nur Zusammenfassungen – Rohdaten (jeder Pulsschlag) bleiben auf dem Handy.
 */
@CapacitorPlugin(name = "HealthBridge")
class HealthBridgePlugin : Plugin() {
    private companion object {
        /** Strecken-Zugriff (wird pro Einheit oder dauerhaft in Health Connect erlaubt) */
        const val READ_ROUTES = "android.permission.health.READ_EXERCISE_ROUTES"
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val readTypes: List<KClass<out Record>> = listOf(
        ExerciseSessionRecord::class,
        DistanceRecord::class,
        TotalCaloriesBurnedRecord::class,
        ActiveCaloriesBurnedRecord::class,
        HeartRateRecord::class,
        RestingHeartRateRecord::class,
        HeartRateVariabilityRmssdRecord::class,
        ElevationGainedRecord::class,
        SleepSessionRecord::class,
        StepsRecord::class,
        Vo2MaxRecord::class,
    )
    private val permissions: Set<String> =
        readTypes.map { HealthPermission.getReadPermission(it) }.toSet() + READ_ROUTES

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
            // Strecken sind optional – der Rest muss da sein
            val needed = permissions - READ_ROUTES
            call.resolve(JSObject().put("granted", granted.containsAll(needed)))
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
        val sessions = readAll(ExerciseSessionRecord::class, since, now)
        for (s in sessions) {
            val type = typeOf(s.exerciseType) ?: continue
            val range = TimeRangeFilter.between(s.startTime, s.endTime)
            val agg = runCatching {
                client().aggregate(
                    AggregateRequest(
                        metrics = setOf(
                            DistanceRecord.DISTANCE_TOTAL,
                            TotalCaloriesBurnedRecord.ENERGY_TOTAL,
                            HeartRateRecord.BPM_AVG,
                            HeartRateRecord.BPM_MAX,
                            ElevationGainedRecord.ELEVATION_GAINED_TOTAL,
                        ),
                        timeRangeFilter = range,
                    ),
                )
            }.getOrNull()
            val route = (s.exerciseRouteResult as? ExerciseRouteResult.Data)?.exerciseRoute?.route
            val o = JSObject()
                .put("source_id", s.metadata.id)
                .put("source", appLabel(s.metadata.dataOrigin.packageName))
                .put("type", type)
                .put("title", s.title)
                .put("started_at", s.startTime.toString())
                .put("duration_s", Duration.between(s.startTime, s.endTime).seconds)
                .put("distance_m", agg?.get(DistanceRecord.DISTANCE_TOTAL)?.inMeters)
                .put("kcal", agg?.get(TotalCaloriesBurnedRecord.ENERGY_TOTAL)?.inKilocalories)
                .put("avg_hr", agg?.get(HeartRateRecord.BPM_AVG))
                .put("max_hr", agg?.get(HeartRateRecord.BPM_MAX))
                .put("elevation_m", agg?.get(ElevationGainedRecord.ELEVATION_GAINED_TOTAL)?.inMeters)
            if (!route.isNullOrEmpty()) {
                // Auf höchstens ~200 Punkte ausdünnen (Platz in der Datenbank sparen)
                val step = (route.size / 200).coerceAtLeast(1)
                val pts = JSArray()
                route.filterIndexed { i, _ -> i % step == 0 || i == route.lastIndex }.forEach {
                    pts.put(JSArray().put(round5(it.latitude)).put(round5(it.longitude)))
                }
                o.put("route", pts)
            } else {
                o.put("route", JSObject.NULL)
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
            val total = Duration.between(s.startTime, s.endTime).toMinutes()
            val awake = minutes(SleepSessionRecord.STAGE_TYPE_AWAKE, SleepSessionRecord.STAGE_TYPE_OUT_OF_BED)
            val hasStages = s.stages.isNotEmpty()
            list.put(
                JSObject()
                    .put("date", day.toString())
                    .put("start_at", s.startTime.toString())
                    .put("end_at", s.endTime.toString())
                    .put("asleep_min", total - awake)
                    .put("deep_min", if (hasStages) minutes(SleepSessionRecord.STAGE_TYPE_DEEP) else JSObject.NULL)
                    .put("rem_min", if (hasStages) minutes(SleepSessionRecord.STAGE_TYPE_REM) else JSObject.NULL)
                    .put("light_min", if (hasStages) minutes(SleepSessionRecord.STAGE_TYPE_LIGHT) else JSObject.NULL)
                    .put("awake_min", if (hasStages) awake else JSObject.NULL)
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

        val groups = client().aggregateGroupByPeriod(
            AggregateGroupByPeriodRequest(
                metrics = setOf(
                    StepsRecord.COUNT_TOTAL,
                    ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL,
                    RestingHeartRateRecord.BPM_AVG,
                ),
                timeRangeFilter = TimeRangeFilter.between(from.atStartOfDay(), to.atStartOfDay()),
                timeRangeSlicer = Period.ofDays(1),
            ),
        )
        for (g in groups) {
            val d = day(g.startTime.toLocalDate())
            g.result[StepsRecord.COUNT_TOTAL]?.let { d.put("steps", it) }
            g.result[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.let { d.put("active_kcal", it.inKilocalories) }
            g.result[RestingHeartRateRecord.BPM_AVG]?.let { d.put("resting_hr", it) }
        }
        // HRV: Durchschnitt pro Tag (meist nachts gemessen)
        readAll(HeartRateVariabilityRmssdRecord::class, since, now)
            .groupBy { it.time.atZone(zone).toLocalDate() }
            .forEach { (d, v) -> day(d).put("hrv_ms", v.map { it.heartRateVariabilityMillis }.average()) }
        readAll(Vo2MaxRecord::class, since, now)
            .groupBy { it.time.atZone(zone).toLocalDate() }
            .forEach { (d, v) -> day(d).put("vo2max", v.last().vo2MillilitersPerMinuteKilogram) }

        val list = JSArray()
        for (d in days.values) {
            for (k in listOf("steps", "active_kcal", "resting_hr", "hrv_ms", "vo2max")) if (!d.has(k)) d.put(k, JSObject.NULL)
            list.put(d)
        }
        return list
    }

    // ---------- Hilfen ----------

    private suspend fun <T : Record> readAll(type: KClass<T>, since: Instant, now: Instant): List<T> {
        val out = mutableListOf<T>()
        var token: String? = null
        do {
            val res = client().readRecords(
                ReadRecordsRequest(type, TimeRangeFilter.between(since, now), pageSize = 500, pageToken = token),
            )
            out += res.records
            token = res.pageToken
        } while (token != null && out.size < 5000)
        return out
    }

    private fun round5(v: Double) = Math.round(v * 100000.0) / 100000.0

    private fun appLabel(pkg: String): String = runCatching {
        val pm = context.packageManager
        pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
    }.getOrDefault(pkg)
}
