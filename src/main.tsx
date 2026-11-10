import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { useStore } from './store/useStore';
import './styles.css';

// Exposed for automated end-to-end tests (Playwright) and debugging.
import { testHooks, cameraHooks } from './three/testHooks';
(window as unknown as { __av: unknown }).__av = { useStore, ...testHooks, ...cameraHooks };
createRoot(document.getElementById('root')!).render(<App />);
