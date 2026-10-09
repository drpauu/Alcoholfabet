import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameAudioManager } from '../../src/motion/audio';

afterEach(() => { vi.unstubAllGlobals(); });

function browserAudio() {
  const start = vi.fn();
  const stop = vi.fn();
  const source = { buffer: null, onended: null, start, stop, disconnect: vi.fn(), connect: vi.fn() };
  const gain = { gain: { value: 1 }, disconnect: vi.fn(), connect: vi.fn() };
  source.connect.mockReturnValue(gain);
  const context = { state: 'running', destination: {}, resume: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined), decodeAudioData: vi.fn().mockResolvedValue({ duration: .2 }), createBufferSource: vi.fn(() => source), createGain: vi.fn(() => gain) };
  const construct = vi.fn(function () { return context; });
  const fetch = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
  const setItem = vi.fn();
  vi.stubGlobal('AudioContext', construct);
  vi.stubGlobal('fetch', fetch);
  vi.stubGlobal('localStorage', { getItem: () => 'on', setItem });
  return { construct, fetch, start, stop, setItem, context, gain };
}

describe('game audio lifecycle', () => {
  it('creates and loads audio only after an explicit interaction', async () => {
    const browser = browserAudio();
    const manager = new GameAudioManager();
    expect(browser.construct).not.toHaveBeenCalled();
    expect(browser.fetch).not.toHaveBeenCalled();
    await manager.play('CORRECT', 'before-interaction');
    expect(browser.start).not.toHaveBeenCalled();
    manager.unlock();
    await manager.play('CORRECT', 'confirmed-2');
    expect(browser.construct).toHaveBeenCalledTimes(1);
    expect(browser.fetch).toHaveBeenCalledTimes(10);
    expect(browser.start).toHaveBeenCalledTimes(1);
    expect(browser.gain.gain.value).toBe(.52);
  });

  it('deduplicates a confirmed cue while preserving distinct pawn landings', async () => {
    const browser = browserAudio();
    const manager = new GameAudioManager(); manager.unlock();
    await manager.play('PAWN_STEP', 'game-2:version-8:cell-3');
    await manager.play('PAWN_STEP', 'game-2:version-8:cell-3');
    await manager.play('PAWN_STEP', 'game-2:version-8:cell-4');
    expect(browser.start).toHaveBeenCalledTimes(2);
    const controller = new AbortController(); controller.abort();
    await manager.play('VICTORY', 'cancelled', controller.signal);
    expect(browser.start).toHaveBeenCalledTimes(2);
  });

  it('persists mute and stops active effects immediately', async () => {
    const browser = browserAudio();
    const manager = new GameAudioManager(); manager.unlock();
    await manager.play('VICTORY', 'game:final');
    expect(manager.toggle()).toBe(false);
    expect(browser.setItem).toHaveBeenCalledWith('tp:sound', 'off');
    expect(browser.stop).toHaveBeenCalledTimes(1);
    await manager.play('DRINK', 'muted');
    expect(browser.start).toHaveBeenCalledTimes(1);
  });
});
