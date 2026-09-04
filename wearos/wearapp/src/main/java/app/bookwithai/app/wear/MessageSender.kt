package app.bookwithai.app.wear

import android.content.Context
import com.google.android.gms.wearable.Wearable

private const val ASK_NEXT_OPENING_PATH = "/bwa/ask/next-opening"
private const val ACTION_START_PATH = "/bwa/action/start"
private const val ACTION_COMPLETE_PATH = "/bwa/action/complete"
private const val CUSTOMER_ACTION_ARRIVED_PATH = "/bwa/customer-action/arrived"
private const val CUSTOMER_ACTION_ETA_ALMOST_PATH = "/bwa/customer-action/eta-almost"
private const val CUSTOMER_ACTION_ETA_LATE_PATH = "/bwa/customer-action/eta-late"
private const val CUSTOMER_ACTION_CANCEL_PATH = "/bwa/customer-action/cancel"

/**
 * Sends watch-initiated requests to the paired phone via the free Wearable
 * Data Layer MessageClient. Fire-and-forget: the phone's WearBridgeModule
 * listens for these exact paths and replies asynchronously via a DataItem
 * (see DataLayerListenerService). No auth token involved -- the phone
 * performs the actual authenticated API call in every case.
 */
object MessageSender {
    fun requestNextOpening(context: Context) {
        sendToAllNodes(context, ASK_NEXT_OPENING_PATH, ByteArray(0))
    }

    /** P5 -- professional Start/Complete. bookingId is sent as the message payload (UTF-8). */
    fun requestAction(context: Context, action: String, bookingId: String) {
        val path = if (action == "start") ACTION_START_PATH else ACTION_COMPLETE_PATH
        sendToAllNodes(context, path, bookingId.toByteArray(Charsets.UTF_8))
    }

    /** P6 -- customer I've Arrived / Running Late (almost|late) / Cancel. */
    fun requestCustomerAction(context: Context, action: String, bookingId: String) {
        val path = when (action) {
            "arrived" -> CUSTOMER_ACTION_ARRIVED_PATH
            "eta_almost" -> CUSTOMER_ACTION_ETA_ALMOST_PATH
            "eta_late" -> CUSTOMER_ACTION_ETA_LATE_PATH
            else -> CUSTOMER_ACTION_CANCEL_PATH
        }
        sendToAllNodes(context, path, bookingId.toByteArray(Charsets.UTF_8))
    }

    private fun sendToAllNodes(context: Context, path: String, data: ByteArray) {
        val messageClient = Wearable.getMessageClient(context)
        Wearable.getNodeClient(context).connectedNodes.addOnSuccessListener { nodes ->
            for (node in nodes) {
                messageClient.sendMessage(node.id, path, data)
            }
        }
    }
}
