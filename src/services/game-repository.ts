import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GameView } from './game-contract';
import type { GameAction, GameMode, PlayerRole } from '../domain/game/game-types';

const role = z.enum(['PAU', 'TECLA']);
const viewSchema = z.object({
  game: z.object({
    id: z.string().uuid(), mode: z.enum(['IN_PERSON', 'ONLINE']),
    status: z.enum(['LOBBY', 'ACTIVE', 'FINISHED', 'ABANDONED']),
    phase: z.string(), currentTurn: role, stateVersion: z.number().int(),
    pauPosition: z.number().int().nonnegative(), teclaPosition: z.number().int().nonnegative(),
    finishPosition: z.number().int().positive(),
  }).passthrough(),
  viewer: z.object({ role: z.enum(['PAU', 'TECLA', 'IN_PERSON_CONTROLLER']), userId: z.string().uuid() }).passthrough(),
  board: z.array(z.object({position: z.number().int(), type: z.enum(['PERSONAL', 'CROSSED', 'TP']), modifier: z.enum(['NONE', 'PLUS_ONE'])})),
  question: z.object({id:z.string(), pool:z.string(), questionCa:z.string(), answerCa:z.string().optional()}).passthrough().nullable(),
  capabilities: z.object({canSeeAnswer:z.boolean(),canJudge:z.boolean()}).passthrough(),
}).passthrough();

export type AccessContext = {
  authorized: boolean;
  coupleId?: string;
  activeGameId?: string | null;
  scoreboard?: { pauWins: number; teclaWins: number; completedGames: number };
};

function readView(value: unknown): GameView {
  const result = viewSchema.safeParse(value);
  if (!result.success) throw new Error('RESPONSE_INVALID');
  const view = result.data as unknown as GameView;
  if (view.game.mode === 'ONLINE' && view.question &&
      (view.viewer.role === view.game.respondingPlayer || view.game.phase === 'TP_OPEN') &&
      Object.hasOwn(view.question, 'answerCa')) {
    throw new Error('RESPONSE_INVALID');
  }
  return view;
}

export class GameRepository {
  private authentication: Promise<string> | null = null;
  constructor(readonly client: SupabaseClient) {}

  authenticate(): Promise<string> {
    this.authentication ??= this.initializeSession().finally(() => { this.authentication = null; });
    return this.authentication;
  }

  private async initializeSession(): Promise<string> {
    const { data: { session }, error } = await this.client.auth.getSession();
    if (error) throw new Error(error.message);
    if (session) return session.user.id;
    const result = await this.client.auth.signInAnonymously();
    if (result.error) {
      if (/anonymous.*disabled/i.test(result.error.message)) throw new Error('ANONYMOUS_DISABLED');
      throw result.error;
    }
    if (!result.data.user) throw new Error('NOT_AUTHENTICATED');
    return result.data.user.id;
  }

  async access(): Promise<AccessContext> {
    const { data, error } = await this.client.rpc('get_access_context');
    if (error) throw new Error(error.message);
    return data as AccessContext;
  }

  async getGameView(gameId: string): Promise<GameView> {
    const { data, error } = await this.client.rpc('get_game_view', {p_game_id:gameId});
    if (error) throw new Error(error.message);
    return readView(data);
  }

  async createGame(input: { mode: GameMode; targetMinutes: number; startingPlayer: PlayerRole | 'RANDOM'; creatorRole: PlayerRole | 'IN_PERSON_CONTROLLER' }): Promise<GameView> {
    const { data, error } = await this.client.rpc('create_game', {
      p_mode: input.mode, p_target_minutes: input.targetMinutes,
      p_starting_player: input.startingPlayer === 'RANDOM' ? null : input.startingPlayer, p_creator_role: input.creatorRole,
      p_idempotency_key: crypto.randomUUID(),
    });
    if (error) throw new Error(error.message);
    return readView(data);
  }

  async joinGame(inviteCode: string, player: PlayerRole): Promise<GameView> {
    const { data, error } = await this.client.rpc('join_game_by_code', {
      p_invite_code:inviteCode, p_role:player, p_idempotency_key:crypto.randomUUID(),
    });
    if (error) throw new Error(error.message);
    return readView(data);
  }

  async startGame(view: GameView): Promise<GameView> {
    const { data, error } = await this.client.rpc('start_game', {
      p_game_id:view.game.id, p_expected_state_version:view.game.stateVersion,
      p_idempotency_key:crypto.randomUUID(),
    });
    if (error) throw new Error(error.message);
    return readView(data);
  }

  async action(view: GameView, action: GameAction): Promise<GameView> {
    const { type, ...payload } = action;
    const { data, error } = await this.client.rpc('apply_game_action', {
      p_game_id:view.game.id, p_action:type, p_payload:payload,
      p_expected_state_version:view.game.stateVersion, p_idempotency_key:crypto.randomUUID(),
    });
    if (error) throw new Error(error.message);
    return readView(data);
  }
}
