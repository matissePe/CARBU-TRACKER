#!/bin/zsh
# Lancé par launchd : recharge l'environnement Node puis récupère les prix du jour.
# launchd démarre avec un PATH minimal, d'où le chemin explicite vers nvm.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_DIR"

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use >/dev/null

exec npm run ingest
