
import React from 'react';
import type { Character, Skill, InventoryItem } from '../types';
import {
    ShieldCheckIcon, BeakerIcon, BookOpenIcon, KeyIcon, PuzzlePieceIcon, UserCircleIcon, StarIcon, HeartIcon, SparklesIcon, ChartBarIcon, FaceFrownIcon, ChatBubbleBottomCenterTextIcon, BoltIcon
} from '@heroicons/react/24/solid';

interface CharacterSheetProps {
  character: Character;
}

const StatBar: React.FC<{ label: React.ReactNode; value: number; max: number; colorClass: string; resourceName?: string; displayAsPercentage?: boolean; }> = ({ label, value, max, colorClass, resourceName, displayAsPercentage = false }) => {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <h4 className="font-display text-lg text-amber-300 flex items-center gap-2">{label}</h4>
        <span className="text-sm font-mono text-slate-300">
            {displayAsPercentage
                ? `${Math.round(percentage)}%`
                : `${value} / ${max} ${resourceName || ''}`
            }
        </span>
      </div>
      <div className="w-full bg-slate-900 rounded-full h-4 border-2 border-slate-700 overflow-hidden">
        <div 
          className={`${colorClass} h-full rounded-full transition-all duration-500`} 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

const StatBox: React.FC<{ label: string; value: number }> = ({ label, value }) => {
    const modifier = Math.floor((value - 10) / 2);
    const sign = modifier >= 0 ? '+' : '';
    return (
        <div className="bg-slate-900/70 p-3 rounded-lg text-center border border-slate-700 flex flex-col items-center justify-center">
            <div className="font-bold text-slate-400 text-xs uppercase">{label}</div>
            <div className="text-3xl font-bold text-parchment">{value}</div>
            <div className="bg-slate-700 rounded-full px-2 text-sm text-amber-300">{sign}{modifier}</div>
        </div>
    );
};

const getIconForItem = (itemName?: string) => {
    const lowerCaseName = (itemName || '').toLowerCase();
    if (lowerCaseName.includes('sword') || lowerCaseName.includes('axe') || lowerCaseName.includes('dagger') || lowerCaseName.includes('mace') || lowerCaseName.includes('bow')) {
        return <ShieldCheckIcon className="h-8 w-8 text-slate-400" />;
    }
    if (lowerCaseName.includes('potion') || lowerCaseName.includes('elixir') || lowerCaseName.includes('vial')) {
        return <BeakerIcon className="h-8 w-8 text-green-400" />;
    }
    if (lowerCaseName.includes('scroll') || lowerCaseName.includes('book') || lowerCaseName.includes('tome') || lowerCaseName.includes('map')) {
        return <BookOpenIcon className="h-8 w-8 text-amber-400" />;
    }
    if (lowerCaseName.includes('key')) {
        return <KeyIcon className="h-8 w-8 text-yellow-500" />;
    }
    if (lowerCaseName.includes('coin')) {
        return <SparklesIcon className="h-8 w-8 text-yellow-400" />;
    }
    return <PuzzlePieceIcon className="h-8 w-8 text-slate-500" />;
};


const CharacterSheet: React.FC<CharacterSheetProps> = ({ character }) => {
    const getResourceColor = (resourceName?: string) => {
        switch((resourceName || '').toLowerCase()) {
            case 'mana': return 'bg-blue-500';
            case 'stamina': return 'bg-yellow-500';
            case 'rage': return 'bg-red-700';
            default: return 'bg-purple-500';
        }
    };

    return (
    <div className="text-parchment p-2 space-y-6">
      <div className="text-center pb-2">
        <div className="flex justify-center mb-4">
            <div className="w-24 h-24 rounded-lg bg-slate-900/50 border-2 border-amber-600/50 shadow-lg flex items-center justify-center">
                {character.avatarUrl ? (
                    <img src={character.avatarUrl} alt={character.name} className="w-full h-full object-contain"/>
                ) : (
                    <UserCircleIcon className="w-20 h-20 text-slate-600"/>
                )}
            </div>
        </div>
        <h1 className="font-display text-4xl text-amber-400">{character.name}</h1>
        <p className="text-slate-400">Level {character.level} {character.race} {character.class} (Age: {character.age})</p>
      </div>

       <div className="space-y-4 bg-slate-900/50 p-4 rounded-lg border border-slate-700">
        {character.health && <StatBar label={<><HeartIcon className="h-5 w-5 text-red-400"/> Health</>} value={character.health.current} max={character.health.max} colorClass="bg-red-500" />}
        {character.stamina && <StatBar label={<><BoltIcon className="h-5 w-5 text-green-400"/> Stamina</>} value={character.stamina.current} max={character.stamina.max} colorClass="bg-green-500" displayAsPercentage={true} />}
        {character.resource && <StatBar label={<><SparklesIcon className="h-5 w-5 text-purple-400"/> {character.resource.name}</>} value={character.resource.current} max={character.resource.max} colorClass={getResourceColor(character.resource.name)}/>}
        {character.experience && <StatBar label={<><ChartBarIcon className="h-5 w-5 text-yellow-400"/> Experience</>} value={character.experience.current} max={character.experience.nextLevel} colorClass="bg-yellow-400" resourceName="XP"/>}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {character.stats && <StatBox label="STR" value={character.stats.strength} />}
        {character.stats && <StatBox label="INT" value={character.stats.intelligence} />}
        {character.stats && <StatBox label="CHA" value={character.stats.charisma} />}
      </div>
      
       <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
          <h3 className="font-display text-xl text-amber-300 mb-3 flex items-center gap-2"><UserCircleIcon className="h-5 w-5"/> About</h3>
            <div className="space-y-3 text-sm">
                <div>
                    <h4 className="font-bold text-slate-400 flex items-center gap-1"><ChatBubbleBottomCenterTextIcon className="h-4 w-4" /> Personality</h4>
                    <div className="flex flex-wrap gap-2 mt-1">
                        {character.personalityTraits.map((trait, i) => <span key={i} className="bg-slate-700 text-slate-300 text-xs font-semibold px-3 py-1 rounded-full">{trait}</span>)}
                    </div>
                </div>
                 <div>
                    <h4 className="font-bold text-slate-400 flex items-center gap-1"><FaceFrownIcon className="h-4 w-4" /> Fears</h4>
                    <p className="text-slate-300 italic">{character.fears}</p>
                 </div>
                <div>
                    <h4 className="font-bold text-slate-400">Backstory</h4>
                    <p className="text-slate-300 italic leading-relaxed">{character.backstory}</p>
                </div>
            </div>
      </div>

      {character.skills && character.skills.length > 0 && (
        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
          <h3 className="font-display text-xl text-amber-300 mb-3 flex items-center gap-2"><StarIcon className="h-5 w-5"/> Skills</h3>
          <div className="space-y-3">
            {character.skills.map((skill: Skill, index) => (
                <div key={index} className="bg-slate-800/60 p-3 rounded-md border border-slate-700">
                    <h4 className="font-bold text-amber-200">{skill.name}</h4>
                    <p className="text-slate-300 text-sm">{skill.description}</p>
                </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
        <h3 className="font-display text-xl text-amber-300 mb-3">Inventory</h3>
        {character.inventory && character.inventory.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {character.inventory
                    .filter(item => item && item.name)
                    .map((item: InventoryItem, index) => (
                    <div key={index} className="relative bg-slate-800 border border-slate-600 rounded-lg p-2 flex flex-col items-center justify-center aspect-square text-center" title={`${item.name} (x${item.quantity})`}>
                       {getIconForItem(item.name)}
                        <span className="text-xs text-slate-400 mt-1 truncate w-full">{item.name}</span>
                        {item.quantity > 1 && (
                             <span className="absolute -top-2 -right-2 bg-amber-500 text-white font-bold text-xs rounded-full h-5 w-5 flex items-center justify-center border-2 border-slate-700">
                                {item.quantity}
                            </span>
                        )}
                    </div>
                ))}
            </div>
        ) : (
            <p className="text-slate-500 italic text-sm text-center py-4">Inventory is empty.</p>
        )}
      </div>
    </div>
  );
};

export default CharacterSheet;
