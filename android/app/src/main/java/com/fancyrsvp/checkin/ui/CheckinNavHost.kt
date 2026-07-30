package com.fancyrsvp.checkin.ui

import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.fancyrsvp.checkin.ui.close.CloseEventScreen
import com.fancyrsvp.checkin.ui.dashboard.DashboardScreen
import com.fancyrsvp.checkin.ui.entrance.EntranceDisplayScreen
import com.fancyrsvp.checkin.ui.guests.GuestListScreen
import com.fancyrsvp.checkin.ui.login.StaffLoginScreen
import com.fancyrsvp.checkin.ui.pair.PairScreen
import com.fancyrsvp.checkin.ui.prepare.PrepareScreen
import com.fancyrsvp.checkin.ui.scanner.ScannerScreen
import com.fancyrsvp.checkin.ui.session.SessionManager

/**
 * Navigation for the check-in app.
 *
 * The route order mirrors the real lifecycle (§5.2):
 *
 *   pair → prepare → login → scanner
 *
 * Pairing and preparation both REQUIRE internet and happen before travelling to
 * the venue. Login and scanning must work with none. That boundary is why the
 * graph is shaped this way rather than as a single gated flow: once an event is
 * armed, nothing downstream may depend on connectivity.
 */
object Routes {
    const val PAIR = "pair"
    const val PREPARE = "prepare"
    const val LOGIN = "login/{eventId}"
    const val SCANNER = "scanner/{eventId}/{staffId}/{staffName}/{role}"
    const val DASHBOARD = "dashboard/{eventId}/{role}"
    const val GUESTS = "guests/{eventId}/{role}"
    const val ENTRANCE = "entrance/{eventId}"
    const val CLOSE = "close/{eventId}"

    /**
     * Sentinel for an absent path argument.
     *
     * Navigation's string arguments cannot be null in a non-optional path segment,
     * and an empty segment collapses the route. A literal is clearer than encoding
     * absence as a blank.
     */
    const val NONE = "-"

    fun login(eventId: String) = "login/$eventId"

    /**
     * The staff identity travels in the route rather than in a shared singleton.
     *
     * That keeps the operator tied to the navigation entry, so returning to login
     * on a session timeout cannot leave a stale operator attributed to later
     * check-ins — attribution is written at creation time and is immutable
     * thereafter (§18.6), which only holds if it was right to begin with.
     */
    fun scanner(eventId: String, staffId: String?, staffName: String?, role: String) =
        "scanner/$eventId/${staffId ?: NONE}/${staffName?.let { Uri.encode(it) } ?: NONE}/$role"

    fun dashboard(eventId: String, role: String) = "dashboard/$eventId/$role"

    fun guests(eventId: String, role: String) = "guests/$eventId/$role"

    fun entrance(eventId: String) = "entrance/$eventId"

    fun close(eventId: String) = "close/$eventId"
}

@Composable
fun CheckinNavHost(
    isPaired: Boolean,
    sessionManager: SessionManager,
    navController: NavHostController = rememberNavController(),
) {
    NavHost(
        navController = navController,
        // An unpaired tablet has nothing else it can usefully do.
        startDestination = if (isPaired) Routes.PREPARE else Routes.PAIR,
    ) {
        composable(Routes.PAIR) {
            PairScreen(
                onPaired = {
                    // popUpTo removes pairing from the back stack: returning to it
                    // after a successful pair would offer to consume a code that is
                    // already spent.
                    navController.navigate(Routes.PREPARE) {
                        popUpTo(Routes.PAIR) { inclusive = true }
                    }
                },
            )
        }

        composable(Routes.PREPARE) {
            PrepareScreen(
                onEventReady = { eventId -> navController.navigate(Routes.login(eventId)) },
            )
        }

        composable(Routes.LOGIN) { entry ->
            val eventId = entry.arguments?.getString("eventId")
            if (eventId == null) {
                navController.popBackStack()
            } else {
                StaffLoginScreen(
                    eventId = eventId,
                    onLoggedIn = { staffId, displayName, role ->
                        // Registers the session so §20.4's inactivity and background
                        // rules have something to expire.
                        sessionManager.onLoggedIn(staffId, displayName, role)
                        navController.navigate(Routes.scanner(eventId, staffId, displayName, role)) {
                            // Login is popped so a session timeout returns here
                            // deliberately rather than the back gesture skipping it.
                            popUpTo(Routes.LOGIN) { inclusive = true }
                        }
                    },
                )
            }
        }

        composable(Routes.SCANNER) { entry ->
            val eventId = entry.arguments?.getString("eventId")
            if (eventId == null) {
                navController.popBackStack()
            } else {
                val role = entry.arguments?.getString("role") ?: "usher"
                ScannerScreen(
                    eventId = eventId,
                    staffId = entry.arguments?.getString("staffId")?.takeIf { it != Routes.NONE },
                    staffName = entry.arguments?.getString("staffName")
                        ?.takeIf { it != Routes.NONE }
                        ?.let { Uri.decode(it) },
                    role = role,
                    onOpenDashboard = { navController.navigate(Routes.dashboard(eventId, role)) },
                )
            }
        }

        composable(Routes.DASHBOARD) { entry ->
            val eventId = entry.arguments?.getString("eventId")
            val role = entry.arguments?.getString("role") ?: "usher"
            if (eventId == null) {
                navController.popBackStack()
            } else {
                DashboardScreen(
                    eventId = eventId,
                    isSupervisor = role == "supervisor",
                    onOpenGuestList = { navController.navigate(Routes.guests(eventId, role)) },
                    onOpenEntranceDisplay = { navController.navigate(Routes.entrance(eventId)) },
                    // Closing an event destroys local data, so only a supervisor
                    // reaches it — and the screen itself blocks the purge while
                    // anything is unsent, regardless of who is holding the tablet.
                    onCloseEvent = if (role == "supervisor") {
                        { navController.navigate(Routes.close(eventId)) }
                    } else {
                        null
                    },
                    // popBackStack, not navigate: the scanner is already on the stack
                    // and re-navigating would rebuild the camera pipeline for no
                    // reason, costing a second of black screen at a door.
                    onBack = { navController.popBackStack() },
                )
            }
        }

        composable(Routes.GUESTS) { entry ->
            val eventId = entry.arguments?.getString("eventId")
            val role = entry.arguments?.getString("role") ?: "usher"
            if (eventId == null) {
                navController.popBackStack()
            } else {
                GuestListScreen(
                    eventId = eventId,
                    isSupervisor = role == "supervisor",
                    onBack = { navController.popBackStack() },
                )
            }
        }

        composable(Routes.ENTRANCE) { entry ->
            val eventId = entry.arguments?.getString("eventId")
            if (eventId == null) {
                navController.popBackStack()
            } else {
                // No back affordance is passed in: §8.8 requires no operational
                // controls visible, because guests walk past this screen and will
                // touch it. Exiting is the system back gesture, which an operator
                // knows and a passer-by will not stumble into.
                EntranceDisplayScreen(eventId = eventId)
            }
        }

        composable(Routes.CLOSE) { entry ->
            val eventId = entry.arguments?.getString("eventId")
            if (eventId == null) {
                navController.popBackStack()
            } else {
                CloseEventScreen(
                    eventId = eventId,
                    onClosed = {
                        // The event is no longer armed, so the whole stack back to
                        // event selection is dropped: leaving a scanner behind for a
                        // purged event would present an empty guest list as though it
                        // were a real one.
                        navController.navigate(Routes.PREPARE) {
                            popUpTo(Routes.PREPARE) { inclusive = true }
                        }
                    },
                    onBack = { navController.popBackStack() },
                )
            }
        }
    }
}

