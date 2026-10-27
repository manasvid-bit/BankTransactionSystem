
"""Bank Transaction Search and Management System
Advanced Data Structures PBL - Splay Tree using C and Flask
"""

import ctypes
import os
import sys
import threading
from datetime import date
from pathlib import Path

from flask import Flask, jsonify, render_template, request

# --------------------------------------------------
# 1. LOAD C SPLAY TREE LIBRARY
# --------------------------------------------------

BASE = Path(__file__).resolve().parent

LIBRARY = BASE / (
    "splay_tree.dll" if os.name == "nt"
    else "libsplay_tree.dylib" if sys.platform == "darwin"
    else "libsplay_tree.so"
)

if not LIBRARY.exists():
    raise RuntimeError(
        f"Missing {LIBRARY.name}. "
        "Compile the C library first."
    )


# --------------------------------------------------
# 2. DEFINE SPLAY TREE NODE STRUCTURE
# --------------------------------------------------

class Node(ctypes.Structure):
    pass


NodePtr = ctypes.POINTER(Node)

Node._fields_ = [
    ("id", ctypes.c_int),
    ("account", ctypes.c_int),
    ("type", ctypes.c_char * 12),
    ("date", ctypes.c_char * 16),
    ("amount", ctypes.c_double),
    ("left", NodePtr),
    ("right", NodePtr)
]


# --------------------------------------------------
# 3. CONNECT PYTHON WITH C LIBRARY
# --------------------------------------------------

lib = ctypes.CDLL(str(LIBRARY))

# Insert transaction
lib.bank_add.argtypes = [
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_double,
    ctypes.c_char_p
]
lib.bank_add.restype = ctypes.c_int

# Search transaction
lib.bank_search.argtypes = [ctypes.c_int]
lib.bank_search.restype = ctypes.c_int

# Update transaction
lib.bank_update.argtypes = lib.bank_add.argtypes
lib.bank_update.restype = ctypes.c_int

# Delete transaction
lib.bank_delete.argtypes = [ctypes.c_int]
lib.bank_delete.restype = ctypes.c_int

# Get root of Splay Tree
lib.bank_root.argtypes = []
lib.bank_root.restype = NodePtr


# --------------------------------------------------
# 4. INITIALIZE FLASK APPLICATION
# --------------------------------------------------

app = Flask(__name__)

lock = threading.RLock()


# --------------------------------------------------
# 5. CONVERT C SPLAY TREE INTO PYTHON DICTIONARY
# --------------------------------------------------

def serialize(ptr):

    if not ptr:
        return None

    node = ptr.contents

    return {
        "id": node.id,
        "account": node.account,
        "type": node.type.decode(),
        "date": node.date.decode(),
        "amount": round(node.amount, 2),
        "left": serialize(node.left),
        "right": serialize(node.right)
    }


# --------------------------------------------------
# 6. DISPLAY TRANSACTIONS IN SORTED ORDER
# --------------------------------------------------

def ordered(tree):

    if tree is None:
        return []

    item = {
        key: tree[key]
        for key in (
            "id",
            "account",
            "type",
            "date",
            "amount"
        )
    }

    return (
        ordered(tree["left"])
        + [item]
        + ordered(tree["right"])
    )


# --------------------------------------------------
# 7. GENERATE DASHBOARD DATA
# --------------------------------------------------

def snapshot():

    tree = serialize(lib.bank_root())

    transactions = ordered(tree)

    deposits = sum(
        transaction["amount"]
        for transaction in transactions
        if transaction["type"] == "Deposit"
    )

    withdrawals = sum(
        transaction["amount"]
        for transaction in transactions
        if transaction["type"] == "Withdrawal"
    )

    return {
        "tree": tree,
        "transactions": transactions,
        "root_id": tree["id"] if tree else None,
        "summary": {
            "count": len(transactions),
            "deposits": round(deposits, 2),
            "withdrawals": round(withdrawals, 2)
        }
    }


# --------------------------------------------------
# 8. VALIDATE TRANSACTION ID
# --------------------------------------------------

def parse_id(raw):

    if isinstance(raw, bool):
        raise ValueError(
            "Transaction ID must be a positive integer"
        )

    try:
        value = int(raw)

    except (TypeError, ValueError, OverflowError):
        raise ValueError(
            "Transaction ID must be a positive integer"
        )

    if (
        str(value) != str(raw).strip()
        or not 1 <= value <= 2147483647
    ):
        raise ValueError(
            "Transaction ID must be a positive integer"
        )

    return value


# --------------------------------------------------
# 9. VALIDATE TRANSACTION DETAILS
# --------------------------------------------------

def parse_transaction(data):

    if not isinstance(data, dict):
        raise ValueError("Invalid transaction data")

    transaction_id = parse_id(data.get("id"))

    account = parse_id(data.get("account"))

    transaction_type = data.get("type")

    if transaction_type not in (
        "Deposit",
        "Withdrawal"
    ):
        raise ValueError(
            "Type must be Deposit or Withdrawal"
        )

    try:
        amount = float(data.get("amount"))

    except (ValueError, TypeError, OverflowError):
        raise ValueError("Enter a valid amount")

    if not (0 < amount <= 1_000_000_000):
        raise ValueError(
            "Amount must be between 0 and 1,000,000,000"
        )

    amount = round(amount, 2)

    if amount <= 0:
        raise ValueError(
            "Amount must be at least 0.01"
        )

    try:
        entered_date = date.fromisoformat(
            data.get("date", "")
        )

    except (ValueError, TypeError):
        raise ValueError(
            "Date must be valid (YYYY-MM-DD)"
        )

    date_text = entered_date.isoformat()

    kind = (
        1 if transaction_type == "Deposit"
        else 2
    )

    return (
        transaction_id,
        account,
        kind,
        amount,
        date_text.encode("ascii")
    )


# --------------------------------------------------
# 10. HOME PAGE
# --------------------------------------------------

@app.get("/")
def index():

    return render_template("index.html")


# --------------------------------------------------
# 11. GET ALL TRANSACTIONS
# --------------------------------------------------

@app.get("/api/state")
def state():

    with lock:
        return jsonify(snapshot())


# --------------------------------------------------
# 12. ADD TRANSACTION
# --------------------------------------------------

@app.post("/api/transactions")
def add():

    try:
        tid, account, kind, amount, when = (
            parse_transaction(
                request.get_json(silent=True)
            )
        )

    except ValueError as error:
        return jsonify(
            error=str(error)
        ), 400

    with lock:

        result = lib.bank_add(
            tid,
            account,
            kind,
            amount,
            when
        )

        if result == 0:
            return jsonify(
                error="Transaction ID already exists",
                **snapshot()
            ), 409

        if result < 0:
            return jsonify(
                error="Could not add transaction"
            ), 400

        return jsonify(
            message="Transaction added successfully",
            **snapshot()
        ), 201


# --------------------------------------------------
# 13. SEARCH TRANSACTION USING SPLAY TREE
# --------------------------------------------------

@app.get("/api/transactions/<int:tid>")
def search(tid):

    with lock:

        found = lib.bank_search(tid)

        data = snapshot()

        if not found:
            return jsonify(
                error="Transaction not found",
                **data
            ), 404

        transaction = {
            key: data["tree"][key]
            for key in (
                "id",
                "account",
                "type",
                "date",
                "amount"
            )
        }

        return jsonify(
            message="Transaction found and moved to root",
            transaction=transaction,
            **data
        )


# --------------------------------------------------
# 14. UPDATE TRANSACTION
# --------------------------------------------------

@app.put("/api/transactions/<int:tid>")
def update(tid):

    try:

        parsed_id, account, kind, amount, when = (
            parse_transaction(
                request.get_json(silent=True)
            )
        )

        if tid != parsed_id:
            raise ValueError(
                "Transaction ID cannot be changed"
            )

    except ValueError as error:
        return jsonify(
            error=str(error)
        ), 400

    with lock:

        result = lib.bank_update(
            tid,
            account,
            kind,
            amount,
            when
        )

        if not result:
            return jsonify(
                error="Transaction not found",
                **snapshot()
            ), 404

        return jsonify(
            message="Transaction updated successfully",
            **snapshot()
        )


# --------------------------------------------------
# 15. DELETE TRANSACTION
# --------------------------------------------------

@app.delete("/api/transactions/<int:tid>")
def delete(tid):

    with lock:

        result = lib.bank_delete(tid)

        if not result:
            return jsonify(
                error="Transaction not found",
                **snapshot()
            ), 404

        return jsonify(
            message="Transaction deleted successfully",
            **snapshot()
        )


# --------------------------------------------------
# 16. RUN FLASK SERVER
# --------------------------------------------------

if __name__ == "__main__":

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True,
        use_reloader=False
    )
