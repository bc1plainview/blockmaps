/**
 * Shared formatting utilities for the BlockMaps frontend.
 * Extracted from duplicates across pages and components.
 */

/**
 * Reconstruct a 64-char hex block hash from the stored hash16 bigint.
 * hash16 is the first 16 bytes of the block hash stored as a u256.
 */
export function hash16ToHex(hash16: bigint): string {
    const hex = hash16.toString(16).padStart(32, '0');
    return hex.padEnd(64, '0');
}

/**
 * Display a satoshi value as BTC (with 8 decimals) when >= 1 BTC,
 * otherwise as sats with commas.
 */
export function satsToBtcDisplay(sats: bigint): string {
    if (sats >= 100_000_000n) {
        const btc = Number(sats) / 100_000_000;
        return `${btc.toFixed(8)} BTC`;
    }
    if (sats === 0n) return '0 BTC';
    return `${sats.toLocaleString()} sats`;
}

/**
 * Short date format: "Jan 3, 2009"
 * Accepts bigint (unix seconds from contract) or number.
 */
export function formatTimestampShort(ts: bigint | number): string {
    const date = new Date(Number(ts) * 1000);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

/**
 * Full date format with weekday, time, and timezone.
 * Returns "Unconfirmed" for null values.
 */
export function formatTimestampFull(ts: number | null): string {
    if (ts === null) return 'Unconfirmed';
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

/**
 * Full date format for MintForm-style timestamps (no weekday).
 * Accepts bigint (contract data) or number.
 */
export function formatTimestampMedium(ts: bigint | number): string {
    const date = new Date(Number(ts) * 1000);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
    });
}

/**
 * Format difficulty with T/G/M suffixes.
 * Accepts bigint (contract) or number (mempool API).
 */
export function formatDifficulty(d: bigint | number): string {
    const num = Number(d);
    if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}G`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    return num.toLocaleString();
}

/**
 * Format byte count with MB/kB/B suffixes.
 */
export function formatBytes(bytes: number): string {
    if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(3)} MB`;
    if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} kB`;
    return `${bytes} B`;
}

/**
 * Format a fee rate in sat/vB from fee and weight.
 */
export function formatFeeRate(fee: bigint, weight: number): string {
    if (weight === 0) return '\u2014';
    const vbytes = weight / 4;
    const rate = Number(fee) / vbytes;
    return `${rate.toFixed(2)} sat/vB`;
}

/**
 * Truncate a long address/key for display.
 */
export function truncateAddress(addr: string, maxLen: number = 16): string {
    if (addr.length <= maxLen) return addr;
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

/**
 * Relative time ago label: "just now", "1 min", "5 hr", "3d".
 */
export function timeAgo(ts: number): string {
    const diffMs = Date.now() - ts * 1000;
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return 'just now';
    if (diffMin === 1) return '1 min';
    if (diffMin < 60) return `${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH === 1) return '1 hr';
    if (diffH < 24) return `${diffH} hr`;
    return `${Math.floor(diffH / 24)}d`;
}

/**
 * Format total fees for LiveBlockFeed display.
 * Uses number (from mempool API).
 */
export function formatFees(totalFees: number): string {
    if (totalFees >= 1e8) return `${(totalFees / 1e8).toFixed(4)} BTC`;
    return `${Math.round(totalFees).toLocaleString()} sats`;
}
