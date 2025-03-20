/* Copyright (C) 2023 Thierry Sans - All Rights Reserved
 */

import { DatabaseRead } from "./database-read.mjs";
import {
  getElement,
  getElements,
  addElement,
  updateElement,
  updateElements,
} from "./database-core.mjs";

export class DatabaseWrite extends DatabaseRead {
  /**
   * initializes the NeDB database with 2 collections: transactions and blocks
   * @param {string} path - the directory where NeDB stores the files
   */
  constructor(path) {
    super(path);
  }

  /**
   * adds a transaction to the collection of transactions
   * @param {object} data - transaction's data
   */
  async addTransaction(data) {
    const transaction = await addElement(this.transactions, data);
    console.log(`Transaction ${transaction._id} has been added`);
    return transaction;
  }

  /**
   * adds a block to the collection of blocks
   * @param {object} data - block's data
   */
  async addBlock(data) {
    const block = await addElement(this.blocks, data);
    console.log(
      `Block ${block._id} has been added (previous ${block.previous})`,
    );
    return block;
  }

  /**
   * updates all utxos (i.e transaction output), given as a list of addresses, to mark it as spent
   * by setting the field 'txIn' as the transaction _id that uses those utxos as input
   * @param {string} txIn - transaction _id that uses the utxos as input
   * @param {array<string>} addresses - the list of base58-encoded addresses (i.e public keys)
   */
  async spendUtxos(txIn, addresses) {
    for (let address of addresses) {
      const transaction = await getElement(this.transactions, {
        utxoOuts: { $elemMatch: { address: address } },
      });
      for (let i = 0; i < transaction.utxoOuts.length; i++) {
        if (transaction.utxoOuts[i].address == address) {
          transaction.utxoOuts[i].txIn = txIn;
          await updateElement(
            this.transactions,
            { _id: transaction._id },
            transaction,
          );
          console.log(
            `Address ${address} has been spent (transaction ${transaction._id})`,
          );
          break;
        }
      }
    }
  }

  /**
   * updates all transactions, given as a list of transaction _ids, to mark it as confirmed
   * by setting the field 'block' as the block _id that confirms them
   * @param {string} _id - the block _id
   * @param {array<string>} transactions - the list of transaction _ids
   */
  async confirmTransactions(_id, transactions) {
    await updateElements(
      this.transactions,
      { _id: { $in: transactions } },
      { $set: { block: _id } },
    );
    console.log(`Transactions ${transactions.join(",")} have been confirmed`);
  }
}
