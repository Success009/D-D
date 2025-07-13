import React from 'react';
import type { ActivePlayer, NPC, SceneryEntry } from '../../types';
import PaginatedStorybook from '../../components/dm/PaginatedStorybook';
import SceneryView from '../../components/dm/SceneryView';

interface StoryTabProps {
    players: ActivePlayer[];
    npcs: NPC[];
    scenery: SceneryEntry[];
}

const StoryTab: React.FC<StoryTabProps> = ({ players, npcs, scenery }) => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-[85vh] flex flex-col">
                <PaginatedStorybook players={players} npcs={npcs} />
            </div>
            <div className="bg-slate-800/80 rounded-lg border border-slate-600 h-[85vh] flex flex-col">
                <h2 className="font-display text-2xl text-amber-300 p-4 border-b border-slate-700 flex-shrink-0">Live Scenery</h2>
                <div className="flex-grow">
                    <SceneryView entries={scenery} />
                </div>
            </div>
      </div>
    );
};

export default StoryTab;
