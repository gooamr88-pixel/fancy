package com.fancyrsvp.checkin.ui.theme

import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import com.fancyrsvp.checkin.R

/**
 * The platform's typefaces — the same three the website uses.
 *
 * Extracted from the web build's font cache and converted to TTF, because
 * `res/font/` reads TTF and OTF only; WOFF2 is a web container and will not
 * load. Google Sans ships as a variable font (wght 400-700) and was instanced
 * into four static weights, so rendering does not depend on Compose's
 * variable-font support matching whatever Android version the tablet runs.
 *
 * ── The script problem, and why there are two display faces ──
 *
 * Aboreto and Google Sans are Latin-only: neither has a single Arabic glyph.
 * Most guests at these events have Arabic names. Setting `أحمد عبد الله` in
 * Aboreto does not fall back gracefully to something similar — Android
 * substitutes its own system font for the missing characters, so a guest list
 * would mix an engraved display face with stock Roboto down the same column.
 *
 * Aref Ruqaa is the platform's Arabic face (it is already imported by the
 * website for exactly this) and is the only one here with Arabic coverage.
 * [displayFamilyFor] picks between them per string.
 */

/** Guest names, event titles, the arrived figure. Latin only. */
val DisplayFont = FontFamily(
    Font(R.font.aboreto_regular, FontWeight.Normal),
)

/** The Arabic counterpart to [DisplayFont]. */
val ArabicDisplayFont = FontFamily(
    Font(R.font.aref_ruqaa_regular, FontWeight.Normal),
    Font(R.font.aref_ruqaa_bold, FontWeight.Bold),
)

/** Every control, label and status. */
val UiFont = FontFamily(
    Font(R.font.google_sans_regular, FontWeight.Normal),
    Font(R.font.google_sans_medium, FontWeight.Medium),
    Font(R.font.google_sans_semibold, FontWeight.SemiBold),
    Font(R.font.google_sans_bold, FontWeight.Bold),
)

/** The wordmark. Used once, on the login screen, and nowhere else. */
val ScriptFont = FontFamily(
    Font(R.font.great_vibes_regular, FontWeight.Normal),
)

/**
 * Chooses the display face that can actually render [text].
 *
 * Checks the Arabic Unicode blocks — Arabic (0600-06FF), Supplement (0750-077F)
 * and Presentation Forms (FB50-FDFF, FE70-FEFF) — rather than a locale setting,
 * because the decision is about THIS string. One event's guest list routinely
 * holds both `Layla Haddad` and `أحمد عبد الله`, and the locale is the same for
 * both.
 *
 * Falls back to the Latin face for mixed strings only when no Arabic is present;
 * a name containing any Arabic is set entirely in Aref Ruqaa, which keeps one
 * name in one typeface instead of splitting it mid-word.
 */
fun displayFamilyFor(text: String): FontFamily =
    if (text.any { ch ->
            val c = ch.code
            (c in 0x0600..0x06FF) || (c in 0x0750..0x077F) ||
                (c in 0xFB50..0xFDFF) || (c in 0xFE70..0xFEFF)
        }
    ) {
        ArabicDisplayFont
    } else {
        DisplayFont
    }
