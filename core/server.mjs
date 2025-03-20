/* Copyright (C) 2023 Thierry Sans - All Rights Reserved
 */

import { DatabaseWrite } from "../database/database-write.mjs";

import * as utils from "../utils/utils.mjs";
import * as common from "./common.mjs";

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

export class DotcoinServer {
  /**
   * initializes the Dotcoin server
   * @param {object} config - contains the mnemonic, the mining difficulty, the transaction limit, the coinbase amount and the NeDB path
   */
  constructor(config) {
    this.difficulty = config.difficulty || 1;
    this.limit = config.limit || 1024; // each block can have up to 2^10 transactions (including coinbase)
    this.amount = config.amount || 100; // coinbase amount
    this.path = config.path || "data";
    this.db = new DatabaseWrite(this.path);
  }

  /**
   * verifies (!!) and adds a transaction to the transaction pool
   * @param {object} txParams - the transaction data
   */
  async addTransaction(txParams) {
    // Check that the number of signatures matches the number of UTXO inputs.
    if (txParams.utxoIns.length !== txParams.signatures.length) {
      throw new ValidationError(
        `Mismatch between number of UTXO inputs and signatures.`
      );
    }
  
    // recalc transaction hash for validation (without signatures)
    const txWithoutSignatures = { ...txParams, signatures: [] };
    const txHash = utils.getTransactionHash(txWithoutSignatures);
  
    // check UTXO inputs, check for dup, and verify sig
    const seenInputs = new Set();
    for (const utxoIn of txParams.utxoIns) {
      if (seenInputs.has(utxoIn)) {
        throw new ValidationError(`Duplicate UTXO input detected: ${utxoIn}`);
      }
      seenInputs.add(utxoIn);
  
      const utxo = await this.db.getUtxo(utxoIn);
      if (!utxo) {
        throw new ValidationError(
          `UTXO ${utxoIn} is not confirmed or does not exist.`
        );
      }
  
      const signatureIndex = txParams.utxoIns.indexOf(utxoIn);
      const signature = txParams.signatures[signatureIndex];
      const derivedKey = utxo.address;
  
      const isValid = common.verifySignature(txHash, derivedKey, signature);
      if (!isValid) {
        throw new ValidationError(`Invalid signature for UTXO ${utxoIn}`);
      }
    }
  
    const addresses = new Set();
    for (const utxoOut of txParams.utxoOuts) {
      if (addresses.has(utxoOut.address)) {
        throw new ValidationError(
          `Duplicate address found in outputs: ${utxoOut.address}`
        );
      }
      addresses.add(utxoOut.address);
      if (!utxoOut.amount || utxoOut.amount <= 0) {
        throw new ValidationError(
          `Invalid amount for address ${utxoOut.address}: Amount must be greater than 0.`
        );
      }
    }
  
    //total inputs cover total outputs.
    let totalInput = 0;
    for (const utxoIn of txParams.utxoIns) {
      const utxo = await this.db.getUtxo(utxoIn);
      if (utxo) {
        totalInput += utxo.amount;
      }
    }
    const totalOutput = txParams.utxoOuts.reduce(
      (sum, utxoOut) => sum + utxoOut.amount,
      0
    );
    if (totalInput < totalOutput) {
      throw new ValidationError(
        `Insufficient input amount: total inputs ${totalInput} is less than total outputs ${totalOutput}.`
      );
    }
  
    // Mark UTXOs as spent
    for (const inputAddress of txParams.utxoIns) {
      try {
        await this.db.spendUtxos(txParams._id, [inputAddress]);
      } catch (err) {
        console.error(`Error marking UTXO ${inputAddress} as spent:`, err);
        throw err;
      }
    }
  
    // Add transaction to the pool (with block set to null)
    try {
      await this.db.addTransaction({ ...txParams, block: null });
    } catch (err) {
      console.error(`Error adding transaction ${txHash}:`, err);
      throw err;
    }
  }


  /**
   * verifies (!!) and adds a block to the database
   * it should also verify (!!) add the coinbase transaction and verify (!!) and update all transactions confirmed by the block
   * @param {object} block - the block data
   * @param {object} coinbase - the block's coinbase transaction
   * @param {array<string>} transactions - the list of transaction _ids (non including the coinbase one) that are confirmed by the block
   */
  async addBlock(block, coinbase, transactions) {
    const blockHash = utils.getBlockHash(block);
  
    // Verify the block's hash
    if (!blockHash.startsWith("1".repeat(this.difficulty))) {
      throw new ValidationError("Block hash does not satisfy difficulty");
    }

    if (block.previous) {
      const previousBlock = await this.db.getBlock(block.previous);
      if (!previousBlock) {
        throw new ValidationError(`Previous block ${block.previous} does not exist`);
      }
      if (previousBlock._id !== block.previous) {
        throw new ValidationError(`Previous block ID mismatch: expected ${block.previous}, got ${previousBlock._id}`);
      }
    }
  
    // fetch transaction
    const fetchedTxs = [];
    for (const txEntry of transactions) {
      let txId;
      if (typeof txEntry === "object" && txEntry !== null && "_id" in txEntry) {
        txId = txEntry._id;
      } else {
        txId = txEntry;
      }
      const tx = await this.db.getTransaction(txId);
      if (!tx) {
        throw new ValidationError(`Transaction ${txId} does not exist`);
      }
      fetchedTxs.push(tx);
    }
  
    const txHashes = fetchedTxs.map((tx) => {
      if (!tx || !("utxoIns" in tx)) {
        throw new ValidationError("Invalid transaction object encountered");
      }
      return utils.getTransactionHash(tx);
    });
  
    const coinbaseHash = utils.getTransactionHash(coinbase);
  
    const root = utils.getMerkleRoot([coinbaseHash, ...txHashes]);
    if (block.root !== root) {
      throw new ValidationError("Invalid Merkle root");
    }
  
    // Verify the coinbase transaction.
    if (
      coinbase.utxoIns.length > 0 ||
      coinbase.utxoOuts.length !== 1 ||
      coinbase.utxoOuts[0].amount !== this.amount
    ) {
      throw new ValidationError("Invalid coinbase transaction");
    }
  
    // Save the block.
    block._id = blockHash;
    await this.db.addBlock(block);
  
    // to array
    const txIds = transactions.map((txEntry) => {
      if (typeof txEntry === "object" && txEntry !== null && "_id" in txEntry) {
        return txEntry._id;
      }
      return txEntry;
    });
    await this.db.confirmTransactions(block._id, txIds);
  
    coinbase.block = block._id;
    await this.db.addTransaction(coinbase);
  }


  /**
   * retrieves a subset of blocks 
   * @param {number} page - the page index
   * @param {numbers} limit - the number of elements per page
   * @param {object} sort - either starting from the oldest one inserted (sort=1) or the latest one inserted (sort=-1)
   */
  async getBlocks(page, limit, sort = 1) {
    return this.db.getBlocks(page, limit, sort);
  }

  /**
   * retrieves the block given its hash
   * @param {string} hash - block's hash
   */
  async getBlock(hash) {
    return this.db.getBlock(hash);
  }

  /**
   * retrieves a subset of transactions
   * @param {number} page - the page index
   * @param {numbers} limit - the number of elements per page
   * @param {object} sort - either starting from the oldest one inserted (sort=1) or the latest one inserted (sort=-1)
   * @param {boolean} unconfirmed - if true, returns only the unconfirmed ones (not mined yet i.e for which the field block == null)
   */
  async getTransactions(page, limit, sort = 1, unconfirmed = false) {
    return this.db.getTransactions(page, limit, sort, unconfirmed);
  }

  /**
   * retrieves the transaction given its hash
   * @param {string} hash - transaction's hash
   */
  async getTransaction(hash) {
    return this.db.getTransaction(hash);
  }

  /**
   * retrieves the utxo (i.e transaction output) for the given address
   * @param {string} address - the address (i.e the public key) of the recipient
   */
  async getUtxo(address) {
    return this.db.getUtxo(address);
  }

  /**
   * erase the directory that stores the NeDB files
   */
  destroy() {
    this.db.destroy();
  }
}
