import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// NOTE: deliberately NOT wrapped in <React.StrictMode>. StrictMode
// double-invokes effects in development, so GameCanvas mounts, unmounts,
// then remounts. Phaser boots asynchronously, so the first Phaser.Game is
// destroyed while BootScene is still generating textures — the WebGL
// context gets torn down mid-render and Phaser throws "Framebuffer
// status: Incomplete Attachment", leaving an orphaned 0x0 canvas and a
// black screen. The official Phaser + React template omits StrictMode for
// this same reason.
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
