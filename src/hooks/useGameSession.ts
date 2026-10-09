import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { GameView } from '../services/game-contract';
import { GameRepository } from '../services/game-repository';
import type { AccessContext } from '../services/game-repository';
import { supabase } from '../services/supabase';
import { errorInCatalan, ca } from '../content/ca';

export const repository = supabase ? new GameRepository(supabase) : null;

type State = {
  loading: boolean;
  pending: boolean;
  access: AccessContext | null;
  view: GameView | null;
  userId: string | null;
  error: string | null;
};
type Change =
  | { type: 'READY'; access: AccessContext; userId: string }
  | { type: 'VIEW'; view: GameView }
  | { type: 'ERROR'; error: string }
  | { type: 'PENDING'; pending: boolean }
  | { type: 'HOME' }
  | { type: 'ACCESS_REQUIRED' }
  | { type: 'CLEAR_ERROR' };

function reducer(state: State, change: Change): State {
  switch (change.type) {
    case 'READY': return { ...state, access: change.access, userId: change.userId, loading: false, error: null };
    case 'VIEW': {
      if (state.view?.game.id === change.view.game.id && state.view.game.stateVersion > change.view.game.stateVersion) return state;
      return { ...state, view: change.view, error: null,
        access: state.access ? { ...state.access, scoreboard: change.view.scoreboard,
          activeGameId: ['ACTIVE', 'LOBBY'].includes(change.view.game.status) ? change.view.game.id : null } : state.access };
    }
    case 'ERROR': return { ...state, error: change.error, loading: false };
    case 'PENDING': return { ...state, pending: change.pending, error: change.pending ? null : state.error };
    case 'HOME': return { ...state, view: null };
    case 'ACCESS_REQUIRED': return { ...state, view: null, userId: null, access: { authorized: false } };
    case 'CLEAR_ERROR': return { ...state, error: null };
  }
}

export function useGameSession() {
  const [state, dispatch] = useReducer(reducer, {
    loading: true, pending: false, access: null, view: null, userId: null, error: null,
  });
  const viewRef = useRef(state.view);
  viewRef.current = state.view;
  const pendingRef = useRef(false);
  const bootGeneration = useRef(0);
  const boot = useCallback(async () => {
    const ticket = ++bootGeneration.current;
    if (!repository) { dispatch({ type: 'ERROR', error: ca.setupMissing }); return; }
    try {
      const userId = await repository.authenticate();
      const access = await repository.access();
      if (ticket !== bootGeneration.current) return;
      const gameId = access.activeGameId || localStorage.getItem('tp-current-game');
      if (access.authorized && gameId) {
        try {
          const view = await repository.getGameView(gameId);
          if (ticket !== bootGeneration.current) return;
          viewRef.current = view;
          dispatch({ type: 'VIEW', view });
        }
        catch { localStorage.removeItem('tp-active-game'); localStorage.removeItem('tp-current-game'); }
      }
      if (ticket === bootGeneration.current) dispatch({ type: 'READY', access, userId });
    } catch (error) { if (ticket === bootGeneration.current) dispatch({ type: 'ERROR', error: errorInCatalan(error) }); }
  }, []);

  useEffect(() => {
    void boot();
    const listener = supabase?.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        bootGeneration.current += 1;
        viewRef.current = null;
        localStorage.removeItem('tp-active-game');
        localStorage.removeItem('tp-current-game');
        dispatch({type:'ACCESS_REQUIRED'});
      }
    });
    return () => { bootGeneration.current += 1; listener?.data.subscription.unsubscribe(); };
  }, [boot]);

  const acceptView = useCallback((view: GameView) => {
    if (viewRef.current?.game.id === view.game.id && viewRef.current.game.stateVersion > view.game.stateVersion) return;
    viewRef.current = view;
    localStorage.setItem('tp-current-game', view.game.id);
    if (view.game.status === 'ACTIVE' || view.game.status === 'LOBBY') localStorage.setItem('tp-active-game', view.game.id);
    else localStorage.removeItem('tp-active-game');
    dispatch({ type: 'VIEW', view });
  }, []);

  const refresh = useCallback(async () => {
    const current = viewRef.current;
    if (!repository || !current) return;
    try {
      const next = await repository.getGameView(current.game.id);
      if (viewRef.current?.game.id === current.game.id) acceptView(next);
    } catch (error) {
      if (error instanceof Error && /DEVICE_NOT_AUTHORIZED|NOT_AUTHENTICATED/.test(error.message)) dispatch({type:'ACCESS_REQUIRED'});
      throw error;
    }
  }, [acceptView]);

  const run = useCallback(async (task: (repo: GameRepository) => Promise<GameView | void>): Promise<boolean> => {
    if (!repository || pendingRef.current) return false;
    const ticket = bootGeneration.current;
    pendingRef.current = true;
    dispatch({ type: 'PENDING', pending: true });
    try {
      const view = await task(repository);
      if (ticket !== bootGeneration.current) return false;
      if (view) acceptView(view);
      return true;
    } catch (error) {
      if (ticket !== bootGeneration.current) return false;
      if (error instanceof Error && /DEVICE_NOT_AUTHORIZED|NOT_AUTHENTICATED/.test(error.message)) dispatch({type:'ACCESS_REQUIRED'});
      if (error instanceof Error && /STALE_STATE/.test(error.message)) {
        await refresh().catch(() => undefined);
        dispatch({type:'ERROR',error:ca.versionChanged});
      } else dispatch({ type: 'ERROR', error: errorInCatalan(error) });
      return false;
    } finally {
      pendingRef.current = false;
      dispatch({ type: 'PENDING', pending: false });
    }
  }, [acceptView, refresh]);

  const verify = useCallback(async (code: string): Promise<boolean> => run(async (repo) => {
    const userId = await repo.authenticate();
    const access = await repo.verify(code);
    dispatch({ type: 'READY', userId, access });
  }), [run]);

  return {
    ...state, run, verify, acceptView, refresh, boot,
    goHome: () => { bootGeneration.current += 1; viewRef.current = null; localStorage.removeItem('tp-current-game'); dispatch({ type: 'HOME' }); },
    clearError: () => dispatch({type:'CLEAR_ERROR'}),
  };
}
