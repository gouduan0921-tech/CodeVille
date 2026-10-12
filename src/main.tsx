import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './ui/App';

// 注意：未使用 StrictMode，避免开发环境下 Phaser 游戏实例被重复创建。
createRoot(document.getElementById('root') as HTMLElement).render(<App />);
