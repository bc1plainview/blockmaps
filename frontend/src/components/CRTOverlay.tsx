import React from 'react';

/**
 * Fixed full-screen CRT scanline and vignette overlay.
 * pointer-events: none so it never intercepts clicks.
 * Hidden when prefers-reduced-motion is set (handled via CSS class).
 */
export function CRTOverlay(): React.ReactElement {
    return (
        <div
            className="crt-overlay"
            aria-hidden="true"
            style={{ pointerEvents: 'none' }}
        />
    );
}
