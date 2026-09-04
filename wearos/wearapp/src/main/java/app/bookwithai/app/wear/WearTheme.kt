package app.bookwithai.app.wear

import androidx.compose.runtime.Composable
import androidx.wear.compose.material.Colors
import androidx.wear.compose.material.MaterialTheme

// Same brand palette used across the phone app and marketing site: near-
// black ground, royal-violet primary, champagne-gold accent. Kept minimal
// on purpose -- Wear Material's default typography/shapes are left as-is so
// the watch still reads as a native Wear OS app, not a shrunk-down mobile
// screen.
private val BwaBlack = androidx.compose.ui.graphics.Color(0xFF000000)
private val BwaSurface = androidx.compose.ui.graphics.Color(0xFF15111F)
private val BwaViolet = androidx.compose.ui.graphics.Color(0xFF7C3AED)
private val BwaLavender = androidx.compose.ui.graphics.Color(0xFFC39BFF)
private val BwaGold = androidx.compose.ui.graphics.Color(0xFFF4D77A)
private val BwaWhite = androidx.compose.ui.graphics.Color(0xFFF5F3FF)

private val BwaWearColors = Colors(
    primary = BwaLavender,
    primaryVariant = BwaViolet,
    secondary = BwaGold,
    secondaryVariant = BwaGold,
    background = BwaBlack,
    surface = BwaSurface,
    onPrimary = BwaBlack,
    onSecondary = BwaBlack,
    onBackground = BwaWhite,
    onSurface = BwaWhite,
)

@Composable
fun BwaWearTheme(content: @Composable () -> Unit) {
    MaterialTheme(colors = BwaWearColors, content = content)
}
