/* Copyright (C) 2023 Thierry Sans - All Rights Reserved
 */

import { generateMnemonic, mnemonicToSeed } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { HDKey } from "@scure/bip32";
import { randomBytes } from "crypto";
import { keccak_256 } from "@noble/hashes/sha3";
import { base58check } from "@scure/base";

import * as utils from "../utils/utils.mjs";

const base58 = base58check(keccak_256);

/**
 * returns the mnemonic as a string
 */
export function createMnemonic() {
    return generateMnemonic(wordlist,128); // this is for 12 words
}

/**
 * returns the receiving key for the given wallet's account
 * @param {string} mnemonic - the wallet's mnemonic phrase
 * @param {number} account - the wallet account index
 */ 
export async function getReceiveKeys(mnemonic, account) {

    const seed = await mnemonicToSeed(mnemonic); //get the seed from the mnemonic
    const root = HDKey.fromMasterSeed(seed); //master key
    const receiveKey = root.derive(`m/44'/1'/${account}'/1`);
    return {
        privateKey: receiveKey.privateExtendedKey,
        publicKey: receiveKey.publicExtendedKey,
    };
}

/**
 * returns the changing key pair (public and private) for the given wallet's account
 * @param {string} mnemonic - the wallet's mnemonic phrase
 * @param {number} account - the wallet account index
 */
export async function getChangeKeys(mnemonic, account) {

    //same logic as earlier but 0 instead of 1
    const seed = await mnemonicToSeed(mnemonic);
    const root = HDKey.fromMasterSeed(seed);
    const changeKey = root.derive(`m/44'/1'/${account}'/0`);
    return {
        privateKey: changeKey.privateExtendedKey,
        publicKey: changeKey.publicExtendedKey,
    };

}

/**
 * returns the child key(s) for the given parent's key
 * if the parent's key is a public key, it returns the child public key only {publicKey: ...}
 * if the parent's key is a private key, it returns both private and public key {privateKey:, publicKey: }
 * @param {string} key - base58-encoded key (either private or public)
 * @param {number} index - the child key index
 */
export function getChildKeys(key, index) {
    const parent = HDKey.fromExtendedKey(key);
    const child = parent.deriveChild(index);
    if (parent.privateKey) {
        return {
            privateKey: child.privateExtendedKey,
            publicKey: child.publicExtendedKey,
        };
    } else {
        return {
            publicKey: child.publicExtendedKey,
        };
    }
}

/**
 * returns the base58-encoded signature for a given hash
 * @param {string} hash - base58-encoded hash
 * @param {string} privateKey - base58-encoded private key
 */
export function signHash(hash, privateKey) {
    const keyPair = HDKey.fromExtendedKey(privateKey);
    const signature = keyPair.sign(base58.decode(hash));
    return base58.encode(signature);
}

/**
 * returns true or false whether the signature match a given hash
 * @param {string} hash - base58-encoded hash
 * @param {string} publicKey - base58-encoded public key
 * @param {string} sig - base58-encoded signature
 */
export function verifySignature(hash, publicKey, sig) {
    const decodedHash = base58.decode(hash);
    const decodedSig = base58.decode(sig);
    const keyPair = HDKey.fromExtendedKey(publicKey);
    const isValid = keyPair.verify(decodedHash, decodedSig);
    return isValid;
  }

/**
 * returns the complete block data that includes a valid nonce that matches the difficulty and the block _id
 * @param {object} block - incomplete block that includes the previous block _id, the merkle root hash and the timestamp
 * @param {number} difficulty - the number of '1' that should prefix the block _id;
 */
export function findNonce(block, difficulty) {
    const prefix = "1".repeat(difficulty);
    let nonce = 0;

    while (true) {
        const nonceArray = new Uint8Array([...(nonce.toString())].map(c => c.charCodeAt(0)));
        block.nonce = base58.encode(nonceArray); 
        const blockId = utils.getBlockHash(block);
        if (blockId.startsWith(prefix)) {
            block._id = blockId;
            return block;
        }
        nonce++;
    }
}


