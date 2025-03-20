/* Copyright (C) 2023 Thierry Sans - All Rights Reserved
 */

import { rmSync } from "fs";
import { join } from "path";
import Datastore from "@seald-io/nedb";

import { getElement, getElements } from "./database-core.mjs";

export class DatabaseRead {
  /**
   * initializes the NeDB database with 2 collections: transactions and blocks
   * @param {string} path - the directory where NeDB stores the files
   */
  constructor(path) {
    this.path = path;
    this.transactions = new Datastore({
      filename: join(path, "transactions.db"),
      autoload: false,
      timestampData: true,
    });
    this.blocks = new Datastore({
      filename: join(path, "blocks.db"),
      autoload: false,
      timestampData: true,
    });
  }

  /**
   * retrieves the utxo (i.e transaction output) for the given address
   * @param {string} address - the address (i.e the public key) of the recipient
   */
  async getUtxo(address) {
    const transaction = await getElement(this.transactions, {
      utxoOuts: { $elemMatch: { address } },
    });
    if (!transaction) {
      return null;
    }
    for (let i = 0; i < transaction.utxoOuts.length; i++) {
      const utxo = transaction.utxoOuts[i];
      if (utxo.address == address) {
        if ("block" in transaction) utxo.block = transaction.block;
        return { ...utxo, transaction: transaction._id };
      }
    }
  }

  /**
   * retrieves the transaction given its hash
   * @param {string} hash - transaction's hash
   */
  getTransaction(hash) {
    return getElement(this.transactions, { _id: hash });
  }

  /**
   * retrieves a subset of transactions
   * @param {number} page - the page index
   * @param {numbers} limit - the number of elements per page
   * @param {object} sort - either starting from the oldest one inserted (sort=1) or the latest one inserted (sort=-1)
   * @param {boolean} unconfirmed - if true, returns only the unconfirmed ones (not mined yet i.e for which the field block == null)
   */
  getTransactions(page, limit, sort = 1, unconfirmed = false) {
    let query = unconfirmed ? { block: null } : {};
    return getElements(this.transactions, query, page, limit, sort);
  }
  
  /**
   * retrieves the unconfirmed transactions that are older than the last block
   * @param {number} page - the page index
   * @param {numbers} limit - the number of elements per page
   */
  getExpiredTransactions(page, limit) {
     const self = this;
     return new Promise(function(resolve, reject){
        self.blocks.loadDatabase(function (err) {
           if (err) {
             return reject(err);
           }
            self.blocks
             .findOne({})
             .sort({ createdAt: -1 })
             .exec(function (err, block) {
                 if (err) {
                   return reject(err);
                 }
                 if (!block) return resolve([]);
                 return resolve(getElements(self.transactions, { block: null, createdAt: {"let": block.createdAt }}, page, limit, 1));
             });
         });
     });
  }

  /**
   * retrieves the block given its hash
   * @param {string} hash - block's hash
   */
  getBlock(hash) {
    return getElement(this.blocks, { _id: hash });
  }

  /**
   * retrieves a subset of blocks
   * @param {number} page - the page index
   * @param {numbers} limit - the number of elements per page
   * @param {object} sort - either starting from the oldest one inserted (sort=1) or the latest one inserted (sort=-1)
   */
  getBlocks(page, limit, sort = 1) {
    return getElements(this.blocks, {}, page, limit, sort);
  }

  /**
   * erase the directory that stores the NeDB files
   */
  destroy() {
    rmSync(this.path, { recursive: true, force: true });
  }
}
