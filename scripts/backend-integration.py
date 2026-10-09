#!/usr/bin/env python3
"""Exercise real Supabase Auth, Edge, RPC, RLS and racing clients.

Reads temporary QA sessions outside the repository. Does not print credentials,
access codes, tokens, question answers, or RPC bodies. Game intents use the same
public API as the browser; no positions or phases are altered directly.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json
import os
import urllib.error
import urllib.request
import uuid

ENV_PATH = Path(os.environ.get('TECLA_PAU_QA_ENV', '/tmp/tecla-pau-qa-env.json'))
USERS_PATH = Path(os.environ.get('TECLA_PAU_QA_USERS', '/tmp/tecla-pau-qa-users.json'))
REPORT_PATH = Path(os.environ.get('TECLA_PAU_BACKEND_REPORT', 'acceptance/backend-integration-report.json'))
env = json.loads(ENV_PATH.read_text())
users = json.loads(USERS_PATH.read_text())
a, b, outsider = users
checks = []
game_ids = []


def key():
    return str(uuid.uuid4())


def http(user, path, body=None, method=None):
    headers = {'apikey': env['publishableKey'], 'Content-Type': 'application/json'}
    if user is not None:
        headers['Authorization'] = 'Bearer ' + user['session']['access_token']
    request = urllib.request.Request(env['url'] + path,
        data=None if body is None else json.dumps(body).encode(), headers=headers,
        method=method or ('GET' if body is None else 'POST'))
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            raw = response.read()
            return response.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        raw = error.read()
        return error.code, json.loads(raw) if raw else None


def rpc(user, name, body):
    status, data = http(user, '/rest/v1/rpc/' + name, body)
    assert status == 200, f'{name}: HTTP {status}, code {data.get("code")}, message {data.get("message")}'
    return data


def rejects(user, name, body, expected=None):
    status, data = http(user, '/rest/v1/rpc/' + name, body)
    assert status >= 400, name + ' unexpectedly allowed'
    if expected:
        assert data.get('message') == expected, name + ': unexpected stable error'


def record(name):
    checks.append({'name': name, 'status': 'PASS'})
    print('PASS ' + name)


def view(user, game_id):
    return rpc(user, 'get_game_view', {'p_game_id': game_id})


def create(user, mode='ONLINE', minutes=30, role='PAU', starting='PAU', idem=None):
    body = {'p_mode': mode, 'p_target_minutes': minutes, 'p_creator_role': role,
            'p_starting_player': starting, 'p_idempotency_key': idem or key()}
    result = rpc(user, 'create_game', body)
    if result['game']['id'] not in game_ids:
        game_ids.append(result['game']['id'])
    return result, body


def action(user, state, name, payload=None, idem=None):
    return rpc(user, 'apply_game_action', {'p_game_id': state['game']['id'],
        'p_action': name, 'p_expected_state_version': state['game']['stateVersion'],
        'p_idempotency_key': idem or key(), 'p_payload': payload or {}})


def online_game(minutes=30):
    state, _ = create(a, minutes=minutes)
    state = rpc(b, 'join_game_by_code', {'p_invite_code': state['game']['inviteCode'].lower(),
        'p_role': 'TECLA', 'p_idempotency_key': key()})
    state = rpc(a, 'start_game', {'p_game_id': state['game']['id'],
        'p_expected_state_version': state['game']['stateVersion'], 'p_idempotency_key': key()})
    return state


def begin_online(state):
    current = a if state['game']['currentTurn'] == 'PAU' else b
    state = action(current, state, 'BEGIN_TURN')
    if state['game']['phase'] == 'TP_OPEN':
        state = action(current, state, 'CLAIM_TP', {'claimant': state['game']['currentTurn']})
    return state


def finish_online(state):
    # PAU advances; TECLA answers incorrectly. Only server intents are used.
    while state['game']['status'] != 'FINISHED':
        state = begin_online(state)
        respondent = state['game']['respondingPlayer']
        judge = b if respondent == 'PAU' else a
        state = action(judge, state, 'JUDGE_CORRECT' if respondent == 'PAU' else 'JUDGE_INCORRECT')
        if state['game']['status'] != 'FINISHED':
            state = action(a, state, 'NEXT_TURN')
    return state


assert rpc(outsider, 'get_access_context', {}) == {'authorized': False}
rejects(outsider, 'create_game', {'p_mode': 'ONLINE', 'p_target_minutes': 30,
    'p_starting_player': 'PAU', 'p_creator_role': 'PAU', 'p_idempotency_key': key()}, 'DEVICE_NOT_AUTHORIZED')
status, result = http(outsider, '/functions/v1/verify-couple-access', {'code': 'invalid-private-code'})
assert status == 403 and result['error'] == 'INVALID_CODE'
status, _ = http(None, '/functions/v1/verify-couple-access', {'code': 'invalid-private-code'})
assert status == 401
record('private-access-edge-and-unauthorized-device')

state, create_body = create(a)
assert rpc(a, 'create_game', create_body)['game']['id'] == state['game']['id']
rejects(a, 'create_game', dict(create_body, p_target_minutes=45), 'IDEMPOTENCY_KEY_REUSED')
rejects(b, 'create_game', create_body, 'IDEMPOTENCY_KEY_REUSED')
record('create-idempotency-is-bound-to-actor-and-intent')

for minutes in [10, 20, 30, 45, 60, 90, 180]:
    board_state, _ = create(a, 'IN_PERSON', minutes, 'IN_PERSON_CONTROLLER', None)
    cells = board_state['board']
    assert len(cells) == board_state['game']['finishPosition']
    assert any(c['type'] == 'TP' for c in cells)
    bonus = [c['position'] for c in cells if c['modifier'] == 'PLUS_ONE']
    assert 1 not in bonus and len(cells)-1 not in bonus and len(cells) not in bonus
    assert all(i+1 not in bonus for i in bonus)
    assert all(not (cells[i]['type'] == cells[i+1]['type'] == cells[i+2]['type']) for i in range(len(cells)-2))
    assert len(bonus) <= max(1, round(len(cells)*.15))
    action(a, board_state, 'ABANDON_GAME')
record('duration-persisted-board-and-plus-one-constraints')

rejects(outsider, 'get_game_view', {'p_game_id': state['game']['id']}, 'NOT_GAME_MEMBER')
status, result = http(outsider, '/rest/v1/games?id=eq.' + state['game']['id'])
assert status == 200 and result == []
table_bodies = {
    'game_members': {'game_id': state['game']['id'], 'user_id': outsider['id'], 'access_role': 'TECLA'},
    'game_cells': {'game_id': state['game']['id'], 'position': 99, 'cell_type': 'TP'},
    'game_events': {'game_id': state['game']['id'], 'state_version': 999, 'event_type': 'FAKE', 'idempotency_key': key()},
    'match_results': {'game_id': state['game']['id'], 'couple_id': state['game']['coupleId'], 'winner': 'PAU', 'finished_at': '2026-10-09T10:00:00Z'},
    'authorized_devices': {'couple_id': state['game']['coupleId'], 'user_id': outsider['id']},
}
for table, body in table_bodies.items():
    status, _ = http(a, '/rest/v1/' + table, body, 'POST')
    assert status in [401, 403], f'{table} mutation/read policy failed'
status, _ = http(a, '/rest/v1/questions')
assert status in [401, 403]
status, _ = http(a, '/rest/v1/games?id=eq.' + state['game']['id'], {'pau_position': 4}, 'PATCH')
assert status in [401, 403]
for helper, body in [('generate_game_board', {'p_game_id': state['game']['id'], 'p_finish_position': 5}),
                     ('broadcast_game_updated', {'p_game_id': state['game']['id'], 'p_state_version': 1, 'p_event_type': 'fake'}),
                     ('pick_unused_question', {'p_game_id': state['game']['id'], 'p_pool': 'PAU'})]:
    rejects(a, helper, body)
rejects(None, 'get_game_view', {'p_game_id': state['game']['id']})
record('rls-direct-mutation-question-and-internal-helper-denial')

state = online_game()
game_id = state['game']['id']
rejects(b, 'apply_game_action', {'p_game_id': game_id, 'p_action': 'BEGIN_TURN',
    'p_expected_state_version': state['game']['stateVersion'], 'p_idempotency_key': key(), 'p_payload': {}}, 'ACTION_NOT_ALLOWED')
state = action(a, state, 'BEGIN_TURN')
assert 'answerCa' not in state['question']
judge_state = view(b, game_id)
assert isinstance(judge_state['question'].get('answerCa'), str)
rejects(a, 'apply_game_action', {'p_game_id': game_id, 'p_action': 'JUDGE_CORRECT',
    'p_expected_state_version': state['game']['stateVersion'], 'p_idempotency_key': key(), 'p_payload': {}}, 'RESPONDENT_CANNOT_JUDGE')
rejects(a, 'apply_game_action', {'p_game_id': game_id, 'p_action': 'REVEAL_ANSWER',
    'p_expected_state_version': state['game']['stateVersion'], 'p_idempotency_key': key(), 'p_payload': {}}, 'NOT_ALLOWED')
record('online-answer-omitted-and-judge-permissions')

idem = key()
old_state = state
state = action(b, state, 'JUDGE_CORRECT', idem=idem)
replay = action(b, old_state, 'JUDGE_CORRECT', idem=idem)
assert replay['game']['stateVersion'] == state['game']['stateVersion']
assert state['game']['pauPosition'] == 1
rejects(b, 'apply_game_action', {'p_game_id': game_id, 'p_action': 'NEXT_TURN',
    'p_expected_state_version': old_state['game']['stateVersion'], 'p_idempotency_key': key(), 'p_payload': {}}, 'STALE_STATE')
assert view(a, game_id)['game'] == state['game']
record('correct-action-idempotency-stale-version-and-reload')

state = action(a, state, 'NEXT_TURN')
state = begin_online(state)
state = action(a, state, 'JUDGE_CORRECT')
state = action(a, state, 'NEXT_TURN')
state = begin_online(state)
state = action(b, state, 'JUDGE_CORRECT')
assert state['game']['pauPosition'] == 3 and state['lastEvent']['payload']['plusOne'] is True
state = action(a, state, 'NEXT_TURN')
state = begin_online(state)
state = action(a, state, 'JUDGE_INCORRECT')
assert state['game']['teclaPosition'] == 1 and state['lastEvent']['payload']['drinkCount'] == 2
record('plus-one-movement-and-double-drink-on-error')

# Make TECLA reach position 2, then her next turn opens the shared TP at position 3.
state = action(a, state, 'NEXT_TURN')
state = begin_online(state)
state = action(b, state, 'JUDGE_INCORRECT')
state = action(a, state, 'NEXT_TURN')
state = begin_online(state)
state = action(a, state, 'JUDGE_CORRECT')
# +1 at cell 2 moves TECLA to 3 too. On the next PAU turn, use another game
# with 20 minutes (no +1) to exercise unequal-position T&P explicitly.
state = action(a, state, 'ABANDON_GAME')
race = online_game(20)
for role in ['PAU', 'TECLA', 'PAU', 'TECLA']:
    race = begin_online(race)
    judge = b if role == 'PAU' else a
    race = action(judge, race, 'JUDGE_CORRECT')
    race = action(a, race, 'NEXT_TURN')
race = action(a, race, 'BEGIN_TURN')
assert race['game']['phase'] == 'TP_OPEN'
assert 'answerCa' not in view(a, race['game']['id'])['question']
assert 'answerCa' not in view(b, race['game']['id'])['question']
def claim(user):
    return http(user, '/rest/v1/rpc/apply_game_action', {'p_game_id': race['game']['id'],
        'p_action': 'CLAIM_TP', 'p_expected_state_version': race['game']['stateVersion'],
        'p_idempotency_key': key(), 'p_payload': {'claimant': user['role']}})
with ThreadPoolExecutor(max_workers=2) as pool:
    results = list(pool.map(claim, [a, b]))
assert [status for status, _ in results].count(200) == 1
race = view(a, race['game']['id'])
respondent = race['game']['respondingPlayer']
judge = b if respondent == 'PAU' else a
assert 'answerCa' not in view(a if respondent == 'PAU' else b, race['game']['id'])['question']
assert 'answerCa' in view(judge, race['game']['id'])['question']
race = action(judge, race, 'JUDGE_INCORRECT')
race = action(a, race, 'NEXT_TURN')
assert race['game']['currentTurn'] == 'TECLA'
action(a, race, 'ABANDON_GAME')
record('tp-simultaneous-claim-single-winner-safe-answer-and-original-turn')

before_score = rpc(a, 'get_access_context', {})['scoreboard']
finish = finish_online(online_game(20))
assert finish['game']['pauPosition'] == finish['game']['finishPosition']
assert finish['game']['winner'] == 'PAU'
after_score = rpc(a, 'get_access_context', {})['scoreboard']
assert after_score['pauWins'] == before_score['pauWins'] + 1
assert after_score['completedGames'] == before_score['completedGames'] + 1
status, results = http(a, '/rest/v1/match_results?game_id=eq.' + finish['game']['id'])
assert status == 200 and len(results) == 1
rejects(a, 'apply_game_action', {'p_game_id': finish['game']['id'], 'p_action': 'ABANDON_GAME',
    'p_expected_state_version': finish['game']['stateVersion'], 'p_idempotency_key': key(), 'p_payload': {}}, 'GAME_ALREADY_FINISHED')
assert rpc(a, 'get_access_context', {})['scoreboard'] == after_score
record('formal-meta-exactly-one-match-result-and-score')

in_person, _ = create(a, 'IN_PERSON', 20, 'IN_PERSON_CONTROLLER')
in_person = action(a, in_person, 'BEGIN_TURN')
assert 'answerCa' not in in_person['question']
in_person = action(a, in_person, 'REVEAL_ANSWER')
assert 'answerCa' in in_person['question'] and in_person['capabilities']['canJudge']
in_person = action(a, in_person, 'JUDGE_INCORRECT')
assert in_person['game']['pauPosition'] == 0
in_person = action(a, in_person, 'ABANDON_GAME')
assert rpc(a, 'get_access_context', {})['scoreboard'] == after_score
record('in-person-reveal-judge-and-abandoned-game-does-not-score')

# Shared +1 at cell 3 of the 60-minute route: the claimant is behind
# the original turn's player, then reaches META through the same shared bonus.
shared = online_game(60)
for role in ['PAU', 'TECLA', 'PAU', 'TECLA']:
    shared = begin_online(shared)
    shared = action(b if role == 'PAU' else a, shared, 'JUDGE_CORRECT' if role == 'PAU' else 'JUDGE_INCORRECT')
    shared = action(a, shared, 'NEXT_TURN')
shared = action(a, shared, 'BEGIN_TURN')
assert shared['game']['phase'] == 'TP_OPEN' and shared['game']['currentTargetCell'] == 3
shared = action(b, shared, 'CLAIM_TP', {'claimant': 'TECLA'})
shared = action(a, shared, 'JUDGE_CORRECT')
assert shared['game']['teclaPosition'] == 2 and shared['game']['pauPosition'] == 2
assert shared['lastEvent']['payload']['from'] == 0 and shared['lastEvent']['payload']['to'] == 2
assert shared['lastEvent']['payload']['plusOne'] is True
shared = action(a, shared, 'NEXT_TURN')
assert shared['game']['currentTurn'] == 'TECLA'
for _ in range(2):
    active = a if shared['game']['currentTurn'] == 'PAU' else b
    shared = action(active, shared, 'BEGIN_TURN')
    shared = action(b, shared, 'CLAIM_TP', {'claimant': 'TECLA'})
    shared = action(a, shared, 'JUDGE_CORRECT')
    shared = action(a, shared, 'NEXT_TURN')
assert shared['game']['teclaPosition'] == 6 and shared['game']['currentTurn'] == 'TECLA'
shared = action(b, shared, 'BEGIN_TURN')
shared = action(a, shared, 'JUDGE_CORRECT')
shared = action(a, shared, 'NEXT_TURN')
assert shared['game']['teclaPosition'] == 7 and shared['game']['currentTurn'] == 'PAU'
shared = action(a, shared, 'BEGIN_TURN')
shared = action(b, shared, 'CLAIM_TP', {'claimant': 'TECLA'})
shared = action(a, shared, 'JUDGE_CORRECT')
assert shared['game']['status'] == 'FINISHED' and shared['game']['winner'] == 'TECLA'
assert shared['game']['teclaPosition'] == shared['game']['finishPosition'] == 9
assert shared['lastEvent']['payload']['from'] == 7 and shared['lastEvent']['payload']['to'] == 9
assert shared['lastEvent']['payload']['plusOne'] is True
record('tp-bonus-moves-claimant-from-own-position-and-can-finish-at-meta')

REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
REPORT_PATH.write_text(json.dumps({'projectRef': 'lhgyopkwstuyxolwfucq',
    'authFixture': 'real-anonymous-sessions' if all(u['session']['user'].get('is_anonymous') for u in users) else 'real-password-sessions-anonymous-disabled', 'checks': checks,
    'gameIds': game_ids, 'passed': len(checks)}, indent=2) + '\n')
print(f'{len(checks)} real-backend checks passed. No secrets or answers printed.')
