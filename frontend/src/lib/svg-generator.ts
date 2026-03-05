/**
 * Client-side SVG generator that mirrors the on-chain algorithm.
 *
 * Grid density is driven by txCount — each filled cell represents one transaction.
 * gridSize = ceil(sqrt(txCount)), clamped to [1, 16]
 * filledCells = min(txCount, gridSize^2)
 *
 * Colors cycle through hash bytes mod 16 synthwave palette entries.
 * Empty cells beyond filledCells render as dark outlines.
 */

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

/**
 * Generates an SVG that mirrors the on-chain BlockMaps algorithm.
 *
 * @param blockHeight - The Bitcoin block height
 * @param hashHex - The full 64-character hex block hash (big-endian)
 * @param txCount - Number of transactions in the block (determines grid density)
 * @returns SVG markup string
 */
export function generateSVG(blockHeight: bigint, hashHex: string, txCount: number = 16): string {
    // Parse hash bytes (first 16 bytes)
    const hashBytes: number[] = [];
    const hexStr = hashHex.startsWith('0x') ? hashHex.slice(2) : hashHex;
    for (let i = 0; i < 32; i += 2) {
        hashBytes.push(parseInt(hexStr.substring(i, i + 2), 16));
    }

    // Compute grid dimensions from txCount (mirrors contract logic)
    const clampedTxCount = Math.min(Math.max(txCount, 1), 256);
    let gridSize = Math.ceil(Math.sqrt(clampedTxCount));
    gridSize = Math.max(1, Math.min(16, gridSize));
    const totalCells = gridSize * gridSize;
    const filledCells = Math.min(clampedTxCount, totalCells);

    // Grid area is 280x280, starting at (20,40) within 320x320 viewBox
    const gridArea = 280;
    const gap = gridSize >= 8 ? 1 : gridSize >= 4 ? 2 : 4;
    const totalGap = (gridSize - 1) * gap;
    const cellSize = Math.floor((gridArea - totalGap) / gridSize);

    let svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 320'>`;
    svg += `<rect width='320' height='320' fill='#0a0a1a'/>`;
    svg += `<text x='160' y='28' text-anchor='middle' fill='#f7931a' font-size='14' font-family='monospace'>BLOCK #${blockHeight.toString()}</text>`;
    svg += `<g transform='translate(20,40)'>`;

    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            const cellIndex = row * gridSize + col;
            const x = col * (cellSize + gap);
            const y = row * (cellSize + gap);

            if (cellIndex < filledCells) {
                // Filled cell — one transaction
                const hashIdx = cellIndex % 16;
                const byteVal = hashBytes[hashIdx] ?? 0;
                // Color from low nibble, vary by mixing with cell position
                const colorByte = (byteVal + cellIndex) & 0xff;
                const color = PALETTE[colorByte & 0x0f] ?? PALETTE[0];
                const opacity = opacityStr(byteVal);
                const rx = cellSize > 10 ? 3 : 1;
                svg += `<rect x='${x}' y='${y}' width='${cellSize}' height='${cellSize}' rx='${rx}' fill='${color}' opacity='${opacity}'/>`;
            } else {
                // Empty cell — dark placeholder
                const rx = cellSize > 10 ? 3 : 1;
                svg += `<rect x='${x}' y='${y}' width='${cellSize}' height='${cellSize}' rx='${rx}' fill='#ffffff' opacity='0.03'/>`;
            }
        }
    }

    svg += `</g>`;

    // Transaction count label
    svg += `<text x='50' y='312' text-anchor='start' fill='#666' font-size='9' font-family='monospace'>${txCount} txns</text>`;

    // Hash preview
    const preview = hexStr.substring(0, 16) + '...';
    svg += `<text x='270' y='312' text-anchor='end' fill='#666' font-size='9' font-family='monospace'>${preview}</text>`;
    svg += `</svg>`;
    return svg;
}

/**
 * Converts a 64-char hex block hash string to the blockHash16 bigint
 * required by the contract's mint() function (first 16 bytes as u256).
 */
export function hashToBlockHash16(hashHex: string): bigint {
    const hexStr = hashHex.startsWith('0x') ? hashHex.slice(2) : hashHex;
    const first32Hex = hexStr.substring(0, 32);
    return BigInt('0x' + first32Hex);
}
