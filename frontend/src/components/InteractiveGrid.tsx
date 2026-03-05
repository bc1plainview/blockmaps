import React, { useState, useCallback, useRef } from 'react';
import { useAudio } from '../hooks/useAudio.js';

const PALETTE: readonly string[] = [
    '#f7931a', '#ffcc00', '#ff6b00', '#ffa940',
    '#e8821a', '#ffdd44', '#cc5500', '#ffb732',
    '#ff8c00', '#f5a623', '#e67300', '#ffc93c',
    '#d4760a', '#ffaa00', '#b35c00', '#ffe066',
];

function opacityStr(byteVal: number): string {
    const scaled = 40 + Math.floor(byteVal * 60 / 255);
    if (scaled >= 100) return '1';
    const tens = Math.floor(scaled / 10);
    const ones = scaled % 10;
    return `0.${tens}${ones}`;
}

function hashToBytes(hashHex: string): number[] {
    const hexStr = hashHex.startsWith('0x') ? hashHex.slice(2) : hashHex;
    const bytes: number[] = [];
    for (let i = 0; i < 32; i += 2) {
        bytes.push(parseInt(hexStr.substring(i, i + 2), 16));
    }
    return bytes;
}

interface TooltipData {
    x: number;
    y: number;
    cellIndex: number;
    txid: string | null;
    txStart: number;
    txEnd: number;
}

interface InteractiveGridProps {
    blockHeight: bigint;
    hashHex: string;
    txCount: number;
    txids?: string[];
    selectedCell: number | null;
    onCellClick: (cellIndex: number) => void;
}

/**
 * SVG interactive grid where each cell = 1 (or N) transaction(s).
 * Uses same color palette as on-chain SVG generator.
 * Hover shows tooltip, click fires onCellClick.
 * Pixel aesthetic: square cells (rx=0), stepped animations, chiptune audio.
 */
export function InteractiveGrid({
    blockHeight,
    hashHex,
    txCount,
    txids = [],
    selectedCell,
    onCellClick,
}: InteractiveGridProps): React.ReactElement {
    const [tooltip, setTooltip] = useState<TooltipData | null>(null);
    const svgRef = useRef<SVGSVGElement | null>(null);
    const { playHover, playClick } = useAudio();

    // Grid size mirrors on-chain algorithm
    const GRID_CELLS = 256; // max 16x16
    const gridDim = 16;
    const txsPerCell = Math.ceil(txCount / GRID_CELLS);
    const filledCells = Math.min(GRID_CELLS, txCount);

    const hashBytes = hashToBytes(hashHex);

    // Cell layout — zero gap for pixel-tight grid
    const viewBox = 320;
    const gridArea = 288;
    const gap = 1; // pixel-tight: 1px gap
    const totalGap = (gridDim - 1) * gap;
    const cellSize = Math.floor((gridArea - totalGap) / gridDim);
    const offsetX = 16;
    const offsetY = 16;

    const handleCellEnter = useCallback((
        e: React.MouseEvent<SVGRectElement>,
        cellIndex: number,
        txStart: number,
        txEnd: number,
        txid: string | null,
    ): void => {
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltip({
            x: rect.right + 8,
            y: rect.top,
            cellIndex,
            txid,
            txStart,
            txEnd,
        });
        playHover();
    }, [playHover]);

    const handleCellLeave = useCallback((): void => {
        setTooltip(null);
    }, []);

    const handleCellClick = useCallback((cellIndex: number): void => {
        onCellClick(cellIndex);
        setTooltip(null);
        playClick();
    }, [onCellClick, playClick]);

    const cells: React.ReactElement[] = [];

    for (let row = 0; row < gridDim; row++) {
        for (let col = 0; col < gridDim; col++) {
            const cellIndex = row * gridDim + col;
            const x = offsetX + col * (cellSize + gap);
            const y = offsetY + row * (cellSize + gap);
            // rx=0 for pixel aesthetic
            const isSelected = selectedCell === cellIndex;

            if (cellIndex < filledCells) {
                const hashIdx = cellIndex % 16;
                const byteVal = hashBytes[hashIdx] ?? 0;
                const colorByte = (byteVal + cellIndex) & 0xff;
                const color = PALETTE[colorByte & 0x0f] ?? PALETTE[0];
                const opacity = opacityStr(byteVal);

                const txStart = cellIndex * txsPerCell;
                const txEnd = Math.min(txCount - 1, txStart + txsPerCell - 1);
                const txid = txids[txStart] ?? null;

                cells.push(
                    <rect
                        key={cellIndex}
                        x={x}
                        y={y}
                        width={cellSize}
                        height={cellSize}
                        rx={0}
                        fill={color}
                        opacity={isSelected ? 1 : opacity}
                        stroke={isSelected ? '#f7931a' : 'none'}
                        strokeWidth={isSelected ? 2 : 0}
                        className="grid-cell"
                        style={{
                            filter: isSelected
                                ? 'drop-shadow(2px 2px 0 rgba(247,147,26,1)) drop-shadow(4px 4px 0 rgba(247,147,26,0.5))'
                                : undefined,
                            animation: `cellReveal 200ms steps(4) ${Math.min(cellIndex * 3, 400)}ms both`,
                        }}
                        onMouseEnter={(e) => handleCellEnter(e, cellIndex, txStart, txEnd, txid)}
                        onMouseLeave={handleCellLeave}
                        onClick={() => handleCellClick(cellIndex)}
                        role="button"
                        aria-label={`Transaction parcel ${cellIndex + 1}${txsPerCell > 1 ? ` (tx ${txStart + 1}–${txEnd + 1})` : ''}`}
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleCellClick(cellIndex);
                            }
                        }}
                    />,
                );
            } else {
                cells.push(
                    <rect
                        key={cellIndex}
                        x={x}
                        y={y}
                        width={cellSize}
                        height={cellSize}
                        rx={0}
                        fill="#ffffff"
                        opacity="0.02"
                    />,
                );
            }
        }
    }

    return (
        <div style={{ position: 'relative' }}>
            <svg
                ref={svgRef}
                viewBox={`0 0 ${viewBox} ${viewBox}`}
                className="interactive-grid"
                style={{
                    display: 'block',
                    width: '100%',
                    height: 'auto',
                    imageRendering: 'pixelated',
                }}
                aria-label={`Interactive block grid for block #${blockHeight.toString()}. ${filledCells} transaction parcels.`}
                role="img"
            >
                {/* Dark pixel background */}
                <rect width={viewBox} height={viewBox} fill="#020208" />

                {/* Subtle pixel dot grid */}
                <pattern id="pixelDots" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
                    <rect x="0" y="0" width="1" height="1" fill="#ffffff" opacity="0.015" />
                </pattern>
                <rect width={viewBox} height={viewBox} fill="url(#pixelDots)" />

                {/* Block height label */}
                <text
                    x={viewBox / 2}
                    y={12}
                    textAnchor="middle"
                    fill="#f7931a"
                    fontSize={8}
                    fontFamily="'Press Start 2P', monospace"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                    BLK #{blockHeight.toString()}
                </text>

                <g>{cells}</g>

                {/* Footer labels */}
                <text x={offsetX} y={viewBox - 4} fill="#333355" fontSize={7} fontFamily="'Press Start 2P', monospace">
                    {txCount.toLocaleString()} TXS
                </text>
                <text x={viewBox - offsetX} y={viewBox - 4} textAnchor="end" fill="#333355" fontSize={7} fontFamily="'Press Start 2P', monospace">
                    {hashHex.substring(0, 8)}
                </text>
            </svg>

            {/* Pixel tooltip */}
            {tooltip && (
                <div
                    className="grid-tooltip"
                    style={{
                        left: Math.min(tooltip.x, window.innerWidth - 260),
                        top: Math.max(8, tooltip.y - 8),
                    }}
                    aria-hidden="true"
                >
                    <div style={{ color: 'var(--accent)', marginBottom: 6, fontSize: 9 }}>
                        PARCEL {tooltip.cellIndex + 1}
                    </div>
                    {txsPerCell > 1 && (
                        <div style={{ color: 'var(--text-muted)', fontSize: 7, marginBottom: 4 }}>
                            TX {tooltip.txStart + 1}&ndash;{tooltip.txEnd + 1}
                        </div>
                    )}
                    {tooltip.txid && (
                        <div style={{ color: 'var(--text-secondary)', wordBreak: 'break-all', fontSize: 7 }}>
                            {tooltip.txid.slice(0, 14)}...
                        </div>
                    )}
                    {!tooltip.txid && (
                        <div style={{ color: 'var(--text-muted)', fontSize: 7 }}>Click to load tx</div>
                    )}
                </div>
            )}
        </div>
    );
}
