# BlockMaps

On-chain Bitcoin block NFTs on OPNet. Every Bitcoin block becomes a unique 16x16 generative artwork derived from its block hash, minted as an OP-721 token with full block metadata stored on-chain.

## What It Does

- **Mint any Bitcoin block** as an NFT — the artwork is deterministically generated from the block hash
- **Interactive block explorer** — click individual transaction "parcels" in the grid to inspect them
- **Sankey BTC flow diagrams** — visualize how BTC moves through inputs and outputs
- **Live block feed** — auto-refreshing feed of the latest Bitcoin blocks
- **On-chain metadata** — block size, weight, total fees, block reward, difficulty, timestamp all stored in the contract

## Architecture

```
contracts/          AssemblyScript smart contract (OP-721 + block storage)
frontend/           React + Vite dApp with WalletConnect
```

### Data Model

Block-level stats are stored on-chain in the contract. Transaction drill-down data comes from the mempool.space REST API. This hybrid approach keeps gas costs low while enabling rich exploration.

### Contract: `BlockMaps.ts`

- `mint(blockHeight, blockHash16, txCount, timestamp, difficulty, blockSize, blockWeight, totalFees, blockReward)` — mint a block NFT with full metadata
- `getBlockData(blockHeight)` — read stored block data (288 bytes)
- `isMinted(blockHeight)` — check if a block has been minted
- `totalMinted()` — count of minted blocks

### Frontend

| Component | Purpose |
|-----------|---------|
| InteractiveGrid | 16x16 SVG grid — each cell is a clickable transaction parcel |
| TxPanel | Slide-in panel showing transaction breakdown |
| SankeyDiagram | BTC flow visualization (inputs -> outputs) |
| LiveBlockFeed | Auto-refreshing feed of latest blocks |
| SearchBar | Search by block height or txid |
| BlockStatsCard | Comprehensive block metadata display |

## Development

```bash
# Frontend
cd frontend
npm install
npm run dev          # http://localhost:5173

# Contract (requires OPNet toolchain)
cd contracts
npm install
npm run build
```

## Testnet

- **Network**: OPNet Testnet (Signet fork)
- **Contract**: `opt1sqr40v6232gwhwtf2jwmr7a3r9au2q25ykqd3cnrj`
- **Explorer**: [OPScan](https://opscan.org)
- **Mempool**: [mempool.opnet.org](https://mempool.opnet.org/testnet4)

## Stack

- AssemblyScript + btc-runtime (contract)
- React + Vite + TypeScript (frontend)
- WalletConnect v2 + OP_WALLET (wallet)
- mempool.space REST API (block/tx data)
- Custom SVG Sankey layout (no D3)
