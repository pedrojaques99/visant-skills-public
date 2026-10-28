#!/usr/bin/env bash
# Old name kept for muscle memory: runs cutlist.sh.
exec bash "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/cutlist.sh" "$@"
