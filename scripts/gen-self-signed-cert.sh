#!/usr/bin/env bash
#
# Genera un certificato TLS autofirmato per nginx/certs/.
#
# A cosa serve: provare l'intera catena di produzione — redirect 80->443,
# terminazione TLS, intestazioni di sicurezza, reti separate — senza possedere un
# dominio e senza chiamare Let's Encrypt. Il rilascio vero ha un limite di
# tentativi falliti per settimana: scoprire un errore di configurazione a colpi
# di `certbot` significa restare chiusi fuori proprio mentre si sta sbagliando.
#
# Il browser mostrera' un avviso: e' corretto, il certificato non e' firmato da
# nessuno. Per le verifiche da riga di comando si usa `curl -k`.
#
# NON usarlo in produzione. Per il certificato vero vedi il servizio `certbot`
# in docker-compose.prod.yml.
#
# Uso:
#   ./scripts/gen-self-signed-cert.sh              # per localhost
#   ./scripts/gen-self-signed-cert.sh commonera.it # per un dominio preciso

set -euo pipefail

DOMAIN="${1:-localhost}"
# Risolto rispetto a questo script, non alla directory corrente: altrimenti
# lanciarlo da dentro scripts/ creerebbe un secondo nginx/certs/ annidato e
# nginx continuerebbe a non trovare niente.
CERT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/nginx/certs"
DAYS=825

mkdir -p "$CERT_DIR"

if [ -s "$CERT_DIR/fullchain.pem" ] && [ "${FORCE:-}" != "1" ]; then
  echo "Esiste gia' $CERT_DIR/fullchain.pem — non lo sovrascrivo."
  echo "Per rigenerarlo:  FORCE=1 $0 $DOMAIN"
  exit 0
fi

# I nomi alternativi (SAN) sono l'unica cosa che i browser guardano davvero: il
# vecchio Common Name e' ignorato da Chrome dal 2017. Senza `localhost` e
# `127.0.0.1` qui dentro, il certificato risulta non valido per l'host su cui lo
# stiamo provando.
if [ "$DOMAIN" = "localhost" ]; then
  SAN="DNS:localhost,IP:127.0.0.1,IP:::1"
else
  SAN="DNS:${DOMAIN},DNS:www.${DOMAIN},DNS:localhost,IP:127.0.0.1,IP:::1"
fi

# ECDSA P-256 invece di RSA: chiavi e handshake piu' leggeri, e lo supportano
# tutti i browser che possano anche solo aprire il sito.
openssl req -x509 -nodes \
  -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 \
  -days "$DAYS" \
  -keyout "$CERT_DIR/privkey.pem" \
  -out "$CERT_DIR/fullchain.pem" \
  -subj "/C=IT/ST=Trentino/L=Rovereto/O=Common Era (sviluppo)/CN=${DOMAIN}" \
  -addext "subjectAltName=${SAN}" \
  -addext "basicConstraints=critical,CA:FALSE" \
  -addext "keyUsage=critical,digitalSignature,keyEncipherment" \
  -addext "extendedKeyUsage=serverAuth" \
  2>/dev/null

# La chiave privata leggibile solo dal proprietario. nginx gira da root nel
# container e la legge lo stesso; 644 la lascerebbe esposta a chiunque abbia un
# account su questa macchina.
chmod 600 "$CERT_DIR/privkey.pem"
chmod 644 "$CERT_DIR/fullchain.pem"

echo "Certificato autofirmato creato in $CERT_DIR (valido $DAYS giorni):"
openssl x509 -in "$CERT_DIR/fullchain.pem" -noout -subject -dates -ext subjectAltName

cat <<'ISTRUZIONI'

Ora si puo' avviare lo stack di produzione in locale:

  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

e verificarlo con:

  curl -kI https://localhost/            # intestazioni di sicurezza
  curl -k  https://localhost/api/products

ISTRUZIONI
