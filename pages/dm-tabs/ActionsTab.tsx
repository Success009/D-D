import React from 'react';
import type { ActivePlayer, DiceRoll, NPC } from '../../types';
import DiceRoller from '../../components/DiceRoller';
import Loader from '../../components/Loader';
import { isApiKeyAvailable } from '../../utils/apiKey';
import { MicrophoneIcon } from '@heroicons/react/24/solid';

interface AssistantProps {
    command: string;
    setCommand: (value: string) => void;
    isProcessing: boolean;
    error: string | null;
    success: string | null;
    handleSubmit: () => void;
}

interface SpeechProps {
    isListening: boolean;
    interimTranscript: string;
    startListening: () => void;
    stopListening: () => void;
    hasRecognitionSupport: boolean;
}

interface DiceRollProps {
    diceRoll: DiceRoll | null;
    onRoll: (rollerName: string) => void;
    onGrantRoll: (playerId: string) => void;
}

interface ActionsTabProps {
    assistantProps: AssistantProps;
    speechProps: SpeechProps;
    diceRollProps: DiceRollProps;
    activePlayers: ActivePlayer[];
    visibleNpcs: NPC[];
}

const ActionsTab: React.FC<ActionsTabProps> = ({
    assistantProps,
    speechProps,
    diceRollProps,
    activePlayers,
    visibleNpcs,
}) => {

    const { command, setCommand, isProcessing, error, success, handleSubmit } = assistantProps;
    const { isListening, interimTranscript, startListening, stopListening, hasRecognitionSupport } = speechProps;
    const { diceRoll, onRoll, onGrantRoll } = diceRollProps;

    const toggleAssistantListening = () => {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    };
    
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-800/80 p-4 rounded-lg border border-slate-600">
                <h2 className="font-display text-2xl text-amber-300 mb-2">DM Assistant</h2>
                <div className="relative">
                    <textarea 
                        value={command}
                        onChange={e => setCommand(e.target.value)}
                        placeholder={isApiKeyAvailable ? "e.g., Elara takes 5 damage and the visible goblin gets 10 gold..." : "AI Assistant is disabled."}
                        className="w-full bg-slate-900 border border-slate-500 rounded p-2 text-sm h-20 pr-12"
                        disabled={isProcessing || !isApiKeyAvailable}
                    />
                    <button
                        type="button"
                        onClick={toggleAssistantListening}
                        disabled={!hasRecognitionSupport || !isApiKeyAvailable}
                        className={`absolute bottom-2 right-2 p-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                            isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                        } disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed`}
                        aria-label={isListening ? 'Stop assistant voice typing' : 'Use microphone for assistant command'}
                    >
                        <MicrophoneIcon className="h-5 w-5" />
                    </button>
                </div>
                {isListening && (
                    <p className="text-slate-400 text-sm italic h-6 mt-1 text-center">
                        {interimTranscript || 'Listening...'}
                    </p>
                )}
                {!isListening && <div className="h-6 mt-1" />}
                <button 
                    onClick={handleSubmit} 
                    disabled={!command.trim() || isProcessing || (activePlayers.length === 0 && visibleNpcs.length === 0) || !isApiKeyAvailable}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
                >
                    {isProcessing ? "Executing..." : "Execute Command"}
                </button>
                 {!isApiKeyAvailable && <p className="text-yellow-500 text-center mt-2 text-sm">AI Assistant disabled: API key not set.</p>}
                {isProcessing && <div className="text-center mt-2"><Loader message="Assistant is at work..."/></div>}
                {error && <p className="text-red-400 text-center mt-2 text-sm">{error}</p>}
                {success && <p className="text-green-400 text-center mt-2 text-sm">{success}</p>}
            </div>
            <div className="space-y-6">
                <DiceRoller 
                    diceRoll={diceRoll}
                    canRoll={true}
                    onRoll={() => onRoll('DM')}
                    rollerName="DM"
                />

                <div className="bg-slate-800/80 p-4 rounded-lg border border-slate-600">
                    <h2 className="font-display text-2xl text-amber-300 mb-2">Player Rolls</h2>
                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                        {activePlayers.length > 0 ? activePlayers.map(p => {
                            const sanitizedId = p.id.replace(/[.#$[\]]/g, '_');
                            return (
                                <div key={p.id} className="flex justify-between items-center bg-slate-900 p-2 rounded-md">
                                    <span className="font-bold text-slate-300">{p.character_data.name}</span>
                                    <button
                                        onClick={() => onGrantRoll(sanitizedId)}
                                        disabled={diceRoll?.permissionHolder === sanitizedId || !!diceRoll?.isRolling}
                                        className="bg-blue-600 hover:bg-blue-700 px-3 py-1 text-xs rounded text-white disabled:bg-gray-500 disabled:cursor-not-allowed"
                                    >
                                        {diceRoll?.permissionHolder === sanitizedId ? 'Permission Granted' : 'Grant Roll'}
                                    </button>
                                </div>
                            );
                        }) : <p className="text-slate-500 italic">No active players to grant rolls to.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ActionsTab;
