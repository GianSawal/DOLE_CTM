/**
 * Airport Announcement Chime Synthesizer & Cross-Tab Chime Bus (Web Audio API)
 *
 * Implements an acoustic simulation of physical metal chime bars (tubular bells)
 * commonly used in international airport Public Address (PA) and gate announcement systems.
 */

let sharedAudioCtx = null;

export const CHIME_BROADCAST_CHANNEL = 'dole_ctms_queue_chime';

export function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!sharedAudioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
  }
  return sharedAudioCtx;
}

export async function unlockAudioContext() {
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      await ctx.resume();
    }
    return ctx?.state === 'running';
  } catch {
    return false;
  }
}

export function isAudioUnlocked() {
  return Boolean(sharedAudioCtx && sharedAudioCtx.state === 'running');
}

/**
 * Broadcasts a call/recall event across open browser tabs/windows.
 */
export function broadcastQueueCall(payload = {}) {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(CHIME_BROADCAST_CHANNEL);
      bc.postMessage({
        type: 'QUEUE_CALLED',
        timestamp: Date.now(),
        ...payload,
      });
      bc.close();
    }
    // Also dispatch to localStorage as an extra cross-window fallback
    try {
      localStorage.setItem('dole_last_queue_call', JSON.stringify({
        timestamp: Date.now(),
        ...payload,
      }));
    } catch {}
  } catch (err) {
    console.debug('broadcastQueueCall notice:', err);
  }
}

/**
 * Chime Presets:
 * 1. classic4: Iconic 4-tone ascending major chime (F4 -> A4 -> C5 -> F5).
 *    Universally recognized in premier international airports (Changi, Haneda, Heathrow).
 * 2. classic3: Crisp 3-tone ascending chime (C5 -> G5 -> C6).
 */
export const CHIME_PRESETS = {
  classic4: {
    id: 'classic4',
    name: 'Airport Chime (4-Tone Ascending)',
    notes: [
      { freq: 349.23, delay: 0.00, duration: 0.90, gain: 0.32 }, // F4
      { freq: 440.00, delay: 0.28, duration: 0.90, gain: 0.34 }, // A4
      { freq: 523.25, delay: 0.56, duration: 1.00, gain: 0.36 }, // C5
      { freq: 698.46, delay: 0.84, duration: 1.75, gain: 0.40 }, // F5 (lingering chord resolution)
    ],
  },
  classic3: {
    id: 'classic3',
    name: 'Airport Chime (3-Tone)',
    notes: [
      { freq: 523.25, delay: 0.00, duration: 0.95, gain: 0.32 }, // C5
      { freq: 783.99, delay: 0.35, duration: 0.95, gain: 0.35 }, // G5
      { freq: 1046.50, delay: 0.70, duration: 1.70, gain: 0.40 }, // C6
    ],
  },
};

/**
 * Plays the airport announcement chime.
 * @param {string} presetKey - 'classic4' (default) or 'classic3'
 */
export async function playAirportChime(presetKey = 'classic4') {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }

    const preset = CHIME_PRESETS[presetKey] || CHIME_PRESETS.classic4;
    const now = ctx.currentTime;

    // Master volume control
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.9, now);
    masterGain.connect(ctx.destination);

    preset.notes.forEach(({ freq, delay, duration, gain: noteGain }) => {
      const startTime = now + delay;
      const endTime = startTime + duration;

      // 1. Primary fundamental tone: pure sinusoidal acoustic chime
      const oscPrimary = ctx.createOscillator();
      const gainPrimary = ctx.createGain();
      oscPrimary.type = 'sine';
      oscPrimary.frequency.setValueAtTime(freq, startTime);

      // Percussive mallet strike: rapid 6ms attack followed by smooth exponential decay
      gainPrimary.gain.setValueAtTime(0.0001, startTime);
      gainPrimary.gain.exponentialRampToValueAtTime(noteGain, startTime + 0.006);
      gainPrimary.gain.exponentialRampToValueAtTime(0.0001, endTime);

      oscPrimary.connect(gainPrimary);
      gainPrimary.connect(masterGain);

      oscPrimary.start(startTime);
      oscPrimary.stop(endTime);

      // 2. High metallic chime overtone (~2.76x physical chime bar inharmonic mode)
      const oscOvertone = ctx.createOscillator();
      const gainOvertone = ctx.createGain();
      oscOvertone.type = 'sine';
      oscOvertone.frequency.setValueAtTime(freq * 2.76, startTime);

      const overtoneDuration = duration * 0.40;
      gainOvertone.gain.setValueAtTime(0.0001, startTime);
      gainOvertone.gain.exponentialRampToValueAtTime(noteGain * 0.18, startTime + 0.004);
      gainOvertone.gain.exponentialRampToValueAtTime(0.0001, startTime + overtoneDuration);

      oscOvertone.connect(gainOvertone);
      gainOvertone.connect(masterGain);

      oscOvertone.start(startTime);
      oscOvertone.stop(startTime + overtoneDuration);

      // 3. Octave harmonic (2.0x) for warmth and rich body
      const oscOctave = ctx.createOscillator();
      const gainOctave = ctx.createGain();
      oscOctave.type = 'sine';
      oscOctave.frequency.setValueAtTime(freq * 2.0, startTime);

      const octaveDuration = duration * 0.55;
      gainOctave.gain.setValueAtTime(0.0001, startTime);
      gainOctave.gain.exponentialRampToValueAtTime(noteGain * 0.14, startTime + 0.005);
      gainOctave.gain.exponentialRampToValueAtTime(0.0001, startTime + octaveDuration);

      oscOctave.connect(gainOctave);
      gainOctave.connect(masterGain);

      oscOctave.start(startTime);
      oscOctave.stop(startTime + octaveDuration);
    });
  } catch (err) {
    console.warn('Airport chime audio playback notice:', err);
  }
}
