package app.bookwithai.app.wear

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.navArgument
import androidx.navigation.navDeepLink
import androidx.wear.compose.navigation.SwipeDismissableNavHost
import androidx.wear.compose.navigation.composable
import androidx.wear.compose.navigation.rememberSwipeDismissableNavController

private const val ROUTE_HOME = "home"
private const val ROUTE_SCHEDULE = "schedule"
private const val ROUTE_DETAIL = "detail/{appointmentId}"
private const val ROUTE_ASK = "ask/{kind}"
private const val ASK_DEEP_LINK = "bwawear://ask/{kind}"

/**
 * Hosts the P2 screens (Home -> Schedule -> Appointment Detail) plus the P4
 * Ask SANAA screen on Wear Compose's standard swipe-to-dismiss navigation
 * (the native Wear OS back gesture) rather than separate Activities. Data
 * comes exclusively from WearDataRepository, populated by
 * DataLayerListenerService relaying what the phone already fetched/computed
 * from the real Book With AI owner APIs -- this app never calls Book With
 * AI's network API itself.
 *
 * `ask/{kind}` is reached two ways: a direct tap (not built in this phase)
 * and -- the actual point of P4 -- Google Assistant's App Actions
 * fulfillment deep link (bwawear://ask/{kind}, see shortcuts.xml and the
 * AndroidManifest.xml intent-filter). android:launchMode="singleTask" +
 * onNewIntent below ensure a repeat voice invocation while the app is
 * already running re-navigates instead of stacking a duplicate instance.
 *
 * P6 -- `home` and `detail/{appointmentId}` each branch on
 * WearDataRepository.role (persisted, pushed by the phone once role is
 * known) to render either the professional or customer version of that
 * screen. This is the entire "role-aware watch" mechanism: one set of
 * routes, content chosen by role, no separate login or duplicated nav
 * graph. Ask SANAA (`ask/{kind}`) remains professional-only, per this
 * phase's explicit exclusion of a customer SANAA assistant.
 */
class MainActivity : ComponentActivity() {
    private var navController: NavHostController? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WearDataRepository.loadFromDisk(applicationContext)
        setContent {
            BwaWearTheme {
                val controller = rememberSwipeDismissableNavController()
                navController = controller
                SwipeDismissableNavHost(
                    navController = controller,
                    startDestination = ROUTE_HOME,
                ) {
                    composable(ROUTE_HOME) {
                        val role by WearDataRepository.role.collectAsState()
                        if (role == WearRole.CUSTOMER) {
                            CustomerHomeScreen(
                                onOpenAppointment = { id -> controller.navigate("detail/$id") },
                            )
                        } else {
                            HomeScreen(
                                onOpenSchedule = { controller.navigate(ROUTE_SCHEDULE) },
                                onOpenAppointment = { id -> controller.navigate("detail/$id") },
                            )
                        }
                    }
                    composable(ROUTE_SCHEDULE) {
                        ScheduleScreen(
                            onOpenAppointment = { id -> controller.navigate("detail/$id") },
                        )
                    }
                    composable(
                        ROUTE_DETAIL,
                        arguments = listOf(navArgument("appointmentId") { type = NavType.StringType }),
                    ) { backStackEntry ->
                        val id = backStackEntry.arguments?.getString("appointmentId").orEmpty()
                        val role by WearDataRepository.role.collectAsState()
                        if (role == WearRole.CUSTOMER) {
                            CustomerAppointmentDetailScreen(appointmentId = id)
                        } else {
                            AppointmentDetailScreen(appointmentId = id)
                        }
                    }
                    composable(
                        ROUTE_ASK,
                        arguments = listOf(navArgument("kind") { type = NavType.StringType }),
                        deepLinks = listOf(navDeepLink { uriPattern = ASK_DEEP_LINK }),
                    ) { backStackEntry ->
                        val kind = backStackEntry.arguments?.getString("kind").orEmpty()
                        AskScreen(kind = kind)
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        navController?.handleDeepLink(intent)
    }
}
