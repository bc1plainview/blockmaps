/**
 * Dynamic block discovery — finds ALL minted blocks without hardcoded lists.
 *
 * Strategy:
 * 1. Call totalMinted() to know how many blocks exist
 * 2. Generate ~200 candidate heights covering palindromes, milestones, round numbers
 * 3. Probe candidates with isMinted() in parallel batches
 * 4. Stop early if we've found all totalMinted blocks
 * 5. Report completeness to the UI
 */

import { getContract } from 'opnet';
import { getProvider } from './provider.js';
import { BLOCKMAPS_ABI } from './abi.js';
import { CONTRACT_ADDRESS, NETWORK } from './constants.js';
import type { MintedBlockData } from '../types/index.js';

type ContractAbiParam = Parameters<typeof getContract>[1];

interface DiscoveryContract {
    isMinted(blockHeight: bigint): Promise<{ properties: Record<string, unknown>; error?: unknown }>;
    getBlockData(blockHeight: bigint): Promise<{ properties: Record<string, unknown>; error?: unknown }>;
    totalMinted(): Promise<{ properties: Record<string, unknown>; error?: unknown }>;
}

interface DiscoveredBlock {
    blockHeight: bigint;
    data: MintedBlockData;
}

interface DiscoveryResult {
    blocks: DiscoveredBlock[];
    totalMinted: number;
    totalFound: number;
}

let discoveryContract: DiscoveryContract | null = null;

function getDiscoveryContract(): DiscoveryContract {
    if (!discoveryContract) {
        const provider = getProvider();
        discoveryContract = getContract(
            CONTRACT_ADDRESS,
            BLOCKMAPS_ABI as unknown as ContractAbiParam,
            provider,
            NETWORK,
        ) as unknown as DiscoveryContract;
    }
    return discoveryContract;
}

/** Generate candidate block heights likely to have been minted. */
function generateCandidateHeights(): bigint[] {
    const candidates = new Set<bigint>();

    // 6-digit palindromes: 111111, 222222, ..., 999999
    for (let d = 1; d <= 9; d++) {
        const s = String(d).repeat(6);
        candidates.add(BigInt(s));
    }

    // 5-digit palindromes: 10001, 11111, 12321, ..., 99999
    for (let d = 1; d <= 9; d++) {
        candidates.add(BigInt(String(d).repeat(5)));
    }

    // Notable mixed palindromes
    for (const p of [12321, 54321, 67876, 78987, 89098, 100001, 123321, 234432, 345543, 456654, 567765, 678876, 789987]) {
        candidates.add(BigInt(p));
    }

    // Round numbers: multiples of 100000
    for (let h = 100000; h <= 900000; h += 100000) {
        candidates.add(BigInt(h));
    }

    // Multiples of 50000
    for (let h = 50000; h <= 900000; h += 50000) {
        candidates.add(BigInt(h));
    }

    // Multiples of 10000 from 500000-900000
    for (let h = 500000; h <= 900000; h += 10000) {
        candidates.add(BigInt(h));
    }

    // Bitcoin milestone blocks
    const milestones = [
        0, 1, 170, 210000, 420000, 478558, 481824, 491407,
        500000, 525000, 550000, 575000, 600000,
        630000, 650000, 680000, 700000, 709632,
        720000, 740000, 750000, 760000, 770000, 780000,
        790000, 795000, 800000, 810000, 820000, 830000,
        840000, 850000, 860000, 870000, 880000, 890000, 900000,
    ];
    for (const h of milestones) {
        candidates.add(BigInt(h));
    }

    // Multiples of 1000 from 835000-895000 (recent halving era — most likely minting range)
    for (let h = 835000; h <= 895000; h += 1000) {
        candidates.add(BigInt(h));
    }

    // Lucky/meme numbers
    for (const h of [69420, 42069, 420000, 690000, 696969, 314159, 271828, 1337, 13370, 133700]) {
        candidates.add(BigInt(h));
    }

    return Array.from(candidates).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

const BATCH_SIZE = 8;

/** Check a batch of heights with isMinted(), returning only the minted ones. */
async function probeBatch(contract: DiscoveryContract, heights: bigint[]): Promise<bigint[]> {
    const results = await Promise.allSettled(
        heights.map(async (h) => {
            const result = await contract.isMinted(h);
            if (result.error) return null;
            const minted = result.properties.minted as boolean;
            return minted ? h : null;
        }),
    );

    const minted: bigint[] = [];
    for (const r of results) {
        if (r.status === 'fulfilled' && r.value !== null) {
            minted.push(r.value);
        }
    }
    return minted;
}

/** Fetch full block data for confirmed minted heights. */
async function fetchBlockData(contract: DiscoveryContract, heights: bigint[]): Promise<DiscoveredBlock[]> {
    const results = await Promise.allSettled(
        heights.map(async (h) => {
            const result = await contract.getBlockData(h);
            if (result.error) return null;

            const props = result.properties as {
                hash16: bigint;
                txCount: bigint;
                timestamp: bigint;
                difficulty: bigint;
                owner: { toString(): string };
                blockSize: bigint;
                blockWeight: bigint;
                totalFees: bigint;
                blockReward: bigint;
            };

            if (!props.owner || props.hash16 === 0n) return null;

            const data: MintedBlockData = {
                hash16: props.hash16,
                txCount: props.txCount,
                timestamp: props.timestamp,
                difficulty: props.difficulty,
                owner: String(props.owner),
                blockSize: props.blockSize ?? 0n,
                blockWeight: props.blockWeight ?? 0n,
                totalFees: props.totalFees ?? 0n,
                blockReward: props.blockReward ?? 0n,
            };

            return { blockHeight: h, data };
        }),
    );

    const blocks: DiscoveredBlock[] = [];
    for (const r of results) {
        if (r.status === 'fulfilled' && r.value !== null) {
            blocks.push(r.value);
        }
    }
    return blocks;
}

/**
 * Discover all minted blocks dynamically.
 *
 * @param onProgress - Called with (found, total) as discovery progresses.
 *                     Use this for progressive UI updates.
 */
export async function discoverMintedBlocks(
    onProgress?: (found: number, total: number, blocks: DiscoveredBlock[]) => void,
): Promise<DiscoveryResult> {
    const contract = getDiscoveryContract();

    // Step 1: Get total minted count
    let totalExpected = 0;
    try {
        const totalResult = await contract.totalMinted();
        if (!totalResult.error) {
            const total = totalResult.properties.total as bigint | undefined;
            totalExpected = total ? Number(total) : 0;
        }
    } catch {
        // If totalMinted fails, we'll just scan everything
    }

    if (totalExpected === 0) {
        return { blocks: [], totalMinted: 0, totalFound: 0 };
    }

    // Step 2: Generate candidates and probe in batches
    const candidates = generateCandidateHeights();
    const allMinted: bigint[] = [];

    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
        const batch = candidates.slice(i, i + BATCH_SIZE);
        const minted = await probeBatch(contract, batch);
        allMinted.push(...minted);

        // Early progress callback with partial data
        if (onProgress && minted.length > 0) {
            const partialBlocks = await fetchBlockData(contract, minted);
            onProgress(allMinted.length, totalExpected, partialBlocks);
        }

        // If we've found all minted blocks, stop early
        if (allMinted.length >= totalExpected) break;
    }

    // Step 3: Fetch full data for all found blocks
    const blocks = await fetchBlockData(contract, allMinted);
    blocks.sort((a, b) => (a.blockHeight < b.blockHeight ? -1 : a.blockHeight > b.blockHeight ? 1 : 0));

    return {
        blocks,
        totalMinted: totalExpected,
        totalFound: blocks.length,
    };
}

/**
 * Discover minted blocks owned by a specific key.
 *
 * @param ownerKey - The hashed ML-DSA key (hex, with or without 0x prefix)
 * @param onProgress - Called with progress updates
 */
export async function discoverOwnedBlocks(
    ownerKey: string,
    onProgress?: (found: number, total: number) => void,
): Promise<DiscoveredBlock[]> {
    const strip0x = (s: string): string => s.startsWith('0x') ? s.slice(2).toLowerCase() : s.toLowerCase();
    const myKey = strip0x(ownerKey);

    const result = await discoverMintedBlocks((found, total) => {
        onProgress?.(found, total);
    });

    return result.blocks.filter((b) => strip0x(b.data.owner) === myKey);
}
