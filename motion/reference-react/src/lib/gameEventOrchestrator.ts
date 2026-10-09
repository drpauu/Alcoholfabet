export type ConfirmedGameEffect =
  | { type: 'QUESTION_ENTER'; stateVersion: number }
  | { type: 'ANSWER_REVEAL'; stateVersion: number }
  | { type: 'CORRECT'; stateVersion: number; from: number; to: number; plusOne: boolean }
  | { type: 'INCORRECT'; stateVersion: number; drinkCount: 1 | 2 }
  | { type: 'TP_CLAIMED'; stateVersion: number; claimant: 'PAU' | 'TECLA' }
  | { type: 'DISCONNECTED'; stateVersion: number }
  | { type: 'RECONNECTED'; stateVersion: number }
  | { type: 'VICTORY'; stateVersion: number; winner: 'PAU' | 'TECLA' };

export class GameEventOrchestrator {
  private readonly playedVersions = new Set<number>();
  private chain: Promise<void> = Promise.resolve();

  enqueue(event: ConfirmedGameEffect, runner: (event: ConfirmedGameEffect) => Promise<void>): Promise<void> {
    if (this.playedVersions.has(event.stateVersion)) return this.chain;
    this.playedVersions.add(event.stateVersion);
    this.chain = this.chain.then(() => runner(event));
    return this.chain;
  }

  markCurrentVersionAsHydrated(version: number): void {
    this.playedVersions.add(version);
  }

  clearBefore(version: number): void {
    for (const value of this.playedVersions) {
      if (value < version - 20) this.playedVersions.delete(value);
    }
  }
}
