package com.fancyrsvp.checkin.ui.scanner

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp
import com.fancyrsvp.checkin.data.repo.CheckInRepository
import com.fancyrsvp.checkin.ui.theme.FoilLight
import com.fancyrsvp.checkin.ui.theme.GroundAlready
import com.fancyrsvp.checkin.ui.theme.GroundAlreadyDeep
import com.fancyrsvp.checkin.ui.theme.GroundForeign
import com.fancyrsvp.checkin.ui.theme.GroundForeignDeep
import com.fancyrsvp.checkin.ui.theme.GroundNotFound
import com.fancyrsvp.checkin.ui.theme.GroundNotFoundDeep
import com.fancyrsvp.checkin.ui.theme.GroundVip
import com.fancyrsvp.checkin.ui.theme.GroundVipDeep
import com.fancyrsvp.checkin.ui.theme.GroundWelcome
import com.fancyrsvp.checkin.ui.theme.GroundWelcomeDeep
import com.fancyrsvp.checkin.ui.theme.Ink
import com.fancyrsvp.checkin.ui.theme.OnAlready
import com.fancyrsvp.checkin.ui.theme.OnForeign
import com.fancyrsvp.checkin.ui.theme.OnVip
import com.fancyrsvp.checkin.ui.theme.OnWelcome

/**
 * Five states, from six outcomes.
 *
 * ── Why the reduction is the design, and where it went too far ──
 *
 * The repository reports six outcomes because six things can genuinely happen.
 * The SCREEN shows fewer, because an usher glancing at it for under two seconds
 * cannot rank six colours.
 *
 * It was four. Three outcomes collapsed into one not-found state on the grounds
 * that all three asked the same thing — search by name. That was right for two
 * of them and wrong for the third: an unrecognised code is not a guest the
 * tablet failed to place, it is an object that was never a ticket, and there is
 * no name to search for. Merging it saved a colour and cost the usher the one
 * fact that would have told them what to do. It is [Foreign] now.
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

    /** Not one of our codes at all. Dark oxblood — see [GroundForeign]. */
    Foreign,
    ;

    /**
     * The lit stop of the ground — also the flat colour anything that needs ONE
     * value should use (an inverted button label, for instance).
     */
    val ground: Color
        get() = when (this) {
            Welcome -> GroundWelcome
            Vip -> GroundVip
            Already -> GroundAlready
            NotFound -> GroundNotFound
            Foreign -> GroundForeign
        }

    /**
     * The shaded stop, toward the lower right.
     *
     * Every state is a gradient rather than a fill — see the note in Palette.kt.
     * A flat colour across a backlit tablet has no light in it, and that is most
     * of why these screens read as a coloured rectangle instead of a surface.
     */
    val groundDeep: Color
        get() = when (this) {
            Welcome -> GroundWelcomeDeep
            Vip -> GroundVipDeep
            Already -> GroundAlreadyDeep
            NotFound -> GroundNotFoundDeep
            Foreign -> GroundForeignDeep
        }

    /**
     * The colour for DISPLAY-size type — the guest name and the table number.
     *
     * Differs from [onGround] only on VIP, where the pale gold is what makes the
     * state read as foil rather than as mustard. Restricted to display sizes
     * because it clears 3:1 (the AA bar for large text) but not 4.5:1.
     */
    val onGroundDisplay: Color
        get() = if (this == Vip) FoilLight else onGround

    /** Text and rules on [ground]. Every pair clears 4.5:1 — see Palette.kt. */
    val onGround: Color
        get() = when (this) {
            Welcome -> OnWelcome
            Vip -> OnVip
            Already -> OnAlready
            NotFound -> Ink
            Foreign -> OnForeign
        }

    /** True when the ground is dark, so overlays must lighten rather than darken. */
    val isDarkGround: Boolean
        get() = this == Welcome || this == Vip || this == Foreign

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
            // Longest of the lot, and it is a safety net rather than the way out:
            // this state offers an explicit DONE button because the operator has a
            // decision to make — wave the next guest forward, or look this one up
            // by name. The timeout only exists so a red screen cannot be left
            // glowing at a door if they walk away mid-thought.
            Foreign -> 12_000L
        }
}

/**
 * The single place six outcomes become five.
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

    /*
     * These two are about a PERSON the tablet cannot place: a ticket for another
     * event, or a real ticket whose party is not in this bundle. Somebody is
     * standing there holding it. They stay on the calm, colourless ground — see
     * GroundNotFound.
     */
    is CheckInRepository.ScanOutcome.WrongEvent -> ResultVisual.NotFound
    CheckInRepository.ScanOutcome.NotFound -> ResultVisual.NotFound

    /*
     * This one is not about a person at all.
     *
     * It fires when the decoded value was never a Fancy ticket — a loyalty card,
     * a delivery label, a QR on a poster behind the queue. It used to render
     * identically to "we cannot find you", which was wrong twice over: it told an
     * usher to search by name for something that has no name attached, and it
     * made the two commonest scan failures indistinguishable at a glance.
     */
    CheckInRepository.ScanOutcome.Unrecognised -> ResultVisual.Foreign
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
