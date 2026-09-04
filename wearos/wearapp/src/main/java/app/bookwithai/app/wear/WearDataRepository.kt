package app.bookwithai.app.wear

import android.content.Context
import com.google.android.gms.wearable.DataMap
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONArray
import org.json.JSONObject

data class WearAppointment(
    val id: String,
    val customerName: String,
    val serviceName: String,
    val startsAtIso: String,
    val endsAtIso: String?,
    val staffName: String?,
    val status: String,
)

data class WearSchedule(
    val next: WearAppointment?,
    val today: List<WearAppointment>,
    val todayCount: Int,
    val syncedAtMillis: Long,
)

/** P4 — one-shot reply to a "when is my next opening" round-trip request. Null fields mean none was found. */
data class NextOpeningResult(
    val startsAtIso: String?,
    val endsAtIso: String?,
    val answeredAtMillis: Long,
)

/** P5 — one-shot reply to a Start/Complete action request. */
data class ActionResult(
    val action: String,
    val bookingId: String,
    val success: Boolean,
    val error: String?,
    val answeredAtMillis: Long,
)

/** P6 — which experience this watch should show. Persisted like the schedule (not transient). */
enum class WearRole { OWNER, CUSTOMER, UNKNOWN }

data class CustomerAppointment(
    val id: String,
    val salonName: String,
    val serviceName: String,
    val startsAtIso: String,
    val endsAtIso: String?,
    val status: String,
)

data class CustomerSchedule(
    val next: CustomerAppointment?,
    val syncedAtMillis: Long,
)

/** P6 — one-shot reply to a customer I've-Arrived/Running-Late/Cancel request. */
data class CustomerActionResult(
    val action: String,
    val bookingId: String,
    val success: Boolean,
    val error: String?,
    val answeredAtMillis: Long,
)

private const val PREFS_NAME = "bwa_wear_schedule"
private const val KEY_JSON = "schedule_json"
private const val KEY_CUSTOMER_JSON = "customer_schedule_json"
private const val KEY_ROLE = "role"

private fun CustomerAppointment.toJson(): JSONObject = JSONObject().apply {
    put("id", id)
    put("salon_name", salonName)
    put("service_name", serviceName)
    put("starts_at", startsAtIso)
    put("ends_at", endsAtIso ?: "")
    put("status", status)
}

private fun jsonToCustomerAppointment(o: JSONObject): CustomerAppointment = CustomerAppointment(
    id = o.optString("id"),
    salonName = o.optString("salon_name"),
    serviceName = o.optString("service_name"),
    startsAtIso = o.optString("starts_at"),
    endsAtIso = o.optString("ends_at").ifEmpty { null },
    status = o.optString("status"),
)

private fun CustomerSchedule.toJson(): String {
    val root = JSONObject()
    next?.let { root.put("next", it.toJson()) }
    root.put("synced_at", syncedAtMillis)
    return root.toString()
}

private fun jsonToCustomerSchedule(raw: String): CustomerSchedule {
    val root = JSONObject(raw)
    val next = if (root.has("next")) jsonToCustomerAppointment(root.getJSONObject("next")) else null
    return CustomerSchedule(next = next, syncedAtMillis = root.optLong("synced_at", 0L))
}

private fun WearAppointment.toJson(): JSONObject = JSONObject().apply {
    put("id", id)
    put("customer_name", customerName)
    put("service_name", serviceName)
    put("starts_at", startsAtIso)
    put("ends_at", endsAtIso ?: "")
    put("staff_name", staffName ?: "")
    put("status", status)
}

private fun jsonToAppointment(o: JSONObject): WearAppointment = WearAppointment(
    id = o.optString("id"),
    customerName = o.optString("customer_name"),
    serviceName = o.optString("service_name"),
    startsAtIso = o.optString("starts_at"),
    endsAtIso = o.optString("ends_at").ifEmpty { null },
    staffName = o.optString("staff_name").ifEmpty { null },
    status = o.optString("status"),
)

private fun WearSchedule.toJson(): String {
    val root = JSONObject()
    next?.let { root.put("next", it.toJson()) }
    root.put("today", JSONArray(today.map { it.toJson() }))
    root.put("today_count", todayCount)
    root.put("synced_at", syncedAtMillis)
    return root.toString()
}

private fun jsonToSchedule(raw: String): WearSchedule {
    val root = JSONObject(raw)
    val next = if (root.has("next")) jsonToAppointment(root.getJSONObject("next")) else null
    val todayArray = root.optJSONArray("today") ?: JSONArray()
    val today = (0 until todayArray.length()).map { jsonToAppointment(todayArray.getJSONObject(it)) }
    return WearSchedule(
        next = next,
        today = today,
        todayCount = root.optInt("today_count", 0),
        syncedAtMillis = root.optLong("synced_at", 0L),
    )
}

/**
 * Single source of truth for the last schedule synced down from the phone.
 * Backed by SharedPreferences (as a small JSON blob -- simplest reliable way
 * to persist a list of appointments without adding a database dependency)
 * so the watch app can show the last-known schedule immediately on cold
 * start; also exposes a StateFlow so a foregrounded activity updates live if
 * DataLayerListenerService receives a fresher value while the app is open.
 */
object WearDataRepository {
    private val _schedule = MutableStateFlow<WearSchedule?>(null)
    val schedule: StateFlow<WearSchedule?> = _schedule.asStateFlow()

    // P4 — transient, not persisted to disk (a stale "next opening" answer
    // from a previous session is worse than none). Reset to null whenever a
    // new request is sent so the Ask screen can distinguish "still waiting"
    // from "phone answered: no opening found".
    private val _nextOpeningResult = MutableStateFlow<NextOpeningResult?>(null)
    val nextOpeningResult: StateFlow<NextOpeningResult?> = _nextOpeningResult.asStateFlow()

    fun clearNextOpeningResult() {
        _nextOpeningResult.value = null
    }

    fun setNextOpeningResult(value: NextOpeningResult) {
        _nextOpeningResult.value = value
    }

    // P5 — transient, same rationale as nextOpeningResult above.
    private val _actionResult = MutableStateFlow<ActionResult?>(null)
    val actionResult: StateFlow<ActionResult?> = _actionResult.asStateFlow()

    fun clearActionResult() {
        _actionResult.value = null
    }

    fun setActionResult(value: ActionResult) {
        _actionResult.value = value
    }

    // P6 — persisted (unlike the one-shot result flows above): the watch
    // should keep showing the right experience across a cold start, before
    // any fresh sync arrives.
    private val _role = MutableStateFlow(WearRole.UNKNOWN)
    val role: StateFlow<WearRole> = _role.asStateFlow()

    private val _customerSchedule = MutableStateFlow<CustomerSchedule?>(null)
    val customerSchedule: StateFlow<CustomerSchedule?> = _customerSchedule.asStateFlow()

    // P6 — transient, same rationale as actionResult above.
    private val _customerActionResult = MutableStateFlow<CustomerActionResult?>(null)
    val customerActionResult: StateFlow<CustomerActionResult?> = _customerActionResult.asStateFlow()

    fun clearCustomerActionResult() {
        _customerActionResult.value = null
    }

    fun setCustomerActionResult(value: CustomerActionResult) {
        _customerActionResult.value = value
    }

    fun setRole(context: Context, role: WearRole) {
        _role.value = role
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
            .putString(KEY_ROLE, role.name)
            .apply()
    }

    fun updateCustomerSchedule(context: Context, value: CustomerSchedule) {
        _customerSchedule.value = value
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
            .putString(KEY_CUSTOMER_JSON, value.toJson())
            .apply()
    }

    fun loadFromDisk(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.getString(KEY_JSON, null)?.let { raw ->
            _schedule.value = runCatching { jsonToSchedule(raw) }.getOrNull()
        }
        prefs.getString(KEY_CUSTOMER_JSON, null)?.let { raw ->
            _customerSchedule.value = runCatching { jsonToCustomerSchedule(raw) }.getOrNull()
        }
        prefs.getString(KEY_ROLE, null)?.let { raw ->
            _role.value = runCatching { WearRole.valueOf(raw) }.getOrDefault(WearRole.UNKNOWN)
        }
    }

    fun update(context: Context, value: WearSchedule) {
        _schedule.value = value
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
            .putString(KEY_JSON, value.toJson())
            .apply()
    }

    /** Builds a CustomerSchedule directly from the raw synced DataMap (used by DataLayerListenerService). */
    fun customerScheduleFromDataMap(dataMap: DataMap): CustomerSchedule {
        val nextMap = dataMap.getDataMap("next")
        val next = nextMap?.let {
            CustomerAppointment(
                id = it.getString("id") ?: "",
                salonName = it.getString("salon_name") ?: "",
                serviceName = it.getString("service_name") ?: "",
                startsAtIso = it.getString("starts_at") ?: "",
                endsAtIso = it.getString("ends_at")?.ifEmpty { null },
                status = it.getString("status") ?: "",
            )
        }
        return CustomerSchedule(next = next, syncedAtMillis = dataMap.getLong("synced_at"))
    }

    /** Builds a WearSchedule directly from the raw synced DataMap (used by DataLayerListenerService). */
    fun scheduleFromDataMap(dataMap: DataMap): WearSchedule {
        val nextMap = dataMap.getDataMap("next")
        val next = nextMap?.let {
            WearAppointment(
                id = it.getString("id") ?: "",
                customerName = it.getString("customer_name") ?: "",
                serviceName = it.getString("service_name") ?: "",
                startsAtIso = it.getString("starts_at") ?: "",
                endsAtIso = it.getString("ends_at")?.ifEmpty { null },
                staffName = it.getString("staff_name")?.ifEmpty { null },
                status = it.getString("status") ?: "",
            )
        }
        val today = (dataMap.getDataMapArrayList("today") ?: arrayListOf()).map {
            WearAppointment(
                id = it.getString("id") ?: "",
                customerName = it.getString("customer_name") ?: "",
                serviceName = it.getString("service_name") ?: "",
                startsAtIso = it.getString("starts_at") ?: "",
                endsAtIso = it.getString("ends_at")?.ifEmpty { null },
                staffName = it.getString("staff_name")?.ifEmpty { null },
                status = it.getString("status") ?: "",
            )
        }
        return WearSchedule(
            next = next,
            today = today,
            todayCount = dataMap.getInt("today_count"),
            syncedAtMillis = dataMap.getLong("synced_at"),
        )
    }
}
