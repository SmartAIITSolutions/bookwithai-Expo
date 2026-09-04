package app.bookwithai.app.wear

import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.WearableListenerService

private const val ROLE_PATH = "/bwa/role"
private const val SCHEDULE_PATH = "/bwa/schedule"
private const val CUSTOMER_SCHEDULE_PATH = "/bwa/customer-schedule"
private const val NEXT_OPENING_RESULT_PATH = "/bwa/next-opening-result"
private const val ACTION_RESULT_PATH = "/bwa/action-result"
private const val CUSTOMER_ACTION_RESULT_PATH = "/bwa/customer-action-result"

/**
 * Receives DataItems pushed from the phone by WearBridgeModule:
 *  - which role to show (P6)
 *  - the professional NEXT appointment + today's schedule (P2)
 *  - the customer next appointment (P6)
 *  - the "next opening" round-trip reply (P4)
 *  - the professional Start/Complete action result (P5)
 *  - the customer I've-Arrived/Running-Late/Cancel action result (P6)
 * Declared in AndroidManifest.xml with matching intent-filters so Play
 * Services can start this service on a relevant data change even if the
 * watch app isn't currently running.
 */
class DataLayerListenerService : WearableListenerService() {
    override fun onDataChanged(dataEvents: DataEventBuffer) {
        for (event in dataEvents) {
            if (event.type != DataEvent.TYPE_CHANGED) continue
            val item = event.dataItem
            val dataMap = DataMapItem.fromDataItem(item).dataMap

            when (item.uri.path) {
                ROLE_PATH -> {
                    val role = runCatching { WearRole.valueOf((dataMap.getString("role") ?: "").uppercase()) }
                        .getOrDefault(WearRole.UNKNOWN)
                    WearDataRepository.setRole(applicationContext, role)
                }
                SCHEDULE_PATH ->
                    WearDataRepository.update(applicationContext, WearDataRepository.scheduleFromDataMap(dataMap))
                CUSTOMER_SCHEDULE_PATH ->
                    WearDataRepository.updateCustomerSchedule(
                        applicationContext,
                        WearDataRepository.customerScheduleFromDataMap(dataMap),
                    )
                NEXT_OPENING_RESULT_PATH ->
                    WearDataRepository.setNextOpeningResult(
                        NextOpeningResult(
                            startsAtIso = dataMap.getString("starts_at")?.ifEmpty { null },
                            endsAtIso = dataMap.getString("ends_at")?.ifEmpty { null },
                            answeredAtMillis = dataMap.getLong("answered_at"),
                        ),
                    )
                ACTION_RESULT_PATH ->
                    WearDataRepository.setActionResult(
                        ActionResult(
                            action = dataMap.getString("action") ?: "",
                            bookingId = dataMap.getString("booking_id") ?: "",
                            success = dataMap.getBoolean("success"),
                            error = dataMap.getString("error")?.ifEmpty { null },
                            answeredAtMillis = dataMap.getLong("answered_at"),
                        ),
                    )
                CUSTOMER_ACTION_RESULT_PATH ->
                    WearDataRepository.setCustomerActionResult(
                        CustomerActionResult(
                            action = dataMap.getString("action") ?: "",
                            bookingId = dataMap.getString("booking_id") ?: "",
                            success = dataMap.getBoolean("success"),
                            error = dataMap.getString("error")?.ifEmpty { null },
                            answeredAtMillis = dataMap.getLong("answered_at"),
                        ),
                    )
            }
        }
    }
}
