/**
 * Web Audio API chiptune sound engine.
 * All sound generation is oscillator-based — zero external dependencies.
 * AudioContext is created lazily after first user interaction.
 * Mute state persists in localStorage.
 */

const MUTE_KEY = 'blockmaps-muted';
const MIN_INTERVAL_MS = 50;
const MAX_CONCURRENT = 3;

type SoundType = 'hover' | 'click' | 'mint' | 'success' | 'error';

let audioCtx: AudioContext | null = null;
let activeNodes = 0;
const lastPlayed: Partial<Record<SoundType, number>> = {};

function isMuted(): boolean {
    try {
        return localStorage.getItem(MUTE_KEY) === 'true';
    } catch {
        return true;
    }
}

export function getMuted(): boolean {
    return isMuted();
}

export function setMuted(value: boolean): void {
    try {
        localStorage.setItem(MUTE_KEY, value ? 'true' : 'false');
    } catch {
        // localStorage unavailable
    }
}

export function toggleMuted(): boolean {
    const next = !isMuted();
    setMuted(next);
    return next;
}

/** Initialize AudioContext lazily. Safe to call from user gesture handlers. */
function getCtx(): AudioContext | null {
    if (typeof AudioContext === 'undefined') return null;
    if (!audioCtx) {
        try {
            audioCtx = new AudioContext();
        } catch {
            return null;
        }
    }
    if (audioCtx.state === 'suspended') {
        void audioCtx.resume();
    }
    return audioCtx;
}

/** Pitch variation: +/- 5% random */
function jitter(freq: number): number {
    return freq * (0.95 + Math.random() * 0.1);
}

function canPlay(type: SoundType): boolean {
    if (isMuted()) return false;
    if (activeNodes >= MAX_CONCURRENT) return false;
    const now = performance.now();
    const last = lastPlayed[type] ?? 0;
    if (now - last < MIN_INTERVAL_MS) return false;
    lastPlayed[type] = now;
    return true;
}

type OscillatorType = 'square' | 'sawtooth' | 'sine' | 'triangle';

interface NoteSpec {
    freq: number;
    startTime: number;
    duration: number;
    type?: OscillatorType;
    gainPeak?: number;
}

function playNotes(notes: NoteSpec[]): void {
    const ctx = getCtx();
    if (!ctx) return;

    activeNodes++;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.18, ctx.currentTime);
    masterGain.connect(ctx.destination);

    let lastEnd = 0;

    for (const note of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = note.type ?? 'square';
        osc.frequency.setValueAtTime(jitter(note.freq), ctx.currentTime + note.startTime);

        const peak = note.gainPeak ?? 0.6;
        const t = ctx.currentTime + note.startTime;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(peak, t + 0.008);
        gain.gain.linearRampToValueAtTime(0, t + note.duration);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(t);
        osc.stop(t + note.duration + 0.01);

        lastEnd = Math.max(lastEnd, note.startTime + note.duration);
    }

    // Release master node reference after all notes finish
    setTimeout(() => {
        masterGain.disconnect();
        activeNodes = Math.max(0, activeNodes - 1);
    }, (lastEnd + 0.1) * 1000);
}

/** Short high-pitched square wave blip (C6, 30ms) */
export function playHover(): void {
    if (!canPlay('hover')) return;
    playNotes([{ freq: 1046.5, startTime: 0, duration: 0.03, type: 'square', gainPeak: 0.3 }]);
}

/** Medium square wave click (G5, 50ms) */
export function playClick(): void {
    if (!canPlay('click')) return;
    playNotes([{ freq: 783.99, startTime: 0, duration: 0.05, type: 'square', gainPeak: 0.5 }]);
}

/** Ascending arpeggio C5-E5-G5-C6 (200ms total) */
export function playMint(): void {
    if (!canPlay('mint')) return;
    playNotes([
        { freq: 523.25, startTime: 0,     duration: 0.05, type: 'square' },
        { freq: 659.25, startTime: 0.05,  duration: 0.05, type: 'square' },
        { freq: 783.99, startTime: 0.10,  duration: 0.05, type: 'square' },
        { freq: 1046.5, startTime: 0.15,  duration: 0.05, type: 'square' },
    ]);
}

/** Triumphant fanfare C5-E5-G5-C6 with longer sustain (400ms) */
export function playSuccess(): void {
    if (!canPlay('success')) return;
    playNotes([
        { freq: 523.25, startTime: 0,     duration: 0.08, type: 'square' },
        { freq: 659.25, startTime: 0.08,  duration: 0.08, type: 'square' },
        { freq: 783.99, startTime: 0.16,  duration: 0.08, type: 'square' },
        { freq: 1046.5, startTime: 0.24,  duration: 0.16, type: 'square', gainPeak: 0.8 },
    ]);
}

/** Descending buzzy saw wave (C4-A3, 200ms) */
export function playError(): void {
    if (!canPlay('error')) return;
    playNotes([
        { freq: 261.63, startTime: 0,    duration: 0.10, type: 'sawtooth', gainPeak: 0.5 },
        { freq: 220.00, startTime: 0.10, duration: 0.10, type: 'sawtooth', gainPeak: 0.4 },
    ]);
}

/** Subtle new-block blip (D6, very quiet, 20ms) */
export function playNewBlock(): void {
    if (!canPlay('hover')) return;
    playNotes([{ freq: 1174.66, startTime: 0, duration: 0.02, type: 'square', gainPeak: 0.15 }]);
}
