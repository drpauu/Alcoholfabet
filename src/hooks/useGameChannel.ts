import { useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase';

export type Connection = 'connecting' | 'connected' | 'reconnecting';

export function useGameChannel(gameId: string | null, userId: string | null, role: string | null, refresh: () => Promise<void>, stateVersion: number) {
  const [connection, setConnection] = useState<Connection>('connected');
  const [presentRoles, setPresentRoles] = useState<string[]>([]);
  const refreshRef = useRef(refresh);
  const versionRef = useRef(stateVersion);
  const connectedGameRef = useRef<string | null>(null);
  refreshRef.current = refresh;
  versionRef.current = stateVersion;

  useEffect(() => {
    if (!gameId || !userId || !supabase) { setConnection('connected'); return; }
    const client = supabase;
    let disposed = false;
    let synchronizing = false;
    let resync = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let channel: ReturnType<typeof client.channel> | null = null;
    let generation = 0;

    const sync = async () => {
      if (synchronizing) { resync = true; return; }
      synchronizing = true;
      try {
        do {
          resync = false;
          await refreshRef.current();
        } while (resync && !disposed);
      } finally { synchronizing = false; }
    };

    const subscribe = async () => {
      if (disposed || !navigator.onLine) return;
      const ticket = ++generation;
      if (channel) await client.removeChannel(channel);
      await client.realtime.setAuth();
      if (disposed || ticket !== generation) return;
      channel = client.channel(`game:${gameId}`, {
        config: { private: true, broadcast: { self: false }, presence: { key: userId } },
      });
      channel.on('broadcast', { event: 'game_updated' }, ({payload}) => {
        if (disposed || ticket !== generation) return;
        if (typeof payload.stateVersion === 'number' && payload.stateVersion <= versionRef.current) return;
        void sync().catch(schedule);
      });
      channel.on('presence', { event: 'sync' }, () => {
        if (disposed || ticket !== generation || !channel) return;
        const entries = Object.values(channel.presenceState<{ role?: string }>()).flat();
        setPresentRoles(entries.flatMap((entry) => typeof entry.role === 'string' ? [entry.role] : []));
      });
      channel.subscribe(async (status) => {
        if (disposed || ticket !== generation) return;
        if (status === 'SUBSCRIBED') {
          if (retry) { clearTimeout(retry); retry = undefined; }
          try {
            await channel?.track({ userId, role, onlineAt: new Date().toISOString() });
            await sync();
            if (!disposed && ticket === generation) {
              connectedGameRef.current = gameId;
              setConnection('connected');
            }
          } catch { schedule(); }
        } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) schedule();
      });
    };
    const schedule = () => {
      if (disposed) return;
      setConnection('reconnecting');
      if (!retry) retry = setTimeout(() => { retry = undefined; void subscribe().catch(schedule); }, 1500);
    };
    const offline = () => { setConnection('reconnecting'); };
    const online = () => { setConnection('reconnecting'); void subscribe().catch(schedule); };
    const focus = () => { if (navigator.onLine) void sync().catch(schedule); };
    setConnection('connecting');
    void subscribe().catch(schedule);
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    window.addEventListener('focus', focus);
    const { data: authListener } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' && session) void client.realtime.setAuth(session.access_token);
    });
    return () => {
      disposed = true;
      generation += 1;
      if (retry) clearTimeout(retry);
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
      window.removeEventListener('focus', focus);
      authListener.subscription.unsubscribe();
      if (channel) void client.removeChannel(channel);
    };
  }, [gameId, userId, role]);
  const currentConnection = gameId && connectedGameRef.current !== gameId
    ? connection === 'reconnecting' ? 'reconnecting' : 'connecting'
    : connection;
  return { connection: currentConnection, presentRoles };
}
