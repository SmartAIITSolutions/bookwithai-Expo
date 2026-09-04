package expo.modules.wearbridge

import com.google.android.gms.tasks.Tasks
import com.google.android.gms.wearable.DataMap
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val ROLE_PATH = "/bwa/role"
private const val SCHEDULE_PATH = "/bwa/schedule"
private const val CUSTOMER_SCHEDULE_PATH = "/bwa/customer-schedule"
private const val ASK_NEXT_OPENING_PATH = "/bwa/ask/next-opening"
private const val NEXT_OPENING_RESULT_PATH = "/bwa/next-opening-result"
private const val ACTION_START_PATH = "/bwa/action/start"
private const val ACTION_COMPLETE_PATH = "/bwa/action/complete"
private const val ACTION_RESULT_PATH = "/bwa/action-result"
private const val CUSTOMER_ACTION_ARRIVED_PATH = "/bwa/customer-action/arrived"
private const val CUSTOMER_ACTION_ETA_ALMOST_PATH = "/bwa/customer-action/eta-almost"
private const val CUSTOMER_ACTION_ETA_LATE_PATH = "/bwa/customer-action/eta-late"
private const val CUSTOMER_ACTION_CANCEL_PATH = "/bwa/customer-action/cancel"
private const val CUSTOMER_ACTION_RESULT_PATH = "/bwa/customer-action-result"

/**
 * Phone-side half of the Wear OS bridge (professional: P1-P5; customer:
 * P6). Two directions, both over the free Google Play Services Wearable
 * Data Layer API (no per-call charge, no new dependency):
 *  - Phone -> watch: DataItems for role (P6), the owner schedule (P2), the
 *    customer schedule (P6), the "next opening" reply (P4), the owner
 *    Start/Complete result (P5), and the customer action result (P6).
 *  - Watch -> phone: a MessageClient listener for the owner "ask next
 *    opening"/Start/Complete requests (P4/P5) and, new in P6, the customer
 *    I've-Arrived/Running-Late/Cancel requests -- all forwarded to JS as
 *    events so the app (already authenticated) can call its existing APIs
 *    and reply. The watch never holds an auth token and never calls Book
 *    With AI's API directly, for either role.
 */
class WearBridgeModule : Module() {
  private var messageListener: com.google.android.gms.wearable.MessageClient.OnMessageReceivedListener? = null

  override fun definition() = ModuleDefinition {
    Name("WearBridge")

    Events("onAskNextOpening", "onWatchAction", "onWatchCustomerAction")

    OnCreate {
      val context = appContext.reactContext ?: return@OnCreate
      val listener = com.google.android.gms.wearable.MessageClient.OnMessageReceivedListener { event: MessageEvent ->
        when (event.path) {
          ASK_NEXT_OPENING_PATH ->
            sendEvent("onAskNextOpening", mapOf("requestedAt" to System.currentTimeMillis()))
          ACTION_START_PATH ->
            sendEvent("onWatchAction", mapOf("action" to "start", "bookingId" to String(event.data)))
          ACTION_COMPLETE_PATH ->
            sendEvent("onWatchAction", mapOf("action" to "complete", "bookingId" to String(event.data)))
          CUSTOMER_ACTION_ARRIVED_PATH ->
            sendEvent("onWatchCustomerAction", mapOf("action" to "arrived", "bookingId" to String(event.data)))
          CUSTOMER_ACTION_ETA_ALMOST_PATH ->
            sendEvent("onWatchCustomerAction", mapOf("action" to "eta_almost", "bookingId" to String(event.data)))
          CUSTOMER_ACTION_ETA_LATE_PATH ->
            sendEvent("onWatchCustomerAction", mapOf("action" to "eta_late", "bookingId" to String(event.data)))
          CUSTOMER_ACTION_CANCEL_PATH ->
            sendEvent("onWatchCustomerAction", mapOf("action" to "cancel", "bookingId" to String(event.data)))
        }
      }
      messageListener = listener
      Wearable.getMessageClient(context).addListener(listener)
    }

    OnDestroy {
      val context = appContext.reactContext
      val listener = messageListener
      if (context != null && listener != null) {
        Wearable.getMessageClient(context).removeListener(listener)
      }
    }

    // P6 -- tells the watch which experience to show. Pushed once per
    // sign-in/role-resolution (see _layout.tsx); the watch persists the
    // last-known role so Home/Detail/Tile can route correctly without
    // needing to re-derive it from data shape.
    AsyncFunction("syncRole") { role: String ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      val request = PutDataMapRequest.create(ROLE_PATH).apply {
        dataMap.putString("role", role)
        dataMap.putLong("synced_at", System.currentTimeMillis())
      }.asPutDataRequest().setUrgent()
      Tasks.await(Wearable.getDataClient(context).putDataItem(request))
      true
    }

    AsyncFunction("syncSchedule") { next: Map<String, Any?>?, today: List<Map<String, Any?>> ->
      val context = appContext.reactContext ?: return@AsyncFunction false

      fun toAppointmentMap(item: Map<String, Any?>): DataMap {
        val dm = DataMap()
        dm.putString("id", item["id"] as? String ?: "")
        dm.putString("customer_name", item["customerName"] as? String ?: "")
        dm.putString("service_name", item["serviceName"] as? String ?: "")
        dm.putString("starts_at", item["startsAtIso"] as? String ?: "")
        dm.putString("ends_at", item["endsAtIso"] as? String ?: "")
        dm.putString("staff_name", item["staffName"] as? String ?: "")
        dm.putString("status", item["status"] as? String ?: "")
        return dm
      }

      val todayList = ArrayList(today.map(::toAppointmentMap))
      val nonCancelledCount = today.count { (it["status"] as? String) != "cancelled" }

      val request = PutDataMapRequest.create(SCHEDULE_PATH).apply {
        dataMap.putDataMapArrayList("today", todayList)
        dataMap.putInt("today_count", nonCancelledCount)
        if (next != null) {
          dataMap.putDataMap("next", toAppointmentMap(next))
        }
        dataMap.putLong("synced_at", System.currentTimeMillis())
      }.asPutDataRequest().setUrgent()

      // putDataItem returns a Task; Tasks.await() is safe here because
      // AsyncFunction bodies already run off the JS/UI thread.
      Tasks.await(Wearable.getDataClient(context).putDataItem(request))
      true
    }

    // P6 -- customer analogue of syncSchedule. Only ever the customer's
    // single next upcoming appointment (no "today list" concept for
    // customers -- see CustomerHomeScreen).
    AsyncFunction("syncCustomerSchedule") { next: Map<String, Any?>? ->
      val context = appContext.reactContext ?: return@AsyncFunction false

      val request = PutDataMapRequest.create(CUSTOMER_SCHEDULE_PATH).apply {
        if (next != null) {
          val dm = DataMap()
          dm.putString("id", next["id"] as? String ?: "")
          dm.putString("salon_name", next["salonName"] as? String ?: "")
          dm.putString("service_name", next["serviceName"] as? String ?: "")
          dm.putString("starts_at", next["startsAtIso"] as? String ?: "")
          dm.putString("ends_at", next["endsAtIso"] as? String ?: "")
          dm.putString("status", next["status"] as? String ?: "")
          dataMap.putDataMap("next", dm)
        }
        dataMap.putLong("synced_at", System.currentTimeMillis())
      }.asPutDataRequest().setUrgent()

      Tasks.await(Wearable.getDataClient(context).putDataItem(request))
      true
    }

    // P4 -- reply to a watch-initiated "when is my next opening" request.
    // startsAtIso/endsAtIso are null when no opening was found in the
    // search window (see GET /api/owner/scheduling/next-opening).
    AsyncFunction("sendNextOpeningResult") { startsAtIso: String?, endsAtIso: String? ->
      val context = appContext.reactContext ?: return@AsyncFunction false

      val request = PutDataMapRequest.create(NEXT_OPENING_RESULT_PATH).apply {
        dataMap.putString("starts_at", startsAtIso ?: "")
        dataMap.putString("ends_at", endsAtIso ?: "")
        dataMap.putLong("answered_at", System.currentTimeMillis())
      }.asPutDataRequest().setUrgent()

      Tasks.await(Wearable.getDataClient(context).putDataItem(request))
      true
    }

    // P5 -- reply to a watch-initiated Start/Complete action request. The
    // mutation itself (startService/completeService) already happened in JS
    // by the time this is called -- this only relays the outcome back.
    AsyncFunction("sendActionResult") { action: String, bookingId: String, success: Boolean, errorMessage: String? ->
      val context = appContext.reactContext ?: return@AsyncFunction false

      val request = PutDataMapRequest.create(ACTION_RESULT_PATH).apply {
        dataMap.putString("action", action)
        dataMap.putString("booking_id", bookingId)
        dataMap.putBoolean("success", success)
        dataMap.putString("error", errorMessage ?: "")
        dataMap.putLong("answered_at", System.currentTimeMillis())
      }.asPutDataRequest().setUrgent()

      Tasks.await(Wearable.getDataClient(context).putDataItem(request))
      true
    }

    // P6 -- reply to a watch-initiated customer action (I've Arrived /
    // Running Late / Cancel). Same shape as sendActionResult -- the
    // mutation (checkInBooking/sendEtaStatus/cancelBooking) already
    // happened in JS by the time this is called.
    AsyncFunction("sendCustomerActionResult") { action: String, bookingId: String, success: Boolean, errorMessage: String? ->
      val context = appContext.reactContext ?: return@AsyncFunction false

      val request = PutDataMapRequest.create(CUSTOMER_ACTION_RESULT_PATH).apply {
        dataMap.putString("action", action)
        dataMap.putString("booking_id", bookingId)
        dataMap.putBoolean("success", success)
        dataMap.putString("error", errorMessage ?: "")
        dataMap.putLong("answered_at", System.currentTimeMillis())
      }.asPutDataRequest().setUrgent()

      Tasks.await(Wearable.getDataClient(context).putDataItem(request))
      true
    }
  }
}
