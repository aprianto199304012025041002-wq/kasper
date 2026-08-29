#!/usr/bin/env bash
# tools/handover.sh — jalankan di awal sesi Claude baru
# Usage: bash tools/handover.sh <GITHUB_PAT>
# Atau:  KASPER_PAT=ghp_xxx bash tools/handover.sh

set -euo pipefail

PAT="${1:-${KASPER_PAT:-}}"
REPO="github.com/aprianto199304012025041002-wq/kasper.git"
DEST="/home/claude/kasper"

# ── 1. Clone / pull ───────────────────────────────────────────────────
if [ -z "$PAT" ]; then
  echo "Usage: bash tools/handover.sh <GITHUB_PAT>"
  echo "   or: KASPER_PAT=ghp_xxx bash tools/handover.sh"
  exit 1
fi

if [ -d "$DEST/.git" ]; then
  echo "▸ Repo sudah ada — pull latest..."
  git -C "$DEST" remote set-url origin "https://$PAT@$REPO"
  git -C "$DEST" pull --ff-only
else
  echo "▸ Clone repo..."
  git clone "https://$PAT@$REPO" "$DEST"
fi

# ── 2. Print CUECARD ──────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════"
cat "$DEST/CUECARD.md"
echo "════════════════════════════════════════════════════════"

# ── 3. Git log 10 commit terakhir ────────────────────────────────────
echo ""
echo "▸ 10 commit terakhir:"
git -C "$DEST" log --oneline -10

# ── 4. Status kerja saat ini ─────────────────────────────────────────
echo ""
echo "▸ Status repo:"
git -C "$DEST" status --short

echo ""
echo "✓ Handover selesai. Repo siap di $DEST"
