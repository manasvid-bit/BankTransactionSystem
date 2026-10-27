# Bank Transaction Search and Management System Using Splay Tree

Advanced Data Structures (ADS) Project-Based Learning (PBL) project.

## What it does

- Insert transactions using a unique transaction ID
- Search transactions and splay the accessed node to the root
- Update and delete transactions
- Display transactions in sorted transaction-ID order (inorder traversal)
- Display an interactive SVG visualization of the current Splay Tree
- Show totals for deposits and withdrawals

**Educational simulation only.** No real banking or money transfers are performed. All data is stored in memory and is lost when the Flask process stops.

## Project structure

```text
BankTransactionSystem/
  app.py
  splay_tree.c
  splay_tree.h
  templates/index.html
  static/style.css
  static/script.js
  README.md
```

## Windows: setup in VS Code PowerShell

Install Python 3 and Flask, and ensure GCC is available (e.g. MSYS2 UCRT64 GCC).
Open the **BankTransactionSystem** folder in VS Code. In its terminal run:

```powershell
python -m pip install flask
gcc -shared -O2 -o splay_tree.dll splay_tree.c
python app.py
```

If `python` is not recognized, try `py` instead.
If `gcc` is not recognized, add `C:\msys64\ucrt64\bin` to Windows PATH and restart VS Code.

Open http://127.0.0.1:5000 in your browser. Keep the terminal running.

**Important:** Compile `splay_tree.c` as a **DLL**, not an EXE, because Flask calls its functions using Python `ctypes`. If the DLL fails to load, make sure Python and GCC use the same architecture (normally 64-bit), and the MSYS2 UCRT64 runtime is accessible in PATH.

## Linux

```bash
python3 -m pip install flask
gcc -shared -fPIC -O2 -o libsplay_tree.so splay_tree.c
python3 app.py
```

## macOS

```bash
python3 -m pip install flask
cc -dynamiclib -O2 -o libsplay_tree.dylib splay_tree.c
python3 app.py
```

## Test the Splay Tree

1. Add transactions with IDs 100, 200, 300, 400 (use any valid account numbers, types, amounts, and dates).
2. View the tree: the most recently inserted transaction (400) is the root.
3. Search for ID 100: it is splayed to the root.
4. View the tree again to observe the change.
5. Edit or delete a transaction, then inspect the tree and table.

## How the C code works

The C implementation retains the core algorithm of the earlier console version:
- `splay`: recursively performs Zig, Zig-Zig, and Zig-Zag adjustments.
- `bank_add`: inserts a transaction and makes the new node the root.
- `bank_search`: searches and splays; unsuccessful searches may also change the root.
- `bank_update`: searches/splays, then updates the matching transaction.
- `bank_delete`: splays the matching node, then joins its left and right subtrees.

`app.py` exposes the C operations as JSON endpoints. JavaScript renders the results, and the SVG visualizer displays the current tree structure. Typical amortized cost per Splay Tree operation is O(log n); a single operation can take O(n).

## API

- `GET /api/state` — current tree, sorted transactions, totals
- `POST /api/transactions` — add a transaction
- `GET /api/transactions/<id>` — search and splay
- `PUT /api/transactions/<id>` — update
- `DELETE /api/transactions/<id>` — delete

Example POST JSON:

```json
{"id":123,"account":42343,"type":"Deposit","amount":20000,"date":"2026-10-27"}
```

## Limitations

- In-memory data only; restarting the server clears the transactions.
- No login, authorization, encryption, or real bank integration.
- Deposit/withdrawal totals are summaries of stored records, not actual account balances.
- The Flask development server is intended for local demos, not public deployment.
- Python locks guard the global C tree while requests run. The design is a single-process local demonstration.

## Suggested future improvements

Add persistent storage, authenticated users, a transaction audit log, and animation of each rotation.
