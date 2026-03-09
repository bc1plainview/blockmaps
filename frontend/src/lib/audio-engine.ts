/**
 * Web Audio API sound engine.
 * Soft, subtle sounds — not annoying chiptune beeps.
 * AudioContext is created lazily after first user interaction.
 * Mute state persists in localStorage. Muted by default.
 */

const MUTE_KEY = 'blockmaps-muted';
const MAX_CONCURRENT = 3;

// Per-sound-type minimum intervals to prevent rapid-fire
const INTERVALS: Record<string, number> = {
    hover: 120,
    click: 80,
    mint: 500,
    success: 500,
    error: 500,
};

type SoundType = 'hover' | 'click' | 'mint' | 'success' | 'error';

let audioCtx: AudioContext | null = null;
let activeNodes = 0;
const lastPlayed: Partial<Record<SoundType, number>> = {};

function isMuted(): boolean {
    try {
        return localStorage.getItem(MUTE_KEY) !== 'false';
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

function canPlay(type: SoundType): boolean {
    if (isMuted()) return false;
    if (activeNodes >= MAX_CONCURRENT) return false;
    const now = performance.now();
    const last = lastPlayed[type] ?? 0;
    const interval = INTERVALS[type] ?? 100;
    if (now - last < interval) return false;
    lastPlayed[type] = now;
    return true;
}

interface NoteSpec {
    freq: number;
    startTime: number;
    duration: number;
    type?: OscillatorType;
    gainPeak?: number;
    decay?: number; // exponential decay time constant
}

function playNotes(notes: NoteSpec[], masterVol: number = 0.12): void {
    const ctx = getCtx();
    if (!ctx) return;

    activeNodes++;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(masterVol, ctx.currentTime);
    masterGain.connect(ctx.destination);

    let lastEnd = 0;

    for (const note of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = note.type ?? 'sine';
        osc.frequency.setValueAtTime(note.freq, ctx.currentTime + note.startTime);

        const peak = note.gainPeak ?? 0.5;
        const t = ctx.currentTime + note.startTime;
        const decay = note.decay ?? note.duration * 0.8;

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(peak, t + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, t + decay);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(t);
        osc.stop(t + note.duration + 0.01);

        lastEnd = Math.max(lastEnd, note.startTime + note.duration);
    }

    setTimeout(() => {
        masterGain.disconnect();
        activeNodes = Math.max(0, activeNodes - 1);
    }, (lastEnd + 0.1) * 1000);
}

/** Soft tick — triangle wave, very quiet, short decay */
export function playHover(): void {
    if (!canPlay('hover')) return;
    playNotes([
        { freq: 800, startTime: 0, duration: 0.04, type: 'triangle', gainPeak: 0.15, decay: 0.03 },
    ], 0.08);
}

/** Soft pop — sine with quick pitch drop */
export function playClick(): void {
    if (!canPlay('click')) return;
    const ctx = getCtx();
    if (!ctx) return;

    activeNodes++;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.08);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.25, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.1);

    setTimeout(() => {
        gain.disconnect();
        activeNodes = Math.max(0, activeNodes - 1);
    }, 150);
}

/** Warm ascending tones for minting */
export function playMint(): void {
    if (!canPlay('mint')) return;
    playNotes([
        { freq: 440, startTime: 0,    duration: 0.12, type: 'triangle', gainPeak: 0.4 },
        { freq: 554, startTime: 0.08, duration: 0.12, type: 'triangle', gainPeak: 0.4 },
        { freq: 659, startTime: 0.16, duration: 0.12, type: 'triangle', gainPeak: 0.5 },
        { freq: 880, startTime: 0.24, duration: 0.20, type: 'sine', gainPeak: 0.6 },
    ], 0.15);
}

/** Success chime — bright sine chord */
export function playSuccess(): void {
    if (!canPlay('success')) return;
    playNotes([
        { freq: 523, startTime: 0,    duration: 0.15, type: 'sine', gainPeak: 0.3 },
        { freq: 659, startTime: 0.06, duration: 0.15, type: 'sine', gainPeak: 0.3 },
        { freq: 784, startTime: 0.12, duration: 0.15, type: 'sine', gainPeak: 0.4 },
        { freq: 1047, startTime: 0.18, duration: 0.25, type: 'sine', gainPeak: 0.5 },
    ], 0.15);
}

/** Error — low soft buzz */
export function playError(): void {
    if (!canPlay('error')) return;
    playNotes([
        { freq: 180, startTime: 0,    duration: 0.15, type: 'triangle', gainPeak: 0.4 },
        { freq: 150, startTime: 0.12, duration: 0.15, type: 'triangle', gainPeak: 0.3 },
    ], 0.12);
}

/** New block notification — subtle high ping */
export function playNewBlock(): void {
    if (!canPlay('hover')) return;
    playNotes([
        { freq: 1200, startTime: 0, duration: 0.06, type: 'sine', gainPeak: 0.12, decay: 0.05 },
    ], 0.06);
}
