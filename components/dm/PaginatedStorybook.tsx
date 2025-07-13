import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { db, storage } from '../../services/firebase';
import { generateSceneryImage } from '../../services/gemini';
import type { ActivePlayer, Character, NPC } from '../../types';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { isApiKeyAvailable } from '../../utils/apiKey';
import { MicrophoneIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon, UserCircleIcon } from '@heroicons/react/24/solid';

const escapeRegExp = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface PaginatedStorybookProps {
    players: ActivePlayer[];
    npcs: NPC[];
}

const PaginatedStorybook: React.FC<PaginatedStorybookProps> = ({ players, npcs }) => {
    const STORY_PAGE_KEY = 'dnd_storybook_current_page';
    const [pages, setPages] = useState<{ [key: number]: { text: string } }>({ 1: { text: '' } });
    const [currentPage, setCurrentPage] = useState(() => {
        const savedPage = localStorage.getItem(STORY_PAGE_KEY);
        return savedPage ? parseInt(savedPage, 10) : 1;
    });
    const [totalPages, setTotalPages] = useState(1);
    const [currentText, setCurrentText] = useState('');
    const [isGeneratingScene, setIsGeneratingScene] = useState(false);
    const [sceneError, setSceneError] = useState<string | null>(null);

    const debounceTimeout = useRef<any>(null);
    const storyPagesRef = useRef(db.ref('DND/game_state/story_pages')).current;
    const isInitialLoad = useRef(true);

    const { 
        isListening, 
        finalTranscript, 
        interimTranscript, 
        startListening, 
        stopListening, 
        setFinalTranscript,
        hasRecognitionSupport 
    } = useSpeechRecognition();

    const allCharacters = useMemo(() => [
        ...players.map(p => p.character_data),
        ...npcs.map(n => n.character_data)
    ], [players, npcs]);

    const mentionedCharacters = useMemo(() => {
        if (!currentText || !allCharacters) return [];
        
        const uniqueCharacters = new Map<string, Character>();
        
        allCharacters.forEach(char => {
            if (!char.name) return;
            const safeName = escapeRegExp(char.name);
            const regex = new RegExp(`\\b${safeName}\\b`, 'i');
            if (regex.test(currentText)) {
                if (!uniqueCharacters.has(char.name)) {
                    uniqueCharacters.set(char.name, char);
                }
            }
        });

        return Array.from(uniqueCharacters.values());
    }, [currentText, allCharacters]);

    useEffect(() => {
        localStorage.setItem(STORY_PAGE_KEY, String(currentPage));
    }, [currentPage]);

    useEffect(() => {
        const listener = storyPagesRef.on('value', snapshot => {
            const data = snapshot.val();
            if (data && Object.keys(data).length > 0) {
                const pageNumbers = Object.keys(data).map(Number).filter(n => !isNaN(n));
                const maxPage = pageNumbers.length > 0 ? Math.max(...pageNumbers) : 1;
                setPages(data);
                setTotalPages(maxPage);

                if (isInitialLoad.current) {
                    setCurrentPage(p => data[p] ? p : maxPage);
                    isInitialLoad.current = false;
                } else {
                     if (!data[currentPage]) setCurrentPage(maxPage);
                }
            } else {
                storyPagesRef.set({ 1: { text: 'Once upon a time...' } });
            }
        });
        return () => storyPagesRef.off('value', listener);
    }, [storyPagesRef, currentPage]);

    useEffect(() => {
        setCurrentText(pages[currentPage]?.text || '');
    }, [currentPage, pages]);
    
    useEffect(() => {
        if (currentText !== (pages[currentPage]?.text || '')) {
            if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
            debounceTimeout.current = setTimeout(() => {
                storyPagesRef.child(String(currentPage)).update({ text: currentText });
            }, 750);
        }
        return () => clearTimeout(debounceTimeout.current);
    }, [currentText, currentPage, pages, storyPagesRef]);

    const handleSceneryGeneration = useCallback(async (pageContent: string, recentNarration: string) => {
        if (!recentNarration.trim() || !isApiKeyAvailable) return;
        setIsGeneratingScene(true);
        setSceneError(null);
        try {
            const base64Data = await generateSceneryImage(pageContent, recentNarration);
            const imageBlob = await(await fetch(`data:image/jpeg;base64,${base64Data}`)).blob();
            const storageRef = storage.ref(`DND/scenery/scene.jpg`);
            await storageRef.put(imageBlob);
            const downloadURL = await storageRef.getDownloadURL();
            await db.ref('DND/game_state/scenery').set({ imageUrl: downloadURL, timestamp: Date.now() });
        } catch (e: any) {
            setSceneError(e.message);
        } finally {
            setIsGeneratingScene(false);
        }
    }, []);

    useEffect(() => {
        if (finalTranscript) {
            const narration = finalTranscript.trim();
            const newText = (currentText ? currentText + ' ' : '') + narration;
            setCurrentText(newText);
            handleSceneryGeneration(newText, narration);
            setFinalTranscript('');
        }
    }, [finalTranscript, setFinalTranscript, currentText, handleSceneryGeneration]);

    const handleNewPage = () => {
        const newPageNum = totalPages + 1;
        storyPagesRef.child(String(newPageNum)).set({ text: '' }).then(() => {
            setCurrentPage(newPageNum);
        });
    };

    const toggleListening = () => isListening ? stopListening() : startListening();

    return (
        <div className="bg-slate-800/80 p-4 rounded-lg border border-slate-600 space-y-3 flex flex-col h-full">
            <h2 className="font-display text-2xl text-amber-300 flex-shrink-0">Story Book</h2>
            <div className="flex-grow grid grid-cols-1 md:grid-cols-3 gap-4 h-0 overflow-hidden">
                <div className="md:col-span-2 relative flex flex-col h-full">
                    <textarea
                        value={currentText}
                        onChange={e => setCurrentText(e.target.value)}
                        placeholder="The story unfolds..."
                        className="w-full h-full bg-slate-900 border border-slate-500 rounded p-3 text-base resize-none custom-scrollbar"
                    />
                </div>
                <div className="md:col-span-1 flex flex-col space-y-2 overflow-y-auto custom-scrollbar bg-slate-900/50 p-3 rounded-md">
                    <h3 className="font-display text-lg text-amber-200 sticky top-0 bg-slate-900/80 backdrop-blur-sm z-10 pb-2 -mx-3 -mt-3 px-3 pt-3 rounded-t-md">On this Page</h3>
                    <div className="space-y-3">
                        {mentionedCharacters.length > 0 ? (
                            mentionedCharacters.map(char => (
                                <div key={char.name} className="flex items-center gap-3 bg-slate-800 p-2 rounded-lg animate-fade-in">
                                    <div className="w-12 h-12 rounded-md bg-slate-900 flex-shrink-0 flex items-center justify-center">
                                        {char.avatarUrl ? (
                                            <img src={char.avatarUrl} alt={char.name} className="w-full h-full object-contain rounded-md" />
                                        ) : (
                                            <UserCircleIcon className="w-10 h-10 text-slate-600" />
                                        )}
                                    </div>
                                    <span className="font-bold text-slate-300 truncate">{char.name}</span>
                                </div>
                            ))
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <p className="text-slate-500 italic text-center text-sm">No characters mentioned.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-shrink-0 pt-2 space-y-2">
                <div className="h-6 text-center text-sm">
                    {isGeneratingScene && <p className="text-amber-400 animate-pulse">Generating scenery...</p>}
                    {sceneError && <p className="text-red-400">{sceneError}</p>}
                    {isListening && <p className="text-slate-400 italic">{interimTranscript || 'Listening...'}</p>}
                </div>
                <div className="flex items-center justify-between gap-4 bg-slate-900/50 p-2 rounded-md">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage <= 1} className="p-2 rounded-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white">
                            <ChevronLeftIcon className="h-5 w-5"/>
                        </button>
                        <span className="font-mono text-slate-300 text-sm">Page {currentPage} of {totalPages}</span>
                        <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages} className="p-2 rounded-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white">
                            <ChevronRightIcon className="h-5 w-5"/>
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={toggleListening}
                            disabled={!hasRecognitionSupport || !isApiKeyAvailable}
                            className={`p-2 rounded-full transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'} disabled:bg-slate-800 disabled:text-slate-500`}
                            aria-label={isListening ? "Stop voice typing" : "Start voice typing"}
                        >
                            <MicrophoneIcon className="h-5 w-5" />
                        </button>
                        <button onClick={handleNewPage} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-md text-sm">
                            <PlusIcon className="h-5 w-5"/> New Page
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaginatedStorybook;
