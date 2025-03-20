# **Dotcoin – A UTXO-Based Blockchain**

### *A Lightweight and Secure Cryptocurrency Implementation*

🚀 **Dotcoin** is a **custom blockchain implementation** inspired by Bitcoin’s **UTXO (Unspent Transaction Output) model**. Unlike traditional blockchains, Dotcoin enforces a **one-time address usage policy**, preventing address reuse for enhanced security and privacy.

This project includes a **client-side wallet**, a **server-side validation system**, and a **custom mining mechanism**, built to provide a **secure, efficient, and decentralized transaction system**.

---

## **📌 Features**
✅ **UTXO-Based Transaction Model** – Prevents double-spending and enhances security.  
✅ **One-Time Address Enforcement** – Ensures each address is used only once, reducing the risk of replay attacks.  
✅ **Client-Side Wallet** – Create accounts, check balances, and sign transactions seamlessly.  
✅ **Server-Side Transaction Validation** – Ensures only legitimate transactions get added to the blockchain.  
✅ **Mining & Block Validation** – Implements **proof-of-work** with **Keccak256 hashing** and **Base58 encoding**.  
✅ **CLI Tool** – A simple command-line interface for interacting with the blockchain.  

---

## **🛠️ Tech Stack**
- **Backend:** Node.js (Express.js)  
- **Blockchain Security:** Keccak256 Hashing, Base58 Encoding  
- **Cryptography:** BIP39 (Mnemonic Phrases), BIP32 (Key Derivation), BIP44 (Multi-Account Wallets)  
- **Data Storage:** Local JSON-based ledger (can be extended to databases)  

---

## **📂 Project Structure**
```plaintext
Dotcoin/
│── app/                   # Main application logic (if needed)
│── core/                  # Core blockchain logic
│   ├── client.mjs         # Wallet, transaction creation, account management
│   ├── server.mjs         # Blockchain node, transaction validation, block mining
│   ├── common.js          # Shared utilities for cryptographic functions
│── database/              # Persistent storage for blockchain data
│── test/                  # Unit tests for blockchain and transaction logic
│── utils/                 # Helper functions and additional utilities
│── cli/                   # Command-line tool for user interaction
│── config.json            # Configuration settings for the blockchain
│── .gitignore             # Ignored files (e.g., node_modules, wallets)
│── package.json           # Dependencies and scripts
│── README.md              # Documentation
```

---

## **🚀 How It Works**
### **1️⃣ Create a Wallet**
```sh
npm run cli -- create
```
Generates a new **mnemonic-based wallet**, securely encrypted.

### **2️⃣ Get Your Wallet Address**
```sh
npm run cli -- address 0
```
Retrieves the **receiving address** for transactions.

### **3️⃣ Check Your Balance**
```sh
npm run cli -- balance 0
```
Fetches **confirmed and pending UTXOs**.

### **4️⃣ Send Dotcoins**
```sh
npm run cli -- transfer 0 <recipient-address> <amount>
```
Sends a transaction to another address.

### **5️⃣ Mine a Block**
```sh
npm run cli -- mine 0
```
Mines a block and adds it to the chain.

---

## **🔒 Security & Validation**
- **Transactions are verified** using cryptographic signatures.
- **Double-spending is prevented** through UTXO validation.
- **Blocks follow proof-of-work** difficulty rules, ensuring valid mining.
- **Unique address enforcement** enhances security and privacy.

---

## **🧪 Running Tests**
```sh
npm test
```
Runs unit tests for **transaction validation, blockchain integrity, and API security**.

---

## **📌 Future Enhancements**
🔹 **Extend to a P2P Network** – Connect multiple nodes for decentralized transactions.  
🔹 **Database Integration** – Move from JSON to a scalable database (MongoDB/PostgreSQL).  
🔹 **Web Dashboard** – Build a front-end interface for easier blockchain interaction.  

---

## **📜 License**
This project is part of CSCD71 course Assignments and has been posted for work-purposes.
