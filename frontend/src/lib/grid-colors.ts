/**
 * Grid color generation for BlockMaps.
 *
 * Color system:
 * 1. Data-driven (primary): Transaction WEIGHT → heat color, fee rate → opacity.
 *    Weight varies much more within a block than fee rate, giving rich visual variety.
 *    - Light tx (400 WU) = cool dark amber
 *    - Medium tx (1000 WU) = bitcoin orange
 *    - Heavy tx (5000+ WU) = bright gold
 *    - Coinbase = green
 *
 * 2. Loading placeholder: Very dim cells while tx data streams in.
 *
 * 3. Hash-based fallback: For preview grids before any data arrives.
 */

import type { TxWeightData } from '../hooks/useBlockTxWeights.js';

// Heat palette: cold (light tx) → hot (heavy tx)
const HEAT_PALETTE: readonly string[] = [
    '#3d1c00', // very cold: near-black brown
    '#5c2a00', // cold: dark brown
    '#7a3800', // cool: deep amber
    '#994d00', // cool-medium: amber
    '#b35c00', // medium-low: burnt orange
    '#cc7000', // medium: dark orange
    '#e67300', // medium: orange
    '#f7931a', // bitcoin orange (median)
    '#ff8c00', // warm: bright orange
    '#ffa940', // warm: light orange
    '#ffbf00', // hot: gold
    '#ffcc00', // hot: bright gold
    '#ffd700', // very hot: deep gold
    '#ffe066', // very hot: pale gold
    '#ffed99', // extreme: light gold
    '#fff5cc', // extreme: near-white gold
];

// Special color for coinbase transaction (index 0)
const COINBASE_COLOR = '#22c55e';

// Fallback palette for hash-based coloring (preview cards before data loads)
const FALLBACK_PALETTE: readonly string[] = [
    '#f7931a', '#ffcc00', '#ff6b00', '#ffa940',
    '#e8821a', '#ffdd44', '#cc5500', '#ffb732',
    '#ff8c00', '#f5a623', '#e67300', '#ffc93c',
    '#d4760a', '#ffaa00', '#b35c00', '#ffe066',
];

/**
 * Parse full 32 bytes from a 64-char hex hash string.
 */
export function hashToBytes(hashHex: string): number[] {
    const hexStr = hashHex.startsWith('0x') ? hashHex.slice(2) : hashHex;
    const bytes: number[] = [];
    for (let i = 0; i < 64 && i < hexStr.length; i += 2) {
        bytes.push(parseInt(hexStr.substring(i, i + 2), 16) || 0);
    }
    while (bytes.length < 32) bytes.push(0);
    return bytes;
}

/**
 * Xorshift PRNG for hash-based variation.
 */
function mixHash(hashBytes: number[], cellIndex: number): number {
    let seed = 0;
    for (let i = 0; i < 32; i++) {
        seed = ((seed << 5) - seed + hashBytes[i]) | 0;
    }
    let x = (seed ^ (cellIndex * 2654435761)) >>> 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return x >>> 0;
}

/**
 * Hash-based fallback color for preview cards (before any tx data loads).
 * Used by SVGPreview and LiveBlockFeed MiniGrid.
 */
export function cellColorFallback(hashBytes: number[], cellIndex: number): { color: string; opacity: number } {
    const mixed = mixHash(hashBytes, cellIndex);
    const colorIdx = mixed % FALLBACK_PALETTE.length;
    const color = FALLBACK_PALETTE[colorIdx] ?? FALLBACK_PALETTE[0];
    const opacityRaw = ((mixed >>> 8) % 256);
    const opacity = 0.15 + (opacityRaw / 256) * 0.25;
    return { color, opacity };
}

/**
 * Loading placeholder color for InteractiveGrid cells that haven't received data yet.
 * Very dim so cells visually "light up" as data streams in.
 */
export function cellColorLoading(hashBytes: number[], cellIndex: number): { color: string; opacity: number } {
    const mixed = mixHash(hashBytes, cellIndex);
    const opacity = 0.03 + ((mixed % 64) / 64) * 0.04; // 0.03-0.07
    return { color: '#7a3800', opacity };
}

/**
 * Data-driven color from actual transaction weight and fee rate.
 *
 * WEIGHT drives the heat color (light tx = cold, heavy tx = hot).
 * Weight varies far more within a block than fee rate, creating rich visual patterns.
 *
 * FEE RATE drives opacity (high fee = brighter, low fee = dimmer).
 *
 * Reference ranges (log scale):
 * - Weight: 200-10000 WU (covers simple 1-in/1-out to large multi-input txs)
 * - Fee rate: 1-200 sat/vB
 */
export function cellColorFromTx(
    txData: TxWeightData,
    _feeRateMin: number,
    _feeRateMax: number,
    isCoinbase: boolean,
): { color: string; opacity: number } {
    if (isCoinbase) {
        return { color: COINBASE_COLOR, opacity: 0.9 };
    }

    // WEIGHT → heat color
    // 200 WU (tiny) → palette[0], 10000 WU (heavy) → palette[15]
    const logMinW = Math.log1p(200);
    const logMaxW = Math.log1p(10000);
    const logRangeW = logMaxW - logMinW;
    const weightNorm = Math.max(0, Math.min(1,
        (Math.log1p(txData.weight) - logMinW) / logRangeW,
    ));

    const colorIdx = Math.round(weightNorm * (HEAT_PALETTE.length - 1));
    const color = HEAT_PALETTE[colorIdx] ?? HEAT_PALETTE[8];

    // FEE RATE → opacity (high fee = more visible)
    const feeRate = txData.weight > 0 ? txData.fee / (txData.weight / 4) : 0;
    const logMinF = Math.log1p(1);
    const logMaxF = Math.log1p(200);
    const logRangeF = logMaxF - logMinF;
    const feeNorm = Math.max(0, Math.min(1,
        (Math.log1p(feeRate) - logMinF) / logRangeF,
    ));
    const opacity = 0.35 + feeNorm * 0.6; // 0.35 (low fee) to 0.95 (high fee)

    return { color, opacity };
}

/**
 * Aggregate multiple TxWeightData into one cell summary.
 */
export function aggregateCellTxData(txDataList: TxWeightData[]): TxWeightData {
    if (txDataList.length === 0) return { fee: 0, weight: 0, size: 0 };
    if (txDataList.length === 1) return txDataList[0];

    let totalFee = 0;
    let totalWeight = 0;
    let totalSize = 0;
    for (const d of txDataList) {
        totalFee += d.fee;
        totalWeight += d.weight;
        totalSize += d.size;
    }
    return {
        fee: Math.round(totalFee / txDataList.length),
        weight: Math.round(totalWeight / txDataList.length),
        size: Math.round(totalSize / txDataList.length),
    };
}

/**
 * Compute the grid dimension based on transaction count.
 */
export function gridDimForTxCount(txCount: number): number {
    if (txCount <= 64) return 8;
    if (txCount <= 256) return 16;
    if (txCount <= 1024) return 32;
    return 48;
}

/**
 * Data-driven cell color for preview grids (SVGPreview / card thumbnails).
 */
export function previewCellColor(
    hashBytes: number[],
    cellIndex: number,
    txCount: number,
    totalCells: number,
    txWeights: TxWeightData[],
    feeRateRange: { min: number; max: number },
): { color: string; opacity: number } {
    const txIndex = Math.floor((cellIndex / totalCells) * txCount);
    const isCoinbase = txIndex === 0;

    if (txIndex < txWeights.length) {
        return cellColorFromTx(txWeights[txIndex], feeRateRange.min, feeRateRange.max, isCoinbase);
    }

    if (isCoinbase) return { color: COINBASE_COLOR, opacity: 0.9 };

    const posNorm = txIndex / txCount;
    const baseWeight = 700 - posNorm * 350;
    const mixed = mixHash(hashBytes, cellIndex);
    const jitter = (mixed % 250) - 125;
    const weight = Math.max(200, Math.round(baseWeight + jitter));

    const logMinW = Math.log1p(200);
    const logMaxW = Math.log1p(10000);
    const logRangeW = logMaxW - logMinW;
    const weightNorm = Math.max(0, Math.min(1, (Math.log1p(weight) - logMinW) / logRangeW));
    const colorIdx = Math.round(weightNorm * (HEAT_PALETTE.length - 1));
    const color = HEAT_PALETTE[colorIdx] ?? HEAT_PALETTE[8];
    const opacity = 0.35 + (1 - posNorm) * 0.55;

    return { color, opacity };
}

/**
 * Mini-grid cell color using block-level stats.
 */
export function miniGridCellColor(
    hashBytes: number[],
    cellIndex: number,
    medianFeeRate: number,
): { color: string; opacity: number } {
    if (cellIndex === 0) {
        return { color: COINBASE_COLOR, opacity: 0.9 };
    }

    const mixed = mixHash(hashBytes, cellIndex);
    const weightVariation = ((mixed % 256) / 256) * 1.2 - 0.6;
    const simulatedWeight = 800 * (1 + weightVariation);
    const logMinW = Math.log1p(200);
    const logMaxW = Math.log1p(10000);
    const logRangeW = logMaxW - logMinW;
    const weightNorm = Math.max(0, Math.min(1,
        (Math.log1p(simulatedWeight) - logMinW) / logRangeW,
    ));
    const colorIdx = Math.round(weightNorm * (HEAT_PALETTE.length - 1));
    const color = HEAT_PALETTE[colorIdx] ?? HEAT_PALETTE[8];

    const feeVariation = ((mixed >>> 8) % 256) / 256 * 0.6 - 0.3;
    const cellFeeRate = medianFeeRate * (1 + feeVariation);
    const logMinF = Math.log1p(1);
    const logMaxF = Math.log1p(200);
    const logRangeF = logMaxF - logMinF;
    const feeNorm = Math.max(0, Math.min(1,
        (Math.log1p(cellFeeRate) - logMinF) / logRangeF,
    ));
    const opacity = 0.35 + feeNorm * 0.55;

    return { color, opacity };
}
