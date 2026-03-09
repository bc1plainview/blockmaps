import * as THREE from 'three';
import type { TxWeightData } from '../hooks/useBlockTxWeights.js';

// Weight range: 200 WU (coinbase/tiny) to 10,000 WU (large)
const MIN_WEIGHT = 200;
const MAX_WEIGHT = 10_000;

const LOG_MIN = Math.log1p(MIN_WEIGHT);
const LOG_MAX = Math.log1p(MAX_WEIGHT);
const HEIGHT_MIN = 0.5;
const HEIGHT_MAX = 5.0;

export function weightToHeight(weight: number): number {
    const clamped = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, weight));
    const t = (Math.log1p(clamped) - LOG_MIN) / (LOG_MAX - LOG_MIN);
    return HEIGHT_MIN + t * (HEIGHT_MAX - HEIGHT_MIN);
}

// 3D WEIGHT-based palette — matches the 2D heat palette approach.
// Weight varies hugely within a block; fee rate does not. Weight = visual variety.
const WEIGHT_PALETTE: THREE.Color[] = [
    new THREE.Color('#cc6600'),  // 200 WU — light tx, deep orange
    new THREE.Color('#e07000'),
    new THREE.Color('#ee8000'),
    new THREE.Color('#f7931a'),  // ~1000 WU — bitcoin orange
    new THREE.Color('#ffaa33'),
    new THREE.Color('#ffbb44'),
    new THREE.Color('#ffcc55'),
    new THREE.Color('#ffdd66'),  // ~3000 WU — gold
    new THREE.Color('#ffee88'),
    new THREE.Color('#fff5aa'),
    new THREE.Color('#ffffcc'),  // 10000 WU — near-white gold
];

export function weightToColor3D(weight: number): THREE.Color {
    const clamped = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, weight));
    const t = (Math.log1p(clamped) - LOG_MIN) / (LOG_MAX - LOG_MIN);
    const idx = t * (WEIGHT_PALETTE.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.min(lo + 1, WEIGHT_PALETTE.length - 1);
    const frac = idx - lo;
    return WEIGHT_PALETTE[lo].clone().lerp(WEIGHT_PALETTE[hi], frac);
}

// Keep feeRateToColor3D for the tooltip display
const FEE_STOPS: Array<{ rate: number; color: THREE.Color }> = [
    { rate: 1,   color: new THREE.Color('#e68a00') },
    { rate: 5,   color: new THREE.Color('#f7931a') },
    { rate: 20,  color: new THREE.Color('#ffaa33') },
    { rate: 50,  color: new THREE.Color('#ffcc44') },
    { rate: 100, color: new THREE.Color('#ffee66') },
    { rate: 200, color: new THREE.Color('#fffff0') },
];

export function feeRateToColor3D(feeRate: number): THREE.Color {
    const clamped = Math.max(1, Math.min(200, feeRate));
    const logRate = Math.log1p(clamped);
    const logMin = Math.log1p(1);
    const logMax = Math.log1p(200);
    const t = (logRate - logMin) / (logMax - logMin);

    for (let i = 0; i < FEE_STOPS.length - 1; i++) {
        const lo = FEE_STOPS[i];
        const hi = FEE_STOPS[i + 1];
        if (lo === undefined || hi === undefined) continue;

        const loT = (Math.log1p(lo.rate) - logMin) / (logMax - logMin);
        const hiT = (Math.log1p(hi.rate) - logMin) / (logMax - logMin);

        if (t >= loT && t <= hiT) {
            const segT = hiT > loT ? (t - loT) / (hiT - loT) : 0;
            return lo.color.clone().lerp(hi.color, segT);
        }
    }

    const last = FEE_STOPS[FEE_STOPS.length - 1];
    return last !== undefined ? last.color.clone() : new THREE.Color('#fff5cc');
}

export type { TxWeightData };

export interface ColumnData {
    matrices: Float32Array;
    colors: Float32Array;
    count: number;
}

// Build per-instance transform matrices and colors.
// COLOR = weight (rich variety within a block), HEIGHT = weight, matching 2D approach.
export function buildColumnData(
    txWeights: Array<TxWeightData | null>,
    txCount: number,
    gridDim: number,
): ColumnData {
    const count = Math.min(txCount, gridDim * gridDim);
    const matrices = new Float32Array(count * 16);
    const colors = new Float32Array(count * 3);

    const spacing = 1.2;
    const offset = ((gridDim - 1) * spacing) / 2;

    const mat = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const quat = new THREE.Quaternion();

    for (let i = 0; i < count; i++) {
        const row = Math.floor(i / gridDim);
        const col = i % gridDim;
        const txData = txWeights[i];

        const weight = txData?.weight ?? 1000;
        const height = weightToHeight(weight);

        pos.set(col * spacing - offset, height / 2, row * spacing - offset);
        scale.set(0.9, height, 0.9);
        mat.compose(pos, quat, scale);
        mat.toArray(matrices, i * 16);

        // Color by WEIGHT (not fee rate) — matches the 2D heat map
        let color: THREE.Color;
        if (i === 0) {
            color = new THREE.Color('#4ade80'); // coinbase green
        } else {
            color = weightToColor3D(weight);
        }

        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }

    return { matrices, colors, count };
}

// Camera: low angle for dramatic cityscape view
export function defaultCameraPosition(gridDim: number): [number, number, number] {
    const extent = gridDim * 1.2;
    // Low elevation angle — see the skyline, not the rooftops
    return [extent * 0.8, extent * 0.35, extent * 0.8];
}
