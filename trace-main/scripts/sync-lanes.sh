#!/usr/bin/env bash
set -euo pipefail

# sync-lanes.sh — Real-time team board and communication fetcher
# Displays the state of all 5 vertical lanes and recent comments/direction changes.

echo "====================================================================="
echo " TRACE Hackathon Lanes — Live Status Board (GitLab: hack-team-1-repo)"
echo "====================================================================="
echo ""

echo "--- Current Issues & Assignments ---"
glab issue list --all

echo ""
echo "--- Recent Comments / Direction Changes (Last 5 Active Issues) ---"
for iid in 2 3 4 5 6; do
  echo ">>> [Issue #$iid] Latest Discussion:"
  glab issue view "$iid" --comments | tail -n 12 || true
  echo "-----------------------------------------------------------------"
done

echo ""
echo "To broadcast an update or blocker from your lane:"
echo "  glab issue note <iid> -m '⚠️ [UPDATE/BLOCKER] details...'"
echo "To link a blocker:"
echo "  glab issue note <iid> -m '/blocked_by #<blocker_iid>'"
