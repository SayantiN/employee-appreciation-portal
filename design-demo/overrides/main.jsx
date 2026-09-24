import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { bootDemo } from './demo-server/app.js';
import { DemoPanel } from './demo/DemoPanel.jsx';
import './styles/global.scss';

const root = createRoot(document.getElementById('root'));
root.render(<div className="demo-boot">Loading the design demo…</div>);

// The in-browser database must exist before the first screen asks for data.
bootDemo()
  .then(() => root.render(
    <React.StrictMode>
      <App />
      <DemoPanel />
    </React.StrictMode>
  ))
  .catch((e) => {
    console.error(e);
    root.render(<div className="demo-boot">The demo could not start in this browser. Try a current Chrome, Edge, Firefox or Safari.</div>);
  });
