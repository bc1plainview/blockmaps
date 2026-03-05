import { useCallback, useState } from 'react';
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
