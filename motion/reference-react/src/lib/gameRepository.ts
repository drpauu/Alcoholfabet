import type { SupabaseClient } from '@supabase/supabase-js';

export type PlayerRole = 'PAU' | 'TECLA';
export type GameMemberRole = PlayerRole | 'IN_PERSON_CONTROLLER';
export type GameMode = 'IN_PERSON' | 'ONLINE';

export type GameView = {
  game: {
    id: string;
    mode: GameMode;
    status: 'LOBBY' | 'ACTIVE' | 'FINISHED' | 'ABANDONED';
    phase: string;
    currentTurn: PlayerRole;
    respondingPlayer: PlayerRole | null;
    pauPosition: number;
    teclaPosition: number;
    finishPosition: number;
    stateVersion: number;
    winner: PlayerRole | null;
  };
  viewer: { role: GameMemberRole; userId: string };
  board: Array<{ position: number; type: string; modifier: string }>;
  question: null | { id: string; pool: string; topic: string; questionCa: string; answerCa: string | null };
  capabilities: { canSeeAnswer: boolean; canJudge: boolean };
};

const idempotencyKey = (): string => crypto.randomUUID();

export class GameRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getGameView(gameId: string): Promise<GameView> {
    const { data, error } = await this.supabase.rpc('get_game_view', { p_game_id: gameId });
    if (error) throw error;
    return data as GameView;
  }

  async createGame(input: { mode: GameMode; targetMinutes: number; startingPlayer: PlayerRole; creatorRole: GameMemberRole }): Promise<GameView> {
    const { data, error } = await this.supabase.rpc('create_game', {
      p_mode: input.mode,
      p_target_minutes: input.targetMinutes,
      p_starting_player: input.startingPlayer,
      p_creator_role: input.creatorRole,
      p_idempotency_key: idempotencyKey(),
    });
    if (error) throw error;
    return data as GameView;
  }

  async joinGame(code: string, role: PlayerRole): Promise<GameView> {
    const { data, error } = await this.supabase.rpc('join_game_by_code', {
      p_invite_code: code,
      p_role: role,
      p_idempotency_key: idempotencyKey(),
    });
    if (error) throw error;
    return data as GameView;
  }

  async startGame(game: GameView): Promise<GameView> {
    const { data, error } = await this.supabase.rpc('start_game', {
      p_game_id: game.game.id,
      p_expected_state_version: game.game.stateVersion,
      p_idempotency_key: idempotencyKey(),
    });
    if (error) throw error;
    return data as GameView;
  }

  async action(game: GameView, action: string, payload: Record<string, unknown> = {}): Promise<GameView> {
    const { data, error } = await this.supabase.rpc('apply_game_action', {
      p_game_id: game.game.id,
      p_action: action,
      p_expected_state_version: game.game.stateVersion,
      p_idempotency_key: idempotencyKey(),
      p_payload: payload,
    });
    if (error) throw error;
    return data as GameView;
  }
}
