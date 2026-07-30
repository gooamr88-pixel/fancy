package com.fancyrsvp.checkin.ui.pair

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.fancyrsvp.checkin.data.repo.DeviceRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Device pairing (spec §18.3).
 *
 * Requires internet, and is done during preparation — never at the venue.
 */
@HiltViewModel
class PairViewModel @Inject constructor(
    private val deviceRepository: DeviceRepository,
) : ViewModel() {

    sealed interface State {
        data object Idle : State
        data object Pairing : State
        data class Paired(val eventId: String, val deviceLabel: String) : State
        data class Error(val kind: Kind, val detail: String? = null) : State
    }

    /**
     * Distinguished failures, because each needs different words in front of an
     * operator: a wrong code is retypeable, an expired one needs a new code from
     * the dashboard, and a device-limit failure needs an admin to revoke something
     * first. A single "pairing failed" would leave them guessing.
     */
    enum class Kind { INVALID_CODE, EXPIRED, DEVICE_LIMIT, OFFLINE, SERVER }

    private val _state = MutableStateFlow<State>(State.Idle)
    val state: StateFlow<State> = _state.asStateFlow()

    private val _code = MutableStateFlow("")
    val code: StateFlow<String> = _code.asStateFlow()

    val isPaired: Boolean get() = deviceRepository.isPaired
    val pairedEventId: String? get() = deviceRepository.pairedEventId

    /**
     * Accepts typed input, normalising as it goes.
     *
     * Uppercased and stripped of separators so a code read off a dashboard screen
     * can be typed with or without spacing, and capped at length so the field
     * cannot silently accumulate extra characters past a valid code.
     */
    fun onCodeChanged(raw: String) {
        _code.value = raw.uppercase().filter { it.isLetterOrDigit() }.take(CODE_LENGTH)
        if (_state.value is State.Error) _state.value = State.Idle
    }

    val canSubmit: Boolean get() = _code.value.length == CODE_LENGTH && _state.value !is State.Pairing

    fun submit() {
        if (!canSubmit) return

        _state.value = State.Pairing
        viewModelScope.launch {
            _state.value = when (val result = deviceRepository.pair(_code.value)) {
                is DeviceRepository.PairResult.Success ->
                    State.Paired(result.eventId, result.deviceLabel)
                DeviceRepository.PairResult.InvalidCode -> State.Error(Kind.INVALID_CODE)
                DeviceRepository.PairResult.CodeExpired -> State.Error(Kind.EXPIRED)
                DeviceRepository.PairResult.DeviceLimitReached -> State.Error(Kind.DEVICE_LIMIT)
                DeviceRepository.PairResult.Offline -> State.Error(Kind.OFFLINE)
                is DeviceRepository.PairResult.Failed ->
                    State.Error(Kind.SERVER, "${result.code} ${result.message ?: ""}".trim())
            }
        }
    }

    private companion object {
        const val CODE_LENGTH = 8
    }
}
