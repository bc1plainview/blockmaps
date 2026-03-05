import React from 'react';
import { useAudio } from '../hooks/useAudio.js';

export function MuteToggle(): React.ReactElement {
    const { isMuted, toggleMute } = useAudio();

    return (
        <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? 'Unmute sounds' : 'Mute sounds'}
            aria-pressed={!isMuted}
            style={{
                background: 'transparent',
                border: '2px solid var(--border-glass)',
                padding: '6px',
                cursor: 'pointer',
                color: isMuted ? 'var(--text-muted)' : 'var(--accent)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                imageRendering: 'pixelated',
                flexShrink: 0,
                transition: 'border-color 150ms step-start, color 150ms step-start',
            }}
            className="mute-toggle"
        >
            {isMuted ? (
                /* Speaker off — pixel art 16x16 grid rendered as SVG */
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    aria-hidden="true"
                    style={{ imageRendering: 'pixelated' }}
                >
                    {/* Speaker body */}
                    <rect x="1" y="5" width="3" height="6" />
                    <rect x="4" y="4" width="1" height="1" />
                    <rect x="4" y="11" width="1" height="1" />
                    <rect x="5" y="3" width="1" height="1" />
                    <rect x="5" y="12" width="1" height="1" />
                    <rect x="6" y="2" width="1" height="1" />
                    <rect x="6" y="13" width="1" height="1" />
                    <rect x="7" y="1" width="1" height="14" />
                    {/* X mark for muted */}
                    <rect x="10" y="5" width="2" height="2" />
                    <rect x="13" y="5" width="2" height="2" />
                    <rect x="11" y="7" width="2" height="2" />
                    <rect x="10" y="9" width="2" height="2" />
                    <rect x="13" y="9" width="2" height="2" />
                </svg>
            ) : (
                /* Speaker on with sound waves */
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    aria-hidden="true"
                    style={{ imageRendering: 'pixelated' }}
                >
                    {/* Speaker body */}
                    <rect x="1" y="5" width="3" height="6" />
                    <rect x="4" y="4" width="1" height="1" />
                    <rect x="4" y="11" width="1" height="1" />
                    <rect x="5" y="3" width="1" height="1" />
                    <rect x="5" y="12" width="1" height="1" />
                    <rect x="6" y="2" width="1" height="1" />
                    <rect x="6" y="13" width="1" height="1" />
                    <rect x="7" y="1" width="1" height="14" />
                    {/* Sound wave 1 */}
                    <rect x="9" y="6" width="1" height="4" />
                    {/* Sound wave 2 */}
                    <rect x="11" y="4" width="1" height="8" />
                    {/* Sound wave 3 */}
                    <rect x="13" y="2" width="1" height="12" />
                </svg>
            )}
        </button>
    );
}
