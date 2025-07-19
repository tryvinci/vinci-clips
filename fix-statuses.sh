#!/bin/bash

echo "Fixing transcript statuses..."
curl -X POST http://localhost:8080/clips/admin/fix-statuses \
  -H "Content-Type: application/json" \
  | python3 -m json.tool

echo -e "\nDone!"