const HDKey = require('hdkey');
const bip39 = require('bip39');
const { ethers } = require('ethers');
const crypto = require('crypto');
const bs58 = require('bs58').default || require('bs58');

const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const seed = bip39.mnemonicToSeedSync(mnemonic);
const master = HDKey.fromMasterSeed(seed);

function getTronAddress(privKeyBuf) {
  const signingKey = new ethers.SigningKey('0x' + privKeyBuf.toString('hex'));
  const uncompressed = signingKey.publicKey;
  const pubBytes = Buffer.from(uncompressed.slice(4), 'hex');
  const keccak = ethers.keccak256('0x' + pubBytes.toString('hex'));
  const addressBytes = Buffer.from('41' + keccak.slice(-40), 'hex');
  const hash1 = crypto.createHash('sha256').update(addressBytes).digest();
  const hash2 = crypto.createHash('sha256').update(hash1).digest();
  const checksum = hash2.slice(0, 4);
  return bs58.encode(Buffer.concat([addressBytes, checksum]));
}

// Gas Station path: m/44'/195'/0'/1/0
const gasChild = master.derive("m/44'/195'/0'/1/0");
const gasAddr = getTronAddress(gasChild.privateKey);
console.log('GAS_STATION_TRON_ADDRESS:', gasAddr);
console.log('GAS_STATION_TRON_PRIVKEY:', gasChild.privateKey.toString('hex'));

// BSC Gas Station path: m/44'/60'/0'/1/0
const bscGasChild = master.derive("m/44'/60'/0'/1/0");
const bscWallet = new ethers.Wallet('0x' + bscGasChild.privateKey.toString('hex'));
console.log('GAS_STATION_BSC_ADDRESS:', bscWallet.address);
console.log('GAS_STATION_BSC_PRIVKEY:', '0x' + bscGasChild.privateKey.toString('hex'));
