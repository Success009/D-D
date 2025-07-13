



import React, { useState, useEffect, useMemo } from 'react';
import { useIpAddress } from '../hooks/useIpAddress';
import { db } from '../services/firebase';
import type { Character, PendingPlayer, ActivePlayer, DiceRoll, SceneryEntry } from '../types';
import CharacterSheet from '../components/CharacterSheet';
import Loader from '../components/Loader';
import MapView from '../components/MapView';
import DiceRoller from '../components/DiceRoller';
import { MapIcon, UserCircleIcon, PhotoIcon } from '@heroicons/react/24/solid';


// Represents the distinct stages a player can be in.
enum PlayerStatus {
  INITIALIZING,
  PENDING_APPROVAL,
  NEEDS_BACKSTORY,
  WAITING_FOR_SHEET,
  IN_GAME,
  ERROR,
}

type PlayerView = 'game' | 'scenery';

// --- Backstory Form Component ---
interface BackstoryFormProps {
    onSave: (backstory: string) => Promise<void>;
}
const BackstoryForm: React.FC<BackstoryFormProps> = ({ onSave }) => {
    const [backstory, setBackstory] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    
    const handleSave = async () => {
        if (!backstory.trim() || isSaving) return;
        setIsSaving(true);
        await onSave(backstory.trim());
        setIsSaving(false);
    };

    return (
        <div className="bg-slate-800/80 p-8 rounded-lg border border-slate-600 max-w-2xl mx-auto w-full animate-fade-in">
            <h2 className="font-display text-3xl text-amber-400 mb-2">The Tale of Your Hero</h2>
            <p className="text-slate-300 mb-4">You have been summoned! Describe your character. Include their name, appearance, and a brief backstory. This will be sent to the Dungeon Master to forge your character sheet.</p>
            <textarea
                value={backstory}
                onChange={(e) => setBackstory(e.target.value)}
                placeholder="e.g., I am Elara, a young elven rogue with silver hair, always searching for ancient ruins and a lost family heirloom..."
                className="w-full bg-slate-900 border border-slate-500 rounded p-3 h-48 focus:ring-amber-400 focus:border-amber-400 text-parchment transition-shadow"
                disabled={isSaving}
            />
            <button
                onClick={handleSave}
                disabled={isSaving || !backstory.trim()}
                className="w-full mt-4 bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-4 rounded disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
            >
                {isSaving ? 'Sending to the DM...' : 'Save and Submit to DM'}
            </button>
        </div>
    );
};

// --- Scenery View Component ---
const SceneryView: React.FC<{ entries: SceneryEntry[] }> = ({ entries }) => {
    const latestEntry = entries[0] ?? null;

    if (!latestEntry) {
        return <div className="flex items-center justify-center h-full"><p className="text-slate-500 text-xl font-display">The world around you has not yet been described...</p></div>;
    }
    
    return (
        <div className="p-2 h-full flex items-center justify-center">
            <div key={latestEntry.timestamp} className="bg-slate-900/50 rounded-lg overflow-hidden border border-slate-700 shadow-lg animate-fade-in w-full">
                <img src={latestEntry.imageUrl} alt="AI-generated scenery" className="w-full h-auto" />
            </div>
        </div>
    );
};


const PlayerPage = () => {
  const { ipAddress: playerId, loading: ipLoading, error: ipError } = useIpAddress();
  const [status, setStatus] = useState<PlayerStatus>(PlayerStatus.INITIALIZING);
  const [character, setCharacter] = useState<Character | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [diceRoll, setDiceRoll] = useState<DiceRoll | null>(null);
  const [scenery, setScenery] = useState<SceneryEntry[]>([]);
  const [activeView, setActiveView] = useState<PlayerView>('game');

  const sanitizedPlayerId = useMemo(() => playerId?.replace(/[.#$[\]]/g, '_'), [playerId]);

  // This effect manages the core player lifecycle, ensuring persistence.
  useEffect(() => {
    if (ipLoading) {
      setStatus(PlayerStatus.INITIALIZING);
      return;
    }
    
    if (ipError || !sanitizedPlayerId || !playerId) {
      setErrorMessage(ipError || "Could not establish a persistent player connection.");
      setStatus(PlayerStatus.ERROR);
      return;
    }

    const activePlayerRef = db.ref(`DND/active_players/${sanitizedPlayerId}`);
    const pendingPlayerRef = db.ref(`DND/pending_players/${sanitizedPlayerId}`);
    
    let pendingListener: any = null;

    const activeListener = activePlayerRef.on('value', (activeSnapshot) => {
      if (activeSnapshot.exists()) {
        if (pendingListener) {
            pendingPlayerRef.off('value', pendingListener);
        }
        
        const data: ActivePlayer = activeSnapshot.val();
        setCharacter(data.character_data);
        setStatus(PlayerStatus.IN_GAME);
      } else {
        setCharacter(null);
        if (pendingListener) return;

        pendingListener = pendingPlayerRef.on('value', (pendingSnapshot) => {
          if (pendingSnapshot.exists()) {
            const data: PendingPlayer = pendingSnapshot.val();
            if (data.backstory) {
              setStatus(PlayerStatus.WAITING_FOR_SHEET);
            } else if (data.accepted) {
              setStatus(PlayerStatus.NEEDS_BACKSTORY);
            } else {
              setStatus(PlayerStatus.PENDING_APPROVAL);
            }
          } else {
            pendingPlayerRef.set({ ip: playerId, accepted: false });
            setStatus(PlayerStatus.PENDING_APPROVAL);
          }
        });
      }
    });

    return () => {
      activePlayerRef.off('value', activeListener);
      if (pendingListener) {
        pendingPlayerRef.off('value', pendingListener);
      }
    };
  }, [sanitizedPlayerId, playerId, ipLoading, ipError]);

  // This effect listens for shared game state once the player is in the game.
  useEffect(() => {
    if (status !== PlayerStatus.IN_GAME) return;

    const diceRollRef = db.ref('DND/game_state/dice_roll');
    const sceneryRef = db.ref('DND/game_state/scenery');

    const diceRollListener = diceRollRef.on('value', snapshot => {
        setDiceRoll(snapshot.val());
    });
    
    const sceneryListener = sceneryRef.on('value', snapshot => {
        const data: SceneryEntry | null = snapshot.val();
        if (data) {
            setScenery([data]);
        } else {
            setScenery([]);
        }
    });

    return () => {
        diceRollRef.off('value', diceRollListener);
        sceneryRef.off('value', sceneryListener);
    };
  }, [status]);

  const handleBackstorySave = async (backstory: string) => {
    if (!sanitizedPlayerId) return;
    try {
        await db.ref(`DND/pending_players/${sanitizedPlayerId}`).update({ backstory });
    } catch (error) {
        console.error("Failed to save backstory:", error);
        setErrorMessage("Could not save your story. Please try again.");
        setStatus(PlayerStatus.ERROR);
    }
  };
  
  const handlePlayerRoll = () => {
    if (!character || !sanitizedPlayerId || diceRoll?.permissionHolder !== sanitizedPlayerId || diceRoll?.isRolling) return;

    const diceRollRef = db.ref('DND/game_state/dice_roll');
    const newRoll = {
        isRolling: true,
        rollerName: character.name,
        timestamp: Date.now(),
        result: null,
        permissionHolder: null // Consume permission
    };
    diceRollRef.set(newRoll);

    setTimeout(() => {
        const result = Math.floor(Math.random() * 20) + 1;
        diceRollRef.update({ isRolling: false, result });
    }, 2000);
  };

  const renderContent = () => {
    switch (status) {
      case PlayerStatus.INITIALIZING:
        return <Loader message="Connecting to the realm..." />;
      case PlayerStatus.PENDING_APPROVAL:
        return <Loader message="Awaiting summons from the Dungeon Master..." />;
      case PlayerStatus.NEEDS_BACKSTORY:
        return <BackstoryForm onSave={handleBackstorySave} />;
      case PlayerStatus.WAITING_FOR_SHEET:
        return <Loader message="The DM is forging your character sheet from your tale..." />;
      case PlayerStatus.IN_GAME:
        if (!character || !sanitizedPlayerId) return <Loader message="Loading Character..." />;

        const VIEW_TABS: { id: PlayerView, label: string, Icon: React.FC<React.ComponentProps<'svg'>> }[] = [
            { id: 'game', label: 'Game', Icon: MapIcon },
            { id: 'scenery', label: 'Scenery', Icon: PhotoIcon },
        ];
        
        return (
            <div className="p-4 h-full w-full flex flex-col gap-4">
                <div className="flex-shrink-0 flex justify-center space-x-2">
                    {VIEW_TABS.map(({ id, label, Icon }) => (
                        <button
                            key={id}
                            onClick={() => setActiveView(id)}
                            className={`flex items-center justify-center gap-2 px-6 py-2 text-sm font-bold rounded-full transition-colors w-40 ${activeView === id ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                        >
                            <Icon className="h-5 w-5" />
                            <span>{label}</span>
                        </button>
                    ))}
                </div>

                <div className="flex-grow h-0">
                    {activeView === 'game' ? (
                        <div className="flex gap-4 h-full">
                            <div className="w-2/3 h-full rounded-lg overflow-hidden">
                                <MapView characterId={sanitizedPlayerId} />
                            </div>
                            <div className="w-1/3 h-full flex flex-col gap-4">
                                <div className="flex-grow h-0 bg-slate-800/80 rounded-lg border border-slate-600 overflow-y-auto custom-scrollbar">
                                    <div className="p-2">
                                        <CharacterSheet character={character} />
                                    </div>
                                </div>
                                <div className="flex-shrink-0">
                                    <DiceRoller 
                                        diceRoll={diceRoll}
                                        canRoll={diceRoll?.permissionHolder === sanitizedPlayerId}
                                        onRoll={handlePlayerRoll}
                                     />
                                </div>
                            </div>
                        </div>
                    ) : (
                         <div className="h-full bg-slate-800/80 rounded-lg border border-slate-600">
                            <SceneryView entries={scenery} />
                         </div>
                    )}
                </div>
            </div>
        );
      case PlayerStatus.ERROR:
        return <div className="text-center text-red-400 bg-slate-800 p-8 rounded-lg">{errorMessage || "An unknown error occurred."}</div>;
      default:
        return <Loader message="Loading..." />;
    }
  };

  const containerClasses = status === PlayerStatus.IN_GAME
      ? "w-screen h-screen animate-fade-in"
      : "container mx-auto p-4 min-h-screen flex items-center justify-center";

  return <div className={containerClasses}>{renderContent()}</div>;
};

export default PlayerPage;