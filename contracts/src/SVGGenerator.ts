import { u256 } from '@btc-vision/as-bignum/assembly';

// Bitcoin orange palette: 16 warm colors, each # becomes %23 for data URI embedding.
const PALETTE_0: string = '%23f7931a';
const PALETTE_1: string = '%23ffcc00';
const PALETTE_2: string = '%23ff6b00';
const PALETTE_3: string = '%23ffa940';
const PALETTE_4: string = '%23e8821a';
const PALETTE_5: string = '%23ffdd44';
const PALETTE_6: string = '%23cc5500';
const PALETTE_7: string = '%23ffb732';
const PALETTE_8: string = '%23ff8c00';
const PALETTE_9: string = '%23f5a623';
const PALETTE_A: string = '%23e67300';
const PALETTE_B: string = '%23ffc93c';
const PALETTE_C: string = '%23d4760a';
const PALETTE_D: string = '%23ffaa00';
const PALETTE_E: string = '%23b35c00';
const PALETTE_F: string = '%23ffe066';

function paletteColor(index: u8): string {
    const i: u8 = index & 0x0f;
    if (i == 0) return PALETTE_0;
    if (i == 1) return PALETTE_1;
    if (i == 2) return PALETTE_2;
    if (i == 3) return PALETTE_3;
    if (i == 4) return PALETTE_4;
    if (i == 5) return PALETTE_5;
    if (i == 6) return PALETTE_6;
    if (i == 7) return PALETTE_7;
    if (i == 8) return PALETTE_8;
    if (i == 9) return PALETTE_9;
    if (i == 10) return PALETTE_A;
    if (i == 11) return PALETTE_B;
    if (i == 12) return PALETTE_C;
    if (i == 13) return PALETTE_D;
    if (i == 14) return PALETTE_E;
    return PALETTE_F;
}

// Format opacity as a two-decimal string (e.g. "0.65") without floats.
// opacity = 40 + (byteVal * 60 / 255), range 40..100 (integers)
function opacityStr(byteVal: u8): string {
    const scaled: u32 = 40 + (<u32>byteVal * 60 / 255);
    if (scaled >= 100) return '1';
    const tens: u32 = scaled / 10;
    const ones: u32 = scaled % 10;
    return '0.' + tens.toString() + ones.toString();
}

// Extract first 16 bytes from u256 (big-endian)
function hashBytesFrom(hashU256: u256): Uint8Array {
    const bytes = hashU256.toUint8Array(true); // big-endian, 32 bytes
    const out = new Uint8Array(16);
    for (let i: i32 = 0; i < 16; i++) {
        out[i] = bytes[i];
    }
    return out;
}

// Build hex preview string from first 8 hash bytes
function hashPreview(hashBytes: Uint8Array): string {
    const HEX: string = '0123456789abcdef';
    let result: string = '';
    for (let i: i32 = 0; i < 8; i++) {
        const b: u8 = hashBytes[i];
        result += HEX.charAt(<i32>(b >> 4));
        result += HEX.charAt(<i32>(b & 0x0f));
    }
    return result + '...';
}

// Integer square root (ceil) for AssemblyScript (no Math.ceil on floats)
function isqrtCeil(n: u32): u32 {
    if (n == 0) return 0;
    if (n == 1) return 1;
    let x: u32 = 1;
    while (x * x < n) {
        x++;
    }
    return x;
}

/**
 * Generates on-chain SVG for a BlockMap NFT.
 * Grid density is driven by txCount — each filled cell represents one transaction.
 *
 * gridSize = ceil(sqrt(txCount)), clamped to [1, 16]
 * filledCells = min(txCount, gridSize^2)
 * Colors cycle through hash bytes mod 16 palette entries.
 * Empty cells beyond filledCells render as dark outlines.
 *
 * @param blockHeight - The Bitcoin block height
 * @param hashU256 - First 16 bytes of block hash stored as u256 (big-endian)
 * @param txCount - Number of transactions in the block
 * @returns URL-safe SVG data URI string
 */
export function generateSVG(blockHeight: u64, hashU256: u256, txCount: u64): string {
    const hashBytes = hashBytesFrom(hashU256);
    const preview = hashPreview(hashBytes);

    // Compute grid dimensions from txCount
    const txCountU32: u32 = txCount > 256 ? 256 : <u32>txCount;
    let gridSize: u32 = isqrtCeil(txCountU32 > 0 ? txCountU32 : 1);
    if (gridSize < 1) gridSize = 1;
    if (gridSize > 16) gridSize = 16;
    const totalCells: u32 = gridSize * gridSize;
    const filledCells: u32 = txCountU32 < totalCells ? txCountU32 : totalCells;

    // Grid area is 280x280, starting at (20,40) within 320x320 viewBox
    const gridArea: u32 = 280;
    // Gap between cells: 1px for dense grids (>=8), 2px for medium, 4px for sparse
    const gap: u32 = gridSize >= 8 ? 1 : gridSize >= 4 ? 2 : 4;
    const totalGap: u32 = (gridSize - 1) * gap;
    const cellSize: u32 = (gridArea - totalGap) / gridSize;

    let svg: string = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 320'>";
    svg += "<rect width='320' height='320' fill='%230a0a1a'/>";
    svg += "<text x='160' y='28' text-anchor='middle' fill='%23f7931a' font-size='14' font-family='monospace'>BLOCK %23" + blockHeight.toString() + "</text>";
    svg += "<g transform='translate(20,40)'>";

    for (let row: u32 = 0; row < gridSize; row++) {
        for (let col: u32 = 0; col < gridSize; col++) {
            const cellIndex: u32 = row * gridSize + col;
            const x: u32 = col * (cellSize + gap);
            const y: u32 = row * (cellSize + gap);

            if (cellIndex < filledCells) {
                // Filled cell — one transaction
                const hashIdx: i32 = <i32>(cellIndex % 16);
                const byteVal: u8 = hashBytes[hashIdx];
                // Color from low nibble, vary by mixing with cell position
                const colorByte: u8 = <u8>((byteVal + <u8>cellIndex) & 0xff);
                const color: string = paletteColor(colorByte);
                const opacity: string = opacityStr(byteVal);
                const rx: u32 = cellSize > 10 ? 3 : 1;
                svg += "<rect x='" + x.toString() + "' y='" + y.toString() + "' width='" + cellSize.toString() + "' height='" + cellSize.toString() + "' rx='" + rx.toString() + "' fill='" + color + "' opacity='" + opacity + "'/>";
            } else {
                // Empty cell — dark placeholder
                const rx: u32 = cellSize > 10 ? 3 : 1;
                svg += "<rect x='" + x.toString() + "' y='" + y.toString() + "' width='" + cellSize.toString() + "' height='" + cellSize.toString() + "' rx='" + rx.toString() + "' fill='%23ffffff' opacity='0.03'/>";
            }
        }
    }

    svg += "</g>";

    // Transaction count label
    const txLabel: string = txCount.toString() + ' txns';
    svg += "<text x='50' y='312' text-anchor='start' fill='%23666' font-size='9' font-family='monospace'>" + txLabel + "</text>";

    // Hash preview
    svg += "<text x='270' y='312' text-anchor='end' fill='%23666' font-size='9' font-family='monospace'>" + preview + "</text>";
    svg += "</svg>";

    return "data:image/svg+xml," + svg;
}
