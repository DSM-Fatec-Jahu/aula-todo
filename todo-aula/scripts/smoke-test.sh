#!/usr/bin/env bash
# Teste de ponta a ponta da API (Postgres + Mongo + Storage + link anonimo).
#
# Uso:
#   ./smoke-test.sh https://SEU_PROJETO.web.app     # nuvem (passa pelo Firebase Hosting)
#   ./smoke-test.sh http://localhost:3000           # API local
#
# Requer: bash 3.2+ (Cloud Shell, Linux, macOS, Git Bash), curl e node (so para ler JSON). Nao deixa dados: apaga o projeto no final.
set -euo pipefail

BASE="${1:?Informe a URL base. Ex.: https://meu-projeto.web.app}"
BASE="${BASE%/}"
EMAIL="smoke-$(date +%s)-$RANDOM@example.com"
PASSWORD="senha-forte-123"
FAILS=0

# json '<caminho.no.objeto>' le o JSON da entrada padrao e imprime o valor
json() {
  node -e '
    let s = "";
    process.stdin.on("data", (d) => (s += d)).on("end", () => {
      const v = process.argv[1].split(".").reduce((a, k) => (a == null ? a : a[k]), JSON.parse(s));
      console.log(v !== null && typeof v === "object" ? JSON.stringify(v) : v);
    });
  ' "$1"
}

ok()   { printf '  OK   %s\n' "$1"; }
fail() { printf '  FAIL %s\n' "$1"; FAILS=$((FAILS + 1)); }
check() { if [ "$2" = "$3" ]; then ok "$1"; else fail "$1 (esperado '$3', veio '$2')"; fi; }

api() { # api METODO CAMINHO [JSON] [TOKEN]
  local method="$1" path="$2" body="${3:-}" token="${4:-}"
  local args=(-sS -X "$method" "$BASE/api$path" -H 'Content-Type: application/json')
  [ -n "$token" ] && args+=(-H "Authorization: Bearer $token")
  [ -n "$body" ] && args+=(-d "$body")
  curl "${args[@]}"
}

echo "Base: $BASE"

echo "1) Saude dos servicos"
READY="$(api GET /health/ready)"
check "PostgreSQL" "$(echo "$READY" | json postgres)" "up"
check "MongoDB" "$(echo "$READY" | json mongo)" "up"

echo "2) Cadastro e login"
REG="$(api POST /auth/register "{\"name\":\"Smoke Test\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")"
TOKEN="$(echo "$REG" | json accessToken)"
[ -n "$TOKEN" ] && [ "$TOKEN" != "undefined" ] && ok "usuario criado e token recebido" || fail "cadastro"
check "login" "$(api POST /auth/login "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | json user.email)" "$EMAIL"

echo "3) Projeto e tarefa"
PROJECT="$(api POST /projects '{"name":"Teste de fumaca"}' "$TOKEN")"
PID="$(echo "$PROJECT" | json id)"
TASK="$(api POST "/projects/$PID/tasks" '{"title":"Tarefa com anexo"}' "$TOKEN")"
TID="$(echo "$TASK" | json id)"
check "tarefa criada como TODO" "$(echo "$TASK" | json status)" "TODO"

echo "4) Upload de arquivo (signed URL direto no storage)"
CONTENT="conteudo de teste $(date +%s)"
SIZE="${#CONTENT}"
SLOT="$(api POST "/projects/$PID/tasks/$TID/attachments" "{\"fileName\":\"nota.txt\",\"contentType\":\"text/plain\",\"sizeBytes\":$SIZE}" "$TOKEN")"
AID="$(echo "$SLOT" | json attachmentId)"
UPLOAD_URL="$(echo "$SLOT" | json upload.url)"
CURL_HEADERS=()
while IFS= read -r line; do
  [ -n "$line" ] && CURL_HEADERS+=(-H "$line")
done < <(echo "$SLOT" | node -e '
  let s = "";
  process.stdin.on("data", (d) => (s += d)).on("end", () => {
    for (const [k, v] of Object.entries(JSON.parse(s).upload.headers)) console.log(`${k}: ${v}`);
  });')
CODE="$(printf '%s' "$CONTENT" | curl -sS -o /dev/null -w '%{http_code}' -X PUT "$UPLOAD_URL" "${CURL_HEADERS[@]}" --data-binary @-)"
check "PUT no storage" "$CODE" "200"
CONFIRM="$(api POST "/projects/$PID/tasks/$TID/attachments/$AID/confirm" '' "$TOKEN")"
check "anexo confirmado (tamanho)" "$(echo "$CONFIRM" | json sizeBytes)" "$SIZE"
DOWNLOAD_URL="$(echo "$CONFIRM" | json downloadUrl)"
check "download pela signed URL" "$(curl -sS "$DOWNLOAD_URL")" "$CONTENT"

echo "5) Compartilhamento anonimo"
SHARE="$(api POST "/projects/$PID/shares" '{"permission":"READ","label":"smoke","expiresInDays":1}' "$TOKEN")"
STOKEN="$(echo "$SHARE" | json token)"
SID="$(echo "$SHARE" | json id)"
VIEW="$(api GET "/public/shares/$STOKEN")"
check "visitante le o projeto" "$(echo "$VIEW" | json project.name)" "Teste de fumaca"
check "visitante ve o anexo" "$(echo "$VIEW" | json tasks.0.attachments.0.fileName)" "nota.txt"
CODE="$(curl -sS -o /dev/null -w '%{http_code}' -X PATCH "$BASE/api/public/shares/$STOKEN/tasks/$TID" -H 'Content-Type: application/json' -d '{"status":"DONE"}')"
check "link somente leitura nao edita" "$CODE" "403"
api DELETE "/projects/$PID/shares/$SID" '' "$TOKEN" >/dev/null
CODE="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/api/public/shares/$STOKEN")"
check "link revogado deixa de funcionar" "$CODE" "404"

echo "6) Historico no MongoDB"
ACTIVITY="$(api GET "/projects/$PID/activity" '' "$TOKEN")"
COUNT="$(echo "$ACTIVITY" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).length))')"
[ "$COUNT" -ge 5 ] && ok "$COUNT eventos registrados" || fail "historico com poucos eventos ($COUNT)"

echo "7) Limpeza"
CODE="$(curl -sS -o /dev/null -w '%{http_code}' -X DELETE "$BASE/api/projects/$PID" -H "Authorization: Bearer $TOKEN")"
check "projeto removido" "$CODE" "204"

echo
if [ "$FAILS" -eq 0 ]; then echo "RESULTADO: tudo certo"; else echo "RESULTADO: $FAILS falha(s)"; exit 1; fi
