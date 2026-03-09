import React, { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { buildColumnData, defaultCameraPosition, feeRateToColor3D } from '../lib/grid-3d.js';
import type { TxWeightData } from '../lib/grid-3d.js';

function gridDimForTxCount(txCount: number): number {
    if (txCount <= 64) return 8;
    if (txCount <= 256) return 16;
    if (txCount <= 1024) return 32;
    return 48;
}

interface BlockScene3DProps {
    blockHeight: bigint;
    txCount: number;
    txids?: string[];
    txWeights?: Array<TxWeightData | null>;
    selectedCell: number | null;
    onCellClick: (cellIndex: number) => void;
}

interface HoverState {
    instanceId: number;
    txid: string | null;
    weight: number;
    feeRate: number;
    screenX: number;
    screenY: number;
}

// ---- InstancedColumns -------------------------------------------------------

interface InstancedColumnsProps {
    txCount: number;
    txWeights: Array<TxWeightData | null>;
    txids: string[];
    gridDim: number;
    selectedCell: number | null;
    onCellClick: (cellIndex: number) => void;
    onHover: (state: HoverState | null) => void;
}

function InstancedColumns({
    txCount,
    txWeights,
    txids,
    gridDim,
    selectedCell,
    onCellClick,
    onHover,
}: InstancedColumnsProps): React.ReactElement | null {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const { camera, gl } = useThree();

    const columnData = useMemo(
        () => buildColumnData(txWeights, txCount, gridDim),
        [txWeights, txCount, gridDim],
    );

    // Apply matrices + per-instance color attribute
    useEffect(() => {
        const mesh = meshRef.current;
        if (!mesh || !mesh.geometry) return;

        const { matrices, colors, count } = columnData;
        const mat = new THREE.Matrix4();

        for (let i = 0; i < count; i++) {
            mat.fromArray(matrices, i * 16);
            mesh.setMatrixAt(i, mat);
        }
        mesh.instanceMatrix.needsUpdate = true;

        // InstancedBufferAttribute — reliable per-instance color path
        const colorAttr = new THREE.InstancedBufferAttribute(new Float32Array(colors), 3);
        mesh.geometry.setAttribute('color', colorAttr);
    }, [columnData]);

    // Highlight selected cell
    const prevSelected = useRef<number | null>(null);

    useFrame(() => {
        const mesh = meshRef.current;
        if (!mesh) return;
        const attr = mesh.geometry.getAttribute('color') as THREE.InstancedBufferAttribute | undefined;
        if (!attr) return;

        if (prevSelected.current !== null && prevSelected.current !== selectedCell) {
            const idx = prevSelected.current;
            if (idx < columnData.count) {
                attr.array[idx * 3] = columnData.colors[idx * 3];
                attr.array[idx * 3 + 1] = columnData.colors[idx * 3 + 1];
                attr.array[idx * 3 + 2] = columnData.colors[idx * 3 + 2];
                attr.needsUpdate = true;
            }
        }

        if (selectedCell !== null && selectedCell < columnData.count) {
            attr.array[selectedCell * 3] = 1.0;
            attr.array[selectedCell * 3 + 1] = 1.0;
            attr.array[selectedCell * 3 + 2] = 1.0;
            attr.needsUpdate = true;
        }

        prevSelected.current = selectedCell;
    });

    const tmpMat = useRef(new THREE.Matrix4());
    const tmpVec = useRef(new THREE.Vector3());

    const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>): void => {
        e.stopPropagation();
        const id = e.instanceId;
        if (id === undefined || id >= columnData.count) return;

        const txData = txWeights[id];
        const weight = txData?.weight ?? 1000;
        const fee = txData?.fee ?? 0;
        const vsize = weight > 0 ? weight / 4 : 1;
        const feeRate = fee / vsize;
        const txid = txids[id] ?? null;

        meshRef.current?.getMatrixAt(id, tmpMat.current);
        tmpVec.current.setFromMatrixPosition(tmpMat.current);

        const canvas = gl.domElement;
        const rect = canvas.getBoundingClientRect();
        const ndc = tmpVec.current.clone().project(camera);
        const screenX = ((ndc.x + 1) / 2) * rect.width + rect.left;
        const screenY = ((-ndc.y + 1) / 2) * rect.height + rect.top;

        onHover({ instanceId: id, txid, weight, feeRate, screenX, screenY });
    }, [columnData.count, txWeights, txids, camera, gl, onHover]);

    const handlePointerOut = useCallback((): void => {
        onHover(null);
    }, [onHover]);

    const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

    const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>): void => {
        pointerDownPos.current = { x: e.clientX, y: e.clientY };
    }, []);

    const handlePointerUp = useCallback((e: ThreeEvent<PointerEvent>): void => {
        if (!pointerDownPos.current) return;
        const dx = Math.abs(e.clientX - pointerDownPos.current.x);
        const dy = Math.abs(e.clientY - pointerDownPos.current.y);
        pointerDownPos.current = null;

        if (dx + dy < 5) {
            const id = e.instanceId;
            if (id !== undefined && id < columnData.count) {
                onCellClick(id);
            }
        }
    }, [columnData.count, onCellClick]);

    if (columnData.count === 0) return null;

    return (
        <instancedMesh
            ref={meshRef}
            args={[undefined, undefined, columnData.count]}
            onPointerMove={handlePointerMove}
            onPointerOut={handlePointerOut}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
        >
            <boxGeometry args={[1, 1, 1]} />
            <meshLambertMaterial vertexColors emissive="#442200" emissiveIntensity={0.3} />
        </instancedMesh>
    );
}

// ---- Ground plane + grid ----------------------------------------------------

function Ground({ gridDim }: { gridDim: number }): React.ReactElement {
    const size = gridDim * 1.2 + 4;
    return (
        <>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
                <planeGeometry args={[size, size]} />
                <meshLambertMaterial color="#181828" />
            </mesh>
            <gridHelper
                args={[size, gridDim, '#443300', '#221800']}
                position={[0, 0, 0]}
            />
        </>
    );
}

// ---- Camera framer ----------------------------------------------------------

interface CameraFramerProps {
    gridDim: number;
    shouldReset: boolean;
    onResetDone: () => void;
}

function CameraFramer({ gridDim, shouldReset, onResetDone }: CameraFramerProps): null {
    const { camera } = useThree();

    useEffect(() => {
        const [x, y, z] = defaultCameraPosition(gridDim);
        camera.position.set(x, y, z);
        camera.lookAt(0, 0, 0);
    }, [camera, gridDim]);

    useEffect(() => {
        if (!shouldReset) return;
        const [x, y, z] = defaultCameraPosition(gridDim);
        camera.position.set(x, y, z);
        camera.lookAt(0, 0, 0);
        onResetDone();
    }, [shouldReset, gridDim, camera, onResetDone]);

    return null;
}

// ---- Tooltip overlay --------------------------------------------------------

interface TooltipProps {
    hover: HoverState;
}

function Tooltip3D({ hover }: TooltipProps): React.ReactElement {
    const style: React.CSSProperties = {
        position: 'fixed',
        left: Math.min(hover.screenX + 12, window.innerWidth - 200),
        top: Math.max(8, hover.screenY - 60),
        background: 'rgba(2,2,8,0.92)',
        border: '1px solid rgba(247,147,26,0.4)',
        padding: '8px 10px',
        pointerEvents: 'none',
        zIndex: 9999,
        backdropFilter: 'blur(4px)',
    };

    const labelStyle: React.CSSProperties = {
        fontFamily: "'Press Start 2P', monospace",
        fontSize: 7,
        color: 'var(--accent, #f7931a)',
        marginBottom: 5,
    };

    const rowStyle: React.CSSProperties = {
        fontFamily: "'Press Start 2P', monospace",
        fontSize: 6,
        color: 'rgba(255,255,255,0.55)',
        marginBottom: 3,
        fontVariantNumeric: 'tabular-nums',
    };

    const feeColor = feeRateToColor3D(hover.feeRate);
    const feeHex = `#${feeColor.getHexString()}`;

    return (
        <div style={style}>
            <div style={labelStyle}>TX {hover.instanceId + 1}</div>
            <div style={rowStyle}>{hover.weight.toLocaleString()} WU</div>
            <div style={{ ...rowStyle, color: feeHex }}>
                {hover.feeRate.toFixed(1)} sat/vB
            </div>
            {hover.txid && (
                <div style={{ ...rowStyle, wordBreak: 'break-all', marginBottom: 0 }}>
                    {hover.txid.slice(0, 12)}...
                </div>
            )}
        </div>
    );
}

// ---- Scene ------------------------------------------------------------------

interface SceneProps {
    txCount: number;
    txWeights: Array<TxWeightData | null>;
    txids: string[];
    gridDim: number;
    selectedCell: number | null;
    onCellClick: (cellIndex: number) => void;
    onHover: (state: HoverState | null) => void;
    shouldReset: boolean;
    onResetDone: () => void;
}

function Scene({
    txCount,
    txWeights,
    txids,
    gridDim,
    selectedCell,
    onCellClick,
    onHover,
    shouldReset,
    onResetDone,
}: SceneProps): React.ReactElement {
    const maxDist = gridDim * 2.5;
    const minDist = 2;

    return (
        <>
            <CameraFramer gridDim={gridDim} shouldReset={shouldReset} onResetDone={onResetDone} />

            {/* Lighting: bright ambient + strong directional for shading depth */}
            <ambientLight intensity={1.2} />
            <directionalLight position={[10, 20, 10]} intensity={2.5} />
            <directionalLight position={[-5, 15, -5]} intensity={1.0} color="#ffaa44" />

            <Ground gridDim={gridDim} />
            <InstancedColumns
                txCount={txCount}
                txWeights={txWeights}
                txids={txids}
                gridDim={gridDim}
                selectedCell={selectedCell}
                onCellClick={onCellClick}
                onHover={onHover}
            />
            <OrbitControls
                minPolarAngle={Math.PI / 12}
                maxPolarAngle={(Math.PI * 7) / 16}
                minDistance={minDist}
                maxDistance={maxDist}
                enableDamping
                dampingFactor={0.08}
                target={[0, 0, 0]}
            />
        </>
    );
}

// ---- Public component -------------------------------------------------------

export function BlockScene3D({
    blockHeight,
    txCount,
    txids = [],
    txWeights = [],
    selectedCell,
    onCellClick,
}: BlockScene3DProps): React.ReactElement {
    const gridDim = gridDimForTxCount(txCount);
    const [hover, setHover] = useState<HoverState | null>(null);
    const [resetPending, setResetPending] = useState(false);

    const handleHover = useCallback((state: HoverState | null): void => {
        setHover(state);
    }, []);

    const handleReset = useCallback((): void => {
        setResetPending(true);
    }, []);

    const handleResetDone = useCallback((): void => {
        setResetPending(false);
    }, []);

    return (
        <div
            style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '16/9',
                background: '#0a0a18',
                border: '1px solid rgba(247,147,26,0.15)',
            }}
            aria-label={`3D block visualization for block #${blockHeight.toString()}`}
        >
            <Canvas
                camera={{ fov: 50, near: 0.1, far: 1000 }}
                gl={{ antialias: true, alpha: false }}
                style={{ width: '100%', height: '100%' }}
            >
                <color attach="background" args={['#0a0a18']} />
                <Scene
                    txCount={txCount}
                    txWeights={txWeights}
                    txids={txids}
                    gridDim={gridDim}
                    selectedCell={selectedCell}
                    onCellClick={onCellClick}
                    onHover={handleHover}
                    shouldReset={resetPending}
                    onResetDone={handleResetDone}
                />
            </Canvas>

            {/* Reset view button */}
            <button
                type="button"
                onClick={handleReset}
                style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: 8,
                    padding: '6px 10px',
                    background: 'rgba(2,2,8,0.8)',
                    border: '1px solid rgba(247,147,26,0.4)',
                    color: 'var(--accent, #f7931a)',
                    cursor: 'pointer',
                    backdropFilter: 'blur(6px)',
                    letterSpacing: '0.04em',
                    zIndex: 10,
                    transition: 'border-color 120ms steps(2)',
                }}
                aria-label="Reset 3D view to default camera position"
            >
                Reset View
            </button>

            {/* Legend */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 12,
                    left: 12,
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: 6,
                    color: 'rgba(255,255,255,0.5)',
                    lineHeight: 1.8,
                    pointerEvents: 'none',
                    zIndex: 10,
                }}
            >
                <div>Height + Color = tx weight</div>
                <div style={{ color: '#4ade80', marginTop: 2 }}>Green = coinbase</div>
            </div>

            {/* Hover tooltip */}
            {hover !== null && <Tooltip3D hover={hover} />}
        </div>
    );
}
