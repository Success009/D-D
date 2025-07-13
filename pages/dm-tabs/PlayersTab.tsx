import React from 'react';
import type { ActivePlayer, PendingPlayer } from '../../types';
import PlayerManager from '../../components/PlayerManager';

interface PlayersTabProps {
    allPlayers: (PendingPlayer | ActivePlayer)[];
}

const PlayersTab: React.FC<PlayersTabProps> = ({ allPlayers }) => {
    return (
        <div className="bg-slate-800/80 p-4 rounded-lg border border-slate-600">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[85vh] overflow-y-auto pr-2 custom-scrollbar">
                {allPlayers.length > 0 ? allPlayers.map(p => <PlayerManager key={'ip' in p ? p.ip : p.id} player={p} />) : <p className="text-slate-400 text-center col-span-full">No players awaiting adventure.</p>}
            </div>
        </div>
    );
};

export default PlayersTab;
