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

console.log('--- Deriving 0 to 20 ---');
for (let i = 0; i < 20; i++) {
  const child = master.derive("m/44'/195'/0'/0/" + i);
  const addr = getTronAddress(child.privateKey);
  console.log(`Index ${i}: ${addr}`);
  if (addr === 'TRGVdeYnLm92LodhRyCyTyxYvLqocfffRs') {
    console.log(`>>> MATCH FOUND AT INDEX ${i} <<<`);
    console.log(`Private Key: ${child.privateKey.toString('hex')}`);
  }
}
