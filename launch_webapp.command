#!/bin/bash
cd "$(dirname "$0")/webapp"
echo "Lina Culture Platform local preview: http://localhost:4173/culture_platform_3.0/"
PATH="$(pwd)/../node_portable/bin:$PATH" ../node_portable/bin/npm run dev
