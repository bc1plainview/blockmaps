/**
 * Pure Sankey diagram layout calculator.
 * No npm dependencies — just geometry.
 *
 * Inputs are on the left, outputs on the right.
 * Flow paths use cubic bezier curves.
 * Fee is shown as a downward "leak" from the total flow.
 */

export interface SankeyNode {
    label: string;
    value: bigint;
}

export interface SankeyPath {
    d: string;
    opacity: number;
    inputIndex: number;
    outputIndex: number;
}

export interface SankeyLayout {
    inputRects: SankeyRect[];
    outputRects: SankeyRect[];
    paths: SankeyPath[];
    feeLeakPath: string;
    totalIn: bigint;
    totalOut: bigint;
    fee: bigint;
    width: number;
    height: number;
}

export interface SankeyRect {
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    value: bigint;
    valuePercent: number;
}

const SANKEY_PADDING = { left: 160, right: 160, top: 20, bottom: 40 };
const NODE_WIDTH = 12;
const NODE_GAP = 6;
const MIN_NODE_HEIGHT = 4;

function satsToBtc(sats: bigint): string {
    if (sats === 0n) return '0';
    const whole = sats / 100_000_000n;
    const frac = sats % 100_000_000n;
    if (frac === 0n) return whole.toString();
    const fracStr = frac.toString().padStart(8, '0').replace(/0+$/, '');
    return `${whole}.${fracStr}`;
}

export { satsToBtc };

/**
 * Compute Sankey layout from arrays of inputs and outputs (each with bigint value in sats).
 * Caps at MAX_NODES for readability.
 */
export function computeSankeyLayout(
    inputs: SankeyNode[],
    outputs: SankeyNode[],
    fee: bigint,
    svgWidth: number,
    svgHeight: number,
): SankeyLayout {
    const MAX_NODES = 20;
    const cappedInputs = inputs.slice(0, MAX_NODES);
    const cappedOutputs = outputs.slice(0, MAX_NODES);

    const totalIn = cappedInputs.reduce((acc, n) => acc + n.value, 0n);
    const totalOut = cappedOutputs.reduce((acc, n) => acc + n.value, 0n);
    const effectiveFee = fee > 0n ? fee : (totalIn > totalOut ? totalIn - totalOut : 0n);

    const innerH = svgHeight - SANKEY_PADDING.top - SANKEY_PADDING.bottom;
    const innerW = svgWidth - SANKEY_PADDING.left - SANKEY_PADDING.right;

    function buildRects(
        nodes: SankeyNode[],
        total: bigint,
        x: number,
    ): SankeyRect[] {
        if (nodes.length === 0 || total === 0n) return [];

        const totalGap = (nodes.length - 1) * NODE_GAP;
        const availH = Math.max(0, innerH - totalGap);

        let rects: SankeyRect[] = [];
        let usedH = 0;

        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const ratio = Number(node.value) / Number(total);
            const rawH = Math.max(MIN_NODE_HEIGHT, Math.round(availH * ratio));
            const h = i === nodes.length - 1 ? Math.max(MIN_NODE_HEIGHT, availH - usedH) : rawH;
            usedH += h;

            rects.push({
                x,
                y: SANKEY_PADDING.top + (rects.length > 0 ? rects.reduce((s, r) => s + r.height + NODE_GAP, 0) : 0),
                width: NODE_WIDTH,
                height: h,
                label: node.label,
                value: node.value,
                valuePercent: ratio * 100,
            });
        }

        // Recalculate y based on accumulated heights
        let accY = SANKEY_PADDING.top;
        rects = rects.map((r) => {
            const updated = { ...r, y: accY };
            accY += r.height + NODE_GAP;
            return updated;
        });

        return rects;
    }

    const inputRects = buildRects(
        cappedInputs,
        totalIn,
        SANKEY_PADDING.left - NODE_WIDTH,
    );
    const outputRects = buildRects(
        cappedOutputs,
        totalOut,
        SANKEY_PADDING.left + innerW,
    );

    // Flow paths from each input to each output (proportional to values)
    const paths: SankeyPath[] = [];

    if (totalIn > 0n && totalOut > 0n) {
        // Track consumed height on each rect
        const inputConsumed: number[] = new Array(inputRects.length).fill(0);

        for (let oi = 0; oi < outputRects.length; oi++) {
            const outRect = outputRects[oi];
            let outConsumed = 0;

            for (let ii = 0; ii < inputRects.length; ii++) {
                const inRect = inputRects[ii];
                const inRatio = Number(cappedInputs[ii]?.value ?? 0n) / Number(totalIn);
                const pathH = Math.max(1, Math.round(outRect.height * inRatio));

                const x1 = inRect.x + NODE_WIDTH;
                const y1 = inRect.y + inputConsumed[ii];
                const x2 = outRect.x;
                const y2 = outRect.y + outConsumed;

                const cx = x1 + (x2 - x1) / 2;

                const d = `M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2} L${x2},${y2 + pathH} C${cx},${y2 + pathH} ${cx},${y1 + pathH} ${x1},${y1 + pathH} Z`;

                paths.push({
                    d,
                    opacity: 0.25 + 0.35 * inRatio,
                    inputIndex: ii,
                    outputIndex: oi,
                });

                inputConsumed[ii] = (inputConsumed[ii] ?? 0) + pathH;
                outConsumed += pathH;
            }
        }
    }

    // Fee leak path — drains downward from the last input
    let feeLeakPath = '';
    if (effectiveFee > 0n && inputRects.length > 0 && totalIn > 0n) {
        const lastIn = inputRects[inputRects.length - 1];
        const feeRatio = Math.min(1, Number(effectiveFee) / Number(totalIn));
        const leakH = Math.max(2, Math.round((lastIn.height) * feeRatio));
        const lx = lastIn.x + NODE_WIDTH;
        const ly = lastIn.y + lastIn.height - leakH;
        const leakEndY = svgHeight - SANKEY_PADDING.bottom / 2;

        feeLeakPath = `M${lx},${ly} C${lx + 40},${ly} ${lx + 40},${leakEndY} ${lx},${leakEndY} L${lx},${leakEndY} L${lx + 2},${leakEndY} C${lx + 42},${leakEndY} ${lx + 42},${ly + leakH} ${lx},${ly + leakH} Z`;
    }

    return {
        inputRects,
        outputRects,
        paths,
        feeLeakPath,
        totalIn,
        totalOut,
        fee: effectiveFee,
        width: svgWidth,
        height: svgHeight,
    };
}
