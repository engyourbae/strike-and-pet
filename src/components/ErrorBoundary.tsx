import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { failed: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Hanya jenis error & komponen; tidak mencatat data pengguna.
    console.error('UI error:', error.name, info.componentStack?.split('\n')[1]?.trim());
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="center-page">
        <div className="center-card">
          <h1>Ada yang tidak beres</h1>
          <p>Aplikasi mengalami kesalahan. Muat ulang halaman untuk melanjutkan.</p>
          <button className="btn btn--primary" onClick={() => window.location.reload()}>Muat ulang</button>
        </div>
      </div>
    );
  }
}
