#!/usr/bin/env bash
# Over-the-air update (Yazan 2026-11-16). Every update goes to the "test" channel first: phones with Admin >
# "Get updates first" on take it at their next open. Only after Yazan's OK is the same update sent to everyone:
#   scripts/publish-update.sh test "message" [android|ios|all]   publish the current code to the test channel
#                                                   (default android; iPhone added 2026-11-17)
#   scripts/publish-update.sh production <groupId>  send that tested update group to everyone (no new bundle)
#
# The app's EXPO_PUBLIC_* values are baked into the code when it is bundled. A store build reads them from .env (and
# eas.json's build env); `eas update --environment` does NOT read .env, so they are loaded here by hand. Without them
# the update crashes at start ("supabaseUrl is required", 2026-11-16: every update that day did this), so the script
# stops if one is missing, bundles from a clean cache (a cached bundle keeps the old, empty values), and checks the finished bundle for the server address before anything is sent.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a
# shellcheck disable=SC1091
. ./.env
set +a
export EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=212035954830-f9nk95o7de5mjpmu33ra3lp0jdtor0bd.apps.googleusercontent.com
export EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=212035954830-ns492cg9k2579g1snl1u8oq8kh8fut92.apps.googleusercontent.com
for v in EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID; do
  [ -n "${!v:-}" ] || { echo "Missing $v: not publishing." >&2; exit 1; }
done
case "${1:-}" in
  test)
    plat="${3:-android}"
    case "$plat" in android) list=android ;; ios) list=ios ;; all) list="android ios" ;; *) echo "platform: android, ios or all" >&2; exit 1 ;; esac
    rm -rf dist
    npx expo export --platform "$plat" --output-dir dist --clear
    host="${EXPO_PUBLIC_SUPABASE_URL#https://}"
    for p in $list; do
      if ! grep -rqa "$host" "dist/_expo/static/js/$p/"; then
        echo "The $p bundle has no server address ($host): not publishing." >&2
        exit 1
      fi
    done
    npx eas-cli@latest update --channel test --message "${2:?message}" --platform "$plat" --skip-bundler --input-dir dist \
      --environment production --non-interactive
    ;;
  production) npx eas-cli@latest update:republish --group "${2:?group id}" --destination-channel production --non-interactive ;;
  *) echo "usage: $0 test \"message\" | production <groupId>"; exit 1 ;;
esac
