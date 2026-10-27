#ifndef SPLAY_TREE_H
#define SPLAY_TREE_H

#ifdef _WIN32
#define API __declspec(dllexport)
#else
#define API
#endif

typedef struct Node {
    int id;
    int account;
    char type[12];
    char date[16];
    double amount;
    struct Node *left;
    struct Node *right;
} Node;

API int bank_add(int id, int account, int type, double amount, const char *date);
API int bank_search(int id);
API int bank_update(int id, int account, int type, double amount, const char *date);
API int bank_delete(int id);
API Node *bank_root(void);
API void bank_clear(void);
#endif
