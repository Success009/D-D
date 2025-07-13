
import React, { useMemo, useState, useEffect } from 'react';
import { db, storage } from '../services/firebase';
import type { PendingPlayer, ActivePlayer, Character } from '../types';
import { createCharacterFromBackstory, generatePixelArtAvatar } from '../services/gemini';
import CharacterSheet from './CharacterSheet';
import Loader from './Loader';
import { isApiKeyAvailable } from '../utils/apiKey';

interface PlayerManagerProps {
    player: PendingPlayer | ActivePlayer;
}

const PlayerManager: React.FC<PlayerManagerProps> = ({ player }) => {
    // --- State for AI creation flow ---
    const [editedBackstory, setEditedBackstory] = useState('');
    const [refinementNotes, setRefinementNotes] = useState('');
    const [generatedChar, setGeneratedChar] = useState<Character | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isPending = (p: PendingPlayer | ActivePlayer): p is PendingPlayer => 'ip' in p;
    const playerId = isPending(player) ? player.ip : player.id;
    const sanitizedPlayerId = useMemo(() => playerId.replace(/[.#$[\]]/g, '_'), [playerId]);
    
    useEffect(() => {
        if (isPending(player) && player.backstory) {
            setEditedBackstory(player.backstory);
        }
    }, [player]);


    // --- Firebase Actions ---
    const handleApprove = () => {
        db.ref(`DND/pending_players/${sanitizedPlayerId}`).update({ accepted: true }).catch(err => console.error("Failed to approve", err));
    };
    
    const handleReject = () => {
        const path = isPending(player) ? `DND/pending_players/${sanitizedPlayerId}` : `DND/active_players/${sanitizedPlayerId}`;
        db.ref(path).remove().catch(err => console.error("Failed to reject/remove", err));
    };

    const handleCreateCharacter = async () => {
        if (!editedBackstory || !isApiKeyAvailable) return;
        setIsProcessing(true);
        setError(null);
        try {
            const charJsonString = await createCharacterFromBackstory(editedBackstory);
            const newChar: Character = JSON.parse(charJsonString);
            setGeneratedChar(newChar);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleRefineCharacter = async () => {
        if (!refinementNotes || !generatedChar || !isApiKeyAvailable) return;
        setIsProcessing(true);
        setError(null);
        try {
            const charJsonString = await createCharacterFromBackstory(editedBackstory, refinementNotes, JSON.stringify(generatedChar));
            const newChar: Character = JSON.parse(charJsonString);
            setGeneratedChar(newChar);
            setRefinementNotes('');
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleGenerateAvatar = async () => {
        if (isPending(player) || !isApiKeyAvailable) return;
        setIsGeneratingAvatar(true);
        setError(null);
        try {
            const base64Data = await generatePixelArtAvatar(player.character_data);
            const imageBlob = await (await fetch(`data:image/png;base64,${base64Data}`)).blob();
            const storageRef = storage.ref(`DND/avatars/${sanitizedPlayerId}`);
            const snapshot = await storageRef.put(imageBlob);
            const downloadURL = await snapshot.ref.getDownloadURL();
            await db.ref(`DND/active_players/${sanitizedPlayerId}/character_data/avatarUrl`).set(downloadURL);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsGeneratingAvatar(false);
        }
    };

    const handleFinalizeCharacter = () => {
        if (!generatedChar) return;
        const updates: { [key: string]: any } = {};
        updates[`/pending_players/${sanitizedPlayerId}`] = null;
        updates[`/active_players/${sanitizedPlayerId}`] = { id: playerId, character_data: generatedChar };
        db.ref('DND').update(updates).catch(err => {
            console.error("Failed to finalize character:", err);
            setError("Failed to move player to active game.");
        });
    };

    // --- Render Logic ---

    if (!isPending(player)) {
        // --- ACTIVE PLAYER VIEW ---
        return (
             <div className="bg-slate-700/50 p-4 rounded-lg border border-green-500/30">
                <div className="flex justify-between items-start">
                    <h3 className="font-display text-xl text-amber-300">{player.character_data.name}</h3>
                    <button onClick={handleReject} className="bg-red-800 hover:bg-red-700 px-2 py-1 rounded text-xs">Remove</button>
                </div>
                <div className="mt-2 text-xs opacity-75 max-h-96 overflow-y-auto custom-scrollbar pr-1">
                    <CharacterSheet character={player.character_data}/>
                </div>
                <button onClick={handleGenerateAvatar} disabled={isGeneratingAvatar || !isApiKeyAvailable} className="w-full mt-2 bg-teal-600 hover:bg-teal-700 px-3 py-1 rounded text-sm disabled:bg-gray-600 disabled:cursor-not-allowed">
                    {isGeneratingAvatar ? 'Generating...' : player.character_data.avatarUrl ? 'Regenerate Avatar' : 'Generate Avatar'}
                </button>
                {!isApiKeyAvailable && <p className="text-yellow-500 text-xs mt-2 text-center">AI features disabled.</p>}
                {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
            </div>
        );
    }
    
    // --- PENDING PLAYER LIFECYCLE ---
    if (generatedChar) {
        // --- REVIEWING AI-GENERATED CHARACTER ---
        return (
            <div className="bg-slate-700/50 p-4 rounded-lg border border-purple-500/30 space-y-3">
                <h3 className="font-display text-xl text-purple-300">Review Character</h3>
                <div className="bg-slate-900/50 rounded-lg p-2 max-h-80 overflow-y-auto custom-scrollbar pr-1"><CharacterSheet character={generatedChar} /></div>
                
                {isProcessing ? <Loader message="AI is working..." /> : (
                <>
                    <div className="space-y-2">
                        <h4 className="font-bold text-slate-400 text-xs uppercase">Refine (Optional)</h4>
                        <textarea value={refinementNotes} onChange={e => setRefinementNotes(e.target.value)} placeholder="e.g., Make the character older, change class to Paladin..." className="w-full bg-slate-900 border border-slate-500 rounded p-2 text-sm h-16" disabled={!isApiKeyAvailable}/>
                        <button onClick={handleRefineCharacter} disabled={!refinementNotes.trim() || !isApiKeyAvailable} className="w-full bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded text-sm disabled:bg-gray-600 disabled:cursor-not-allowed">Refine with AI</button>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleFinalizeCharacter} className="flex-1 bg-green-600 hover:bg-green-700 px-3 py-2 rounded text-sm font-bold">Accept Character</button>
                        <button onClick={() => setGeneratedChar(null)} className="bg-gray-600 hover:bg-gray-700 px-3 py-2 rounded text-sm">Back</button>
                    </div>
                </>
                )}
                 {!isApiKeyAvailable && <p className="text-yellow-500 text-xs text-center">AI features disabled.</p>}
                {error && <p className="text-red-400 text-xs">{error}</p>}
            </div>
        );
    }

    if (player.backstory) {
        // --- DM REVIEWING & EDITING BACKSTORY ---
        return (
            <div className="bg-slate-700/50 p-4 rounded-lg border border-amber-500/30 space-y-3">
                 <div className="flex justify-between items-start">
                    <h3 className="font-display text-xl text-amber-300 truncate" title={player.ip}>Awaiting Creation</h3>
                    <button onClick={handleReject} className="bg-red-800 hover:bg-red-700 px-2 py-1 rounded text-xs">Reject</button>
                </div>
                <div>
                     <label className="font-bold text-slate-400 text-xs uppercase">Player's Backstory (Editable)</label>
                     <textarea value={editedBackstory} onChange={(e) => setEditedBackstory(e.target.value)} className="w-full bg-slate-900 border border-slate-500 rounded p-2 mt-1 h-32 text-sm" />
                </div>
                 <button onClick={handleCreateCharacter} disabled={isProcessing || !editedBackstory.trim() || !isApiKeyAvailable} className="w-full bg-amber-600 hover:bg-amber-700 px-3 py-2 rounded font-bold disabled:bg-gray-600 disabled:cursor-not-allowed">
                    {isProcessing ? 'Creating...' : 'Create with AI'}
                 </button>
                 {!isApiKeyAvailable && <p className="text-yellow-500 text-xs mt-2 text-center">AI features disabled.</p>}
                 {error && <p className="text-red-400 text-xs">{error}</p>}
            </div>
        );
    }

    if (player.accepted) {
        // --- WAITING FOR PLAYER TO WRITE BACKSTORY ---
        return (
            <div className="bg-slate-700/50 p-4 rounded-lg">
                 <div className="flex justify-between items-center">
                    <div>
                        <h3 className="font-display text-xl text-amber-300 truncate" title={player.ip}>{player.ip}</h3>
                        <p className="text-slate-400 italic text-sm">Waiting for backstory...</p>
                    </div>
                    <button onClick={handleReject} className="bg-red-800 hover:bg-red-700 px-2 py-1 rounded text-xs">Reject</button>
                </div>
            </div>
        );
    }

    // --- PENDING INITIAL APPROVAL ---
    return (
        <div className="bg-slate-700 p-4 rounded-lg flex justify-between items-center">
            <span className="font-bold truncate" title={player.ip}>{player.ip}</span>
            <div className="flex gap-2 flex-shrink-0">
                <button onClick={handleApprove} className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm">Approve</button>
                <button onClick={handleReject} className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm">Reject</button>
            </div>
        </div>
    );
};

export default PlayerManager;