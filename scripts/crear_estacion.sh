#!/usr/bin/env bash
# Crea una estación vía la API (POST /api/estaciones). Requiere el backend
# levantado en http://localhost:3000 (docker compose up). Los contaminantes por
# defecto son PM2.5 y PM10 (foco del indicador 11.6.2); sus ids se resuelven en
# vivo desde la BD.
set -euo pipefail

echo "Comunas disponibles:"
docker exec calidad_aire_pg psql -U calidad_app -d calidad_aire -c "SELECT id, nombre FROM comuna ORDER BY id"

read -r -p "Nombre de la estación: " N
read -r -p "Comuna ID: " C
read -r -p "Latitud (-90..90): " LAT
read -r -p "Longitud (-180..180): " LON

IDS=$(docker exec calidad_aire_pg psql -U calidad_app -d calidad_aire -tAc \
  "SELECT string_agg(id::text, ',') FROM contaminante WHERE codigo IN ('PM25','PM10')")
echo "Contaminantes por defecto (PM2.5, PM10): [$IDS]"

curl -fsS -X POST http://localhost:3000/api/estaciones \
  -H 'Content-Type: application/json' \
  -d "{\"nombre\":\"$N\",\"comuna_id\":$C,\"latitud\":$LAT,\"longitud\":$LON,\"contaminantes\":[$IDS]}"
echo
