#!/bin/bash
cd "$(dirname "$0")/webapp"
echo "Lina Culture Platform local preview: http://localhost:4173/?preview=1"
python3 -m http.server 4173
