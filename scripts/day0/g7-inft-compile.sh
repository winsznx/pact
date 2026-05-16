#!/usr/bin/env bash
# Gate G7 — compile the 0g-agent-nft (ERC-7857) reference contract under
# Solidity 0.8.24 + cancun, the pinned PACT toolchain.
#
# Per MASTER_PRD §13 Phase 0: "Fork `0g-agent-nft`. Compile against 0.8.24.
# Deploy to local fork." This gate covers the compile half. We clone the
# upstream repo into a sibling cache directory, apply our foundry profile,
# run `forge build`, and write a structured pass/fail JSON to output/.
#
# Pass criteria (PRD §21): compiles without modification.

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="${HERE}/output"
GATE="g7-inft-compile"
JSON="${OUTPUT_DIR}/${GATE}.json"
CACHE_DIR="${HERE}/.cache"
REPO_DIR="${CACHE_DIR}/0g-agent-nft"
REPO_URL="https://github.com/0gfoundation/0g-agent-nft.git"

mkdir -p "${OUTPUT_DIR}" "${CACHE_DIR}"

started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

emit_json() {
  local status="$1"
  local summary="$2"
  local extra="$3"
  local finished_at
  finished_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  cat >"${JSON}" <<EOF
{
  "gate": "${GATE}",
  "status": "${status}",
  "summary": ${summary},
  "startedAt": "${started_at}",
  "finishedAt": "${finished_at}",
  "data": ${extra}
}
EOF
  echo "${status} ${GATE}: $(echo "${summary}" | sed -e 's/^"//' -e 's/"$//') (${JSON})"
  if [ "${status}" = "FAIL" ]; then exit 1; fi
}

json_string() {
  # Quote a string for JSON. Escapes \, ", and control chars.
  python3 - <<'PY' "$1"
import json, sys
print(json.dumps(sys.argv[1]))
PY
}

# 1. forge present?
if ! command -v forge >/dev/null 2>&1; then
  emit_json "FAIL" "$(json_string 'forge not found in PATH; install foundry: https://book.getfoundry.sh/getting-started/installation')" '{"forgeFound": false}'
fi

forge_version="$(forge --version 2>/dev/null | head -n1 || echo unknown)"

# 2. clone or update reference repo.
if [ ! -d "${REPO_DIR}/.git" ]; then
  if ! git clone --depth=1 "${REPO_URL}" "${REPO_DIR}" 2>"${OUTPUT_DIR}/${GATE}.clone.log"; then
    summary="$(json_string "git clone failed; see ${OUTPUT_DIR}/${GATE}.clone.log")"
    emit_json "FAIL" "${summary}" "{\"forgeVersion\": $(json_string "${forge_version}"), \"repoUrl\": $(json_string "${REPO_URL}")}"
  fi
else
  git -C "${REPO_DIR}" fetch --depth=1 origin >>"${OUTPUT_DIR}/${GATE}.clone.log" 2>&1 || true
  git -C "${REPO_DIR}" reset --hard origin/HEAD >>"${OUTPUT_DIR}/${GATE}.clone.log" 2>&1 || true
fi

repo_head="$(git -C "${REPO_DIR}" rev-parse HEAD 2>/dev/null || echo unknown)"
repo_branch="$(git -C "${REPO_DIR}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"

# 3. detect project layout. The reference repo MAY ship as a hardhat project
# rather than foundry. We probe both.
has_foundry_toml=0; [ -f "${REPO_DIR}/foundry.toml" ] && has_foundry_toml=1
has_hardhat_config=0
{ [ -f "${REPO_DIR}/hardhat.config.js" ] || [ -f "${REPO_DIR}/hardhat.config.ts" ]; } && has_hardhat_config=1

# 4. write a PACT-pinned foundry profile next to the repo so we compile
# against our pinned toolchain (0.8.24 + cancun) regardless of upstream.
PROFILE_DIR="${CACHE_DIR}/profile"
mkdir -p "${PROFILE_DIR}"
cat >"${PROFILE_DIR}/foundry.toml" <<'TOML'
# PACT Day 0 — pinned profile applied during G7 compile.
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.24"
evm_version = "cancun"
optimizer = true
optimizer_runs = 200
TOML

# 5. compile. Try foundry-native first; if it isn't a foundry project, copy
# the contracts into a scratch foundry project and try again.
build_log="${OUTPUT_DIR}/${GATE}.build.log"
: >"${build_log}"
build_status="UNKNOWN"
build_path="${REPO_DIR}"

if [ "${has_foundry_toml}" = "1" ]; then
  if (cd "${REPO_DIR}" && forge build --use 0.8.24 --evm-version cancun) >>"${build_log}" 2>&1; then
    build_status="PASS"
  else
    build_status="FAIL"
  fi
else
  # Synthesize a scratch foundry project around upstream contracts.
  SCRATCH="${CACHE_DIR}/scratch"
  rm -rf "${SCRATCH}"
  mkdir -p "${SCRATCH}/src"
  cp "${PROFILE_DIR}/foundry.toml" "${SCRATCH}/foundry.toml"
  copied=0
  # Common locations.
  for d in contracts contracts/src src; do
    if [ -d "${REPO_DIR}/${d}" ]; then
      cp -R "${REPO_DIR}/${d}/." "${SCRATCH}/src/"
      copied=1
      break
    fi
  done
  if [ "${copied}" = "0" ]; then
    summary="$(json_string 'reference repo has no contracts/ or src/ directory')"
    emit_json "FAIL" "${summary}" "$(cat <<JSON
{"forgeVersion": $(json_string "${forge_version}"),
 "repoHead": $(json_string "${repo_head}"),
 "repoBranch": $(json_string "${repo_branch}"),
 "hasFoundryToml": false,
 "hasHardhatConfig": ${has_hardhat_config}
}
JSON
)"
  fi

  # 5a. Resolve `@openzeppelin/...` (and any other npm) imports the
  # upstream contracts depend on. Upstream is hardhat + npm, so we run
  # `pnpm install` (falls back to npm) inside the cloned repo to fetch
  # @openzeppelin/contracts and @openzeppelin/contracts-upgradeable, then
  # remap them in our scratch foundry profile.
  if [ -f "${REPO_DIR}/package.json" ]; then
    if command -v pnpm >/dev/null 2>&1; then
      (cd "${REPO_DIR}" && pnpm install --ignore-scripts) >>"${build_log}" 2>&1 || \
        (cd "${REPO_DIR}" && npm install --ignore-scripts) >>"${build_log}" 2>&1 || true
    elif command -v npm >/dev/null 2>&1; then
      (cd "${REPO_DIR}" && npm install --ignore-scripts) >>"${build_log}" 2>&1 || true
    fi
  fi

  # Add remappings to the scratch foundry profile pointing at upstream's
  # node_modules. We only emit a remapping for a path if it actually
  # exists on disk so a missing dep produces a clearer compile error
  # than a phantom remap.
  REMAPS=""
  for pkg in \
      "@openzeppelin/contracts/=node_modules/@openzeppelin/contracts/" \
      "@openzeppelin/contracts-upgradeable/=node_modules/@openzeppelin/contracts-upgradeable/" ; do
    target="${pkg#*=}"
    if [ -d "${REPO_DIR}/${target}" ]; then
      REMAPS+="\n    \"${pkg%=*}=${REPO_DIR}/${target}\","
    fi
  done

  cat >"${SCRATCH}/foundry.toml" <<TOML
# PACT Day 0 — pinned profile applied during G7 compile.
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.24"
evm_version = "cancun"
optimizer = true
optimizer_runs = 200
remappings = [$(printf "%b" "${REMAPS}")
]
TOML

  build_path="${SCRATCH}"
  if (cd "${SCRATCH}" && forge build --use 0.8.24 --evm-version cancun) >>"${build_log}" 2>&1; then
    build_status="PASS"
  else
    build_status="FAIL"
  fi
fi

build_tail="$(tail -n 60 "${build_log}" 2>/dev/null || echo '')"

extra="$(cat <<JSON
{"forgeVersion": $(json_string "${forge_version}"),
 "repoUrl": $(json_string "${REPO_URL}"),
 "repoHead": $(json_string "${repo_head}"),
 "repoBranch": $(json_string "${repo_branch}"),
 "hasFoundryToml": $([ "${has_foundry_toml}" = "1" ] && echo true || echo false),
 "hasHardhatConfig": $([ "${has_hardhat_config}" = "1" ] && echo true || echo false),
 "buildPath": $(json_string "${build_path}"),
 "buildLog": $(json_string "${build_log}"),
 "buildLogTail": $(json_string "${build_tail}")
}
JSON
)"

if [ "${build_status}" = "PASS" ]; then
  emit_json "PASS" "$(json_string "0g-agent-nft compiled clean against 0.8.24+cancun (head=${repo_head:0:8})")" "${extra}"
else
  emit_json "FAIL" "$(json_string "compile failed; tail in build log")" "${extra}"
fi
