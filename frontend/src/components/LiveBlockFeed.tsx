import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveBlocks } from '../hooks/useLiveBlocks.js';
import type { MempoolBlockSummary } from '../types/index.js';

const MINI_GRID_DIM = 4;
const MINI_CELL = 10;
const MINI_GAP = 1;
const MINI_SIZE = MINI_GRID_DIM * (MINI_CELL + MINI_GAP) - MINI_GAP;

const PALETTE: readonly string[] = [
    '#f7931a', '#ffcc00', '#ff6b00', '#ffa940',
    '#e8821a', '#ffdd44', '#cc5500', '#ffb732',
    '#ff8c00', '#f5a623', '#e67300', '#ffc93c',
    '#d4760a', '#ffaa00', '#b35c00', '#ffe066',
];

function MiniGrid({ blockHash }: { blockHash: string }): React.ReactElement {
    const hexStr = blockHash.startsWith('0x') ? blockHash.slice(2) : blockHash;
    const bytes: number[] = [];
    for (let i = 0; i < 32; i += 2) {
        bytes.push(parseInt(hexStr.substring(i, i + 2), 16));
    }

    const cells: React.ReactElement[] = [];
    for (let i = 0; i < MINI_GRID_DIM * MINI_GRID_DIM; i++) {
        const col = i % MINI_GRID_DIM;
        const row = Math.floor(i / MINI_GRID_DIM);
        const x = col * (MINI_CELL + MINI_GAP);
        const y = row * (MINI_CELL + MINI_GAP);
        const byteVal = bytes[i] ?? 0;
        const colorByte = (byteVal + i) & 0xff;
        const color = PALETTE[colorByte & 0x0f] ?? PALETTE[0];
        const scaled = 40 + Math.floor(byteVal * 60 / 255);
        const opacity = scaled >= 100 ? '1' : `0.${Math.floor(scaled / 10)}${scaled % 10}`;

        cells.push(
            <rect
                key={i}
                x={x}
                y={y}
                width={MINI_CELL}
                height={MINI_CELL}
                rx={1}
                fill={color}
                opacity={opacity}
            />,
        );
    }

    return (
        <svg
            viewBox={`0 0 ${MINI_SIZE} ${MINI_SIZE}`}
            width={MINI_SIZE}
            height={MINI_SIZE}
            className="live-feed-mini-grid"
            aria-hidden="true"
        >
            <rect width={MINI_SIZE} height={MINI_SIZE} fill="#050510" />
            {cells}
        </svg>
    );
}

function timeAgo(ts: number): string {
    const diffMs = Date.now() - ts * 1000;
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return 'just now';
    if (diffMin === 1) return '1 min ago';
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH === 1) return '1 hr ago';
    if (diffH < 24) return `${diffH} hrs ago`;
    return `${Math.floor(diffH / 24)}d ago`;
}

function formatFees(block: MempoolBlockSummary): string {
    const fees = block.extras?.totalFees;
    if (fees === undefined || fees === null) return '—';
    if (fees >= 1e8) return `${(fees / 1e8).toFixed(4)} BTC`;
    return `${Math.round(fees).toLocaleString()} sats`;
}

interface BlockCardProps {
    block: MempoolBlockSummary;
    onClick: (height: number) => void;
}

function BlockCard({ block, onClick }: BlockCardProps): React.ReactElement {
    return (
        <div
            className="live-feed-card"
            onClick={() => onClick(block.height)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick(block.height);
                }
            }}
            aria-label={`Navigate to block ${block.height}`}
        >
            <MiniGrid blockHash={block.id} />

            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                        #{block.height.toLocaleString()}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                        {timeAgo(block.timestamp)}
                    </span>
                </div>

                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', marginBottom: 4 }}>
                    {block.id.slice(0, 8)}...{block.id.slice(-4)}
                </div>

                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {block.tx_count.toLocaleString()} txns
                    </span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatFees(block)}
                    </span>
                    {block.extras?.medianFee !== undefined && (
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {block.extras.medianFee.toFixed(1)} sat/vB
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

export function LiveBlockFeed(): React.ReactElement {
    const { blocks, loading, error, lastUpdated, refresh } = useLiveBlocks();
    const navigate = useNavigate();
    const [nowMs, setNowMs] = useState<number>(0);

    // Update "now" every 10s so we can compute time-ago without calling Date.now() in render
    useEffect((): (() => void) => {
        const timer = setInterval((): void => {
            setNowMs(Date.now());
        }, 10_000);
        // Fire once async to avoid synchronous setState in effect body
        const initialTimer = setTimeout((): void => {
            setNowMs(Date.now());
        }, 0);
        return (): void => {
            clearInterval(timer);
            clearTimeout(initialTimer);
        };
    }, []);

    const secondsAgoLabel: string | null = (lastUpdated !== null && nowMs > 0)
        ? `${Math.round((nowMs - lastUpdated) / 1000)}s ago`
        : null;

    const handleBlockClick = useCallback((height: number): void => {
        navigate(`/block/${height.toString()}`);
    }, [navigate]);

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Latest Blocks
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {secondsAgoLabel !== null && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                            Updated {secondsAgoLabel}
                        </span>
                    )}
                    <button
                        type="button"
                        className="refresh-btn"
                        onClick={refresh}
                        disabled={loading}
                        aria-label="Refresh block feed"
                    >
                        {loading ? 'Loading...' : 'Refresh'}
                    </button>
                </div>
            </div>

            {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

            {loading && blocks.length === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="skeleton" style={{ height: 72, borderRadius: 8 }} />
                    ))}
                </div>
            )}

            {blocks.length > 0 && (
                <div className="live-feed">
                    {blocks.map((block) => (
                        <BlockCard
                            key={block.id}
                            block={block}
                            onClick={handleBlockClick}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
