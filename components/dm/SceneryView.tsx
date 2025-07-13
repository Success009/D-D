import React from 'react';
import type { SceneryEntry } from '../../types';

interface SceneryViewProps {
    entries: SceneryEntry[];
}

const SceneryView: React.FC<SceneryViewProps> = ({ entries }) => {
    const latestEntry = entries[0] ?? null;

    if (!latestEntry) {
        return <div className="flex items-center justify-center h-full"><p className="text-slate-500 text-xl font-display">No scenery has been generated yet.</p></div>;
    }
    
    return (
        <div className="p-4 h-full flex items-center justify-center">
            <div key={latestEntry.timestamp} className="bg-slate-900/50 rounded-lg overflow-hidden border border-slate-700 shadow-lg animate-fade-in w-full">
                <img src={latestEntry.imageUrl} alt="AI-generated scenery" className="w-full h-auto" />
            </div>
        </div>
    );
};

export default SceneryView;
