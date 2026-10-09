import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'error';

export function usePrivateGameChannel(
  supabase: SupabaseClient,
  gameId: string | null,
  userId: string | null,
  onGameUpdated: (payload: { gameId: string; stateVersion: number; eventType: string }) => void,
) {
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const channelRef = useRef<RealtimeChannel | null>(null);
  const callbackRef = useRef(onGameUpdated);
  callbackRef.current = onGameUpdated;

  useEffect(() => {
    if (!gameId || !userId) return;
    let disposed = false;

    const connect = async () => {
      setConnection((current) => current === 'connected' ? 'reconnecting' : 'connecting');
      await supabase.realtime.setAuth();
      const channel = supabase.channel(`game:${gameId}`, {
        config: {
          private: true,
          presence: { key: userId },
          broadcast: { self: false, ack: true },
        },
      });
      channelRef.current = channel;

      channel
        .on('broadcast', { event: 'game_updated' }, ({ payload }) => {
          if (!disposed) callbackRef.current(payload as { gameId: string; stateVersion: number; eventType: string });
        })
        .on('presence', { event: 'sync' }, () => undefined)
        .subscribe(async (status) => {
          if (disposed) return;
          if (status === 'SUBSCRIBED') {
            setConnection('connected');
            await channel.track({ userId, onlineAt: new Date().toISOString() });
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setConnection('error');
          } else if (status === 'CLOSED') {
            setConnection('reconnecting');
          }
        });
    };

    void connect();
    return () => {
      disposed = true;
      const channel = channelRef.current;
      channelRef.current = null;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [supabase, gameId, userId]);

  return { connection, channel: channelRef.current };
}
