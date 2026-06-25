#!/usr/bin/env bash
# Busca estaciones por coincidencia parcial de nombre en la BD (PostgreSQL).
# El término se pasa con psql -v y se referencia con :'q' (psql lo entrecomilla,
# evitando inyección SQL).
set -euo pipefail

read -r -p "Buscar estación (parte del nombre): " Q

docker exec calidad_aire_pg psql -U calidad_app -d calidad_aire -v q="$Q" -c \
"SELECT e.id, e.nombre, co.nombre AS comuna, e.latitud, e.longitud, e.fecha_instalacion
   FROM estacion e
   JOIN comuna co ON co.id = e.comuna_id
  WHERE e.nombre ILIKE '%' || :'q' || '%'
  ORDER BY e.nombre"
