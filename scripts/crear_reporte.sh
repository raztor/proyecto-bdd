#!/usr/bin/env bash
# Crea un reporte ciudadano vía la API (POST /api/reportes). Requiere el backend
# levantado en http://localhost:3000 (docker compose up).
set -euo pipefail

echo "Comunas disponibles:"
docker exec calidad_aire_pg psql -U calidad_app -d calidad_aire -c "SELECT id, nombre FROM comuna ORDER BY id"

read -r -p "Comuna ID: " C
read -r -p "Nivel percibido (1=bueno .. 5=malo): " N

curl -fsS -X POST http://localhost:3000/api/reportes \
  -H 'Content-Type: application/json' \
  -d "{\"comuna_id\":$C,\"nivel_percibido\":$N}"
echo
