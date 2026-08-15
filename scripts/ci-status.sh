#!/usr/bin/env bash
# Wait for the CI run belonging to a specific commit, and report every job.
#
# `gh run list --limit 1` returns whatever run exists *now*, which right after a
# push is usually the previous one — GitHub has not created the new run yet. That
# is how a failing run once got reported as green: the wrong run was watched.
# Asking by commit cannot make that mistake.
set -euo pipefail

sha="${1:-$(git rev-parse HEAD)}"

for _ in $(seq 1 30); do
    run=$(gh run list --commit "$sha" --limit 1 --json databaseId --jq '.[0].databaseId // empty')
    [ -n "$run" ] && break
    sleep 5
done

if [ -z "${run:-}" ]; then
    echo "No CI run found for ${sha:0:7} after 150s" >&2
    exit 1
fi

gh run watch "$run" --compact > /dev/null 2>&1 || true
echo "Commit ${sha:0:7} — run $run"
gh run view "$run" --json jobs --jq '.jobs[] | "  \(.name): \(.conclusion)"'
gh run view "$run" --json conclusion --jq '.conclusion' | grep -q '^success$'
