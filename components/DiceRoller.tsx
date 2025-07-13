import React, { useState, useEffect } from 'react';
import type { DiceRoll } from '../types';

interface DiceRollerProps {
    diceRoll: DiceRoll | null;
    canRoll: boolean;
    onRoll: () => void;
    rollerName?: string;
}

const D20Icon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor" className={className}>
        <path d="M495.2 214.3L297.4 24.8c-15.5-14.8-40.6-14.8-56.1 0L42.6 214.3c-23.3 22.2-8.2 65.7 22.8 65.7h402c31 0 46-43.5 27.8-65.7zM256 464c-11.4 0-22-6-27.9-15.9l-57-95c-5-8.3-4.1-18.7 2.2-26.1s17.1-11.9 26.6-11.9h114.2c9.5 0 18.2 4.6 23.7 11.9s8.1 17.8 3.1 26.1l-57 95c-5.9 9.9-16.5 15.9-27.9 15.9z"/>
    </svg>
);


const DiceRoller: React.FC<DiceRollerProps> = ({ diceRoll, canRoll, onRoll, rollerName }) => {
    const [displayNumber, setDisplayNumber] = useState<number | null>(20);
    const animationTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const animationIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (diceRoll?.isRolling) {
            // Clear any lingering timeouts/intervals
            if (animationTimeoutRef.current) {
                clearTimeout(animationTimeoutRef.current);
            }
            if (animationIntervalRef.current) {
                clearInterval(animationIntervalRef.current);
            }

            animationIntervalRef.current = setInterval(() => {
                setDisplayNumber(Math.floor(Math.random() * 20) + 1);
            }, 80);

            animationTimeoutRef.current = setTimeout(() => {
                if (animationIntervalRef.current) {
                    clearInterval(animationIntervalRef.current);
                }
                setDisplayNumber(diceRoll.result);
            }, 2000);

        } else {
            // If we are not rolling, just show the result.
            // Clear any intervals in case the component re-renders while rolling.
            if (animationIntervalRef.current) {
                clearInterval(animationIntervalRef.current);
            }
            setDisplayNumber(diceRoll?.result ?? null);
        }

        return () => {
            if (animationIntervalRef.current) {
                clearInterval(animationIntervalRef.current);
            }
            if (animationTimeoutRef.current) {
                clearTimeout(animationTimeoutRef.current);
            }
        };
    }, [diceRoll]);

    const showResult = !diceRoll?.isRolling && diceRoll?.result;

    return (
        <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-600 text-center space-y-3">
            <h3 className="font-display text-lg text-amber-300">Dice Roll</h3>
            
            <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                <D20Icon className={`w-full h-full text-slate-700 transition-colors duration-500 ${diceRoll?.isRolling ? 'text-purple-500/50' : showResult ? 'text-amber-500/50' : 'text-slate-700'}`} />
                <div 
                    className={`absolute inset-0 flex items-center justify-center font-display text-3xl text-white ${diceRoll?.isRolling ? 'dice-rolling' : ''}`}
                    style={{ textShadow: '0 0 8px black' }}
                >
                    {displayNumber}
                </div>
            </div>

            {showResult ? (
                <p className="text-lg animate-fade-in h-12 flex items-center justify-center">
                    <span className="font-bold text-amber-200">{diceRoll.rollerName}</span> rolled a <span className="font-display text-2xl text-white ml-2">{diceRoll.result}</span>!
                </p>
            ) : (
                <div className="h-12 flex items-center justify-center">
                    {!canRoll && <p className="text-slate-400 italic">Waiting for a roll...</p>}
                </div>
            )}


            {canRoll && (
                <button
                    onClick={onRoll}
                    disabled={diceRoll?.isRolling}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
                >
                    {diceRoll?.isRolling ? 'Rolling...' : `Roll D20 ${rollerName ? `as ${rollerName}`: ''}`}
                </button>
            )}
        </div>
    );
};

export default DiceRoller;