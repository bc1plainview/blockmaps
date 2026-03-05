import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
    Mnemonic,
    MnemonicStrength,
    TransactionFactory,
    OPNetLimitedProvider,
    ChallengeSolution,
    MLDSASecurityLevel,
} from '@btc-vision/transaction';
import { networks } from '@btc-vision/bitcoin';
import { JSONRpcProvider } from 'opnet';

const __dirname = dirname(fileURLToPath(import.meta.url));

const NETWORK = networks.opnetTestnet;
const RPC_URL = 'https://testnet.opnet.org';
const WASM_PATH = resolve(__dirname, '../build/BlockMaps.wasm');
const WALLET_PATH = resolve(__dirname, '../.wallet.json');
const RECEIPT_PATH = resolve(__dirname, '../../.claude/loop/sessions/onchain-bitmaps/artifacts/deployment/receipt.json');

function loadWallet() {
    const walletData = JSON.parse(readFileSync(WALLET_PATH, 'utf8'));
    const mnemonic = new Mnemonic(walletData.phrase, '', NETWORK, MLDSASecurityLevel.LEVEL2);
    const wallet = mnemonic.derive(0);
    return { mnemonic, wallet, walletData };
}

async function generateWallet(): Promise<void> {
    if (existsSync(WALLET_PATH)) {
        const existing = JSON.parse(readFileSync(WALLET_PATH, 'utf8'));
        console.log('\n=== Existing Wallet Found ===');
        console.log('Address (P2TR):', existing.p2tr);
        console.log('Mnemonic saved in:', WALLET_PATH);
        return;
    }

    console.log('\n=== Generating New Testnet Wallet ===');
    const mnemonic = Mnemonic.generate(
        MnemonicStrength.MAXIMUM,
        '',
        NETWORK,
        MLDSASecurityLevel.LEVEL2,
    );

    const wallet = mnemonic.derive(0);

    const walletData = {
        phrase: mnemonic.phrase,
        p2tr: wallet.p2tr,
        p2wpkh: wallet.p2wpkh,
        network: 'opnetTestnet',
    };

    writeFileSync(WALLET_PATH, JSON.stringify(walletData, null, 2));

    console.log('Mnemonic:', mnemonic.phrase);
    console.log('Address (P2TR):', wallet.p2tr);
    console.log('Wallet saved to:', WALLET_PATH);
    console.log('\nFund this address with testnet BTC before deploying.');
    console.log('Then run: npx tsx scripts/deploy.ts link');
    console.log('Then run: npx tsx scripts/deploy.ts deploy');

    mnemonic.zeroize();
    wallet.zeroize();
}

async function checkBalance(): Promise<bigint> {
    const walletData = JSON.parse(readFileSync(WALLET_PATH, 'utf8'));
    const limitedProvider = new OPNetLimitedProvider(RPC_URL);

    try {
        const utxos = await limitedProvider.fetchUTXO({
            address: walletData.p2tr,
            minAmount: 330n,
            requestedAmount: 1n,
        });

        const total = utxos.reduce((sum, u) => sum + u.value, 0n);
        console.log(`Balance: ${total} sats (${utxos.length} UTXOs)`);
        return total;
    } catch {
        console.log('Balance: 0 sats (no UTXOs found)');
        return 0n;
    }
}

async function linkMLDSA(): Promise<void> {
    if (!existsSync(WALLET_PATH)) {
        console.error('No wallet found. Run: npx tsx scripts/deploy.ts generate');
        process.exit(1);
    }

    const { mnemonic, wallet } = loadWallet();
    console.log('\n=== Linking ML-DSA Key to Address ===');
    console.log('Address:', wallet.p2tr);

    const limitedProvider = new OPNetLimitedProvider(RPC_URL);

    // Fetch UTXOs
    let utxos;
    try {
        utxos = await limitedProvider.fetchUTXO({
            address: wallet.p2tr,
            minAmount: 330n,
            requestedAmount: 50_000n,
        });
    } catch (err) {
        console.error('Failed to fetch UTXOs:', err instanceof Error ? err.message : err);
        mnemonic.zeroize();
        wallet.zeroize();
        process.exit(1);
    }

    const totalSats = utxos.reduce((sum, u) => sum + u.value, 0n);
    console.log(`Found ${utxos.length} UTXOs, total: ${totalSats} sats`);

    // Send a self-transfer with linkMLDSAPublicKeyToAddress: true
    console.log('\nSending ML-DSA key linking transaction...');
    const factory = new TransactionFactory();

    const result = await factory.createBTCTransfer({
        signer: wallet.keypair,
        mldsaSigner: wallet.mldsaKeypair,
        network: NETWORK,
        from: wallet.p2tr,
        to: wallet.p2tr,
        amount: 1000n,
        utxos: utxos,
        linkMLDSAPublicKeyToAddress: true,
        revealMLDSAPublicKey: true,
        feeRate: 2,
        priorityFee: 330n,
        gasSatFee: 330n,
    });

    console.log('Broadcasting linking transaction...');
    const broadcastResult = await limitedProvider.broadcastTransaction(
        result.transaction,
        false,
    );

    if (!broadcastResult?.success) {
        console.error('Linking TX failed:', broadcastResult?.error ?? 'unknown error');
        mnemonic.zeroize();
        wallet.zeroize();
        process.exit(1);
    }

    console.log('Linking TX:', broadcastResult.result);
    console.log('\n=== ML-DSA Key Linked ===');
    console.log('Wait for confirmation, then run: npx tsx scripts/deploy.ts deploy');

    mnemonic.zeroize();
    wallet.zeroize();
}

async function deploy(): Promise<void> {
    if (!existsSync(WALLET_PATH)) {
        console.error('No wallet found. Run: npx tsx scripts/deploy.ts generate');
        process.exit(1);
    }

    if (!existsSync(WASM_PATH)) {
        console.error('No WASM found. Run: npm run build');
        process.exit(1);
    }

    const { mnemonic, wallet } = loadWallet();
    console.log('\n=== Deploying BlockMaps Contract ===');
    console.log('Network: OPNet Testnet');
    console.log('Deployer:', wallet.p2tr);

    // Load bytecode
    const bytecode = new Uint8Array(readFileSync(WASM_PATH));
    console.log('Bytecode size:', bytecode.length, 'bytes');

    // Fetch UTXOs
    const limitedProvider = new OPNetLimitedProvider(RPC_URL);
    console.log('\nFetching UTXOs...');

    let utxos;
    try {
        utxos = await limitedProvider.fetchUTXO({
            address: wallet.p2tr,
            minAmount: 330n,
            requestedAmount: 500_000n,
        });
    } catch (err) {
        console.error('Failed to fetch UTXOs. Is the wallet funded?');
        console.error('Address:', wallet.p2tr);
        console.error('Error:', err instanceof Error ? err.message : err);
        mnemonic.zeroize();
        wallet.zeroize();
        process.exit(1);
    }

    const totalSats = utxos.reduce((sum, u) => sum + u.value, 0n);
    console.log(`Found ${utxos.length} UTXOs, total: ${totalSats} sats`);

    // Get challenge from the network
    console.log('\nFetching epoch challenge...');
    const rpcProvider = new JSONRpcProvider({ url: RPC_URL, network: NETWORK });
    const challenge = await rpcProvider.getChallenge();
    console.log('Challenge obtained');

    // Build and sign deployment
    console.log('\nSigning deployment transaction...');
    const factory = new TransactionFactory();

    const result = await factory.signDeployment({
        signer: wallet.keypair,
        mldsaSigner: wallet.mldsaKeypair,
        network: NETWORK,
        from: wallet.p2tr,
        bytecode: bytecode,
        utxos: utxos,
        challenge: challenge as unknown as ChallengeSolution,
        linkMLDSAPublicKeyToAddress: true,
        feeRate: 2,
        priorityFee: 330n,
        gasSatFee: 330n,
    });

    console.log('Contract address:', result.contractAddress);
    console.log('Contract pubkey:', result.contractPubKey);

    // Broadcast funding TX first, then deployment TX
    console.log('\nBroadcasting funding transaction...');
    const fundingResult = await limitedProvider.broadcastTransaction(
        result.transaction[0],
        false,
    );

    if (!fundingResult?.success) {
        console.error('Funding TX failed:', fundingResult?.error ?? 'unknown error');
        mnemonic.zeroize();
        wallet.zeroize();
        process.exit(1);
    }
    console.log('Funding TX:', fundingResult.result);

    console.log('Broadcasting deployment transaction...');
    const deployResult = await limitedProvider.broadcastTransaction(
        result.transaction[1],
        false,
    );

    if (!deployResult?.success) {
        console.error('Deployment TX failed:', deployResult?.error ?? 'unknown error');
        mnemonic.zeroize();
        wallet.zeroize();
        process.exit(1);
    }
    console.log('Deployment TX:', deployResult.result);

    // Save receipt
    const receipt = {
        status: 'success',
        contractAddress: result.contractAddress,
        contractPubKey: result.contractPubKey,
        fundingTxId: fundingResult.result,
        deploymentTxId: deployResult.result,
        network: 'opnetTestnet',
        deployer: wallet.p2tr,
        timestamp: new Date().toISOString(),
        explorer: {
            mempool: `https://mempool.opnet.org/testnet4/tx/${deployResult.result}`,
            opscan: `https://opscan.org/accounts/${result.contractAddress}?network=op_testnet`,
        },
    };

    // Ensure receipt directory exists
    const receiptDir = dirname(RECEIPT_PATH);
    if (!existsSync(receiptDir)) {
        mkdirSync(receiptDir, { recursive: true });
    }
    writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2));
    console.log('\nReceipt saved to:', RECEIPT_PATH);

    console.log('\n=== Deployment Complete ===');
    console.log('Contract:', result.contractAddress);
    console.log('Mempool:', receipt.explorer.mempool);
    console.log('OPScan:', receipt.explorer.opscan);

    // Cleanup
    mnemonic.zeroize();
    wallet.zeroize();
}

// CLI entry point
const command = process.argv[2] ?? 'generate';

switch (command) {
    case 'generate':
        await generateWallet();
        break;
    case 'balance':
        await checkBalance();
        break;
    case 'link':
        await linkMLDSA();
        break;
    case 'deploy':
        await deploy();
        break;
    default:
        console.log('Usage: npx tsx scripts/deploy.ts [generate|balance|link|deploy]');
}
