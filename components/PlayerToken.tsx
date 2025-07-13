import React from 'react';
import type { TokenData } from '../types';

interface EntityTokenProps {
    name: string;
    avatarUrl?: string;
    tokenData: TokenData;
    tokenSize: number;
    showName: boolean;
    isCurrentUser?: boolean;
    imageWidth?: number;
    imageHeight?: number;
    onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
}

const MAP_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6'];

const getColorForString = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash % MAP_COLORS.length);
    return MAP_COLORS[index];
};

const EntityToken: React.FC<EntityTokenProps> = ({ name, avatarUrl, tokenData, tokenSize, showName, isCurrentUser, imageWidth, imageHeight, onDragStart }) => {
    const [isDragging, setIsDragging] = React.useState(false);
    const initial = name ? name.charAt(0).toUpperCase() : '?';
    const color = getColorForString(name);

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        setIsDragging(true);
        // Use a transparent image as drag ghost
        const img = new Image();
        img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        e.dataTransfer.setDragImage(img, 0, 0);
        if (onDragStart) {
            onDragStart(e);
        }
    };

    const handleDragEnd = () => {
        setIsDragging(false);
    };

    if (!tokenData.visible || !imageWidth || !imageHeight) {
        return null;
    }
    
    const leftPercent = (tokenData.x / imageWidth) * 100;
    const bottomPercent = (tokenData.y / imageHeight) * 100;

    const baseRemSize = 3; // Corresponds to w-12/h-12
    const finalSizeRem = baseRemSize * tokenSize;
    
    const nameplateFontSizeRem = Math.max(0.6, 0.75 * tokenSize);

    return (
        <div
            draggable={!!onDragStart}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            className={`absolute rounded-full flex items-center justify-center transition-opacity duration-150 ease-in-out ${!!onDragStart ? 'cursor-grab' : 'cursor-default'} ${isDragging ? 'opacity-50 z-20' : 'opacity-100 z-10'}`}
            style={{ 
                left: `${leftPercent}%`, 
                bottom: `${bottomPercent}%`,
                width: `${finalSizeRem}rem`,
                height: `${finalSizeRem}rem`,
                transform: `translate(-50%, 50%)`,
                boxShadow: isCurrentUser ? `0 0 15px 3px #fdf6e3` : `0 0 12px 2px ${color}`,
                border: `3px solid ${isCurrentUser ? '#fdf6e3' : color}`
            }}
            title={name}
        >
            {avatarUrl ? (
                <img src={avatarUrl} alt={name} className="w-full h-full object-contain rounded-full bg-slate-800" />
            ) : (
                <div 
                    className="w-full h-full rounded-full flex items-center justify-center font-bold text-white" 
                    style={{ 
                        backgroundColor: color,
                        fontSize: `${finalSizeRem * 0.5}rem` // Scale font size inside token
                    }}
                >
                    {initial}
                </div>
            )}
             {showName && (
                <div
                    className="absolute bottom-full mb-1 w-max max-w-[200px] truncate bg-black/60 text-white font-bold px-2 py-0.5 rounded-md pointer-events-none"
                    style={{
                        fontSize: `${nameplateFontSizeRem}rem`,
                        transform: 'translateX(-50%)',
                        left: '50%',
                    }}
                >
                    {name}
                </div>
            )}
        </div>
    );
};

export default EntityToken;
