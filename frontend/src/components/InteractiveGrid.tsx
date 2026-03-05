import React, { useState, useCallback, useRef } from 'react';

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

    // Grid size mirrors on-chain algorithm
    const GRID_CELLS = 256; // max 16x16
    const gridDim = 16;
    const txsPerCell = Math.ceil(txCount / GRID_CELLS);
    const filledCells = Math.min(GRID_CELLS, txCount);

    const hashBytes = hashToBytes(hashHex);

    // Cell layout
    const viewBox = 320;
    const gridArea = 280;
    const gap = 2;
    const totalGap = (gridDim - 1) * gap;
    const cellSize = Math.floor((gridArea - totalGap) / gridDim);
    const offsetX = 20;
    const offsetY = 20;

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
    }, []);

    const handleCellLeave = useCallback((): void => {
        setTooltip(null);
    }, []);

    const handleCellClick = useCallback((cellIndex: number): void => {
        onCellClick(cellIndex);
        setTooltip(null);
    }, [onCellClick]);

    const cells: React.ReactElement[] = [];

    for (let row = 0; row < gridDim; row++) {
        for (let col = 0; col < gridDim; col++) {
            const cellIndex = row * gridDim + col;
            const x = offsetX + col * (cellSize + gap);
            const y = offsetY + row * (cellSize + gap);
            const rx = 2;
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
                        rx={rx}
                        fill={color}
                        opacity={isSelected ? 1 : opacity}
                        stroke={isSelected ? '#f7931a' : 'none'}
                        strokeWidth={isSelected ? 1.5 : 0}
                        className="grid-cell"
                        style={{
                            filter: isSelected
                                ? 'drop-shadow(0 0 4px rgba(247,147,26,0.8)) drop-shadow(0 0 8px rgba(247,147,26,0.4))'
                                : undefined,
                            animation: `cellReveal 200ms ease ${Math.min(cellIndex * 3, 400)}ms both`,
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
                        rx={rx}
                        fill="#ffffff"
                        opacity="0.025"
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
                style={{ display: 'block', width: '100%', height: 'auto' }}
                aria-label={`Interactive block grid for block #${blockHeight.toString()}. ${filledCells} transaction parcels.`}
                role="img"
            >
                <rect width={viewBox} height={viewBox} fill="#050510" />

                {/* Block height label */}
                <text
                    x={viewBox / 2}
                    y={14}
                    textAnchor="middle"
                    fill="#f7931a"
                    fontSize={11}
                    fontFamily="monospace"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                    BLOCK #{blockHeight.toString()}
                </text>

                <g>{cells}</g>

                {/* Footer labels */}
                <text x={20} y={viewBox - 6} fill="#555" fontSize={9} fontFamily="monospace">
                    {txCount.toLocaleString()} txns
                </text>
                <text x={viewBox - 20} y={viewBox - 6} textAnchor="end" fill="#555" fontSize={9} fontFamily="monospace">
                    {hashHex.substring(0, 8)}...
                </text>
            </svg>

            {/* Tooltip */}
            {tooltip && (
                <div
                    className="grid-tooltip"
                    style={{
                        left: Math.min(tooltip.x, window.innerWidth - 300),
                        top: Math.max(8, tooltip.y - 8),
                    }}
                    aria-hidden="true"
                >
                    <div style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: 4 }}>
                        Parcel {tooltip.cellIndex + 1}
                    </div>
                    {txsPerCell > 1 && (
                        <div style={{ color: 'var(--text-muted)', fontSize: 10, marginBottom: 4 }}>
                            Txns {tooltip.txStart + 1}&ndash;{tooltip.txEnd + 1}
                        </div>
                    )}
                    {tooltip.txid && (
                        <div style={{ color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                            {tooltip.txid.slice(0, 16)}...
                        </div>
                    )}
                    {!tooltip.txid && (
                        <div style={{ color: 'var(--text-muted)' }}>Click to load tx detail</div>
                    )}
                </div>
            )}
        </div>
    );
}
