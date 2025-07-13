
import React from 'react';
import { HashRouter, Routes, Route, Link } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import PlayerPage from './pages/PlayerPage';
import DMPage from './pages/DMPage';

function App() {
  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-fixed" 
      style={{backgroundImage: "url('https://picsum.photos/seed/dndbg/1920/1080')"}}
    >
      <div className="min-h-screen bg-slate-900/70 backdrop-blur-sm">
        <HashRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/player" element={<PlayerPage />} />
            <Route path="/dm" element={<DMPage />} />
            <Route path="*" element={
              <div className="flex flex-col items-center justify-center h-screen">
                <h1 className="text-4xl font-display text-amber-400">404 - Page Not Found</h1>
                <Link to="/" className="mt-4 px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-lg transition-transform transform hover:scale-105">Return to Campfire</Link>
              </div>
            } />
          </Routes>
        </HashRouter>
      </div>
    </div>
  );
}

export default App;
