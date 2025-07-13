
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserIcon, ShieldCheckIcon } from '@heroicons/react/24/solid';
import { isApiKeyAvailable } from '../utils/apiKey';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="text-center bg-slate-800/60 backdrop-blur-md p-8 md:p-12 rounded-xl shadow-2xl border border-slate-700">
        <h1 className="text-5xl md:text-7xl font-display text-amber-400 drop-shadow-[0_2px_2px_rgba(0,0,0,0.7)]">
          D&D Live Storyteller
        </h1>
        <p className="mt-4 text-lg md:text-xl text-slate-300 max-w-2xl mx-auto">
          An AI-powered companion for your tabletop adventures. The Dungeon Master narrates, the AI illustrates the world, and players experience the story unfold in real-time.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row justify-center items-center gap-6">
          <button
            onClick={() => navigate('/player')}
            className="group flex items-center gap-3 w-64 justify-center px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg transition-transform transform hover:scale-105"
          >
            <UserIcon className="h-6 w-6 transition-transform group-hover:rotate-[-10deg]" />
            <span>Enter as Player</span>
          </button>
          {isApiKeyAvailable && (
            <button
              onClick={() => navigate('/dm')}
              className="group flex items-center gap-3 w-64 justify-center px-6 py-4 bg-red-700 hover:bg-red-800 text-white font-bold rounded-lg shadow-lg transition-transform transform hover:scale-105"
            >
              <ShieldCheckIcon className="h-6 w-6 transition-transform group-hover:rotate-[5deg]" />
              <span>Enter as Dungeon Master</span>
            </button>
          )}
        </div>
      </div>
    </main>
  );
};

export default LandingPage;
