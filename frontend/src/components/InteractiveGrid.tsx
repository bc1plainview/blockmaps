import React, { useState, useCallback, useRef } from 'react';
import { useAudio } from '../hooks/useAudio.js';
import type { TxWeightData } from '../hooks/useBlockTxWeights.js';
import {
    hashToBytes,
    cellColorLoading,
    cellColorFromTx,
    aggregateCellTxData,
    gridDimForTxCount,
} from '../lib/grid-colors.js';

interface TooltipData {
    x: number;
    y: number;
    cellIndex: number;
    txid: string | null;
    txStart: number;
    txEnd: number;
    feeRate: string | null;
}

interface InteractiveGridProps {
    blockHeight: bigint;
    hashHex: string;
    txCount: number;
    txids?: string[];
    txWeights?: (TxWeightData | null)[];
    feeRateRange?: { min: number; max: number };
    weightsProgress?: number;
    selectedCell: number | null;
    onCellClick: (cellIndex: number) => void;
}

export function InteractiveGrid({
    blockHeight,
    hashHex,
    txCount,
    txids = [],
    txWeights = [],
    feeRateRange = { min: 1, max: 100 },
    weightsProgress = 0,
    selectedCell,
    onCellClick,
}: InteractiveGridProps): React.ReactElement {
    const [tooltip, setTooltip] = useState<TooltipData | null>(null);
    const svgRef = useRef<SVGSVGElement | null>(null);
    const { playHover, playClick } = useAudio();

    const gridDim = gridDimForTxCount(txCount);
    const totalCells = gridDim * gridDim;
    const txsPerCell = Math.max(1, Math.ceil(txCount / totalCells));
    const filledCells = Math.min(totalCells, Math.ceil(txCount / txsPerCell));

    const hashBytes = hashToBytes(hashHex);

    const viewBox = 320;
    const gridArea = 288;
    const gap = gridDim <= 16 ? 1 : 0;
    const totalGap = (gridDim - 1) * gap;
    const cellSize = (gridArea - totalGap) / gridDim;
    const offsetX = 16;
    const offsetY = 16;

    const handleCellEnter = useCallback((
        e: React.MouseEvent<SVGRectElement>,
        cellIndex: number,
        txStart: number,
        txEnd: number,
        txid: string | null,
        feeRate: string | null,
    ): void => {
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltip({ x: rect.right + 8, y: rect.top, cellIndex, txid, txStart, txEnd, feeRate });
        playHover();
    }, [playHover]);

    const handleCellLeave = useCallback((): void => { setTooltip(null); }, []);

    const handleCellClick = useCallback((cellIndex: number): void => {
        onCellClick(cellIndex);
        setTooltip(null);
        playClick();
    }, [onCellClick, playClick]);

    const getCellColor = useCallback((cellIndex: number): { color: string; opacity: number } => {
        const txStart = cellIndex * txsPerCell;
        const txEnd = Math.min(txCount, txStart + txsPerCell);
        const isCoinbase = txStart === 0;

        const cellTxData: TxWeightData[] = [];
        for (let i = txStart; i < txEnd; i++) {
            const w = txWeights[i];
            if (w) cellTxData.push(w);
        }

        if (cellTxData.length > 0) {
            const agg = aggregateCellTxData(cellTxData);
            return cellColorFromTx(agg, feeRateRange.min, feeRateRange.max, isCoinbase);
        }

        return cellColorLoading(hashBytes, cellIndex);
    }, [txsPerCell, txCount, txWeights, feeRateRange, hashBytes]);

    const cells: React.ReactElement[] = [];

    for (let row = 0; row < gridDim; row++) {
        for (let col = 0; col < gridDim; col++) {
            const cellIndex = row * gridDim + col;
            const x = offsetX + col * (cellSize + gap);
            const y = offsetY + row * (cellSize + gap);
            const isSelected = selectedCell === cellIndex;

            if (cellIndex < filledCells) {
                const { color, opacity } = getCellColor(cellIndex);
                const txStart = cellIndex * txsPerCell;
                const txEnd = Math.min(txCount - 1, txStart + txsPerCell - 1);
                const txid = txids[txStart] ?? null;

                let feeRateStr: string | null = null;
                const firstTx = txWeights[txStart];
                if (firstTx && firstTx.weight > 0) {
                    const rate = firstTx.fee / (firstTx.weight / 4);
                    feeRateStr = rate.toFixed(1) + ' sat/vB';
                }

                const isInteractive = gridDim <= 32;

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
                            animation: gridDim <= 16
                                ? `cellReveal 200ms steps(4) ${Math.min(cellIndex * 3, 400)}ms both`
                                : `cellReveal 100ms steps(4) ${Math.min(cellIndex * 0.5, 300)}ms both`,
                        }}
                        onMouseEnter={isInteractive ? (e: React.MouseEvent<SVGRectElement>): void => handleCellEnter(e, cellIndex, txStart, txEnd, txid, feeRateStr) : undefined}
                        onMouseLeave={isInteractive ? handleCellLeave : undefined}
                        onClick={(): void => handleCellClick(cellIndex)}
                        role="button"
                        aria-label={`Transaction parcel ${cellIndex + 1}${txsPerCell > 1 ? ` (tx ${txStart + 1}–${txEnd + 1})` : ''}`}
                        tabIndex={isInteractive ? 0 : -1}
                        onKeyDown={isInteractive ? (e: React.KeyboardEvent<SVGRectElement>): void => {
                            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCellClick(cellIndex); }
                        } : undefined}
                    />,
                );
            } else {
                // Empty cell — no transaction data, don't render
            }
        }
    }

    return (
        <div style={{ position: 'relative' }}>
            <svg
                ref={svgRef}
                viewBox={`0 0 ${viewBox} ${viewBox}`}
                className="interactive-grid"
                style={{ display: 'block', width: '100%', height: 'auto', imageRendering: 'pixelated' }}
                aria-label={`Interactive block grid for block #${blockHeight.toString()}. ${filledCells} transaction parcels in ${gridDim}x${gridDim} grid.`}
                role="img"
            >
                <rect width={viewBox} height={viewBox} fill="#020208" />
                <pattern id="pixelDots" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
                    <rect x="0" y="0" width="1" height="1" fill="#ffffff" opacity="0.015" />
                </pattern>
                <rect width={viewBox} height={viewBox} fill="url(#pixelDots)" />

                <text x={viewBox / 2} y={12} textAnchor="middle" fill="#f7931a" fontSize={8} fontFamily="'Press Start 2P', monospace" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    BLK #{blockHeight.toString()}
                </text>

                <g>{cells}</g>

                <text x={offsetX} y={viewBox - 4} fill="#333355" fontSize={7} fontFamily="'Press Start 2P', monospace">
                    {txCount.toLocaleString()} TXS ({gridDim}x{gridDim})
                </text>
                <text x={viewBox - offsetX} y={viewBox - 4} textAnchor="end" fill="#333355" fontSize={7} fontFamily="'Press Start 2P', monospace">
                    {hashHex.substring(0, 8)}
                </text>

                {weightsProgress > 0 && weightsProgress < 100 && (
                    <g>
                        <rect x={offsetX} y={viewBox - 12} width={gridArea} height={2} fill="#111122" rx={0} />
                        <rect x={offsetX} y={viewBox - 12} width={gridArea * (weightsProgress / 100)} height={2} fill="#f7931a" rx={0} />
                    </g>
                )}
            </svg>

            {tooltip && (
                <div className="grid-tooltip" style={{ left: Math.min(tooltip.x, window.innerWidth - 260), top: Math.max(8, tooltip.y - 8) }} aria-hidden="true">
                    <div style={{ color: 'var(--accent)', marginBottom: 6, fontSize: 8, fontFamily: "'Press Start 2P', cursive" }}>PARCEL {tooltip.cellIndex + 1}</div>
                    {txsPerCell > 1 ? (
                        <div style={{ color: 'var(--text-secondary)', fontSize: 7, marginBottom: 4, fontFamily: "'Press Start 2P', cursive" }}>
                            {txsPerCell} transactions<br /><span style={{ color: 'var(--text-muted)' }}>#{tooltip.txStart + 1}&ndash;{tooltip.txEnd + 1}</span>
                        </div>
                    ) : (
                        <div style={{ color: 'var(--text-secondary)', fontSize: 7, marginBottom: 4, fontFamily: "'Press Start 2P', cursive" }}>1 transaction</div>
                    )}
                    {tooltip.feeRate && <div style={{ color: '#ffa940', fontSize: 7, marginBottom: 4, fontFamily: "'Press Start 2P', cursive" }}>{tooltip.feeRate}</div>}
                    {tooltip.txid && <div style={{ color: 'var(--text-muted)', wordBreak: 'break-all', fontSize: 6, fontFamily: "'Press Start 2P', cursive" }}>{tooltip.txid.slice(0, 16)}...</div>}
                    <div style={{ color: 'var(--accent)', fontSize: 6, marginTop: 4, fontFamily: "'Press Start 2P', cursive" }}>Click to inspect</div>
                </div>
            )}
        </div>
    );
}
