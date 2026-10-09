import { readFile, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

const env = JSON.parse(await readFile(process.env.TECLA_PAU_QA_ENV ?? '/tmp/tecla-pau-qa-env.json', 'utf8'));
const users = JSON.parse(await readFile(process.env.TECLA_PAU_QA_USERS ?? '/tmp/tecla-pau-qa-users.json', 'utf8'));
const clients = users.map(() => createClient(env.url, env.publishableKey, { auth: { persistSession: false, autoRefreshToken: false } }));
const [a, b, outsider] = clients;
for (let i = 0; i < clients.length; i++) {
  const { error } = await clients[i].auth.setSession(users[i].session);
  assert.equal(error, null, 'real auth session valid');
  await clients[i].realtime.setAuth(users[i].session.access_token);
}
const rpc = async (client, name, payload) => {
  const { data, error } = await client.rpc(name, payload);
  assert.equal(error, null, `${name} returned an error`);
  return data;
};
const checks = [];
const pass = (name) => { checks.push({ name, status: 'PASS' }); console.log(`PASS ${name}`); };
const waitFor = async (test, timeout = 12000) => {
  const until = Date.now() + timeout;
  while (!test() && Date.now() < until) await new Promise((resolve) => setTimeout(resolve, 100));
  assert(test(), 'Realtime condition reached before timeout');
};
const subscribe = (channel, expected = 'SUBSCRIBED') => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Realtime subscription timeout')), 15000);
  channel.subscribe((status) => {
    if (status === expected) { clearTimeout(timer); resolve(status); }
    else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(timer); reject(new Error(`Unexpected channel status ${status}`)); }
  });
});
let state;
try {
  state = await rpc(a, 'create_game', { p_mode: 'ONLINE', p_target_minutes: 20, p_starting_player: 'PAU', p_creator_role: 'PAU', p_idempotency_key: randomUUID() });
  state = await rpc(b, 'join_game_by_code', { p_invite_code: state.game.inviteCode, p_role: 'TECLA', p_idempotency_key: randomUUID() });
  const notificationsA = [], notificationsB = [];
  const channelA = a.channel(`game:${state.game.id}`, { config: { private: true, presence: { key: users[0].id } } })
    .on('broadcast', { event: 'game_updated' }, ({ payload }) => notificationsA.push(payload));
  const channelB = b.channel(`game:${state.game.id}`, { config: { private: true, presence: { key: users[1].id } } })
    .on('broadcast', { event: 'game_updated' }, ({ payload }) => notificationsB.push(payload));
  await Promise.all([subscribe(channelA), subscribe(channelB)]);
  pass('two-real-members-join-private-game-channel');
  await Promise.all([channelA.track({ role: 'PAU', online_at: new Date().toISOString() }), channelB.track({ role: 'TECLA', online_at: new Date().toISOString() })]);
  await waitFor(() => Object.keys(channelA.presenceState()).length === 2 && Object.keys(channelB.presenceState()).length === 2);
  pass('presence-visible-to-both-members');
  const denied = outsider.channel(`game:${state.game.id}`, { config: { private: true } });
  await subscribe(denied, 'CHANNEL_ERROR');
  pass('nonmember-rejected-from-private-channel');
  state = await rpc(a, 'start_game', { p_game_id: state.game.id, p_expected_state_version: state.game.stateVersion, p_idempotency_key: randomUUID() });
  await waitFor(() => notificationsA.some((n) => n.stateVersion === state.game.stateVersion) && notificationsB.some((n) => n.stateVersion === state.game.stateVersion));
  for (const notification of [...notificationsA, ...notificationsB]) {
    assert(Object.keys(notification).every((field) => ['eventType', 'gameId', 'stateVersion', 'id'].includes(field)), 'notification contains only safe fields');
    assert.equal(typeof notification.stateVersion, 'number');
    assert.equal(notification.gameId, state.game.id);
  }
  pass('server-broadcast-only-safe-version-notifications');
  state = await rpc(a, 'apply_game_action', { p_game_id: state.game.id, p_action: 'BEGIN_TURN', p_expected_state_version: state.game.stateVersion, p_idempotency_key: randomUUID(), p_payload: {} });
  await waitFor(() => notificationsB.some((n) => n.stateVersion === state.game.stateVersion));
  const judge = await rpc(b, 'get_game_view', { p_game_id: state.game.id });
  assert.equal(judge.game.stateVersion, state.game.stateVersion);
  assert.equal('answerCa' in state.question, false);
  assert.equal(typeof judge.question.answerCa, 'string');
  pass('broadcast-refetches-safe-role-view');
  await a.removeChannel(channelA);
  const reconnected = a.channel(`game:${state.game.id}`, { config: { private: true, presence: { key: users[0].id } } });
  await a.realtime.setAuth(users[0].session.access_token);
  await subscribe(reconnected);
  await reconnected.track({ role: 'PAU', online_at: new Date().toISOString() });
  const recovered = await rpc(a, 'get_game_view', { p_game_id: state.game.id });
  assert.deepEqual(recovered.game, state.game);
  assert.equal('answerCa' in recovered.question, false);
  pass('reconnect-auth-presence-and-exact-state-recovery');
  state = await rpc(a, 'apply_game_action', { p_game_id: state.game.id, p_action: 'ABANDON_GAME', p_expected_state_version: state.game.stateVersion, p_idempotency_key: randomUUID(), p_payload: {} });
  await writeFile('acceptance/backend-realtime-report.json', JSON.stringify({ authFixture: users.every((user) => user.session.user.is_anonymous) ? 'real-anonymous-sessions' : 'real-password-sessions', checks, gameId: state.game.id, passed: checks.length }, null, 2) + '\n');
  console.log(`${checks.length} real Realtime checks passed. No secrets or answers printed.`);
} finally {
  await Promise.all(clients.map((client) => client.removeAllChannels()));
}
