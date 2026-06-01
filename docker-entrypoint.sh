#!/bin/sh
set -e

CONFIG_FILE="$HOME/.free-coding-models.json"
LOG_FILE="$HOME/.free-coding-models-daemon.log"
DAEMON_PORT_FILE="$HOME/.free-coding-models-daemon.port"

touch "$CONFIG_FILE" "$LOG_FILE" 2>/dev/null || true
# 📖 Config file holds API keys — keep it 0600 so only the fcm user can read it.
chmod 600 "$CONFIG_FILE" 2>/dev/null || true
chmod 640 "$LOG_FILE" 2>/dev/null || true

node /app/scripts/docker-init.mjs

FCM_HOST="${FCM_HOST:-0.0.0.0}"
FCM_PORT="${FCM_PORT:-19280}"

echo "FCM_HOST: ${FCM_HOST}"
echo "FCM_PORT: ${FCM_PORT}"

echo "${FCM_PORT}" > "${DAEMON_PORT_FILE}"

echo "Starting FCM router daemon..."
# 📖 Use --daemon (foreground) instead of --daemon-bg so the container's
# 📖 lifecycle is tied to the daemon process. If the daemon dies, the
# 📖 container exits and Docker's restart policy can recover it.
cd /app
FCM_HOST="${FCM_HOST}" node bin/free-coding-models.js --daemon 2>&1 | sed "s/^/[daemon] /" &
DAEMON_PID=$!
echo "Daemon started with PID ${DAEMON_PID}"

echo "Waiting for daemon to be ready..."
for i in $(seq 1 30); do
  if wget -qO- "http://127.0.0.1:${FCM_PORT}/health" > /dev/null 2>&1; then
    echo "Daemon is ready!"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "WARNING: Daemon did not become ready after 30s, continuing anyway..."
  else
    sleep 1
  fi
done

echo "FCM container is running."
echo "  - Daemon: http://127.0.0.1:${FCM_PORT}/health"
echo "  - Web:    http://${FCM_HOST}:${FCM_PORT}/"

cleanup() {
  echo "Received shutdown signal, stopping daemon..."
  kill -TERM "$DAEMON_PID" 2>/dev/null || true
  wait "$DAEMON_PID" 2>/dev/null || true
  echo "Daemon stopped."
  exit 0
}

trap cleanup TERM INT

# 📖 Wait directly on the daemon PID — if the daemon crashes, the container
# 📖 exits and Docker's restart policy can recover it cleanly.
wait "$DAEMON_PID"
EXIT_CODE=$?
echo "Daemon exited with code ${EXIT_CODE}"
exit "$EXIT_CODE"