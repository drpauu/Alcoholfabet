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
