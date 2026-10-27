#include "splay_tree.h"
#include <stdlib.h>
#include <string.h>
#include <math.h>

static Node *root = NULL;

static Node *rotate_right(Node *x) {
    Node *y = x->left;
    x->left = y->right;
    y->right = x;
    return y;
}

static Node *rotate_left(Node *x) {
    Node *y = x->right;
    x->right = y->left;
    y->left = x;
    return y;
}

/* Top-down recursive splaying: Zig, Zig-Zig, and Zig-Zag cases. */
static Node *splay(Node *t, int key) {
    if (!t || t->id == key) return t;
    if (key < t->id) {
        if (!t->left) return t;
        if (key < t->left->id) {
            t->left->left = splay(t->left->left, key);
            t = rotate_right(t);
        } else if (key > t->left->id) {
            t->left->right = splay(t->left->right, key);
            if (t->left->right) t->left = rotate_left(t->left);
        }
        return t->left ? rotate_right(t) : t;
    }
    if (!t->right) return t;
    if (key > t->right->id) {
        t->right->right = splay(t->right->right, key);
        t = rotate_left(t);
    } else if (key < t->right->id) {
        t->right->left = splay(t->right->left, key);
        if (t->right->left) t->right = rotate_right(t->right);
    }
    return t->right ? rotate_left(t) : t;
}

static int valid(int id, int account, int type, double amount, const char *date) {
    return id > 0 && account > 0 && (type == 1 || type == 2) &&
           isfinite(amount) && amount > 0 && date && strlen(date) == 10;
}

int bank_add(int id, int account, int type, double amount, const char *date) {
    if (!valid(id, account, type, amount, date)) return -1;
    root = splay(root, id);
    if (root && root->id == id) return 0;
    Node *n = (Node *)calloc(1, sizeof(Node));
    if (!n) return -2;
    n->id = id;
    n->account = account;
    n->amount = amount;
    strcpy(n->type, type == 1 ? "Deposit" : "Withdrawal");
    strcpy(n->date, date);
    if (!root) root = n;
    else if (id < root->id) {
        n->left = root->left;
        n->right = root;
        root->left = NULL;
        root = n;
    } else {
        n->right = root->right;
        n->left = root;
        root->right = NULL;
        root = n;
    }
    return 1;
}

int bank_search(int id) {
    if (id <= 0) return 0;
    root = splay(root, id);
    return root && root->id == id;
}

int bank_update(int id, int account, int type, double amount, const char *date) {
    if (!valid(id, account, type, amount, date)) return -1;
    if (!bank_search(id)) return 0;
    root->account = account;
    root->amount = amount;
    strcpy(root->type, type == 1 ? "Deposit" : "Withdrawal");
    strcpy(root->date, date);
    return 1;
}

int bank_delete(int id) {
    if (!bank_search(id)) return 0;
    Node *old = root;
    if (!root->left) root = root->right;
    else {
        Node *right = root->right;
        root = splay(root->left, id);
        root->right = right;
    }
    free(old);
    return 1;
}

Node *bank_root(void) { return root; }

static void free_tree(Node *n) {
    if (!n) return;
    free_tree(n->left);
    free_tree(n->right);
    free(n);
}

void bank_clear(void) {
    free_tree(root);
    root = NULL;
}
