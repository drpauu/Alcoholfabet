#!/usr/bin/env python3
"""Create isolated real anonymous QA sessions and authorize PAU/TECLA.

Tokens and the access code remain outside the repository and are never printed.
Run before backend suites, not while browser tests share these fixtures.
"""
import json
import os
from pathlib import Path
import urllib.request

config_path = Path(os.environ.get('TECLA_PAU_QA_ENV', '/tmp/tecla-pau-qa-env.json'))
if config_path.exists():
    config = json.loads(config_path.read_text())
else:
    config = {'url': os.environ['VITE_SUPABASE_URL'], 'publishableKey': os.environ['VITE_SUPABASE_PUBLISHABLE_KEY']}
    config_path.write_text(json.dumps(config))
    os.chmod(config_path, 0o600)
code_path = Path(os.environ.get('TECLA_PAU_ACCESS_CODE_FILE', str(Path.home() / '.config' / 'tecla-pau' / 'access-code.txt')))
code = code_path.read_text().strip()
users = []
for role in ['PAU', 'TECLA', 'OUTSIDER']:
    request = urllib.request.Request(config['url'] + '/auth/v1/signup', data=b'{}',
        headers={'apikey': config['publishableKey'], 'Content-Type': 'application/json'})
    session = json.load(urllib.request.urlopen(request, timeout=20))
    assert session['user']['is_anonymous'], 'Auth did not issue an anonymous session'
    user = {'id': session['user']['id'], 'role': role, 'session': session}
    users.append(user)
    if role != 'OUTSIDER':
        request = urllib.request.Request(config['url'] + '/functions/v1/verify-couple-access',
            data=json.dumps({'code': code}).encode(), headers={'apikey': config['publishableKey'],
                'Authorization': 'Bearer ' + session['access_token'], 'Content-Type': 'application/json'})
        result = json.load(urllib.request.urlopen(request, timeout=20))
        assert result['authorized'], 'Private access was not authorized'
path = Path(os.environ.get('TECLA_PAU_QA_USERS', '/tmp/tecla-pau-qa-users.json'))
path.write_text(json.dumps(users)); os.chmod(path, 0o600)
print('Three real anonymous QA fixtures created privately. No tokens or codes printed.')
