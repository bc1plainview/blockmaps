import { Address, AddressMap, ExtendedAddressMap, SchnorrSignature } from '@btc-vision/transaction';
import { CallResult, OPNetEvent, IOP_NETContract } from 'opnet';

// ------------------------------------------------------------------
// Event Definitions
// ------------------------------------------------------------------
export type BlockMintedEvent = {
    readonly blockHeight: bigint;
    readonly minter: Address;
};

// ------------------------------------------------------------------
// Call Results
// ------------------------------------------------------------------

/**
 * @description Represents the result of the mint function call.
 */
export type Mint = CallResult<
    {
        tokenId: bigint;
    },
    OPNetEvent<BlockMintedEvent>[]
>;

/**
 * @description Represents the result of the isMinted function call.
 */
export type IsMinted = CallResult<
    {
        minted: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getBlockData function call.
 */
export type GetBlockData = CallResult<
    {
        hash16: bigint;
        txCount: bigint;
        timestamp: bigint;
        difficulty: bigint;
        owner: Address;
        blockSize: bigint;
        blockWeight: bigint;
        totalFees: bigint;
        blockReward: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the totalMinted function call.
 */
export type TotalMinted = CallResult<
    {
        total: bigint;
    },
    OPNetEvent<never>[]
>;

// ------------------------------------------------------------------
// IBlockMaps
// ------------------------------------------------------------------
export interface IBlockMaps extends IOP_NETContract {
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
    ): Promise<Mint>;
    isMinted(blockHeight: bigint): Promise<IsMinted>;
    getBlockData(blockHeight: bigint): Promise<GetBlockData>;
    totalMinted(): Promise<TotalMinted>;
}
