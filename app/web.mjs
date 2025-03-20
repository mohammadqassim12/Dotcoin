import { Command } from "commander";
import { readFileSync } from "fs";
import { join, resolve } from "path";
import { createServer } from "http";
import express from "express";

import { DotcoinServer } from "../core/server.mjs";
import { readConfig } from "./storage.mjs";

const databasePath = join("data", "server");

let server;

const app = express();
app.use(express.json());

app.use(function (req, res, next) {
  console.log("Request", req.method, req.url, req.body);
  next();
});

app.put("/transactions/", async function (req, res, next) {
  try {
    const tx = await server.addTransaction(req.body);
    return res.send(tx);
  } catch (err) {
    return next(err);
  }
});

app.get("/transactions/:id/", async function (req, res, next) {
  try {
    const transaction = await server.getTransaction(req.params.id);
    return res.send(transaction);
  } catch (err) {
    return next(err);
  }
});

app.get("/transactions/", async function (req, res, next) {
  try {
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 10;
    const sort = parseInt(req.query.sort) || -1;
    const unconfirmed = req.query.unconfirmed
      ? req.query.unconfirmed == "true"
      : false;
    const transactions = await server.getTransactions(
      page,
      limit,
      sort,
      unconfirmed,
    );
    return res.send(transactions);
  } catch (err) {
    return next(err);
  }
});

app.put("/blocks/", async function (req, res, next) {
  try {
    const block = await server.addBlock(
      req.body.block,
      req.body.coinbase,
      req.body.transactions,
    );
    return res.send(block);
  } catch (err) {
    return next(err);
  }
});

app.get("/blocks/:id/", async function (req, res, next) {
  try {
    const block = await server.getBlock(req.params.id);
    return res.send(block);
  } catch (err) {
    return next(err);
  }
});

app.get("/blocks/", async function (req, res, next) {
  try {
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 10;
    const sort = parseInt(req.query.sort) || -1;
    const blocks = await server.getBlocks(page, limit, sort);
    return res.send(blocks);
  } catch (err) {
    return next(err);
  }
});

app.get("/utxo/:address/", async function (req, res, next) {
  try {
    const utxo = await server.getUtxo(req.params.address);
    return res.send(utxo);
  } catch (err) {
    return next(err);
  }
});

app.use(function (err, req, res, next) {
  if (err.name === "ValidationError") {
    return res.status(400).send(err.message);
  } else {
    throw err;
  }
});

app.use(express.static(resolve(databasePath)));

async function run(options) {
  const config = readConfig(options.config);
  server = new DotcoinServer({ path: databasePath, ...config });
  const port = parseInt(options.port);
  createServer(app).listen(port, function (err) {
    if (err) console.log(err);
    else console.log("HTTP server on http://localhost:%s", port);
  });
}

const program = new Command();

program
  .option("-c, --config <configfile>", "config file", "./config.json")
  .option("-t, --port <port>", "port", "3000")
  .action(run);

program.parse();
