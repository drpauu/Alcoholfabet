import { audioCues, type AudioCue } from './choreography';

export class GameAudioManager {
  private context: AudioContext | null = null;
  private buffers = new Map<AudioCue, AudioBuffer>();
  private bytes = new Map<AudioCue, Promise<ArrayBuffer | null>>();
  private decoded = new Map<AudioCue, Promise<AudioBuffer | null>>();
  private played = new Set<string>();
  private active = new Set<AudioBufferSourceNode>();
  enabled: boolean;

  constructor() {
    try { this.enabled = localStorage.getItem('tp:sound') !== 'off'; }
    catch { this.enabled = true; }
  }

  preload(): void {
    for (const cue of Object.keys(audioCues) as AudioCue[]) {
      if (!this.bytes.has(cue)) this.bytes.set(cue, fetch(`/assets/production/sounds/${audioCues[cue].file}`).then((response) => response.ok ? response.arrayBuffer() : null).catch(() => null));
    }
  }

  /** Must be invoked directly from a pointer or keyboard interaction. */
  unlock(): void {
    if (typeof AudioContext === 'undefined') return;
    this.context ??= new AudioContext();
    void this.context.resume().catch(() => undefined);
    this.preload();
    for (const cue of Object.keys(audioCues) as AudioCue[]) void this.decode(cue);
  }

  private decode(cue: AudioCue): Promise<AudioBuffer | null> {
    const existing = this.decoded.get(cue);
    if (existing) return existing;
    const context = this.context;
    if (!context) return Promise.resolve(null);
    const promise = (this.bytes.get(cue) ?? Promise.resolve(null)).then(async (bytes) => {
      if (!bytes || context.state === 'closed') return null;
      const buffer = await context.decodeAudioData(bytes.slice(0)).catch(() => null);
      if (buffer) this.buffers.set(cue, buffer);
      return buffer;
    });
    this.decoded.set(cue, promise);
    return promise;
  }

  async play(cue: AudioCue, eventKey: string, signal?: AbortSignal): Promise<void> {
    const key = `${eventKey}:${cue}`;
    if (this.played.has(key)) return;
    this.played.add(key);
    if (this.played.size > 500) this.played.delete(this.played.values().next().value as string);
    if (!this.enabled || !this.context || this.context.state !== 'running' || signal?.aborted) return;
    const buffer = this.buffers.get(cue) ?? await this.decode(cue);
    if (!buffer || signal?.aborted || !this.enabled || this.context.state !== 'running') return;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    gain.gain.value = audioCues[cue].volume;
    source.buffer = buffer;
    source.connect(gain).connect(this.context.destination);
    this.active.add(source);
    source.onended = () => { this.active.delete(source); source.disconnect(); gain.disconnect(); };
    source.start();
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    try { localStorage.setItem('tp:sound', this.enabled ? 'on' : 'off'); } catch { /* Storage can be unavailable in private mode. */ }
    if (!this.enabled) this.stop();
    return this.enabled;
  }

  stop(): void {
    for (const source of this.active) { try { source.stop(); } catch { /* Already ended. */ } }
    this.active.clear();
  }

  dispose(): void { this.stop(); void this.context?.close().catch(() => undefined); this.context = null; }
}
