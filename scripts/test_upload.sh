#!/bin/bash
# Test the upload pipeline end-to-end.
# Usage: bash scripts/test_upload.sh <path-to-audio-file>
# Example: bash scripts/test_upload.sh ~/Music/test.mp3
#
# Prerequisites:
#   1. HelixDB running (bash scripts/init_db.sh)
#   2. Next.js dev server running (pnpm dev:web)

set -e

FILE="${1:?Usage: bash scripts/test_upload.sh <audio-file>}"
BASE_URL="${2:-http://localhost:3000}"

if [ ! -f "$FILE" ]; then
  echo "Error: File not found: $FILE"
  exit 1
fi

echo "=== Atlas Upload Test ==="
echo "File: $FILE"
echo "Server: $BASE_URL"
echo ""

# 1. Upload
echo "1. Uploading file..."
RESPONSE=$(curl -s -w "\n%{http_code}" -F "file=@$FILE" "$BASE_URL/api/ingest")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
# POSIX-compatible body extraction (BSD head doesn't support -n -1).
BODY=$(printf "%s\n" "$RESPONSE" | sed '$d')

echo "   HTTP $HTTP_CODE"
echo "   Response: $BODY"

if [ "$HTTP_CODE" != "200" ] && ! printf "%s" "$BODY" | python3 -m json.tool >/dev/null 2>&1; then
  echo "   FAILED: Non-JSON error response from ingest"
  exit 1
fi

if [ "$HTTP_CODE" != "200" ]; then
  echo "   FAILED: Expected HTTP 200 with JSON body"
  exit 1
fi

if ! printf "%s" "$BODY" | python3 -m json.tool >/dev/null 2>&1; then
  echo "   FAILED: Expected JSON success payload from ingest"
  exit 1
fi

TRACK_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "   Track ID: $TRACK_ID"
echo ""

# 2. Poll for READY status (max 30 seconds)
echo "2. Polling for READY status..."
for i in $(seq 1 15); do
  sleep 2
  STATUS_RESPONSE=$(curl -s "$BASE_URL/api/tracks/$TRACK_ID")
  STATUS=$(echo "$STATUS_RESPONSE" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "   [$i] Status: $STATUS"

  if [ "$STATUS" = "READY" ]; then
    echo ""
    echo "3. Track details:"
    echo "$STATUS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$STATUS_RESPONSE"
    echo ""
    echo "4. Verifying similar-track relationships..."
    SIMILAR_RESPONSE=$(curl -s "$BASE_URL/api/tracks/$TRACK_ID/similar")
    SIMILAR_COUNT=$(echo "$SIMILAR_RESPONSE" | grep -o '"track":{' | wc -l | tr -d ' ')
    ALL_TRACKS_RESPONSE=$(curl -s "$BASE_URL/api/tracks")
    TOTAL_TRACKS=$(echo "$ALL_TRACKS_RESPONSE" | grep -o '"id":"' | wc -l | tr -d ' ')
    echo "   Similar tracks for upload: $SIMILAR_COUNT"
    echo "   Total tracks in DB: $TOTAL_TRACKS"

    if [ "$TOTAL_TRACKS" -ge 2 ] && [ "$SIMILAR_COUNT" -eq 0 ]; then
      echo "   FAILED: Expected at least one similar relationship when 2+ tracks exist"
      echo "   Similar API response: $SIMILAR_RESPONSE"
      exit 1
    fi

    if [ "$TOTAL_TRACKS" -lt 2 ]; then
      echo "   Note: only one track exists, so similar relationships are not expected yet"
    fi

    echo ""
    echo "5. Checking atlas v1 map payload..."
    MAP_RESPONSE=$(curl -s "$BASE_URL/api/atlas/map?v=1")
    MAP_SCENE_COUNT=$(echo "$MAP_RESPONSE" | grep -o '"id":"' | wc -l | tr -d ' ')
    MAP_EDGE_COUNT=$(echo "$MAP_RESPONSE" | grep -o '"from_scene_id":"' | wc -l | tr -d ' ')
    echo "   Atlas scenes: ${MAP_SCENE_COUNT:-0}"
    echo "   Atlas scene edges: ${MAP_EDGE_COUNT:-0}"

    echo ""
    echo "=== Upload test PASSED ==="
    echo "View in UI: $BASE_URL/track/$TRACK_ID"
    exit 0
  fi

  if [ "$STATUS" = "ERROR" ]; then
    echo "   FAILED: Track analysis errored"
    echo "$STATUS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$STATUS_RESPONSE"
    exit 1
  fi
done

echo "   TIMEOUT: Track did not reach READY status within 30 seconds"
exit 1
