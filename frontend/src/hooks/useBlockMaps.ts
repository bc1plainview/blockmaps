import { useState, useCallback, useRef } from 'react';
import { getContract } from 'opnet';
import { useWalletConnect } from '@btc-vision/walletconnect';
import { getProvider } from '../lib/provider.js';
import { BLOCKMAPS_ABI } from '../lib/abi.js';
import { CONTRACT_ADDRESS, NETWORK } from '../lib/constants.js';
import { hashToBlockHash16 } from '../lib/svg-generator.js';
import type { MintedBlockData, MintStatus } from '../types/index.js';

type ContractAbiParam = Parameters<typeof getContract>[1];

/** Contract methods available via ABI — typed for call sites */
interface BlockMapsContractMethods {
    mint(
        blockHeight: bigint,
        blockHash16: bigint,
        txCount: bigint,
        timestamp: bigint,
        difficulty: bigint,
        blockSize: bigint,
        blockWeight: bigint,
        totalFees: bigint,
        blockReward: bigint,
    ): Promise<Record<string, unknown>>;
    isMinted(blockHeight: bigint): Promise<Record<string, unknown>>;
    getBlockData(blockHeight: bigint): Promise<Record<string, unknown>>;
    totalMinted(): Promise<Record<string, unknown>>;
    setSender(sender: unknown): void;
}

interface UseMintReturn {
    mintStatus: MintStatus;
    mintError: string | null;
    mintTxId: string | null;
    mint: (
        blockHeight: bigint,
        blockHash: string,
        txCount: bigint,
        timestamp: bigint,
        difficulty: bigint,
        blockSize: bigint,
        blockWeight: bigint,
        totalFees: bigint,
        blockReward: bigint,
    ) => Promise<void>;
}

interface UseIsMintedReturn {
    isMinted: boolean | null;
    checkingMinted: boolean;
    checkMinted: (blockHeight: bigint) => Promise<boolean | null>;
}

interface UseGetBlockDataReturn {
    mintedBlockData: MintedBlockData | null;
    loadingMintedData: boolean;
    fetchMintedBlockData: (blockHeight: bigint) => Promise<MintedBlockData | null>;
}

interface UseTotalMintedReturn {
    totalMinted: bigint | null;
    loadingTotal: boolean;
    fetchTotalMinted: () => Promise<bigint | null>;
}

/** Read-only contract instance (no sender needed for view calls) */
function getReadContract(): BlockMapsContractMethods {
    const provider = getProvider();
    return getContract(
        CONTRACT_ADDRESS,
        BLOCKMAPS_ABI as unknown as ContractAbiParam,
        provider,
        NETWORK,
        undefined,
    ) as unknown as BlockMapsContractMethods;
}

function getWriteContract(sender: Parameters<typeof getContract>[4]): BlockMapsContractMethods {
    const provider = getProvider();
    return getContract(
        CONTRACT_ADDRESS,
        BLOCKMAPS_ABI as unknown as ContractAbiParam,
        provider,
        NETWORK,
        sender,
    ) as unknown as BlockMapsContractMethods;
}

/** Hook for minting a block NFT. */
export function useMint(): UseMintReturn {
    const { address, walletAddress } = useWalletConnect();
    const contractRef = useRef<BlockMapsContractMethods | null>(null);
    const [mintStatus, setMintStatus] = useState<MintStatus>('idle');
    const [mintError, setMintError] = useState<string | null>(null);
    const [mintTxId, setMintTxId] = useState<string | null>(null);

    const mint = useCallback(async (
        blockHeight: bigint,
        blockHash: string,
        txCount: bigint,
        timestamp: bigint,
        difficulty: bigint,
        blockSize: bigint,
        blockWeight: bigint,
        totalFees: bigint,
        blockReward: bigint,
    ): Promise<void> => {
        if (!address) {
            setMintError('Wallet not connected');
            return;
        }

        if (!walletAddress) {
            setMintError('Wallet address not resolved. Please wait and retry.');
            return;
        }

        setMintStatus('simulating');
        setMintError(null);
        setMintTxId(null);

        try {
            if (!contractRef.current) {
                contractRef.current = getWriteContract(address);
            } else {
                contractRef.current.setSender(address);
            }

            const blockHash16 = hashToBlockHash16(blockHash);

            // Simulate first — always before sendTransaction
            const sim = await contractRef.current.mint(
                blockHeight,
                blockHash16,
                txCount,
                timestamp,
                difficulty,
                blockSize,
                blockWeight,
                totalFees,
                blockReward,
            );

            if ('error' in sim) {
                setMintError(`Simulation failed: ${String(sim.error)}`);
                setMintStatus('error');
                return;
            }

            setMintStatus('pending');

            // Send with null signers — wallet handles signing on frontend
            const sendFn = sim.sendTransaction as (params: {
                signer: null;
                mldsaSigner: null;
                refundTo: string;
                network: typeof NETWORK;
            }) => Promise<Record<string, unknown>>;

            const receipt = await sendFn({
                signer: null,
                mldsaSigner: null,
                refundTo: walletAddress,
                network: NETWORK,
            });

            if (receipt && typeof receipt === 'object' && 'txid' in receipt) {
                setMintTxId(String(receipt.txid));
            }
            setMintStatus('success');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Transaction failed';
            setMintError(message);
            setMintStatus('error');
        }
    }, [address, walletAddress]);

    return { mintStatus, mintError, mintTxId, mint };
}

/** Hook to check if a block has been minted. */
export function useIsMinted(): UseIsMintedReturn {
    const [isMinted, setIsMinted] = useState<boolean | null>(null);
    const [checkingMinted, setCheckingMinted] = useState(false);

    const checkMinted = useCallback(async (blockHeight: bigint): Promise<boolean | null> => {
        setCheckingMinted(true);
        try {
            const contract = getReadContract();
            const result = await contract.isMinted(blockHeight);
            if ('error' in result) return null;
            const minted = result.decoded as boolean;
            setIsMinted(minted);
            return minted;
        } catch {
            return null;
        } finally {
            setCheckingMinted(false);
        }
    }, []);

    return { isMinted, checkingMinted, checkMinted };
}

/** Hook to fetch on-chain stored block data (includes new fields). */
export function useGetBlockData(): UseGetBlockDataReturn {
    const [mintedBlockData, setMintedBlockData] = useState<MintedBlockData | null>(null);
    const [loadingMintedData, setLoadingMintedData] = useState(false);

    const fetchMintedBlockData = useCallback(async (blockHeight: bigint): Promise<MintedBlockData | null> => {
        setLoadingMintedData(true);
        try {
            const contract = getReadContract();
            const result = await contract.getBlockData(blockHeight);
            if ('error' in result) return null;

            const decoded = result.decoded as {
                hash16: bigint;
                txCount: bigint;
                timestamp: bigint;
                difficulty: bigint;
                owner: string;
                blockSize: bigint;
                blockWeight: bigint;
                totalFees: bigint;
                blockReward: bigint;
            };

            const data: MintedBlockData = {
                hash16: decoded.hash16,
                txCount: decoded.txCount,
                timestamp: decoded.timestamp,
                difficulty: decoded.difficulty,
                owner: decoded.owner,
                blockSize: decoded.blockSize ?? 0n,
                blockWeight: decoded.blockWeight ?? 0n,
                totalFees: decoded.totalFees ?? 0n,
                blockReward: decoded.blockReward ?? 0n,
            };
            setMintedBlockData(data);
            return data;
        } catch {
            return null;
        } finally {
            setLoadingMintedData(false);
        }
    }, []);

    return { mintedBlockData, loadingMintedData, fetchMintedBlockData };
}

/** Hook to fetch total minted count. */
export function useTotalMinted(): UseTotalMintedReturn {
    const [totalMinted, setTotalMinted] = useState<bigint | null>(null);
    const [loadingTotal, setLoadingTotal] = useState(false);

    const fetchTotalMinted = useCallback(async (): Promise<bigint | null> => {
        setLoadingTotal(true);
        try {
            const contract = getReadContract();
            const result = await contract.totalMinted();
            if ('error' in result) return null;
            const total = result.decoded as bigint | undefined;
            if (total === undefined || total === null) return null;
            setTotalMinted(total);
            return total;
        } catch {
            return null;
        } finally {
            setLoadingTotal(false);
        }
    }, []);

    return { totalMinted, loadingTotal, fetchTotalMinted };
}
