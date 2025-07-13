
import React, { useState, useEffect } from 'react';
import { db, storage } from '../services/firebase';
import { createNpcFromDescription, generatePixelArtAvatar } from '../services/gemini';
import type { NPC, Character } from '../types';
import CharacterSheet from './CharacterSheet';
import Loader from './Loader';
import { SparklesIcon, TrashIcon } from '@heroicons/react/24/solid';
import { isApiKeyAvailable } from '../utils/apiKey';

const NpcManager: React.FC = () => {
    const [npcs, setNpcs] = useState<NPC[]>([]);
    const [description, setDescription] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const npcsRef = db.ref('DND/npcs');

    useEffect(() => {
        const listener = npcsRef.on('value', snapshot => {
            const data = snapshot.val() || {};
            const npcList: NPC[] = Object.entries(data).map(([id, value]) => ({
                id,
                ...value as { character_data: Character }
            }));
            setNpcs(npcList);
        });
        return () => npcsRef.off('value', listener);
    }, []);

    const handleCreate = async () => {
        if (!description.trim() || !isApiKeyAvailable) return;
        setIsProcessing(true);
        setError(null);
        try {
            const charJson = await createNpcFromDescription(description);
            const character: Character = JSON.parse(charJson);
            
            const newNpcRef = npcsRef.push();
            const newNpcId = newNpcRef.key;
            if (!newNpcId) throw new Error("Could not generate NPC ID.");

            await newNpcRef.set({ character_data: character });
            
            setDescription('');

        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDelete = (npcId: string) => {
        if(window.confirm("Are you sure you want to permanently delete this NPC?")) {
            npcsRef.child(npcId).remove();
            // The token will be auto-removed by MapManager's useEffect
        }
    };
    
    const handleGenerateAvatar = async (npc: NPC) => {
        if (!isApiKeyAvailable) return;
        setError(null);
        try {
            const base64Data = await generatePixelArtAvatar(npc.character_data);
            const imageBlob = await (await fetch(`data:image/png;base64,${base64Data}`)).blob();
            const storageRef = storage.ref(`DND/avatars/${npc.id}`);
            const snapshot = await storageRef.put(imageBlob);
            const downloadURL = await snapshot.ref.getDownloadURL();
            await npcsRef.child(`${npc.id}/character_data/avatarUrl`).set(downloadURL);
        } catch (e: any) {
            setError(e.message);
        }
    };

    return (
        <div className="bg-slate-800/80 p-4 rounded-lg border border-slate-600">
            <h2 className="font-display text-2xl text-amber-300 mb-4">NPC Management</h2>
            
            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 mb-6">
                <h3 className="font-display text-xl text-amber-300 mb-2">Create New NPC</h3>
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={isApiKeyAvailable ? "Describe the NPC... e.g., 'Grizelda, an old, wise woman who runs the potion shop.'" : "AI features are disabled."}
                    className="w-full bg-slate-900 border border-slate-500 rounded p-2 h-24 text-sm"
                    disabled={isProcessing || !isApiKeyAvailable}
                />
                <button
                    onClick={handleCreate}
                    disabled={isProcessing || !description.trim() || !isApiKeyAvailable}
                    className="w-full mt-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                    <SparklesIcon className="h-5 w-5" />
                    {isProcessing ? 'Conjuring NPC...' : 'Create with AI'}
                </button>
                {isProcessing && <div className="text-center mt-2"><Loader message="AI is breathing life into your character..." /></div>}
                {!isApiKeyAvailable && <p className="text-yellow-500 text-center mt-2 text-sm">AI features disabled: API key not set.</p>}
                {error && <p className="text-red-400 text-center mt-2 text-sm">{error}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                {npcs.length > 0 ? (
                    npcs.map(npc => (
                        <div key={npc.id} className="bg-slate-700/50 p-4 rounded-lg border border-purple-500/30 flex flex-col">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-display text-xl text-amber-300 truncate">{npc.character_data.name}</h3>
                                <button onClick={() => handleDelete(npc.id)} className="bg-red-800 hover:bg-red-700 p-1 rounded text-xs" title={`Delete ${npc.character_data.name}`}>
                                    <TrashIcon className="h-4 w-4"/>
                                </button>
                            </div>
                            <div className="flex-grow max-h-96 overflow-y-auto custom-scrollbar pr-1 mb-2">
                                <CharacterSheet character={npc.character_data} />
                            </div>
                            <button onClick={() => handleGenerateAvatar(npc)} className="w-full mt-auto bg-teal-600 hover:bg-teal-700 px-3 py-1 rounded text-sm disabled:bg-gray-600 disabled:cursor-not-allowed" disabled={!isApiKeyAvailable}>
                                {npc.character_data.avatarUrl ? 'Regenerate Avatar' : 'Generate Avatar'}
                            </button>
                        </div>
                    ))
                ) : (
                    <p className="text-slate-400 italic text-center col-span-full">No NPCs have been created yet.</p>
                )}
            </div>
        </div>
    );
};

export default NpcManager;