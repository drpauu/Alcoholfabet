#!/usr/bin/env python3
"""Generate a private access code and a server-only hash setup query.

Never prints the code or hash. Apply the protected SQL file as a database owner.
Existing codes are preserved unless --rotate is explicitly passed.
"""
import argparse
import hashlib
from pathlib import Path
import secrets
import os

parser = argparse.ArgumentParser()
parser.add_argument('--rotate', action='store_true')
parser.add_argument('--directory', type=Path, default=Path.home() / '.config' / 'tecla-pau')
args = parser.parse_args()
args.directory.mkdir(parents=True, exist_ok=True)
os.chmod(args.directory, 0o700)
code_path = args.directory / 'access-code.txt'
if args.rotate or not code_path.exists():
    code_path.write_text(secrets.token_urlsafe(24) + '\n')
os.chmod(code_path, 0o600)
digest = hashlib.sha256(code_path.read_text().strip().encode()).hexdigest()
query_path = args.directory / 'set-access-code.sql'
query_path.write_text("insert into private.couple_access_config(couple_id,code_sha256) select id,decode('" + digest + "','hex') from public.couples where slug='pau-tecla' on conflict(couple_id) do update set code_sha256=excluded.code_sha256,updated_at=now();\n")
os.chmod(query_path, 0o600)
print('Private access configuration prepared in ' + str(args.directory) + '; contents not displayed.')
