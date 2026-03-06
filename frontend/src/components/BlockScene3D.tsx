import React, { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { buildColumnData, defaultCameraPosition, feeRateToColor3D } from '../lib/grid-3d.js';
import type { TxWeightData } from '../lib/grid-3d.js';

// Resolve grid dimension from tx count (matches 2D algorithm)
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

    // Apply matrices and colors once data changes
    useEffect(() => {
        const mesh = meshRef.current;
        if (!mesh) return;

        const { matrices, colors, count } = columnData;
        const mat = new THREE.Matrix4();

        for (let i = 0; i < count; i++) {
            mat.fromArray(matrices, i * 16);
            mesh.setMatrixAt(i, mat);

            const color = new THREE.Color(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]);
            mesh.setColorAt(i, color);
        }

        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }, [columnData]);

    // Highlight selected cell by overriding its instance color to bright accent.
    // On deselect, restore the original color from columnData.
    const prevSelected = useRef<number | null>(null);
    const highlightColor = useMemo(() => new THREE.Color('#f7931a'), []);

    useFrame(() => {
        const mesh = meshRef.current;
        if (!mesh || !mesh.instanceColor) return;

        // Restore previous selection's color
        if (prevSelected.current !== null && prevSelected.current !== selectedCell) {
            const idx = prevSelected.current;
            if (idx < columnData.count) {
                const orig = new THREE.Color(
                    columnData.colors[idx * 3],
                    columnData.colors[idx * 3 + 1],
                    columnData.colors[idx * 3 + 2],
                );
                mesh.setColorAt(idx, orig);
                mesh.instanceColor.needsUpdate = true;
            }
        }

        // Apply highlight to current selection
        if (selectedCell !== null && selectedCell < columnData.count) {
            mesh.setColorAt(selectedCell, highlightColor);
            mesh.instanceColor.needsUpdate = true;
        }

        prevSelected.current = selectedCell;
    });

    // Reusable temp objects for pointer move (avoid GC pressure)
    const tmpMat = useRef(new THREE.Matrix4());
    const tmpVec = useRef(new THREE.Vector3());

    const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>): void => {
        e.stopPropagation();
        const id = e.instanceId;
        if (id === undefined || id >= columnData.count) return;

        const txData = txWeights[id];
        const weight = txData?.weight ?? 1000;
        const fee = txData?.fee ?? 0;
        const vsize = txData?.size ?? Math.ceil(weight / 4);
        const feeRate = vsize > 0 ? fee / vsize : 1;
        const txid = txids[id] ?? null;

        // Project 3D position to screen space for tooltip placement
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

    const handleClick = useCallback((e: ThreeEvent<MouseEvent>): void => {
        e.stopPropagation();
        const id = e.instanceId;
        if (id !== undefined && id < columnData.count) {
            onCellClick(id);
        }
    }, [columnData.count, onCellClick]);

    if (columnData.count === 0) return null;

    return (
        <instancedMesh
            ref={meshRef}
            args={[undefined, undefined, columnData.count]}
            onPointerMove={handlePointerMove}
            onPointerOut={handlePointerOut}
            onClick={handleClick}
            castShadow
            receiveShadow
        >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial vertexColors roughness={0.6} metalness={0.1} />
        </instancedMesh>
    );
}

// ---- Ground plane + grid ----------------------------------------------------

function Ground({ gridDim }: { gridDim: number }): React.ReactElement {
    const size = gridDim * 1.2 + 4;
    return (
        <>
            {/* Solid ground */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
                <planeGeometry args={[size, size]} />
                <meshStandardMaterial color="#0a0a18" roughness={0.9} metalness={0} />
            </mesh>
            {/* Grid lines */}
            <gridHelper
                args={[size, gridDim, '#1a1a3a', '#0f0f22']}
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
            <fog attach="fog" args={['#020208', maxDist * 0.6, maxDist * 1.4]} />
            <ambientLight intensity={0.4} />
            <directionalLight
                position={[10, 20, 10]}
                intensity={1.2}
                castShadow
                shadow-mapSize={[1024, 1024]}
            />
            <directionalLight position={[-8, 12, -8]} intensity={0.3} color="#3333aa" />
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
                minPolarAngle={Math.PI / 18}
                maxPolarAngle={(Math.PI * 8) / 18}
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
                background: '#020208',
                border: '1px solid rgba(247,147,26,0.15)',
            }}
            aria-label={`3D block visualization for block #${blockHeight.toString()}`}
        >
            <Canvas
                camera={{ fov: 50, near: 0.1, far: 1000 }}
                shadows
                gl={{ antialias: true, alpha: false }}
                style={{ width: '100%', height: '100%' }}
            >
                <color attach="background" args={['#020208']} />
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

            {/* Reset view button — HTML overlay */}
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
                    color: 'rgba(255,255,255,0.4)',
                    lineHeight: 1.8,
                    pointerEvents: 'none',
                    zIndex: 10,
                }}
            >
                <div>Height = tx weight</div>
                <div>Color = fee rate</div>
                <div style={{ color: '#22c55e', marginTop: 2 }}>Green = coinbase</div>
            </div>

            {/* Hover tooltip */}
            {hover !== null && <Tooltip3D hover={hover} />}
        </div>
    );
}
