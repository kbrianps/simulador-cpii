#!/usr/bin/env bash
# Render one PDF page to PNG so it can be viewed with the Read tool.
# usage: tools/render.sh <pdf> <page> [dpi=110] [out.png]
set -euo pipefail
pdf=$1; page=$2; dpi=${3:-110}
out=${4:-/tmp/cp2render/$(basename "$pdf" .pdf)-p$page-$dpi.png}
mkdir -p "$(dirname "$out")"
pdftoppm -r "$dpi" -f "$page" -l "$page" -png -singlefile "$pdf" "${out%.png}"
echo "$out"
