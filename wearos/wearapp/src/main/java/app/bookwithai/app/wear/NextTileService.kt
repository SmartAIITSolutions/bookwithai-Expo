package app.bookwithai.app.wear

import androidx.wear.protolayout.ActionBuilders
import androidx.wear.protolayout.ColorBuilders.argb
import androidx.wear.protolayout.DimensionBuilders.expand
import androidx.wear.protolayout.LayoutElementBuilders
import androidx.wear.protolayout.ModifiersBuilders
import androidx.wear.protolayout.ResourceBuilders
import androidx.wear.protolayout.TimelineBuilders
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.TileBuilders
import androidx.wear.tiles.TileService
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

private const val RESOURCES_VERSION = "1"

/**
 * P5/P6 -- the "appropriate standard Wear OS glance surface for NEXT" the
 * phase asks for, for both roles. A Tile, chosen over a watch-face
 * complication because Tiles are broadly supported the same way across
 * Galaxy Watch, Pixel Watch, and any other current Wear OS device, and
 * don't require any watch-face-specific integration. Reads only from
 * WearDataRepository (already-synced data) -- issues no network call of
 * its own. Tapping it launches MainActivity (Home), same entry point as
 * the launcher icon; MainActivity's own role branch takes it from there.
 *
 * One Tile service, branching on role, per P6's instruction to reuse the
 * same Tile infrastructure rather than create a parallel one for
 * customers. A watch-face complication (ComplicationDataSourceService) was
 * evaluated and deliberately deferred in P5, per that phase's own
 * instruction to keep a Tile-only scope when a complication would
 * materially expand it -- still true here, unchanged in P6.
 */
class NextTileService : TileService() {
    override fun onTileRequest(
        requestParams: RequestBuilders.TileRequest,
    ): ListenableFuture<TileBuilders.Tile> {
        val role = WearDataRepository.role.value

        val line1: String
        val line2: String
        if (role == WearRole.CUSTOMER) {
            val next = WearDataRepository.customerSchedule.value?.next
            if (next == null) {
                line1 = "NEXT APPOINTMENT"
                line2 = "No upcoming appointments"
            } else {
                line1 = "NEXT APPOINTMENT"
                val day = formatWearDayLabel(next.startsAtIso) ?: ""
                val time = formatWearTime(next.startsAtIso) ?: ""
                val countdown = formatWearCountdown(next.startsAtIso, next.endsAtIso)
                line2 = if (countdown != null && countdown.startsWith("in ")) {
                    "${next.salonName} — $countdown"
                } else {
                    "${next.salonName} — $day • $time"
                }
            }
        } else {
            val next = WearDataRepository.schedule.value?.next
            if (next == null) {
                line1 = "NEXT"
                line2 = "Nothing scheduled"
            } else {
                line1 = "NEXT"
                val time = formatWearTime(next.startsAtIso) ?: ""
                val countdown = formatWearCountdown(next.startsAtIso, next.endsAtIso)
                line2 = if (countdown != null && countdown.startsWith("in ")) {
                    "${next.customerName} • $time ($countdown)"
                } else {
                    "${next.customerName} • $time"
                }
            }
        }

        val launchClickable = ModifiersBuilders.Clickable.Builder()
            .setOnClick(
                ActionBuilders.LaunchAction.Builder()
                    .setAndroidActivity(
                        ActionBuilders.AndroidActivity.Builder()
                            .setPackageName(packageName)
                            .setClassName("app.bookwithai.app.wear.MainActivity")
                            .build(),
                    )
                    .build(),
            )
            .build()

        val layout = LayoutElementBuilders.Column.Builder()
            .setWidth(expand())
            .setHeight(expand())
            .addContent(
                LayoutElementBuilders.Text.Builder()
                    .setText(line1)
                    .setFontStyle(
                        LayoutElementBuilders.FontStyle.Builder()
                            .setSize(androidx.wear.protolayout.DimensionBuilders.sp(12f))
                            .setColor(argb(0xFFF4D77A.toInt()))
                            .build(),
                    )
                    .build(),
            )
            .addContent(
                LayoutElementBuilders.Text.Builder()
                    .setText(line2)
                    .setFontStyle(
                        LayoutElementBuilders.FontStyle.Builder()
                            .setSize(androidx.wear.protolayout.DimensionBuilders.sp(16f))
                            .setColor(argb(0xFFF5F3FF.toInt()))
                            .build(),
                    )
                    .build(),
            )
            .setModifiers(
                ModifiersBuilders.Modifiers.Builder()
                    .setClickable(launchClickable)
                    .build(),
            )
            .build()

        val timeline = TimelineBuilders.Timeline.Builder()
            .addTimelineEntry(
                TimelineBuilders.TimelineEntry.Builder()
                    .setLayout(LayoutElementBuilders.Layout.Builder().setRoot(layout).build())
                    .build(),
            )
            .build()

        val tile = TileBuilders.Tile.Builder()
            .setResourcesVersion(RESOURCES_VERSION)
            .setTileTimeline(timeline)
            .build()

        return Futures.immediateFuture(tile)
    }

    override fun onTileResourcesRequest(
        requestParams: RequestBuilders.ResourcesRequest,
    ): ListenableFuture<ResourceBuilders.Resources> {
        return Futures.immediateFuture(
            ResourceBuilders.Resources.Builder().setVersion(RESOURCES_VERSION).build(),
        )
    }
}
