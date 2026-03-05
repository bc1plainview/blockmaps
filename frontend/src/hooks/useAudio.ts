import { useCallback, useEffect, useState } from 'react';
import {
    getMuted,
    toggleMuted,
    playHover,
    playClick,
    playMint,
    playSuccess,
    playError,
    playNewBlock,
} from '../lib/audio-engine.js';

interface UseAudioReturn {
    playHover: () => void;
    playClick: () => void;
    playMint: () => void;
    playSuccess: () => void;
    playError: () => void;
    playNewBlock: () => void;
    isMuted: boolean;
    toggleMute: () => void;
}

export function useAudio(): UseAudioReturn {
    const [isMuted, setIsMuted] = useState<boolean>(getMuted());

    // Initialize AudioContext on first user interaction
    useEffect((): (() => void) => {
        const initCtx = (): void => {
            // AudioContext is initialized lazily inside audio-engine on first play call.
            // This listener ensures the context state is known early.
            document.removeEventListener('click', initCtx, { capture: true });
        };
        document.addEventListener('click', initCtx, { capture: true });
        return (): void => {
            document.removeEventListener('click', initCtx, { capture: true });
        };
    }, []);

    const handleToggleMute = useCallback((): void => {
        const next = toggleMuted();
        setIsMuted(next);
    }, []);

    return {
        playHover,
        playClick,
        playMint,
        playSuccess,
        playError,
        playNewBlock,
        isMuted,
        toggleMute: handleToggleMute,
    };
}
