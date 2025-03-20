import { rmSync } from "fs";
import chai from "chai";

import { DotcoinClient } from "../core/client.mjs";
import { DotcoinServer } from "../core/server.mjs";

const expect = chai.expect;

const databasePath = "data/testDb";

describe("Testing Core Features", function () {
  this.timeout(10000);
  const config = {
    difficulty: 2,
    amount: 100,
    limit: 1024,
  };
  let client1;
  let client2;
  let server;

  before(async function () {
    client1 = new DotcoinClient({ ...config, path: databasePath });
    client2 = new DotcoinClient({ ...config, path: databasePath });
    server = new DotcoinServer({
      ...config,
      path: databasePath,
    });
  });

  after(function () {
    server.destroy();
  });

  it("it should create the genesis block", async function () {
    const { block, coinbase, transactions } = await client1.mine(0);
    const blockMined = await server.addBlock(block, coinbase, transactions);
  });

  it("it should return the balances", async function () {
    const { usable: usable1, pending: pending1 } = await client1.getBalance(0);
    expect(usable1).to.be.equal(100);
    expect(pending1).to.be.equal(0);
    const { usable: usable2, pending: pending2 } = await client2.getBalance(0);
    expect(usable2).to.be.equal(0);
    expect(pending2).to.be.equal(0);
  });

  it("it should add a transaction", async function () {
    const txParams = await client1.createTransaction(
      0,
      await client2.getReceivingAddress(0),
      10,
    );
    const transaction = await server.addTransaction(txParams);
  });

  it("it should return the updated balances", async function () {
    const { usable: usable1, pending: pending1 } = await client1.getBalance(0);
    expect(usable1).to.be.equal(0);
    expect(pending1).to.be.equal(90);
    const { usable: usable2, pending: pending2 } = await client2.getBalance(0);
    expect(usable2).to.be.equal(0);
    expect(pending2).to.be.equal(10);
  });

  it("it should mine a block", async function () {
    const { block, coinbase, transactions } = await client2.mine(0);
    const blockMined = await server.addBlock(block, coinbase, transactions);
  });

  it("it should return the updated balances", async function () {
    const { usable: usable1, pending: pending1 } = await client1.getBalance(0);
    expect(usable1).to.be.equal(90);
    expect(pending1).to.be.equal(0);
    const { usable: usable2, pending: pending2 } = await client2.getBalance(0);
    expect(usable2).to.be.equal(110);
    expect(pending2).to.be.equal(0);
  });

  it("it should add another transaction", async function () {
    const txParams = await client2.createTransaction(
      0,
      await client1.getReceivingAddress(0),
      30,
    );
    const transaction = await server.addTransaction(txParams);
  });

  it("it should return the updated balances", async function () {
    const { usable: usable1, pending: pending1 } = await client1.getBalance(0);
    expect(usable1).to.be.equal(90);
    expect(pending1).to.be.equal(30);
    const { usable: usable2, pending: pending2 } = await client2.getBalance(0);
    expect(usable2).to.be.equal(0);
    expect(pending2).to.be.equal(80);
  });

  it("it should mine another block", async function () {
    const { block, coinbase, transactions } = await client1.mine(0);
    const blockMined = await server.addBlock(block, coinbase, transactions);
  });

  it("it should return the final balances", async function () {
    const { usable: usable1, pending: pending1 } = await client1.getBalance(0);
    expect(usable1).to.be.equal(220);
    expect(pending1).to.be.equal(0);
    const { usable: usable2, pending: pending2 } = await client2.getBalance(0);
    expect(usable2).to.be.equal(80);
    expect(pending2).to.be.equal(0);
  });
});
