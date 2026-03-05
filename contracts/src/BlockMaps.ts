import { u256 } from '@btc-vision/as-bignum/assembly';
import {
    Address,
    Blockchain,
    BytesWriter,
    Calldata,
    NetEvent,
    OP721,
    OP721InitParameters,
    Revert,
    StoredMapU256,
    StoredString,
    U256_BYTE_LENGTH,
    ADDRESS_BYTE_LENGTH,
} from '@btc-vision/btc-runtime/runtime';
import { generateSVG } from './SVGGenerator';

// Storage pointers for BlockMaps-specific data.
// These are declared at module scope so they are allocated AFTER OP721's internal pointers.
const blockHashPointer: u16 = Blockchain.nextPointer;
const blockTxCountPointer: u16 = Blockchain.nextPointer;
const blockTimestampPointer: u16 = Blockchain.nextPointer;
const blockDifficultyPointer: u16 = Blockchain.nextPointer;
const blockMinterPointer: u16 = Blockchain.nextPointer;
const svgStoragePointer: u16 = Blockchain.nextPointer;
const blockSizePointer: u16 = Blockchain.nextPointer;
const blockWeightPointer: u16 = Blockchain.nextPointer;
const totalFeesPointer: u16 = Blockchain.nextPointer;
const blockRewardPointer: u16 = Blockchain.nextPointer;

/**
 * BlockMinted event emitted when a block is minted.
 * Payload: blockHeight (u256, 32 bytes) + minter (Address, 32 bytes) = 64 bytes total.
 */
class BlockMintedEvent extends NetEvent {
    constructor(blockHeight: u256, minter: Address) {
        const writer = new BytesWriter(U256_BYTE_LENGTH + ADDRESS_BYTE_LENGTH);
        writer.writeU256(blockHeight);
        writer.writeAddress(minter);
        super('BlockMinted', writer);
    }
}

/**
 * BlockMaps — On-chain Bitcoin block NFTs.
 *
 * Each Bitcoin block can be minted exactly once as an OP721 NFT.
 * The token ID is the block height (as u256).
 * On-chain SVG art is generated from the block hash bytes and stored per-token.
 */
@final
export class BlockMaps extends OP721 {
    // Maps blockHeight (u256) -> first 16 bytes of block hash packed as u256 (big-endian)
    private readonly blockHashMap: StoredMapU256;
    // Maps blockHeight (u256) -> txCount (u256)
    private readonly blockTxCountMap: StoredMapU256;
    // Maps blockHeight (u256) -> timestamp (u256)
    private readonly blockTimestampMap: StoredMapU256;
    // Maps blockHeight (u256) -> difficulty (u256)
    private readonly blockDifficultyMap: StoredMapU256;
    // Maps blockHeight (u256) -> minter address packed as u256 (big-endian)
    private readonly blockMinterMap: StoredMapU256;
    // Maps blockHeight (u256) -> block size in bytes (u256)
    private readonly blockSizeMap: StoredMapU256;
    // Maps blockHeight (u256) -> block weight in WU (u256)
    private readonly blockWeightMap: StoredMapU256;
    // Maps blockHeight (u256) -> total fees in sats (u256)
    private readonly totalFeesMap: StoredMapU256;
    // Maps blockHeight (u256) -> block reward in sats (u256)
    private readonly blockRewardMap: StoredMapU256;

    public constructor() {
        super();
        // ONLY pointer wiring here. 20M gas constructor limit.
        this.blockHashMap = new StoredMapU256(blockHashPointer);
        this.blockTxCountMap = new StoredMapU256(blockTxCountPointer);
        this.blockTimestampMap = new StoredMapU256(blockTimestampPointer);
        this.blockDifficultyMap = new StoredMapU256(blockDifficultyPointer);
        this.blockMinterMap = new StoredMapU256(blockMinterPointer);
        this.blockSizeMap = new StoredMapU256(blockSizePointer);
        this.blockWeightMap = new StoredMapU256(blockWeightPointer);
        this.totalFeesMap = new StoredMapU256(totalFeesPointer);
        this.blockRewardMap = new StoredMapU256(blockRewardPointer);
    }

    public override onDeployment(_calldata: Calldata): void {
        this.instantiate(
            new OP721InitParameters(
                'BlockMaps',
                'BMAP',
                '',
                u256.fromU64(1000000),
            ),
        );
    }

    /**
     * Mint a unique Bitcoin block as an NFT.
     *
     * @param blockHeight - Bitcoin block height (becomes the token ID)
     * @param blockHash16 - First 16 bytes of the block hash packed into a u256 (caller-provided)
     * @param txCount - Number of transactions in the block
     * @param timestamp - Block timestamp (Unix epoch seconds)
     * @param difficulty - Block difficulty as u256
     * @returns tokenId (u256) = blockHeight cast to u256
     */
    @method(
        { name: 'blockHeight', type: ABIDataTypes.UINT64 },
        { name: 'blockHash16', type: ABIDataTypes.UINT256 },
        { name: 'txCount', type: ABIDataTypes.UINT64 },
        { name: 'timestamp', type: ABIDataTypes.UINT64 },
        { name: 'difficulty', type: ABIDataTypes.UINT256 },
        { name: 'blockSize', type: ABIDataTypes.UINT64 },
        { name: 'blockWeight', type: ABIDataTypes.UINT64 },
        { name: 'totalFees', type: ABIDataTypes.UINT64 },
        { name: 'blockReward', type: ABIDataTypes.UINT64 },
    )
    @returns({ name: 'tokenId', type: ABIDataTypes.UINT256 })
    @emit('BlockMinted')
    public mint(calldata: Calldata): BytesWriter {
        const blockHeight: u64 = calldata.readU64();
        const blockHash16: u256 = calldata.readU256();
        const txCount: u64 = calldata.readU64();
        const timestamp: u64 = calldata.readU64();
        const difficulty: u256 = calldata.readU256();
        const blockSize: u64 = calldata.readU64();
        const blockWeight: u64 = calldata.readU64();
        const totalFees: u64 = calldata.readU64();
        const blockReward: u64 = calldata.readU64();

        // Only past or current blocks can be minted
        if (blockHeight > Blockchain.block.number) {
            throw new Revert('Block has not been mined yet');
        }

        if (blockHash16 == u256.Zero) {
            throw new Revert('Block hash cannot be zero');
        }

        const tokenId: u256 = u256.fromU64(blockHeight);

        // _mint reverts if token already exists
        if (this._exists(tokenId)) {
            throw new Revert('Block already minted');
        }

        const minter: Address = Blockchain.tx.sender;

        // Store block metadata
        this.blockHashMap.set(tokenId, blockHash16);
        this.blockTxCountMap.set(tokenId, u256.fromU64(txCount));
        this.blockTimestampMap.set(tokenId, u256.fromU64(timestamp));
        this.blockDifficultyMap.set(tokenId, difficulty);
        this.blockMinterMap.set(tokenId, this._u256FromAddress(minter));
        this.blockSizeMap.set(tokenId, u256.fromU64(blockSize));
        this.blockWeightMap.set(tokenId, u256.fromU64(blockWeight));
        this.totalFeesMap.set(tokenId, u256.fromU64(totalFees));
        this.blockRewardMap.set(tokenId, u256.fromU64(blockReward));

        // Generate on-chain SVG and store in custom large-string storage
        // (bypasses OP721's 200-char MAX_URI_LENGTH by using StoredString directly)
        const svgDataUri: string = generateSVG(blockHeight, blockHash16, txCount);
        const svgStore: StoredString = new StoredString(svgStoragePointer, blockHeight);
        svgStore.value = svgDataUri;

        // Mint the OP721 token (reverts if already exists or max supply reached)
        this._mint(minter, tokenId);

        // Emit compact BlockMinted event (64 bytes, well under 352-byte limit)
        this.emitEvent(new BlockMintedEvent(tokenId, minter));

        const writer = new BytesWriter(U256_BYTE_LENGTH);
        writer.writeU256(tokenId);
        return writer;
    }

    /**
     * Check if a Bitcoin block has been minted.
     *
     * @param blockHeight - The block height to check
     * @returns true if minted, false otherwise
     */
    @method({ name: 'blockHeight', type: ABIDataTypes.UINT64 })
    @returns({ name: 'minted', type: ABIDataTypes.BOOL })
    public isMinted(calldata: Calldata): BytesWriter {
        const blockHeight: u64 = calldata.readU64();
        const tokenId: u256 = u256.fromU64(blockHeight);
        const writer = new BytesWriter(1);
        writer.writeBoolean(this._exists(tokenId));
        return writer;
    }

    /**
     * Get stored metadata for a minted BlockMap.
     *
     * @param blockHeight - The Bitcoin block height
     * @returns hash16 (u256), txCount (u256), timestamp (u256), difficulty (u256), owner (Address)
     */
    @method({ name: 'blockHeight', type: ABIDataTypes.UINT64 })
    @returns(
        { name: 'hash16', type: ABIDataTypes.UINT256 },
        { name: 'txCount', type: ABIDataTypes.UINT256 },
        { name: 'timestamp', type: ABIDataTypes.UINT256 },
        { name: 'difficulty', type: ABIDataTypes.UINT256 },
        { name: 'owner', type: ABIDataTypes.ADDRESS },
        { name: 'blockSize', type: ABIDataTypes.UINT256 },
        { name: 'blockWeight', type: ABIDataTypes.UINT256 },
        { name: 'totalFees', type: ABIDataTypes.UINT256 },
        { name: 'blockReward', type: ABIDataTypes.UINT256 },
    )
    public getBlockData(calldata: Calldata): BytesWriter {
        const blockHeight: u64 = calldata.readU64();
        const tokenId: u256 = u256.fromU64(blockHeight);

        if (!this._exists(tokenId)) {
            throw new Revert('Block not minted');
        }

        const hash16: u256 = this.blockHashMap.get(tokenId);
        const txCount: u256 = this.blockTxCountMap.get(tokenId);
        const timestamp: u256 = this.blockTimestampMap.get(tokenId);
        const difficulty: u256 = this.blockDifficultyMap.get(tokenId);
        const ownerU256: u256 = this.blockMinterMap.get(tokenId);
        const owner: Address = this._addressFromU256(ownerU256);
        const blockSize: u256 = this.blockSizeMap.get(tokenId);
        const blockWeight: u256 = this.blockWeightMap.get(tokenId);
        const totalFees: u256 = this.totalFeesMap.get(tokenId);
        const blockReward: u256 = this.blockRewardMap.get(tokenId);

        // 8 × u256 (32 bytes each) + 1 × Address (32 bytes) = 288 bytes
        const writer = new BytesWriter(8 * U256_BYTE_LENGTH + ADDRESS_BYTE_LENGTH);
        writer.writeU256(hash16);
        writer.writeU256(txCount);
        writer.writeU256(timestamp);
        writer.writeU256(difficulty);
        writer.writeAddress(owner);
        writer.writeU256(blockSize);
        writer.writeU256(blockWeight);
        writer.writeU256(totalFees);
        writer.writeU256(blockReward);
        return writer;
    }

    /**
     * Get total number of minted BlockMaps.
     * Delegates to OP721 totalSupply.
     */
    @method()
    @returns({ name: 'total', type: ABIDataTypes.UINT256 })
    public totalMinted(_calldata: Calldata): BytesWriter {
        const writer = new BytesWriter(U256_BYTE_LENGTH);
        writer.writeU256(this.totalSupply);
        return writer;
    }

    /**
     * Override tokenURI to serve the on-chain SVG data URI stored during mint.
     * This bypasses OP721's 200-character MAX_URI_LENGTH limit by reading from
     * our custom StoredString storage (indexed by blockHeight / tokenId).
     */
    public override tokenURI(calldata: Calldata): BytesWriter {
        const tokenId: u256 = calldata.readU256();
        if (!this._exists(tokenId)) {
            throw new Revert('Token does not exist');
        }

        // tokenId == blockHeight (stored as low 64 bits of u256)
        const blockHeight: u64 = tokenId.lo1;
        const svgStore: StoredString = new StoredString(svgStoragePointer, blockHeight);
        const uri: string = svgStore.value;

        // writeStringWithLength uses 4-byte length prefix + UTF-8 content
        const byteLen: i32 = String.UTF8.byteLength(uri);
        const writer = new BytesWriter(4 + byteLen);
        writer.writeStringWithLength(uri);
        return writer;
    }
}
