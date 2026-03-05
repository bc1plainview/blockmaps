import React, { useMemo } from 'react';
import type { TxDetail } from '../types/index.js';
import { computeSankeyLayout, satsToBtc } from '../lib/sankey-layout.js';
import type { SankeyNode } from '../lib/sankey-layout.js';

const MAX_NODES = 20;
const DIAGRAM_WIDTH = 500;
const DIAGRAM_HEIGHT = 320;

interface SankeyDiagramProps {
    tx: TxDetail;
}

function truncateAddr(addr: string): string {
    if (addr.length <= 16) return addr;
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

function satDisplay(sats: bigint): string {
    if (sats >= 100_000_000n) return `${satsToBtc(sats)} BTC`;
    return `${sats.toLocaleString()} sats`;
}

export function SankeyDiagram({ tx }: SankeyDiagramProps): React.ReactElement {
    const layout = useMemo(() => {
        const inputs: SankeyNode[] = tx.vin
            .slice(0, MAX_NODES)
            .map((v) => ({
                label: v.prevout
                    ? truncateAddr(v.prevout.scriptpubkey_address)
                    : 'coinbase',
                value: v.prevout?.value ?? 0n,
            }));

        const outputs: SankeyNode[] = tx.vout
            .slice(0, MAX_NODES)
            .map((o) => ({
                label: truncateAddr(o.scriptpubkey_address),
                value: o.value,
            }));

        return computeSankeyLayout(inputs, outputs, tx.fee, DIAGRAM_WIDTH, DIAGRAM_HEIGHT);
    }, [tx]);

    const inputOverflow = tx.vin.length > MAX_NODES ? tx.vin.length - MAX_NODES : 0;
    const outputOverflow = tx.vout.length > MAX_NODES ? tx.vout.length - MAX_NODES : 0;

    return (
        <div className="sankey-diagram">
            <svg
                viewBox={`0 0 ${DIAGRAM_WIDTH} ${DIAGRAM_HEIGHT}`}
                style={{ display: 'block', width: '100%', height: 'auto' }}
                aria-label={`BTC flow diagram: ${tx.vin.length} inputs, ${tx.vout.length} outputs`}
            >
                {/* Flow paths */}
                {layout.paths.map((path, i) => (
                    <path
                        key={i}
                        d={path.d}
                        fill="var(--accent)"
                        opacity={path.opacity}
                    />
                ))}

                {/* Fee leak */}
                {layout.feeLeakPath && (
                    <path
                        d={layout.feeLeakPath}
                        fill="var(--red)"
                        opacity={0.4}
                    />
                )}

                {/* Input rects */}
                {layout.inputRects.map((rect, i) => (
                    <g key={`in-${i}`}>
                        <rect
                            x={rect.x}
                            y={rect.y}
                            width={rect.width}
                            height={rect.height}
                            fill="var(--accent)"
                            opacity={0.7}
                            rx={2}
                        />
                        <text
                            x={rect.x - 4}
                            y={rect.y + rect.height / 2}
                            dominantBaseline="middle"
                            textAnchor="end"
                            fontSize={9}
                            fill="var(--text-secondary)"
                            fontFamily="'Space Mono', monospace"
                        >
                            {rect.label}
                        </text>
                        <text
                            x={rect.x - 4}
                            y={rect.y + rect.height / 2 + 11}
                            dominantBaseline="middle"
                            textAnchor="end"
                            fontSize={8}
                            fill="var(--text-muted)"
                            fontFamily="'Space Mono', monospace"
                        >
                            {satDisplay(rect.value)}
                        </text>
                    </g>
                ))}

                {/* Output rects */}
                {layout.outputRects.map((rect, i) => (
                    <g key={`out-${i}`}>
                        <rect
                            x={rect.x}
                            y={rect.y}
                            width={rect.width}
                            height={rect.height}
                            fill="var(--accent-b)"
                            opacity={0.7}
                            rx={2}
                        />
                        <text
                            x={rect.x + rect.width + 4}
                            y={rect.y + rect.height / 2}
                            dominantBaseline="middle"
                            textAnchor="start"
                            fontSize={9}
                            fill="var(--text-secondary)"
                            fontFamily="'Space Mono', monospace"
                        >
                            {rect.label}
                        </text>
                        <text
                            x={rect.x + rect.width + 4}
                            y={rect.y + rect.height / 2 + 11}
                            dominantBaseline="middle"
                            textAnchor="start"
                            fontSize={8}
                            fill="var(--text-muted)"
                            fontFamily="'Space Mono', monospace"
                        >
                            {satDisplay(rect.value)}
                        </text>
                    </g>
                ))}

                {/* Fee label */}
                {layout.fee > 0n && (
                    <text
                        x={layout.inputRects[0] ? layout.inputRects[0].x + 16 : DIAGRAM_WIDTH / 2}
                        y={DIAGRAM_HEIGHT - 6}
                        textAnchor="middle"
                        fontSize={9}
                        fill="var(--red)"
                        opacity={0.7}
                        fontFamily="'Space Mono', monospace"
                    >
                        fee: {satDisplay(layout.fee)}
                    </text>
                )}

                {/* Column headers */}
                <text
                    x={layout.inputRects[0] ? layout.inputRects[0].x - 4 : 140}
                    y={12}
                    textAnchor="end"
                    fontSize={9}
                    fill="var(--text-muted)"
                    fontFamily="'Space Mono', monospace"
                >
                    INPUTS
                </text>
                <text
                    x={layout.outputRects[0] ? layout.outputRects[0].x + 16 : DIAGRAM_WIDTH - 140}
                    y={12}
                    textAnchor="start"
                    fontSize={9}
                    fill="var(--text-muted)"
                    fontFamily="'Space Mono', monospace"
                >
                    OUTPUTS
                </text>
            </svg>

            {(inputOverflow > 0 || outputOverflow > 0) && (
                <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border-glass)' }}>
                    {inputOverflow > 0 && `+${inputOverflow} more inputs`}
                    {inputOverflow > 0 && outputOverflow > 0 && ' · '}
                    {outputOverflow > 0 && `+${outputOverflow} more outputs`}
                </div>
            )}
        </div>
    );
}
