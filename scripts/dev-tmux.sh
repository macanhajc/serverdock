#!/usr/bin/env bash
set -e

SESSION="serverdock"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "Session '$SESSION' already running — attaching."
  tmux attach-session -t "$SESSION"
  exit
fi

tmux new-session  -d -s "$SESSION" -c "$ROOT" -x 220 -y 50
tmux rename-window -t "$SESSION" dev

# Left pane: backend
tmux send-keys -t "$SESSION:dev.0" "npm run dev:api" Enter

# Right pane: frontend
tmux split-window -h -t "$SESSION:dev" -c "$ROOT"
tmux send-keys -t "$SESSION:dev.1" "npm run dev:ui" Enter

# Focus left pane
tmux select-pane -t "$SESSION:dev.0"

tmux attach-session -t "$SESSION"
