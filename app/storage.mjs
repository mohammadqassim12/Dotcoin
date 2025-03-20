import { writeFileSync, readFileSync, existsSync } from "fs";
import readlineSync from "readline-sync";
import { pbkdf2 } from "@noble/hashes/pbkdf2";
import { sha256 } from "@noble/hashes/sha256";
import { xchacha20poly1305 } from "@noble/ciphers/chacha";
import { utf8ToBytes, bytesToUtf8 } from "@noble/ciphers/utils";
import { randomBytes } from "@noble/ciphers/webcrypto/utils";

import { DotcoinClient } from "../core/client.mjs";

const salt = "D0tco1n4EvR";

export function readConfig(filename) {
  if (!existsSync(filename)) {
    throw new Error(`[error] config file ${filename} does not exists`);
  } else {
    return JSON.parse(readFileSync(filename, "utf-8"));
  }
}

function encryptData(password, plaintext) {
  const key = pbkdf2(sha256, password, salt, { c: 32, dkLen: 32 });
  const nonce = randomBytes(24);
  const stream = xchacha20poly1305(key, nonce);
  const data = utf8ToBytes(plaintext);
  const ciphertext = stream.encrypt(data);
  return new Uint8Array([...nonce, ...ciphertext]);
}

function decryptData(password, data) {
  const key = pbkdf2(sha256, password, salt, { c: 32, dkLen: 32 });
  const nonce = data.slice(0, 24);
  const ciphertext = data.slice(24);
  const stream = xchacha20poly1305(key, nonce);
  const plaintext = stream.decrypt(ciphertext);
  return bytesToUtf8(plaintext);
}

function getPassword() {
  return readlineSync.question("Password: ", {
    hideEchoBack: true, // The typed text on screen is hidden by `*` (default).
  });
}

export function readMnemonic(filename, password) {
  if (!existsSync(filename)) {
    throw new Error(`[error] wallet file ${filename} does not exists`);
  } else {
    password = password || getPassword();
    const data = new Uint8Array(readFileSync(filename));
    return decryptData(password, data);
  }
}

export function writeMnemonic(filename, mnemonic, password) {
  if (existsSync(filename)) {
    throw new Error(`[error] wallet file ${filename} already exists`);
  }
  password = password || getPassword();
  const data = encryptData(password, mnemonic);
  return writeFileSync(filename, data);
}
