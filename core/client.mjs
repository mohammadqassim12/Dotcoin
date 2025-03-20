/* Copyright (C) 2023 Thierry Sans - All Rights Reserved
 */

import { DatabaseRead } from "../database/database-read.mjs";

import * as utils from "../utils/utils.mjs";
import * as common from "./common.mjs";

export class ClientError extends Error {
  constructor(message) {
    super(message);
    this.name = "ClientError";
  }
}

export class DotcoinClient {
  /**
       * initializes the Dotcoin client
       * @param {object} config - contains the mnemonic, the mining difficulty, the transaction limit, the coinbase amount and the NeDB path
       */
  constructor(config) {
    this.mnemonic = config.mnemonic || common.createMnemonic(); // mnemonic for genesis block
    this.difficulty = config.difficulty || 1; // mining difficulty
    this.limit = config.limit || 1024; // each block can have up to 2^10 transactions (including coinbase)
    this.amount = config.amount || 100; // coinbase amount
    this.path = config.path || "data"; // database path
    this.db = new DatabaseRead(this.path);
}

  /**
   * returns the mnemonic as a string
   */
  getMnemonic() {
    return this.mnemonic;
  }

  /**
   * returns the receiving key (i.e public key) as a string
   * @param {number} account - the wallet account index
   */
  async getReceivingAddress(account) {
    const {publicKey} = await common.getReceiveKeys(this.mnemonic, account);
    return publicKey;
  }

  /**
   * returns the total of dotcoin owns by the wallet account as a number
   * @param {number} account - the wallet account index
   */
  async getBalance(account) {
    let totalUsable = 0;
    let totalPending = 0;
    let childIndex = 0;

    while (true) {

        // Derive receiving and change addresses dynamically using childIndex
        const { publicKey: receiveParentKey } = await common.getReceiveKeys(this.mnemonic, account);
        const { publicKey: changeParentKey } = await common.getChangeKeys(this.mnemonic, account);

        const receiveAddress = common.getChildKeys(receiveParentKey, childIndex).publicKey;
        const changeAddress = common.getChildKeys(changeParentKey, childIndex).publicKey;

        // Fetch UTXOs for the derived receiving and change addresses
        let receiveUtxos = await this.db.getUtxo(receiveAddress);
        let changeUtxos = await this.db.getUtxo(changeAddress);

        // Break the loop if no UTXOs are found for both receiving and change addresses
        if (!receiveUtxos && !changeUtxos) {
            break;
        }

        receiveUtxos = Array.isArray(receiveUtxos) ? receiveUtxos : receiveUtxos ? [receiveUtxos] : [];
        changeUtxos = Array.isArray(changeUtxos) ? changeUtxos : changeUtxos ? [changeUtxos] : [];
        const allUtxos = [...receiveUtxos, ...changeUtxos];

        for (const utxo of allUtxos) {
            if (utxo.txIn) continue; //spent UTXOs
            if (utxo.block) {
                totalUsable += utxo.amount; // confirmed UTXO
            } else {
                totalPending += utxo.amount; // pending UTXO
            }
        }
        // Increment childIndex to derive the next set of addresses
        childIndex++;
    }
    return { usable: totalUsable, pending: totalPending };
}



  /**
   * returns a transaction candidate
   * @param {number} account - the wallet account index
   * @param {string} address - recipient's receiving address (i.e public key)
   * @param {number} amount - the number of dotcoin to transfer
   */
  async createTransaction(account, address, amount) {
    let total = 0;
    const selectedUtxos = [];
    const tx = { utxoIns: [], utxoOuts: [], signatures: [] };
  
    // same logic as getBalance 
    let childIndex = 0;
    while (total < amount) {
      
      const { publicKey: receiveParentKey } = await common.getReceiveKeys(this.mnemonic, account);
      const { publicKey: changeParentKey } = await common.getChangeKeys(this.mnemonic, account);
      const receiveAddress = common.getChildKeys(receiveParentKey, childIndex).publicKey;
      const changeAddress = common.getChildKeys(changeParentKey, childIndex).publicKey;
  
      
      let receiveUtxos = await this.db.getUtxo(receiveAddress);
      let changeUtxos = await this.db.getUtxo(changeAddress);
  
      
      receiveUtxos = Array.isArray(receiveUtxos) ? receiveUtxos : receiveUtxos ? [receiveUtxos] : [];
      changeUtxos = Array.isArray(changeUtxos) ? changeUtxos : changeUtxos ? [changeUtxos] : [];
      const allUtxos = [...receiveUtxos, ...changeUtxos];
  
      
      if (allUtxos.length === 0 && childIndex > 0) {
        break;
      }
  
      for (const utxo of allUtxos) {
        if (utxo.txIn) continue;      // spent
        if (!utxo.block) continue;     // unconfirmed
        if (total >= amount) break;
  
        total += utxo.amount;
        // UTXO came from the receive or change
        const type = utxo.address === receiveAddress ? 'receive' : 'change';
        selectedUtxos.push({ ...utxo, childIndex, type });
        tx.utxoIns.push(utxo.address);
      }
      childIndex++;
    }
  
    if (total < amount) {
      throw new ClientError("Insufficient funds");
    }
  
    // creaut UTxO outs for recipient and change (if needed)
    const change = total - amount;
    if (change < 0) {
      throw new ClientError("Invalid transaction amount");
    }
  
    // Get change add if needed.
    let changeAddressForOutput;
    if (change > 0) {
      let changeChildIndex = 0;
      const { publicKey: changeParentKey } = await common.getChangeKeys(this.mnemonic, account);
      while (true) {
        const derivedChangeAddress = common.getChildKeys(changeParentKey, changeChildIndex).publicKey;
        const utxo = await this.db.getUtxo(derivedChangeAddress);
        if (!utxo) {
          changeAddressForOutput = derivedChangeAddress;
          break;
        }
        changeChildIndex++;
      }
    }
  
    // Get recipient address
    let recipientAddress;
    let recipientChildIndex = 0;
    while (true) {
      const derivedRecipientAddress = common.getChildKeys(address, recipientChildIndex).publicKey;
      const utxo = await this.db.getUtxo(derivedRecipientAddress);
      if (!utxo) {
        recipientAddress = derivedRecipientAddress;
        break;
      }
      recipientChildIndex++;
    }
  
    const utxoOuts = [{ address: recipientAddress, amount }];
    if (change > 0) {
      utxoOuts.push({ address: changeAddressForOutput, amount: change });
    }
    tx.utxoOuts.push(...utxoOuts);
  
    // Compute the transaction hash (without signatures)
    const txHash = utils.getTransactionHash(tx);
  
    // For each UTXO, sign the transaction hash using appropriate key 
    for (const utxoObj of selectedUtxos) {
      let keyPair;
      if (utxoObj.type === "receive") {
        const { privateKey: parentPrivateKey } = await common.getReceiveKeys(this.mnemonic, account);
        keyPair = common.getChildKeys(parentPrivateKey, utxoObj.childIndex);
      } else {
        const { privateKey: parentPrivateKey } = await common.getChangeKeys(this.mnemonic, account);
        keyPair = common.getChildKeys(parentPrivateKey, utxoObj.childIndex);
      }
      const signature = common.signHash(txHash, keyPair.privateKey);
      tx.signatures.push(signature);
    }
  
    // Calculate the transaction ID (hash) including the signatures
    tx._id = utils.getTransactionHash(tx);
  
    return tx;
  }


  /**
   * returns a block candidate
   * @param {number} account - the wallet account index that will receives the coinbase amount
   */
  async mine(account) {
      let childIndex = 0;
      let publicKey;
      const { publicKey: parentKey } = await common.getReceiveKeys(this.mnemonic, account);
      // Find the first available public key
      while (true) {
          const derivedKey = common.getChildKeys(parentKey, childIndex).publicKey;
          const utxo = await this.db.getUtxo(derivedKey);
          if (!utxo) {
              publicKey = derivedKey;
              break;
          }
          childIndex++;
      }

      const coinbase = {
          _id: null,
          utxoIns: [],
          utxoOuts: [{ address: publicKey, amount: this.amount}],
      };
      coinbase._id = utils.getTransactionHash(coinbase);
      const unconfirmedTxs = await this.db.getTransactions(0, 100, 1, true);

      let transactionsToMine = [coinbase, ...unconfirmedTxs];

      const lastBlocks = await this.db.getBlocks(0, 1, -1);
      const lastBlock = lastBlocks.length > 0 ? lastBlocks[0] : null;

      const txIds = transactionsToMine.map((tx) => tx._id);
      const blockCandidate = {
          _id: null,
          previous: lastBlock ? lastBlock._id : null,
          root: utils.getMerkleRoot(txIds),
          nonce: null,
      };
      const minedBlock = common.findNonce(blockCandidate, this.difficulty);
      minedBlock._id = utils.getBlockHash(minedBlock);

      for (const tx of unconfirmedTxs) {
          tx.block = minedBlock._id;
      }
      return { block: minedBlock, coinbase, transactions: unconfirmedTxs.map(tx => tx._id) };
  }

}
