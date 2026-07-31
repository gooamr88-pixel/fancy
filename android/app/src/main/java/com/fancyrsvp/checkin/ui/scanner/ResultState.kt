package com.fancyrsvp.checkin.ui.scanner

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp
import com.fancyrsvp.checkin.data.repo.CheckInRepository
import com.fancyrsvp.checkin.ui.theme.GroundAlready
import com.fancyrsvp.checkin.ui.theme.GroundNotFound
import com.fancyrsvp.checkin.ui.theme.GroundVip
import com.fancyrsvp.checkin.ui.theme.GroundWelcome
import com.fancyrsvp.checkin.ui.theme.Ink
import com.fancyrsvp.checkin.ui.theme.OnAlready
import com.fancyrsvp.checkin.ui.theme.OnVip
import com.fancyrsvp.checkin.ui.theme.OnWelcome

/**
 * Four states. Not six.
 *
 * ── Why the reduction is the design ──
 *
 * The repository reports six outcomes because six things can genuinely happen.
 * The SCREEN may only ever show four, because an usher glancing at it for under
 * two seconds cannot rank six colours, and three of the six ask for exactly the
 * same thing from them: search for this guest by name.
 *
 * `Expired` folding into a welcome is not a behaviour change. §5.3 already
 * admits those guests normally — the door is never blocked by uncertainty — so
 * being past its date was never a different ACTION, only a different colour.
 * It becomes a quiet line of text instead.
 *
 * The mapping is deliberately total and lives here rather than inside the
 * composable, so a seventh outcome added to the repository later fails to
 * compile in one place instead of silently rendering as a blank screen.
 */
enum class ResultVisual {
    /** Admit them. Deep green, dark. */
    Welcome,

    /** Admit them, and they matter. Gold, dark, moving. */
    Vip,

    /** Someone already used this. Light sand, flooded amber. */
    Already,

    /** Nothing found, nothing wrong. Light, deliberately colourless. */
    NotFound,
    ;

    /** The full-screen ground. */
    val ground: Color
        get() = when (this) {
            Welcome -> GroundWelcome
            Vip -> GroundVip
            Already -> GroundAlready
            NotFound -> GroundNotFound
        }

    /** Text and rules on [ground]. Every pair clears 4.5:1 — see Palette.kt. */
    val onGround: Color
        get() = when (this) {
            Welcome -> OnWelcome
            Vip -> OnVip
            Already -> OnAlready
            NotFound -> Ink
        }

    /** True when the ground is dark, so overlays must lighten rather than darken. */
    val isDarkGround: Boolean
        get() = this == Welcome || this == Vip

    /**
     * How long before the screen returns to the camera on its own.
     *
     * Null means "wait for the operator", which is only ever the two welcome
     * states: those are the ones with an admission to record, and timing that
     * out would either admit nobody or admit the wrong people. Every other
     * state has nothing to decide, so it leaves by itself.
     *
     * `NotFound` gets the longest window because it is the one state where the
     * operator has to say something to a guest before acting.
     */
    val autoDismissMillis: Long?
        get() = when (this) {
            Welcome, Vip -> null
            Already -> 6_000L
            NotFound -> 8_000L
        }
}

/**
 * The single place six outcomes become four.
 *
 * An `Expired` scan that resolved to a party is a welcome; one that resolved to
 * nothing is a not-found. Nothing else in the app needs to know that `Expired`
 * exists.
 */
fun CheckInRepository.ScanOutcome.visual(): ResultVisual = when (this) {
    is CheckInRepository.ScanOutcome.Welcome ->
        if (party.hasVip) ResultVisual.Vip else ResultVisual.Welcome

    is CheckInRepository.ScanOutcome.AlreadyCheckedIn -> ResultVisual.Already

    is CheckInRepository.ScanOutcome.Expired ->
        when {
            party == null -> ResultVisual.NotFound
            party.hasVip -> ResultVisual.Vip
            else -> ResultVisual.Welcome
        }

    // All three mean the same thing to the person holding the tablet: this code
    // told us nothing, search by name instead.
    is CheckInRepository.ScanOutcome.WrongEvent -> ResultVisual.NotFound
    CheckInRepository.ScanOutcome.NotFound -> ResultVisual.NotFound
    CheckInRepository.ScanOutcome.Unrecognised -> ResultVisual.NotFound
}

/** The party behind an outcome, when there is one. */
fun CheckInRepository.ScanOutcome.partyOrNull(): CheckInRepository.PartyView? = when (this) {
    is CheckInRepository.ScanOutcome.Welcome -> party
    is CheckInRepository.ScanOutcome.AlreadyCheckedIn -> party
    is CheckInRepository.ScanOutcome.Expired -> party
    else -> null
}

/**
 * The table number's size, chosen from the string.
 *
 * ── Why this is not a type role ──
 *
 * The table is the largest element on the screen because it is the thing staff
 * say out loud. But `tableName` is free text, not a number: it is usually "12",
 * and sometimes "Head Table" or "The Rose Garden". A fixed 140sp would push the
 * check-in button off the bottom of the tablet the first time an organizer
 * names a table after a flower.
 *
 * Compose 1.7 has no auto-sizing text (`TextStyle.autoSize` arrives in 1.8), so
 * the size is bucketed by length. At every bucket the table remains larger than
 * the 60sp guest name, which is the rule that actually matters.
 *
 * Callers must also pass `maxLines = 2` and ellipsis as the hard stop — this
 * function narrows the problem, it does not eliminate it.
 */
fun tableDisplaySize(tableName: String?, compact: Boolean): TextUnit {
    val length = tableName?.trim()?.length ?: 0
    return if (compact) {
        when {
            length <= 3 -> 88.sp
            length <= 6 -> 68.sp
            length <= 12 -> 46.sp
            else -> 34.sp
        }
    } else {
        when {
            length <= 3 -> 140.sp
            length <= 6 -> 104.sp
            length <= 12 -> 64.sp
            else -> 44.sp
        }
    }
}
