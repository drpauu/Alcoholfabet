import { describe, expect, it } from 'vitest';
import { GameRepository } from '../../src/services/game-repository';
import { errorInCatalan } from '../../src/content/ca';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('la frontera RPC normalitza els errors de PostgREST',()=>{
  for (const code of ['STALE_STATE','DEVICE_NOT_AUTHORIZED']) {
    it(`${code} es pot capturar com a Error real`,async()=>{
      const client={rpc:async()=>({data:null,error:{message:code,code:'P0001',details:null,hint:null}})} as unknown as SupabaseClient;
      const repository=new GameRepository(client);
      await expect(repository.getGameView('00000000-0000-0000-0000-000000000000')).rejects.toThrow(code);
    });
  }
  it('els missatges del servidor sempre es tradueixen sense exposar SQL',()=>{
    expect(errorInCatalan({message:'DEVICE_NOT_AUTHORIZED'})).toBe('Aquest dispositiu encara no està autoritzat.');
    expect(errorInCatalan({message:'raw internal database exception'})).toBe('No hem pogut connectar amb el joc. Torna-ho a provar.');
  });
});

describe('online identity and session recovery', () => {
  it('uses the server role and rejects incorrect codes or invalid responses', async () => {
    for (const [data, expected] of [
      [{ identified: true, role: 'TECLA' }, 'TECLA'],
      [{ identified: false, error: 'INVALID_CODE' }, 'INVALID_CODE'],
      [{ identified: true, role: 'UNKNOWN' }, 'RESPONSE_INVALID'],
    ] as const) {
      const client = { rpc: async () => ({ data, error: null }) } as unknown as SupabaseClient;
      const task = new GameRepository(client).identifyOnlinePlayer('local-test-code');
      if (expected === 'TECLA') expect(await task).toBe('TECLA');
      else await expect(task).rejects.toThrow(expected);
    }
  });

  it('replaces a cached session rejected by Auth with one fresh anonymous session', async () => {
    let resets = 0, signups = 0;
    const client = { auth: {
      getSession: async () => ({ data: { session: { user: { id: 'old-user' } } }, error: null }),
      getUser: async () => ({ data: { user: null }, error: { status: 401, message: 'Invalid JWT' } }),
      signOut: async () => { resets++; return { error: null }; },
      signInAnonymously: async () => { signups++; return { data: { user: { id: 'fresh-user' } }, error: null }; },
    } } as unknown as SupabaseClient;
    const repository = new GameRepository(client);
    const results = await Promise.all([repository.authenticate(), repository.authenticate()]);
    expect(results).toEqual(['fresh-user', 'fresh-user']);
    expect(resets).toBe(1); expect(signups).toBe(1);
  });

  it('keeps an existing account when verification fails because of the network', async () => {
    let reset = false;
    const client = { auth: {
      getSession: async () => ({ data: { session: { user: { id: 'existing-user' } } }, error: null }),
      getUser: async () => ({ data: { user: null }, error: { status: 503, message: 'Network unavailable' } }),
      signOut: async () => { reset = true; return { error: null }; },
    } } as unknown as SupabaseClient;
    await expect(new GameRepository(client).authenticate()).rejects.toMatchObject({ status: 503 });
    expect(reset).toBe(false);
    expect(errorInCatalan({ status: 429, message: 'Too many requests' })).toContain('Massa intents');
  });
});
