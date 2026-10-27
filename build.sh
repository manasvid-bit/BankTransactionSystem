#!/bin/sh
set -e

pip install -r requirements.txt
gcc -shared -fPIC -O2 -o libsplay_tree.so splay_tree.c