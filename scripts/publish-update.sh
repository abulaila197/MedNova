#!/usr/bin/env bash
# Over-the-air update (Yazan 2026-11-16). Every update goes to the "test" channel first: phones with Admin >
# "Get updates first" on take it at their next open. Only after Yazan's OK is the same update sent to everyone:
#   scripts/publish-update.sh test "message"        publish the current code to the test channel
#   scripts/publish-update.sh production <groupId>  send that tested update group to everyone (no new bundle)
# The EXPO_PUBLIC_* values must match eas.json's build env, or Google sign-in breaks in the updated code.
set -euo pipefail
export EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=212035954830-f9nk95o7de5mjpmu33ra3lp0jdtor0bd.apps.googleusercontent.com
export EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=212035954830-ns492cg9k2579g1snl1u8oq8kh8fut92.apps.googleusercontent.com
case "${1:-}" in
  test) npx eas-cli@latest update --channel test --message "${2:?message}" --non-interactive ;;
  production) npx eas-cli@latest update:republish --group "${2:?group id}" --destination-channel production --non-interactive ;;
  *) echo "usage: $0 test \"message\" | production <groupId>"; exit 1 ;;
esac
