package app.bookwithai.app.wear

import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException

private val TIME_FORMATTER = DateTimeFormatter.ofPattern("h:mm a")

/**
 * Parses a `starts_at`/`ends_at` ISO 8601 instant (as returned by Book With
 * AI's owner API, e.g. "2026-09-03T18:30:00.000Z") and renders it in the
 * watch's own local timezone -- a deliberate simplification for this phase
 * (the salon's own timezone isn't relayed yet); returns null for a blank/
 * unparsable value so callers can fall back to an empty state instead of
 * showing garbage text.
 */
fun formatWearTime(iso: String?): String? {
    if (iso.isNullOrBlank()) return null
    return try {
        Instant.parse(iso).atZone(ZoneId.systemDefault()).format(TIME_FORMATTER)
    } catch (e: DateTimeParseException) {
        null
    }
}

/** "in 25 min" / "in 2h 10m" / "Starting now" / "Running long" for a starts_at already in progress. */
fun formatWearCountdown(startsAtIso: String?, endsAtIso: String? = null, now: Instant = Instant.now()): String? {
    if (startsAtIso.isNullOrBlank()) return null
    val start = try { Instant.parse(startsAtIso) } catch (e: DateTimeParseException) { return null }

    val untilStart = Duration.between(now, start)
    if (!untilStart.isNegative) {
        val minutes = untilStart.toMinutes()
        if (minutes < 1) return "Starting now"
        if (minutes < 60) return "in ${minutes}m"
        val hours = minutes / 60
        val remMinutes = minutes % 60
        return if (remMinutes == 0L) "in ${hours}h" else "in ${hours}h ${remMinutes}m"
    }

    // Already started -- if we know when it ends and we're still before
    // that, show "in progress"; otherwise omit the countdown rather than
    // show a confusing negative value.
    val end = endsAtIso?.let { runCatching { Instant.parse(it) }.getOrNull() }
    return if (end != null && now.isBefore(end)) "In progress" else null
}

/** "Today" / "Tomorrow" / "Fri, Sep 5" for a starts_at ISO instant, in the watch's local timezone. */
fun formatWearDayLabel(iso: String?, now: Instant = Instant.now()): String? {
    if (iso.isNullOrBlank()) return null
    return try {
        val zone = ZoneId.systemDefault()
        val target = Instant.parse(iso).atZone(zone).toLocalDate()
        val today = now.atZone(zone).toLocalDate()
        when (target) {
            today -> "Today"
            today.plusDays(1) -> "Tomorrow"
            else -> Instant.parse(iso).atZone(zone).format(DateTimeFormatter.ofPattern("EEE, MMM d"))
        }
    } catch (e: DateTimeParseException) {
        null
    }
}

/** "45 min" from start/end ISO instants, or null if either is missing/unparsable. */
fun formatWearDuration(startsAtIso: String?, endsAtIso: String?): String? {
    if (startsAtIso.isNullOrBlank() || endsAtIso.isNullOrBlank()) return null
    return try {
        val start = Instant.parse(startsAtIso)
        val end = Instant.parse(endsAtIso)
        val minutes = Duration.between(start, end).toMinutes()
        if (minutes <= 0) null else "$minutes min"
    } catch (e: DateTimeParseException) {
        null
    }
}
