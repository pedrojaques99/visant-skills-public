#!/usr/bin/env bash
# Old name kept for muscle memory: runs transcribe.sh.
exec bash "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/transcribe.sh" "$@"
