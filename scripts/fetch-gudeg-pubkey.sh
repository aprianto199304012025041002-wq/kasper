#!/bin/bash
# Jalankan dari laptop untuk ambil public key GUDEG
# lalu masukkan ke GitHub Secrets sebagai SSO_PUBLIC_KEY
set -e
echo "Fetching public key dari GUDEG..."
curl -sf https://gudeg.xo.je/jwks.json | python3 -c "
import sys, json, base64, struct
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicNumbers
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

data = json.load(sys.stdin)
key = data['keys'][0]
def b64url_decode(s):
    s += '=' * (4 - len(s) % 4)
    return base64.urlsafe_b64decode(s)

n = int.from_bytes(b64url_decode(key['n']), 'big')
e = int.from_bytes(b64url_decode(key['e']), 'big')
pub = RSAPublicNumbers(e, n).public_key(default_backend())
pem = pub.public_key_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
print(pem.decode())
" 2>/dev/null || echo "Gagal — minta admin GUDEG untuk share isi /keys/public.pem"
