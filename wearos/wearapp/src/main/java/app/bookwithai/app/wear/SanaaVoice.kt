package app.bookwithai.app.wear

import android.content.Context
import android.speech.tts.TextToSpeech
import java.util.Locale

/**
 * Speaks the Ask SANAA answer using Android's built-in, on-device
 * TextToSpeech engine (android.speech.tts) -- free, no network call, no
 * paid speech/AI service of any kind. First use on a given watch may
 * trigger the OS's own one-time "install voice data" prompt on some
 * devices; that is standard platform behavior, not something this app
 * controls or can bypass.
 */
object SanaaVoice {
    private var tts: TextToSpeech? = null
    private var ready = false

    fun speak(context: Context, text: String) {
        val engine = tts ?: TextToSpeech(context.applicationContext) { status ->
            ready = status == TextToSpeech.SUCCESS
            if (ready) tts?.language = Locale.US
        }.also { tts = it }

        if (ready) {
            engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, "sanaa_answer")
        }
        // If not yet ready (engine still initializing on first-ever call),
        // the answer is still shown as text on screen -- speech is a bonus,
        // not the only way the answer is conveyed.
    }
}
