import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type firebase from 'firebase/compat/app';
import { db } from '../services/firebase';
import type { MapData, ActivePlayer, NPC, Character } from '../types';
import EntityToken from './PlayerToken';

interface MapViewProps {
  characterId: string;
}

const MapView: React.FC<MapViewProps> = ({ characterId }) => {
    const [mapState, setMapState] = useState<(MapData & { id: string }) | null>(null);
    const [activePlayers, setActivePlayers] = useState<ActivePlayer[]>([]);
    const [npcs, setNpcs] = useState<NPC[]>([]);
    const viewportRef = useRef<HTMLDivElement>(null);
    const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

    const [localView, setLocalView] = useState({ zoom: 1, pan: { x: 0, y: 0 } });
    const isPanningRef = useRef(false);
    const panStartRef = useRef({ x: 0, y: 0 });
    const viewStartRef = useRef({ x: 0, y: 0 });
    
    // Listen for players and NPCs
    useEffect(() => {
        const playersRef = db.ref('DND/active_players');
        const npcsRef = db.ref('DND/npcs');

        const playersCallback = (snapshot: any) => {
            const playersData = snapshot.val() || {};
            setActivePlayers(Object.values(playersData));
        };
        const npcsCallback = (snapshot: any) => {
             const npcsData = snapshot.val() || {};
             const npcList: NPC[] = Object.entries(npcsData).map(([id, data]) => ({ id, ...(data as any) }));
             setNpcs(npcList);
        }

        playersRef.on('value', playersCallback);
        npcsRef.on('value', npcsCallback);

        return () => {
            playersRef.off('value', playersCallback);
            npcsRef.off('value', npcsCallback);
        };
    }, []);

    // Listen for active map and its data
    useEffect(() => {
        const activeMapIdRef = db.ref('DND/game_state/activeMapId');
        let mapRef: firebase.database.Reference | null = null;
        let mapListener: any = null;
    
        const activeMapIdListener = activeMapIdRef.on('value', snapshot => {
            const activeMapId = snapshot.val();
    
            if (mapRef && mapListener) {
                mapRef.off('value', mapListener);
            }
            setMapState(null);
            setLocalView({ zoom: 1, pan: { x: 0, y: 0 }});
    
            if (activeMapId) {
                mapRef = db.ref(`DND/maps/${activeMapId}`);
                mapListener = mapRef.on('value', mapSnapshot => {
                    const mapData = mapSnapshot.val();
                    if (mapData) {
                        setMapState({ ...mapData, id: activeMapId });
                    }
                });
            }
        });
    
        return () => {
            activeMapIdRef.off('value', activeMapIdListener);
            if (mapRef && mapListener) {
                mapRef.off('value', mapListener);
            }
        };
    }, []);

    useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;
        const resizeObserver = new ResizeObserver(entries => {
            const { width, height } = entries[0].contentRect;
            setViewportSize({ width, height });
        });
        resizeObserver.observe(viewport);
        return () => resizeObserver.disconnect();
    }, []);

    const mapContainerStyle = useMemo(() => {
        if (!mapState?.imageWidth || !mapState?.imageHeight || !viewportSize.width || !viewportSize.height) {
            return { display: 'none' };
        }
        const imageRatio = mapState.imageWidth / mapState.imageHeight;
        const viewportRatio = viewportSize.width / viewportSize.height;

        let style = {};
        if (imageRatio > viewportRatio) {
            style = { width: '100%', height: `${viewportSize.width / imageRatio}px` };
        } else {
            style = { height: '100%', width: `${viewportSize.height * imageRatio}px` };
        }
        return { ...style, position: 'relative' as const };
    }, [mapState, viewportSize]);

    const getEntityById = (id: string): (Character & { type: 'player' | 'npc' }) | null => {
        const player = activePlayers.find(p => p.id.replace(/[.#$[\]]/g, '_') === id);
        if (player) return { ...player.character_data, type: 'player' };
        
        const npc = npcs.find(n => n.id.replace(/[.#$[\]]/g, '_') === id);
        if (npc) return { ...npc.character_data, type: 'npc' };

        return null;
    }
    
    const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (!viewportRef.current) return;

        const rect = viewportRef.current.getBoundingClientRect();
        const oldView = localView;
        const zoomFactor = 1.1;
        const newZoom = e.deltaY < 0 ? oldView.zoom * zoomFactor : oldView.zoom / zoomFactor;
        const clampedZoom = Math.max(0.25, Math.min(8, newZoom));

        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const newPanX = mouseX - ((mouseX - oldView.pan.x) * (clampedZoom / oldView.zoom));
        const newPanY = mouseY - ((mouseY - oldView.pan.y) * (clampedZoom / oldView.zoom));
        
        setLocalView({ zoom: clampedZoom, pan: { x: newPanX, y: newPanY }});
    }, [localView]);

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        e.preventDefault();
        isPanningRef.current = true;
        panStartRef.current = { x: e.clientX, y: e.clientY };
        viewStartRef.current = localView.pan;
    }, [localView.pan]);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!isPanningRef.current) return;
        e.preventDefault();
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        
        const newPan = { x: viewStartRef.current.x + dx, y: viewStartRef.current.y + dy };
        setLocalView(prev => ({...prev, pan: newPan}));
    }, []);
    
    const handleMouseUpOrLeave = useCallback(() => {
        isPanningRef.current = false;
    }, []);

    return (
        <div 
            ref={viewportRef}
            className="w-full h-full bg-slate-900 relative rounded-lg overflow-hidden flex items-center justify-center cursor-grab"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
        >
             {mapState?.imageUrl && mapState.imageWidth && mapState.imageHeight ? (
                <div 
                    className="absolute"
                    style={{
                        transform: `translate(${localView.pan.x}px, ${localView.pan.y}px) scale(${localView.zoom})`,
                        transformOrigin: 'top left',
                    }}
                >
                    <div className="relative" style={mapContainerStyle}>
                        <img src={mapState.imageUrl} alt="Game Map" className="w-full h-full pointer-events-none" />
                        {mapState?.tokens && Object.entries(mapState.tokens).map(([id, tokenData]) => {
                            if (!tokenData.visible) return null;
                            const entity = getEntityById(id);
                            if (!entity) return null;
                            
                            return (
                                <EntityToken
                                    key={id}
                                    name={entity.name}
                                    avatarUrl={entity.avatarUrl}
                                    tokenData={tokenData}
                                    tokenSize={mapState?.tokenSize || 1}
                                    showName={entity.type === 'player'}
                                    isCurrentUser={id === characterId}
                                    imageWidth={mapState.imageWidth}
                                    imageHeight={mapState.imageHeight}
                                />
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="w-full h-full flex items-center justify-center">
                    <p className="font-display text-2xl text-slate-500">The map is shrouded in mist...</p>
                </div>
            )}
        </div>
    );
};

export default MapView;