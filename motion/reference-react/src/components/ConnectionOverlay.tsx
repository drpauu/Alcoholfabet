type Props = { status: 'connected' | 'reconnecting' | 'restored' };

export function ConnectionOverlay({ status }: Props) {
  if (status === 'connected') return null;
  return (
    <div className={`tp-connection-overlay tp-connection-overlay--${status}`} role="status" aria-live="polite">
      <div className="tp-connection-card">
        <span className="tp-connection-icon" aria-hidden>{status === 'restored' ? '✓' : '⌁'}</span>
        <strong>{status === 'restored' ? "T'has tornat a connectar" : "S'ha perdut la connexió"}</strong>
        <span>{status === 'restored' ? 'La partida continua.' : "S'està reconnectant…"}</span>
      </div>
    </div>
  );
}
