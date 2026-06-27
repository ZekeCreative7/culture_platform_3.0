import React from 'react';
import { createRoot } from 'react-dom/client';

// React app entrypoint placeholder. The real App component will be wired in step 1.
function App() {
  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>Culture Platform 3.0 - React entrypoint ready</h1>
      <p>Step 0 complete. Start step 1 for state migration.</p>
    </div>
  );
}

const container = document.getElementById('react-root');
if (container) {
  createRoot(container).render(<App />);
}
