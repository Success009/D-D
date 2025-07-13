
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db, storage } from '../services/firebase';
import type { PendingPlayer, ActivePlayer, NPC, MapData, DiceRoll, SceneryEntry, Character } from '../types';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { executeDMAssistantCommand, generatePixelArtAvatar } from '../services/gemini';
import { isApiKeyAvailable } from '../utils/apiKey';

import StoryTab from './dm-tabs/StoryTab';
import ActionsTab from './dm-tabs/ActionsTab';
import PlayersTab from './dm-tabs/PlayersTab';
import NpcManager from '../components/NpcManager';
import MapManager from '../components/MapManager';

import { MapIcon, UserGroupIcon, BookOpenIcon, UsersIcon, BoltIcon } from '@heroicons/react/24/solid';

type DMTab = 'story' | 'actions' | 'players' | 'npcs' | 'map';

const DMPage = () => {
    const [allPlayers, setAllPlayers] = useState<(PendingPlayer | ActivePlayer)[]>([]);
    const [npcs, setNpcs] = useState<NPC[]>([]);
    const [activeTab, setActiveTab] = useState<DMTab>('story');
    const [allMaps, setAllMaps] = useState<MapData[]>([]);
    const [activeMapId, setActiveMapId] = useState<string | null>(null);
    const [diceRoll, setDiceRoll] = useState<DiceRoll | null>(null);
    const [scenery, setScenery] = useState<SceneryEntry[]>([]);
    
    // --- Assistant State & Logic ---
    const {
        isListening: isAssistantListening,
        finalTranscript: assistantTranscript,
        interimTranscript: assistantInterimTranscript,
        startListening: startAssistantListening,
        stopListening: stopAssistantListening,
        setFinalTranscript: setAssistantTranscript,
        hasRecognitionSupport: hasAssistantRecognitionSupport,
    } = useSpeechRecognition();

    const [assistantCommand, setAssistantCommand] = useState('');
    const [isAssistantProcessing, setIsAssistantProcessing] = useState(false);
    const [assistantError, setAssistantError] = useState<string | null>(null);
    const [assistantSuccess, setAssistantSuccess] = useState<string | null>(null);
    
    // --- Memoized Derived State ---
    const activePlayers = useMemo(() => allPlayers.filter((p): p is ActivePlayer => 'character_data' in p), [allPlayers]);
    const activeMap = useMemo(() => allMaps.find(m => m.id === activeMapId) || null, [allMaps, activeMapId]);

    const visibleNpcs = useMemo(() => {
        if (!activeMap || !activeMap.tokens || !npcs) return [];
        
        const visibleNpcIds = Object.entries(activeMap.tokens)
            .filter(([id, tokenData]) => {
                const isVisible = tokenData.visible;
                const isNpc = npcs.some(n => n.id === id);
                return isVisible && isNpc;
            })
            .map(([id]) => id);
        
        return npcs.filter(n => visibleNpcIds.includes(n.id));
    }, [npcs, activeMap]);
    
    // --- Data Fetching Effect ---
    useEffect(() => {
        const pendingRef = db.ref('DND/pending_players');
        const activeRef = db.ref('DND/active_players');
        const npcsRef = db.ref('DND/npcs');
        const mapsRef = db.ref('DND/maps');
        const gameStateRef = db.ref('DND/game_state');

        const updateCombinedPlayers = (pendingData: any, activeData: any) => {
            const combinedList = [
                ...Object.values(pendingData || {}),
                ...Object.values(activeData || {})
            ].filter((p: any): p is (PendingPlayer | ActivePlayer) => p && (p.id || p.ip));
            setAllPlayers(combinedList);
        };

        let currentPending: any = {};
        let currentActive: any = {};

        const pendingListener = pendingRef.on('value', snapshot => {
            currentPending = snapshot.val() || {};
            updateCombinedPlayers(currentPending, currentActive);
        });

        const activeListener = activeRef.on('value', snapshot => {
            currentActive = snapshot.val() || {};
            updateCombinedPlayers(currentPending, currentActive);
        });
        
        const npcsListener = npcsRef.on('value', snapshot => {
            const npcsData = snapshot.val() || {};
            const npcList: NPC[] = Object.entries(npcsData).map(([id, data]) => ({ id, ...(data as any) }));
            setNpcs(npcList);
        });
        
        const mapsListener = mapsRef.on('value', snapshot => {
            const mapsData = snapshot.val() || {};
            const mapsList: MapData[] = Object.entries(mapsData).map(([id, data]) => ({ id, ...(data as any) }));
            setAllMaps(mapsList);
        });
        
        const gameStateListener = gameStateRef.on('value', snapshot => {
            const state = snapshot.val() || {};
            setDiceRoll(state.dice_roll || null);
            setActiveMapId(state.activeMapId || null);
            if (state.scenery) {
                setScenery([state.scenery]);
            } else {
                setScenery([]);
            }
        });

        return () => {
            pendingRef.off('value', pendingListener);
            activeRef.off('value', activeListener);
            npcsRef.off('value', npcsListener);
            mapsRef.off('value', mapsListener);
            gameStateRef.off('value', gameStateListener);
        };
    }, []);
    
    // --- Assistant Command Handling ---
    useEffect(() => {
        if (assistantTranscript) {
            setAssistantCommand(prev => (prev ? prev + ' ' : '') + assistantTranscript.trim());
            setAssistantTranscript('');
        }
    }, [assistantTranscript, setAssistantTranscript]);

    const handleAssistantSubmit = async () => {
        if (!assistantCommand.trim() || isAssistantProcessing || !isApiKeyAvailable) {
            if (!isApiKeyAvailable) setAssistantError("AI Assistant is disabled. API key is not configured.");
            return;
        }

        setIsAssistantProcessing(true);
        setAssistantError(null);
        setAssistantSuccess(null);

        try {
            const responseJson = await executeDMAssistantCommand(assistantCommand, activePlayers, visibleNpcs);
            const results: any[] = JSON.parse(responseJson);

            if (!Array.isArray(results) || results.length === 0) {
                setAssistantError("The command didn't result in any changes.");
                setIsAssistantProcessing(false);
                return;
            }

            const batchUpdates: { [key: string]: any } = {};
            const successfulUpdateMessages: string[] = [];
            const allCharacters = [...activePlayers, ...visibleNpcs];

            for (const result of results) {
                const { playerName, avatarRefinement, ...updates } = result;
                const entityToUpdate = allCharacters.find(c => c.character_data.name === playerName);
                if (!entityToUpdate) continue;
                
                const isPlayer = 'ip' in entityToUpdate || activePlayers.some(p => p.id === entityToUpdate.id);
                const sanitizedId = entityToUpdate.id.replace(/[.#$[\]]/g, '_');
                const basePath = isPlayer ? `DND/active_players/${sanitizedId}/character_data` : `DND/npcs/${sanitizedId}/character_data`;

                if (avatarRefinement) {
                    const base64Data = await generatePixelArtAvatar(entityToUpdate.character_data, avatarRefinement);
                    const imageBlob = await (await fetch(`data:image/png;base64,${base64Data}`)).blob();
                    const storageRef = storage.ref(`DND/avatars/${sanitizedId}`);
                    const snapshot = await storageRef.put(imageBlob);
                    const downloadURL = await snapshot.ref.getDownloadURL();
                    batchUpdates[`${basePath}/avatarUrl`] = downloadURL;
                    successfulUpdateMessages.push(`Refined ${playerName}'s avatar`);
                }

                Object.entries(updates).forEach(([key, value]) => {
                    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                        Object.entries(value).forEach(([subKey, subValue]) => {
                           batchUpdates[`${basePath}/${key}/${subKey}`] = subValue;
                        });
                    } else {
                        batchUpdates[`${basePath}/${key}`] = value;
                    }
                });
                
                if (Object.keys(updates).length > 0) successfulUpdateMessages.push(`Updated ${playerName}`);
            }

            if (Object.keys(batchUpdates).length > 0) {
                await db.ref().update(batchUpdates);
                setAssistantSuccess([...new Set(successfulUpdateMessages)].join('. ') + '.');
            } else {
                setAssistantError("The command didn't result in any changes.");
            }
            setAssistantCommand("");
        } catch (e: any) {
            setAssistantError(e.message.replace(/[.#$[\]]/g, '_'));
        } finally {
            setIsAssistantProcessing(false);
        }
    };
    
    // --- Dice Roll Handling ---
    const handleRoll = (rollerName: string) => {
        const diceRollRef = db.ref('DND/game_state/dice_roll');
        diceRollRef.set({ isRolling: true, rollerName, timestamp: Date.now(), result: null, permissionHolder: null });
        setTimeout(() => diceRollRef.update({ isRolling: false, result: Math.floor(Math.random() * 20) + 1 }), 2000);
    };

    const handleGrantRoll = (playerId: string) => {
        db.ref('DND/game_state/dice_roll/permissionHolder').set(playerId);
    };
    
    const TABS: { id: DMTab, label: string, Icon: React.FC<React.ComponentProps<'svg'>> }[] = [
        { id: 'story', label: 'Story', Icon: BookOpenIcon },
        { id: 'actions', label: 'Actions', Icon: BoltIcon },
        { id: 'players', label: 'Players', Icon: UserGroupIcon },
        { id: 'npcs', label: 'NPCs', Icon: UsersIcon },
        { id: 'map', label: 'Map', Icon: MapIcon },
    ];

    return (
        <div className="container mx-auto p-4">
            <h1 className="font-display text-4xl text-amber-400 text-center mb-6">Dungeon Master's Screen</h1>
            
            <div className="flex space-x-2 border-b border-slate-700 mb-4">
                 {TABS.map(({ id, label, Icon }) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-t-lg border-b-2 transition-colors ${activeTab === id ? 'bg-slate-800/80 border-amber-400 text-amber-300' : 'border-transparent text-slate-400 hover:bg-slate-700/50'}`}
                    >
                        <Icon className="h-5 w-5" />
                        <span className="capitalize">{label}</span>
                    </button>
                 ))}
            </div>
            
            <div className="animate-fade-in">
                {activeTab === 'story' && <StoryTab players={activePlayers} npcs={npcs} scenery={scenery} />}
                
                {activeTab === 'actions' && (
                    <ActionsTab
                        assistantProps={{
                            command: assistantCommand,
                            setCommand: setAssistantCommand,
                            isProcessing: isAssistantProcessing,
                            error: assistantError,
                            success: assistantSuccess,
                            handleSubmit: handleAssistantSubmit,
                        }}
                        speechProps={{
                            isListening: isAssistantListening,
                            interimTranscript: assistantInterimTranscript,
                            startListening: startAssistantListening,
                            stopListening: stopAssistantListening,
                            hasRecognitionSupport: hasAssistantRecognitionSupport
                        }}
                        diceRollProps={{
                            diceRoll,
                            onRoll: handleRoll,
                            onGrantRoll: handleGrantRoll,
                        }}
                        activePlayers={activePlayers}
                        visibleNpcs={visibleNpcs}
                    />
                )}

                {activeTab === 'players' && <PlayersTab allPlayers={allPlayers} />}
                
                {activeTab === 'npcs' && <NpcManager />}
                
                {activeTab === 'map' && <MapManager allMaps={allMaps} activeMap={activeMap} activePlayers={activePlayers} npcs={npcs} />}
            </div>
        </div>
    );
};

export default DMPage;
