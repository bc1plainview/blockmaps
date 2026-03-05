import { ABIDataTypes, BitcoinAbiTypes, OP_NET_ABI } from 'opnet';

export const BlockMapsEvents = [
    {
        name: 'BlockMinted',
        values: [
            { name: 'blockHeight', type: ABIDataTypes.UINT256 },
            { name: 'minter', type: ABIDataTypes.ADDRESS },
        ],
        type: BitcoinAbiTypes.Event,
    },
];

export const BlockMapsAbi = [
    {
        name: 'mint',
        inputs: [
            { name: 'blockHeight', type: ABIDataTypes.UINT64 },
            { name: 'blockHash16', type: ABIDataTypes.UINT256 },
            { name: 'txCount', type: ABIDataTypes.UINT64 },
            { name: 'timestamp', type: ABIDataTypes.UINT64 },
            { name: 'difficulty', type: ABIDataTypes.UINT256 },
            { name: 'blockSize', type: ABIDataTypes.UINT64 },
            { name: 'blockWeight', type: ABIDataTypes.UINT64 },
            { name: 'totalFees', type: ABIDataTypes.UINT64 },
            { name: 'blockReward', type: ABIDataTypes.UINT64 },
        ],
        outputs: [{ name: 'tokenId', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'isMinted',
        inputs: [{ name: 'blockHeight', type: ABIDataTypes.UINT64 }],
        outputs: [{ name: 'minted', type: ABIDataTypes.BOOL }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'getBlockData',
        inputs: [{ name: 'blockHeight', type: ABIDataTypes.UINT64 }],
        outputs: [
            { name: 'hash16', type: ABIDataTypes.UINT256 },
            { name: 'txCount', type: ABIDataTypes.UINT256 },
            { name: 'timestamp', type: ABIDataTypes.UINT256 },
            { name: 'difficulty', type: ABIDataTypes.UINT256 },
            { name: 'owner', type: ABIDataTypes.ADDRESS },
            { name: 'blockSize', type: ABIDataTypes.UINT256 },
            { name: 'blockWeight', type: ABIDataTypes.UINT256 },
            { name: 'totalFees', type: ABIDataTypes.UINT256 },
            { name: 'blockReward', type: ABIDataTypes.UINT256 },
        ],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'totalMinted',
        inputs: [],
        outputs: [{ name: 'total', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    ...BlockMapsEvents,
    ...OP_NET_ABI,
];

export default BlockMapsAbi;
