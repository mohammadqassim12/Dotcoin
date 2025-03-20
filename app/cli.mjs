import { join } from "path";
import { mkdirSync, readFileSync, existsSync, writeFileSync } from "fs";
import { Command } from "commander";
import axios from "axios";
import axiosRetry from "axios-retry";

import { DotcoinClient } from "../core/client.mjs";
import { readConfig, readMnemonic, writeMnemonic } from "./storage.mjs";

axiosRetry(axios, { retries: 5 });

const databasePath = join("data", "client");

async function syncDatabase(servername, path) {
  mkdirSync(databasePath, { recursive: true });
  const transactions = await axios
    .get(`${servername}/transactions.db`, { responseType: "blob" })
    .then(function (res) {
      return res.data;
    });
  await writeFileSync(join(databasePath, "transactions.db"), transactions);
  const blocks = await axios
    .get(`${servername}/blocks.db`, { responseType: "blob" })
    .then(function (res) {
      return res.data;
    });
  await writeFileSync(join(databasePath, "blocks.db"), blocks);
}

async function create(options) {
  const config = readConfig(options.config);
  const client = new DotcoinClient(config);
  const mnemonic = client.getMnemonic();
  await writeMnemonic(options.wallet, mnemonic, options.password);
  console.log(`wallet has been created and save in ${options.wallet}`);
}

async function mnemonic(options) {
  const mnemonic = await readMnemonic(options.wallet, options.password);
  console.log(`${mnemonic}`);
}

async function address(account, options) {
  const mnemonic = await readMnemonic(options.wallet, options.password);
  const config = readConfig(options.config);
  const client = new DotcoinClient({ path: databasePath, mnemonic, ...config });
  const publicKey = await client.getReceivingAddress(parseInt(account));
  console.log(`The address for account ${account} is ${publicKey}`);
}

async function balance(account, options) {
  const mnemonic = await readMnemonic(options.wallet, options.password);
  const config = readConfig(options.config);
  await syncDatabase(options.node, config.path);
  const client = new DotcoinClient({ path: databasePath, mnemonic, ...config });
  const { usable, pending } = await client.getBalance(parseInt(account));
  console.log(
    `The address for account ${account} has a balance of ${usable} (and pending: ${pending})`,
  );
}

async function transfer(account, address, amount, options) {
  const mnemonic = await readMnemonic(options.wallet, options.password);
  const config = readConfig(options.config);
  await syncDatabase(options.node, config.path);
  const client = new DotcoinClient({ path: databasePath, mnemonic, ...config });
  const transaction = await client.createTransaction(
    parseInt(account),
    address,
    parseInt(amount),
  );
  await axios
    .put(`${options.node}/transactions/`, transaction)
    .then(function (res) {
      if (res.status == 200)
        return console.log(JSON.stringify(res.data, null, 2));
      if (res.status == 400) throw new Error(`[error] ${res.data}`);
      if (res.status == 500) throw new Error(`[bug] ${res.data}`);
    });
}

async function mine(account, options) {
  const mnemonic = await readMnemonic(options.wallet, options.password);
  const config = readConfig(options.config);
  await syncDatabase(options.node, config.path);
  const client = new DotcoinClient({ path: databasePath, mnemonic, ...config });
  const blockData = await client.mine(parseInt(account));
  await axios
    .put(`${options.node}/blocks/`, blockData, { proxy: false })
    .then(function (res) {
      if (res.status == 200)
        return console.log(JSON.stringify(blockData, null, 2));
      if (res.status == 400) throw new Error(`[error] ${res.data}`);
      if (res.status == 500) throw new Error(`[bug] ${res.data}`);
    });
}

const program = new Command();

program.name("dotcoin-cli").description("DotCoin Client CLI").version("0.1");

program
  .command("create")
  .description("create a wallet and export its mnemonic phrase")
  .option("-w, --wallet <walletfile>", "wallet file", "./wallet.bin")
  .option("-c, --config <configfile>", "config file", "./config.json")
  .option("-p, --password <password>", "password")
  .action(create);

program
  .command("mnemonic")
  .description("get mnemonic")
  .option("-w, --wallet <walletfile>", "wallet file", "./wallet.bin")
  .option("-c, --config <configfile>", "config file", "./config.json")
  .option("-p, --password <password>", "password")
  .action(mnemonic);

program
  .command("address")
  .description("get receiving address")
  .argument("<account>", "account")
  .option("-w, --wallet <walletfile>", "wallet file", "./wallet.bin")
  .option("-c, --config <configfile>", "config file", "./config.json")
  .option("-p, --password <password>", "password")
  .action(address);

program
  .command("balance")
  .description("get balance")
  .argument("<account>", "account")
  .option("-w, --wallet <walletfile>", "wallet file", "./wallet.bin")
  .option("-c, --config <configfile>", "config file", "./config.json")
  .option("-p, --password <password>", "password")
  .option(
    "-n, --node <servername>",
    "servername",
    "https://dotcoin.seclab.space",
  )
  .action(balance);

program
  .command("transfer")
  .description("transfer coins")
  .argument("<account>", "account")
  .argument("<address>", "recipient's address")
  .argument("<amount>", "amount to transfer")
  .option("-w, --wallet <walletfile>", "wallet file", "./wallet.bin")
  .option("-c, --config <configfile>", "config file", "./config.json")
  .option("-p, --password <password>", "password")
  .option(
    "-n, --node <servername>",
    "servername",
    "https://dotcoin.seclab.space",
  )
  .action(transfer);

program
  .command("mine")
  .description("mine the next block")
  .argument("<account>", "account")
  .option("-w, --wallet <walletfile>", "wallet file", "./wallet.bin")
  .option("-c, --config <configfile>", "config file", "./config.json")
  .option("-p, --password <password>", "password")
  .option(
    "-n, --node <servername>",
    "servername",
    "https://dotcoin.seclab.space",
  )
  .action(mine);

program.parse();
