
"use strict";

const API = "/api";

const $ = (id) => document.getElementById(id);

let transactions = [];
let selectedTransaction = null;

const money = (value) =>
    "₹" + Number(value || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

// -----------------------------------------------
// SHOW SUCCESS AND ERROR MESSAGES
// -----------------------------------------------

function showMessage(message, isError = false) {
    const element = $("message");
    element.textContent = message;
    element.className = "message " + (isError ? "error" : "success");
    element.hidden = false;
}

// -----------------------------------------------
// SEND REQUESTS TO FLASK
// -----------------------------------------------

async function apiRequest(path, options = {}) {
    let response;

    try {
        response = await fetch(API + path, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {})
            }
        });
    } catch (error) {
        throw new Error("Cannot connect to Flask. Check that app.py is running.");
    }

    let data;

    try {
        data = await response.json();
    } catch (error) {
        throw new Error("Server returned an invalid response.");
    }

    if (!response.ok) {
        const err = new Error(data.error || "Request failed.");
        err.data = data;
        throw err;
    }

    return data;
}

// -----------------------------------------------
// UPDATE DASHBOARD
// -----------------------------------------------

function updateDashboard(data) {
    transactions = data.transactions || [];

    $("totalCount").textContent = data.summary.count;
    $("totalDeposits").textContent = money(data.summary.deposits);
    $("totalWithdrawals").textContent = money(data.summary.withdrawals);
    $("rootId").textContent = data.root_id ?? "—";

    renderTransactions();
    renderTree(data.tree);
}

// -----------------------------------------------
// LOAD TRANSACTIONS
// -----------------------------------------------

async function loadState() {
    try {
        const data = await apiRequest("/state");
        updateDashboard(data);
    } catch (error) {
        showMessage(error.message, true);
    }
}

// -----------------------------------------------
// READ TRANSACTION FORM
// -----------------------------------------------

function getFormData() {
    const id = Number($("transactionId").value);
    const account = Number($("accountId").value);
    const amount = Number($("amount").value);

    if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) {
        throw new Error("Enter a valid positive transaction ID.");
    }

    if (!Number.isSafeInteger(account) || account < 1 || account > 2147483647) {
        throw new Error("Enter a valid account number.");
    }

    if (!Number.isFinite(amount) || amount < 0.01 || amount > 1000000000) {
        throw new Error("Enter a valid transaction amount.");
    }

    return {
        id: id,
        account: account,
        type: $("transactionType").value,
        amount: amount,
        date: $("transactionDate").value
    };
}

// -----------------------------------------------
// ADD TRANSACTION
// -----------------------------------------------

async function addTransaction(event) {
    event.preventDefault();

    try {
        const transaction = getFormData();

        const data = await apiRequest("/transactions", {
            method: "POST",
            body: JSON.stringify(transaction)
        });

        updateDashboard(data);
        showMessage(data.message);
        $("transactionForm").reset();
        setToday();

    } catch (error) {
        showMessage(error.message, true);
    }
}

// -----------------------------------------------
// UPDATE TRANSACTION
// -----------------------------------------------

async function updateTransaction() {
    try {
        const transaction = getFormData();

        const data = await apiRequest(
            "/transactions/" + transaction.id,
            {
                method: "PUT",
                body: JSON.stringify(transaction)
            }
        );

        updateDashboard(data);
        showMessage(data.message);
        $("transactionForm").reset();
        setToday();

    } catch (error) {
        showMessage(error.message, true);
    }
}

// -----------------------------------------------
// VALIDATE SEARCH ID
// -----------------------------------------------

function getSearchId() {
    const raw = $("searchId").value.trim();
    const id = Number(raw);

    if (!raw || !Number.isSafeInteger(id) || id < 1 || id > 2147483647) {
        throw new Error("Enter a valid transaction ID to search or delete.");
    }

    return id;
}

// -----------------------------------------------
// DISPLAY SEARCH RESULT
// -----------------------------------------------

function showSearchResult(transaction) {
    selectedTransaction = transaction;

    const container = $("searchDetails");
    container.replaceChildren();

    const fields = [
        ["Transaction ID", transaction.id],
        ["Account Number", transaction.account],
        ["Type", transaction.type],
        ["Amount", money(transaction.amount)],
        ["Date", transaction.date]
    ];

    for (const [label, value] of fields) {
        const row = document.createElement("div");
        row.className = "detail-row";

        const labelElement = document.createElement("span");
        labelElement.textContent = label;

        const valueElement = document.createElement("strong");
        valueElement.textContent = String(value);

        row.append(labelElement, valueElement);
        container.appendChild(row);
    }

    $("searchResult").hidden = false;
}

// -----------------------------------------------
// SEARCH TRANSACTION
// -----------------------------------------------

async function searchTransaction() {
    try {
        const id = getSearchId();

        $("searchResult").hidden = true;
        selectedTransaction = null;

        const data = await apiRequest("/transactions/" + id);

        updateDashboard(data);
        showSearchResult(data.transaction);
        showMessage(data.message);

    } catch (error) {
        if (error.data && error.data.transactions) {
            updateDashboard(error.data);
        }

        showMessage(error.message, true);
    }
}

// -----------------------------------------------
// DELETE TRANSACTION
// -----------------------------------------------

async function deleteTransaction() {
    try {
        const id = getSearchId();

        if (!confirm("Are you sure you want to delete transaction " + id + "?")) {
            return;
        }

        const data = await apiRequest("/transactions/" + id, {
            method: "DELETE"
        });

        updateDashboard(data);
        showMessage(data.message);

        selectedTransaction = null;
        $("searchResult").hidden = true;
        $("searchId").value = "";

    } catch (error) {
        showMessage(error.message, true);
    }
}

// -----------------------------------------------
// FILL FORM FOR EDITING
// -----------------------------------------------

function fillEditForm(transaction) {
    $("transactionId").value = transaction.id;
    $("accountId").value = transaction.account;
    $("transactionType").value = transaction.type;
    $("amount").value = transaction.amount;
    $("transactionDate").value = transaction.date;

    $("transaction-form").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

// -----------------------------------------------
// DISPLAY TRANSACTION HISTORY
// -----------------------------------------------

function renderTransactions() {
    const tbody = $("transactionTable");
    tbody.replaceChildren();

    if (transactions.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 6;
        cell.className = "empty";
        cell.textContent = "No transactions available. Add your first transaction.";

        row.appendChild(cell);
        tbody.appendChild(row);
        return;
    }

    transactions.forEach((transaction) => {
        const row = document.createElement("tr");

        function addCell(value) {
            const cell = document.createElement("td");
            cell.textContent = String(value);
            row.appendChild(cell);
            return cell;
        }

        addCell(transaction.id);
        addCell(transaction.account);

        const typeCell = document.createElement("td");
        const badge = document.createElement("span");

        badge.className =
            "type-badge " +
            (transaction.type === "Deposit" ? "deposit" : "withdrawal");

        badge.textContent = transaction.type;
        typeCell.appendChild(badge);
        row.appendChild(typeCell);

        addCell(money(transaction.amount));
        addCell(transaction.date);

        const actionCell = document.createElement("td");
        const editButton = document.createElement("button");

        editButton.className = "table-action";
        editButton.textContent = "Edit";
        editButton.type = "button";

        editButton.addEventListener("click", () => {
            fillEditForm(transaction);
        });

        actionCell.appendChild(editButton);
        row.appendChild(actionCell);
        tbody.appendChild(row);
    });
}

// -----------------------------------------------
// VISUALIZE SPLAY TREE USING SVG
// -----------------------------------------------

function renderTree(tree) {
    const svg = $("treeSvg");
    const empty = $("treeEmpty");

    svg.replaceChildren();

    if (!tree) {
        svg.style.display = "none";
        empty.hidden = false;
        return;
    }

    svg.style.display = "block";
    empty.hidden = true;

    const nodes = [];
    const edges = [];
    let nextX = 0;
    let maxDepth = 0;

    // In-order layout ensures left children are
    // positioned before parents and right children.
    function layout(node, depth = 0, parent = null) {
        if (!node) return;

        maxDepth = Math.max(maxDepth, depth);

        layout(node.left, depth + 1, node);

        const position = {
            id: node.id,
            x: 70 + nextX * 105,
            y: 60 + depth * 105,
            depth: depth
        };

        nextX++;
        nodes.push(position);

        if (parent !== null) {
            edges.push({
                parentId: parent.id,
                childId: node.id
            });
        }

        layout(node.right, depth + 1, node);
    }

    layout(tree);

    const width = Math.max(500, nextX * 105 + 80);
    const height = Math.max(290, (maxDepth + 1) * 105 + 80);

    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.style.width = width + "px";
    svg.style.height = height + "px";

    const ns = "http://www.w3.org/2000/svg";

    function createSvgElement(tag, attributes) {
        const element = document.createElementNS(ns, tag);

        for (const [key, value] of Object.entries(attributes)) {
            element.setAttribute(key, String(value));
        }

        return element;
    }

    const positions = new Map(nodes.map((node) => [node.id, node]));

    // Draw connections first.
    edges.forEach((edge) => {
        const parent = positions.get(edge.parentId);
        const child = positions.get(edge.childId);

        const line = createSvgElement("line", {
            x1: parent.x,
            y1: parent.y,
            x2: child.x,
            y2: child.y,
            stroke: "#9eb2d0",
            "stroke-width": 2.5
        });

        svg.appendChild(line);
    });

    // Draw transaction nodes.
    nodes.forEach((node) => {
        const isRoot = node.depth === 0;

        const circle = createSvgElement("circle", {
            cx: node.x,
            cy: node.y,
            r: 29,
            fill: isRoot ? "#2563eb" : "#ffffff",
            stroke: isRoot ? "#2563eb" : "#8aa8d6",
            "stroke-width": 3
        });

        const text = createSvgElement("text", {
            x: node.x,
            y: node.y + 5,
            "text-anchor": "middle",
            "font-size": 14,
            "font-weight": 700,
            fill: isRoot ? "#ffffff" : "#1e3a5f"
        });

        text.textContent = node.id;

        svg.append(circle, text);

        if (isRoot) {
            const rootLabel = createSvgElement("text", {
                x: node.x,
                y: node.y - 39,
                "text-anchor": "middle",
                "font-size": 12,
                "font-weight": 700,
                fill: "#2563eb"
            });

            rootLabel.textContent = "ROOT";
            svg.appendChild(rootLabel);
        }
    });
}

// -----------------------------------------------
// SET DEFAULT DATE
// -----------------------------------------------

function setToday() {
    const now = new Date();
    const local = new Date(
        now.getTime() - now.getTimezoneOffset() * 60000
    );

    $("transactionDate").value = local.toISOString().slice(0, 10);
}

// -----------------------------------------------
// EVENT LISTENERS
// -----------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
    setToday();

    $("transactionForm").addEventListener("submit", addTransaction);

    $("updateBtn").addEventListener("click", updateTransaction);

    $("searchBtn").addEventListener("click", searchTransaction);

    $("deleteBtn").addEventListener("click", deleteTransaction);

    $("refreshBtn").addEventListener("click", loadState);

    $("editFoundBtn").addEventListener("click", () => {
        if (selectedTransaction) {
            fillEditForm(selectedTransaction);
        }
    });

    $("transactionForm").addEventListener("reset", () => {
        setTimeout(setToday, 0);
    });

    loadState();
});
