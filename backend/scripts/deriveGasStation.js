const bip39 = require('bip39');
const HDKey = require('hdkey');
const { ethers } = require('ethers');
const TronWeb = require('tronweb');
const TW = TronWeb.default || TronWeb;

const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const seed = bip39.mnemonicToSeedSync(mnemonic);
const root = HDKey.fromMasterSeed(seed);

// Index 100 = dedicated gas station (outside the 0-49 scan range)
const bscChild  = root.derive("m/44'/60'/0'/0/100");
const bscPrivKey = '0x' + bscChild.privateKey.toString('hex');
const bscAddress = ethers.computeAddress(bscPrivKey);

const tronChild   = root.derive("m/44'/195'/0'/0/100");
const tronPrivKey = tronChild.privateKey.toString('hex');
const tronAddrHex = '41' + ethers.computeAddress('0x' + tronPrivKey).slice(2).toLowerCase();
const tronAddress = TW.address.fromHex(tronAddrHex);

console.log('=== GAS STATION WALLETS (Index 100) ===');
console.log('BSC_GAS_PRIVKEY=' + bscPrivKey);
console.log('BSC_GAS_ADDRESS=' + bscAddress);
console.log('TRON_GAS_PRIVKEY=' + tronPrivKey);
console.log('TRON_GAS_ADDRESS=' + tronAddress);
