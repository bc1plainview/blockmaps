import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { SVGPreview } from './SVGPreview.js';
import { useAudio } from '../hooks/useAudio.js';

interface BlockMapCardProps {
    blockHeight: bigint;
    hashHex: string;
    txCount?: number;
    owner: string;
    timestamp?: bigint;
}

function truncateAddress(addr: string): string {
    if (addr.length <= 16) return addr;
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

function formatTimestamp(ts: bigint): string {
    const date = new Date(Number(ts) * 1000);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

export function BlockMapCard({ blockHeight, hashHex, txCount, owner, timestamp }: BlockMapCardProps): React.ReactElement {
    const { playHover, playClick } = useAudio();

    const handleMouseEnter = useCallback((): void => {
        playHover();
    }, [playHover]);

    const handleClick = useCallback((): void => {
        playClick();
    }, [playClick]);

    return (
        <Link
            to={`/block/${blockHeight.toString()}`}
            style={{ textDecoration: 'none', display: 'block' }}
            onClick={handleClick}
        >
            <div
                className="glass-card"
                style={{
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    padding: '8px',
                    transition: 'all 80ms step-start',
                }}
                onMouseEnter={handleMouseEnter}
            >
                {/* Grid preview with pixel border */}
                <div style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '1',
                    overflow: 'hidden',
                    border: '2px solid var(--border-glass)',
                    imageRendering: 'pixelated',
                }}>
                    <SVGPreview
                        blockHeight={blockHeight}
                        hashHex={hashHex}
                        txCount={txCount}
                        className="block-map-svg"
                    />

                    {/* Tx count badge overlay */}
                    {txCount !== undefined && (
                        <div style={{
                            position: 'absolute',
                            bottom: '0',
                            right: '0',
                            background: 'rgba(5, 5, 16, 0.9)',
                            border: '1px solid rgba(247, 147, 26, 0.2)',
                            borderTop: '2px solid rgba(247,147,26,0.15)',
                            borderRight: 'none',
                            borderBottom: 'none',
                            padding: '3px 6px',
                            fontSize: '7px',
                            color: 'var(--text-secondary)',
                            fontVariantNumeric: 'tabular-nums',
                            fontFamily: "'Press Start 2P', cursive",
                        }}>
                            {txCount.toLocaleString()} TX
                        </div>
                    )}
                </div>

                {/* Block info */}
                <div style={{ padding: '4px 2px 2px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span
                        style={{
                            fontSize: '10px',
                            fontWeight: 400,
                            color: 'var(--accent)',
                            fontVariantNumeric: 'tabular-nums',
                            fontFamily: "'Press Start 2P', cursive",
                            textShadow: '1px 1px 0 rgba(247,147,26,0.3)',
                        }}
                    >
                        #{blockHeight.toLocaleString()}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                        <span
                            className="code-text"
                            style={{ fontSize: '7px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                            {truncateAddress(owner)}
                        </span>

                        {timestamp !== undefined && (
                            <span style={{ fontSize: '7px', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: "'Press Start 2P', cursive" }}>
                                {formatTimestamp(timestamp)}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </Link>
    );
}
