package app.bookwithai.app.wear

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import kotlinx.coroutines.delay
import kotlinx.coroutines.withTimeoutOrNull

private const val NEXT_OPENING_TIMEOUT_MS = 10_000L

/**
 * Handles all five V1 Ask SANAA commands, reached either via a direct tap
 * on a Home/Schedule chip or -- the actual point of this phase -- via
 * Assistant's App Actions deep link (bwawear://ask/{kind}, "Hey Google, ask
 * Book With AI ..."). Four of the five are answered instantly from data
 * already synced by the phone (WearDataRepository); "next-opening" is the
 * one command that needs a short on-demand round-trip (see MessageSender +
 * WearBridgeModule) since it can't be usefully precomputed and pushed
 * speculatively. Every answer is SANAA-branded, shown as text and spoken
 * via on-device TextToSpeech (free) -- no Telnyx, no LLM, no network cost.
 */
@Composable
fun AskScreen(kind: String) {
    val context = LocalContext.current
    val schedule by WearDataRepository.schedule.collectAsState()
    val nextOpeningResult by WearDataRepository.nextOpeningResult.collectAsState()
    var answer by remember(kind) { mutableStateOf<String?>(null) }
    var spoken by remember(kind) { mutableStateOf(false) }

    LaunchedEffect(kind, schedule) {
        if (kind == "next-opening") return@LaunchedEffect // handled below
        answer = computeLocalAnswer(kind, schedule)
    }

    if (kind == "next-opening") {
        LaunchedEffect(kind) {
            WearDataRepository.clearNextOpeningResult()
            MessageSender.requestNextOpening(context)
            val result = withTimeoutOrNull(NEXT_OPENING_TIMEOUT_MS) {
                // Poll the StateFlow's current value via a short delay loop --
                // simplest correct approach for a one-shot wait without
                // pulling in a Flow-collection dependency here.
                var value = WearDataRepository.nextOpeningResult.value
                while (value == null) {
                    delay(200)
                    value = WearDataRepository.nextOpeningResult.value
                }
                value
            }
            answer = if (result == null) {
                "SANAA: Couldn't reach your phone."
            } else if (result.startsAtIso.isNullOrBlank()) {
                "SANAA: No openings in the next week."
            } else {
                val day = formatWearDayLabel(result.startsAtIso) ?: ""
                val time = formatWearTime(result.startsAtIso) ?: ""
                "SANAA: Your next opening is $day at $time."
            }
        }
    }

    LaunchedEffect(answer) {
        val text = answer
        if (text != null && !spoken) {
            spoken = true
            SanaaVoice.speak(context, text)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        if (schedule == null && kind != "next-opening") {
            Text(
                text = "Waiting for data from your phone…",
                textAlign = TextAlign.Center,
            )
            return@Column
        }

        Text(
            text = answer ?: if (kind == "next-opening") "Checking your schedule…" else "…",
            style = MaterialTheme.typography.body1,
            color = MaterialTheme.colors.primary,
            textAlign = TextAlign.Center,
        )
    }
}

/** Answers the four commands that never need to leave the watch. */
private fun computeLocalAnswer(kind: String, schedule: WearSchedule?): String {
    if (schedule == null) return "…"

    return when (kind) {
        "next" -> {
            val next = schedule.next
            if (next == null) "SANAA: Nothing scheduled."
            else {
                val time = formatWearTime(next.startsAtIso) ?: ""
                "SANAA: ${next.customerName} is next at $time for ${next.serviceName}."
            }
        }
        "after-next" -> {
            val sorted = schedule.today.sortedBy { it.startsAtIso }
            val nextId = schedule.next?.id
            val afterNext = if (nextId != null) {
                sorted.dropWhile { it.id != nextId }.drop(1).firstOrNull()
            } else {
                sorted.drop(1).firstOrNull()
            }
            if (afterNext == null) "SANAA: Nothing scheduled after that."
            else {
                val time = formatWearTime(afterNext.startsAtIso) ?: ""
                "SANAA: Then ${afterNext.customerName} at $time for ${afterNext.serviceName}."
            }
        }
        "today-count" -> {
            val count = schedule.todayCount
            "SANAA: You have $count appointment${if (count == 1) "" else "s"} today."
        }
        "time-until-next" -> {
            val next = schedule.next
            if (next == null) "SANAA: Nothing scheduled."
            else {
                val countdown = formatWearCountdown(next.startsAtIso, next.endsAtIso)
                if (countdown == null) "SANAA: ${next.customerName} is up next."
                else "SANAA: $countdown until ${next.customerName}."
            }
        }
        else -> "SANAA: Sorry, I didn't understand that."
    }
}
