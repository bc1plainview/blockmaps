import React from 'react';
import { hashToBytes, previewCellColor, gridDimForTxCount } from '../lib/grid-colors.js';

interface SVGPreviewProps {
    blockHeight: bigint;
    hashHex: string;
    txCount?: number;
    size?: number;
    className?: string;
}

/**
 * Renders a grid preview using the same weight-based heat palette as the detail page.
 * Uses simulated weight distribution when no real tx data is available.
 * Empty cells (beyond actual tx count) are not rendered.
 */
export function SVGPreview({ blockHeight, hashHex, txCount = 256, size = 280, className = '' }: SVGPreviewProps): React.ReactElement {
    const gridDim = gridDimForTxCount(txCount);
    const viewBox = 280;
    const gap = gridDim <= 16 ? 1 : 0;
    const totalGap = (gridDim - 1) * gap;
    const cellSize = (viewBox - totalGap) / gridDim;
    const totalCells = gridDim * gridDim;
    const txsPerCell = Math.max(1, Math.ceil(txCount / totalCells));
    const filledCells = Math.min(totalCells, Math.ceil(txCount / txsPerCell));
    const hashBytes = hashToBytes(hashHex);

    const cells: React.ReactElement[] = [];

    for (let row = 0; row < gridDim; row++) {
        for (let col = 0; col < gridDim; col++) {
            const cellIndex = row * gridDim + col;
            if (cellIndex >= filledCells) continue; // empty — skip entirely

            const x = col * (cellSize + gap);
            const y = row * (cellSize + gap);

            const { color, opacity } = previewCellColor(
                hashBytes, cellIndex, txCount, totalCells, [], { min: 1, max: 100 },
            );

            cells.push(
                <rect
                    key={cellIndex}
                    x={x}
                    y={y}
                    width={cellSize}
                    height={cellSize}
                    rx={0}
                    fill={color}
                    opacity={opacity}
                />,
            );
        }
    }

    return (
        <svg
            viewBox={`0 0 ${viewBox} ${viewBox}`}
            width={size}
            height={size}
            className={className}
            style={{ display: 'block', width: '100%', height: 'auto', imageRendering: 'pixelated' }}
            aria-label={`BlockMap #${blockHeight.toString()}`}
            role="img"
        >
            <rect width={viewBox} height={viewBox} fill="#020208" rx="0" />
            <g>{cells}</g>
        </svg>
    );
}
