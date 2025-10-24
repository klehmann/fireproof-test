import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

function AppWrapper() {
  // Initialize from localStorage, default to true (online)
  const [useCloud, setUseCloud] = useState(() => {
    const saved = localStorage.getItem('fireproof-useCloud');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Log initial state
  console.log(`🚀 Initial mode loaded: ${useCloud ? 'Online' : 'Offline'} (from localStorage)`);

  const toggleMode = () => {
    const newMode = !useCloud;
    setUseCloud(newMode);
    // Persist to localStorage
    localStorage.setItem('fireproof-useCloud', JSON.stringify(newMode));
    console.log(`🔄 Mode switched to: ${newMode ? 'Online' : 'Offline'}`);
  };

  return (
    <StrictMode>
      <div style={{ position: 'relative' }}>
        {/* Online/Offline Toggle */}
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 1000,
          backgroundColor: '#f0f0f0',
          border: '2px solid #ccc',
          borderRadius: '8px',
          padding: '8px 16px',
          cursor: 'pointer',
          userSelect: 'none',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          transition: 'all 0.2s ease'
        }}
        onClick={toggleMode}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#e0e0e0';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#f0f0f0';
        }}>
          <span style={{
            color: useCloud ? '#28a745' : '#dc3545',
            fontWeight: 'bold',
            fontSize: '14px'
          }}>
            {useCloud ? '🟢 Online' : '🔴 Offline'}
            <span style={{ fontSize: '10px', marginLeft: '4px', opacity: 0.7 }}>
              💾
            </span>
          </span>
        </div>
        
        <App key={useCloud ? 'online' : 'offline'} useCloud={useCloud} />
      </div>
    </StrictMode>
  );
}

createRoot(document.getElementById('root')!).render(<AppWrapper />)
