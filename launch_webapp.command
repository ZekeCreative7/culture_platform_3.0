#!/bin/bash
cd "$(dirname "$0")/webapp"
python3 -m http.server 4173
