import React from 'react';
import type { EnhancedBlockData } from '../types/index.js';

interface BlockStatsCardProps {
    data: EnhancedBlockData;
}

function formatBytes(bytes: number): string {
    if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(3)} MB`;
    if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} kB`;
    return `${bytes} B`;
}

function formatWU(wu: number): string {
    return `${wu.toLocaleString()} WU`;
}

function formatDifficulty(d: number): string {
    if (d >= 1e12) return `${(d / 1e12).toFixed(4)}T`;
    if (d >= 1e9) return `${(d / 1e9).toFixed(4)}G`;
    if (d >= 1e6) return `${(d / 1e6).toFixed(4)}M`;
    return d.toLocaleString();
}

function formatTimestamp(ts: number): string {
    return new Date(ts * 1000).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
    });
}

function satsToBtc(sats: number): string {
    return `${(sats / 1e8).toFixed(8)} BTC`;
}

interface StatItemProps {
    label: string;
    value: string;
    mono?: boolean;
    breakAll?: boolean;
}

function StatItem({ label, value, mono = false, breakAll = false }: StatItemProps): React.ReactElement {
    return (
        <div className="block-stat-item">
            <div className="block-stat-label">{label}</div>
            <div
                className="block-stat-value"
                style={{
                    fontFamily: mono ? "'Space Mono', monospace" : undefined,
                    wordBreak: breakAll ? 'break-all' : undefined,
                }}
            >
                {value}
            </div>
        </div>
    );
}

export function BlockStatsCard({ data }: BlockStatsCardProps): React.ReactElement {
    const totalFeesSats = data.extras?.totalFees ?? null;
    const rewardSats = data.extras?.reward ?? null;
    const medianFee = data.extras?.medianFee ?? null;

    return (
        <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                Block Statistics
            </div>
            <div className="block-stats">
                <StatItem label="Height" value={data.height.toLocaleString()} />
                <StatItem label="Transactions" value={data.tx_count.toLocaleString()} />
                <StatItem label="Timestamp" value={formatTimestamp(data.timestamp)} />
                <StatItem label="Difficulty" value={formatDifficulty(data.difficulty)} />
                <StatItem label="Size" value={formatBytes(data.size)} />
                <StatItem label="Weight" value={formatWU(data.weight)} />
                <StatItem label="Version" value={`0x${data.version.toString(16).toUpperCase()}`} mono />
                <StatItem label="Bits" value={`0x${data.bits.toString(16).toUpperCase()}`} mono />
                <StatItem label="Nonce" value={data.nonce.toLocaleString()} />
                {medianFee !== null && (
                    <StatItem label="Median Fee" value={`${medianFee.toFixed(1)} sat/vB`} />
                )}
                {totalFeesSats !== null && (
                    <StatItem label="Total Fees" value={satsToBtc(totalFeesSats)} />
                )}
                {rewardSats !== null && (
                    <StatItem label="Block Reward" value={satsToBtc(rewardSats)} />
                )}
                <StatItem label="Merkle Root" value={data.merkle_root} mono breakAll />
                {data.previousblockhash && (
                    <StatItem label="Prev Block" value={data.previousblockhash} mono breakAll />
                )}
            </div>
        </div>
    );
}
