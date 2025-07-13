import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { db, storage } from '../services/firebase';
import { generateMapImage } from '../services/gemini';
import type { ActivePlayer, MapData, NPC } from '../types';
import EntityToken from './PlayerToken';
import { EyeIcon, EyeSlashIcon, ArrowUpTrayIcon, SparklesIcon, TrashIcon, CheckCircleIcon } from '@heroicons/react/24/solid';
import Loader from './Loader';
import { isApiKeyAvailable } from '../utils/apiKey';

interface MapManagerProps {
    activePlayers: ActivePlayer[];
    npcs: NPC[];
    allMaps: MapData[];
    activeMap: MapData | null;
}

const MapManager: React.FC<MapManagerProps> = ({ activePlayers, npcs, allMaps, activeMap }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [mapGenPrompt, setMapGenPrompt] = useState('');
    const [mapError, setMapError] = useState<string | null>(null);
    const [tokenSizeValue, setTokenSizeValue] = useState(1);
    
    const viewportRef = useRef<HTMLDivElement>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
    
    // Local view state for DM's pan and zoom
    const [localView, setLocalView] = useState({ zoom: 1, pan: { x: 0, y: 0 } });
    const isPanningRef = useRef(false);
    const panStartRef = useRef({ x: 0, y: 0 });
    const viewStartRef = useRef({ x: 0, y: 0 });
    
    const tokenSizeDebounceRef = useRef<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const allEntities = useMemo(() => [
        ...activePlayers.map(p => ({...p.character_data, id: p.id, type: 'player' as const})),
        ...npcs.map(n => ({...n.character_data, id: n.id, type: 'npc' as const}))
    ], [activePlayers, npcs]);

    useEffect(() => {
        if (activeMap?.tokenSize) {
            setTokenSizeValue(activeMap.tokenSize);
        }
        // Reset view when map changes
        setLocalView({ zoom: 1, pan: { x: 0, y: 0 } });
    }, [activeMap]);

    // Token Syncing Logic
    useEffect(() => {
        if (!activeMap) return;

        const sanitizedEntityIds = allEntities.map(e => e.id.replace(/[.#$[\]]/g, '_'));
        const currentTokenIds = Object.keys(activeMap.tokens || {});
        const updates: {[key: string]: any} = {};
        
        sanitizedEntityIds.forEach(id => {
            if (!currentTokenIds.includes(id)) {
                 updates[id] = { x: (activeMap.imageWidth || 1000) * 0.1, y: (activeMap.imageHeight || 1000) * 0.1, visible: true };
            }
        });

        currentTokenIds.forEach(id => {
            if (!sanitizedEntityIds.includes(id)) {
                updates[id] = null;
            }
        });

        if(Object.keys(updates).length > 0) {
            db.ref(`DND/maps/${activeMap.id}/tokens`).update(updates);
        }
    }, [allEntities, activeMap]);


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
        if (!activeMap?.imageWidth || !activeMap?.imageHeight || !viewportSize.width || !viewportSize.height) {
            return { display: 'none' };
        }
        const imageRatio = activeMap.imageWidth / activeMap.imageHeight;
        const viewportRatio = viewportSize.width / viewportSize.height;

        let style = {};
        if (imageRatio > viewportRatio) {
            style = { width: '100%', height: `${viewportSize.width / imageRatio}px` };
        } else {
            style = { height: '100%', width: `${viewportSize.height * imageRatio}px` };
        }
        return { ...style, position: 'relative' as const };
    }, [activeMap, viewportSize]);

    const handleSetActiveMap = (mapId: string) => {
        db.ref('DND/game_state/activeMapId').set(mapId);
    };

    const handleDeleteMap = async (map: MapData) => {
        if (!window.confirm(`Are you sure you want to delete the map "${map.name}"? This cannot be undone.`)) return;

        try {
            await storage.ref(map.storagePath).delete();
            await db.ref(`DND/maps/${map.id}`).remove();

            if (activeMap?.id === map.id) {
                const otherMaps = allMaps.filter(m => m.id !== map.id);
                handleSetActiveMap(otherMaps.length > 0 ? otherMaps[0].id : null);
            }
        } catch (error) {
            console.error("Failed to delete map:", error);
            setMapError("Could not delete map. Check console for details.");
        }
    };
    
    const createNewMap = async (newMapData: Omit<MapData, 'id'>) => {
        const newMapRef = await db.ref('DND/maps').push(newMapData);
        if (!activeMap) {
            handleSetActiveMap(newMapRef.key!);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const name = window.prompt("Enter a name for the new map:", file.name.replace(/\.[^/.]+$/, ""));
        if (!name) return;

        setIsProcessing(true);
        setMapError(null);
        
        const img = new Image();
        img.onload = async () => {
            try {
                const filePath = `DND/maps/${Date.now()}-${file.name}`;
                const storageRef = storage.ref(filePath);
                const snapshot = await storageRef.put(file);
                const downloadURL = await snapshot.ref.getDownloadURL();
                
                await createNewMap({
                    name,
                    imageUrl: downloadURL,
                    storagePath: filePath,
                    imageWidth: img.naturalWidth,
                    imageHeight: img.naturalHeight,
                    tokens: {},
                    tokenSize: 1,
                });

            } catch (err: any) {
                setMapError("Failed to upload map: " + err.message);
            } finally {
                setIsProcessing(false);
                URL.revokeObjectURL(img.src);
                 if (fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        img.onerror = () => {
            setMapError("Could not read image file.");
            setIsProcessing(false);
        }
        img.src = URL.createObjectURL(file);
    };

    const handleGenerateMap = async () => {
        if (!mapGenPrompt.trim() || !isApiKeyAvailable) return;

        setIsProcessing(true);
        setMapError(null);
        try {
            const base64Data = await generateMapImage(mapGenPrompt);
            const img = new Image();
            img.onload = async () => {
                const imageBlob = await (await fetch(img.src)).blob();
                const filePath = `DND/maps/ai-${Date.now()}.jpeg`;
                const storageRef = storage.ref(filePath);
                const snapshot = await storageRef.put(imageBlob);
                const downloadURL = await snapshot.ref.getDownloadURL();
                
                await createNewMap({
                    name: mapGenPrompt,
                    imageUrl: downloadURL,
                    storagePath: filePath,
                    imageWidth: img.naturalWidth,
                    imageHeight: img.naturalHeight,
                    tokens: {},
                    tokenSize: 1,
                });

                setMapGenPrompt('');
            };
            img.onerror = () => { throw new Error("Could not process generated image data."); }
            img.src = `data:image/jpeg;base64,${base64Data}`;

        } catch (err: any) {
            setMapError(err.message);
        } finally {
             setIsProcessing(false);
        }
    };

    const handleToggleVisibility = (entityId: string, currentVisibility: boolean) => {
        if (!activeMap) return;
        db.ref(`DND/maps/${activeMap.id}/tokens/${entityId}/visible`).set(!currentVisibility);
    };

    const handleTokenSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!activeMap) return;
        const newSize = parseFloat(e.target.value);
        setTokenSizeValue(newSize);
        if (tokenSizeDebounceRef.current) clearTimeout(tokenSizeDebounceRef.current);
        tokenSizeDebounceRef.current = setTimeout(() => {
            db.ref(`DND/maps/${activeMap.id}/tokenSize`).set(newSize);
        }, 100);
    };
    
    const handleTokenDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const entityId = e.dataTransfer.getData("entityId");
        if (!entityId || !mapContainerRef.current || !activeMap?.imageWidth || !activeMap?.imageHeight) return;
        
        const mapRect = mapContainerRef.current.getBoundingClientRect();
        
        const xOnMap = e.clientX - mapRect.left;
        const yOnMap = e.clientY - mapRect.top;

        const xPixel = (xOnMap / mapRect.width) * activeMap.imageWidth;
        const yPixelFromTop = (yOnMap / mapRect.height) * activeMap.imageHeight;
        const yPixelFromBottom = activeMap.imageHeight - yPixelFromTop;

        const clampedX = Math.max(0, Math.min(activeMap.imageWidth, xPixel));
        const clampedY = Math.max(0, Math.min(activeMap.imageHeight, yPixelFromBottom));

        db.ref(`DND/maps/${activeMap.id}/tokens/${entityId}`).update({ x: clampedX, y: clampedY });
    }, [activeMap]);

    // --- Viewport controls ---
    const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
        e.preventDefault();
        const rect = viewportRef.current!.getBoundingClientRect();
        const zoomFactor = 1.1;
        const newZoom = e.deltaY < 0 ? localView.zoom * zoomFactor : localView.zoom / zoomFactor;
        const clampedZoom = Math.max(0.25, Math.min(8, newZoom));
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const newPanX = mouseX - ((mouseX - localView.pan.x) * (clampedZoom / localView.zoom));
        const newPanY = mouseY - ((mouseY - localView.pan.y) * (clampedZoom / localView.zoom));
        setLocalView({ zoom: clampedZoom, pan: { x: newPanX, y: newPanY }});
    }, [localView]);

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('[draggable="true"]') || e.button !== 0) return;
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
        setLocalView(prev => ({ ...prev, pan: { x: viewStartRef.current.x + dx, y: viewStartRef.current.y + dy }}));
    }, []);
    
    const handleMouseUpOrLeave = useCallback(() => { isPanningRef.current = false; }, []);
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();

    return (
        <div className="bg-slate-800/80 p-4 rounded-lg border border-slate-600 space-y-4">
            <h2 className="font-display text-2xl text-amber-300">Map Management</h2>
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700 space-y-2">
                        <h3 className="font-display text-xl text-amber-300">Add New Map</h3>
                        <div className="flex gap-2">
                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden"/>
                            <button onClick={() => fileInputRef.current?.click()} className="flex-1 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-bold text-sm flex items-center justify-center gap-2" disabled={isProcessing}>
                                <ArrowUpTrayIcon className="h-5 w-5"/> Upload Map
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <input type="text" value={mapGenPrompt} onChange={e => setMapGenPrompt(e.target.value)} placeholder={isApiKeyAvailable ? "e.g., A forest clearing with a river..." : "AI map generation disabled."} className="flex-grow bg-slate-900 border border-slate-500 rounded p-2 text-sm" disabled={isProcessing || !isApiKeyAvailable}/>
                            <button onClick={handleGenerateMap} className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded font-bold text-sm flex items-center justify-center gap-2 disabled:bg-gray-500 disabled:cursor-not-allowed" disabled={isProcessing || !mapGenPrompt.trim() || !isApiKeyAvailable}>
                                <SparklesIcon className="h-5 w-5"/> Generate
                            </button>
                        </div>
                    </div>
                    {isProcessing && <Loader message="Map is being conjured..."/>}
                    {mapError && <p className="text-red-400 text-center text-sm">{mapError}</p>}
                </div>

                <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                    <h3 className="font-display text-xl text-amber-300 mb-2">Available Maps</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[25vh] overflow-y-auto custom-scrollbar pr-1">
                        {allMaps.map(map => (
                            <div key={map.id} className={`relative rounded-md overflow-hidden border-2 ${activeMap?.id === map.id ? 'border-amber-400' : 'border-transparent'}`}>
                                <img src={map.imageUrl} alt={map.name} className="aspect-video object-cover"/>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-1.5">
                                    <p className="text-white text-xs font-bold truncate">{map.name}</p>
                                    <div className="flex items-center gap-1 mt-1">
                                        <button onClick={() => handleSetActiveMap(map.id)} disabled={activeMap?.id === map.id} className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-800/50 text-white rounded px-2 py-0.5 text-xs flex items-center justify-center gap-1">
                                            <CheckCircleIcon className="h-3 w-3"/> Set Active
                                        </button>
                                        <button onClick={() => handleDeleteMap(map)} className="bg-red-700 hover:bg-red-800 text-white p-1 rounded">
                                            <TrashIcon className="h-3 w-3"/>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                         {allMaps.length === 0 && <p className="text-slate-500 italic text-sm col-span-full text-center">No maps created yet.</p>}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div
                    ref={viewportRef}
                    className="xl:col-span-2 w-full min-h-[50vh] bg-slate-900 rounded-lg relative overflow-hidden border-2 border-slate-600 cursor-grab flex items-center justify-center"
                    onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUpOrLeave} onMouseLeave={handleMouseUpOrLeave}
                >
                    {activeMap?.imageUrl ? (
                         <div className="absolute" style={{ transform: `translate(${localView.pan.x}px, ${localView.pan.y}px) scale(${localView.zoom})`, transformOrigin: 'top left' }}>
                            <div ref={mapContainerRef} style={mapContainerStyle} onDragOver={handleDragOver} onDrop={handleTokenDrop}>
                                <img src={activeMap.imageUrl} alt="Game Map" className="w-full h-full pointer-events-none select-none"/>
                                {activeMap.tokens && Object.entries(activeMap.tokens).map(([entityId, tokenData]) => {
                                    const entity = allEntities.find(e => e.id.replace(/[.#$[\]]/g, '_') === entityId);
                                    if (!entity || !tokenData) return null;
                                    return <EntityToken key={entityId} name={entity.name} avatarUrl={entity.avatarUrl} tokenData={tokenData} tokenSize={activeMap.tokenSize} showName={entity.type === 'player'} imageWidth={activeMap.imageWidth} imageHeight={activeMap.imageHeight} onDragStart={(e) => e.dataTransfer.setData("entityId", entityId)}/>;
                                })}
                            </div>
                        </div>
                    ) : (
                        <p className="font-display text-xl text-slate-500 text-center p-8">No map selected. Please upload, generate, or select an active map.</p>
                    )}
                </div>
                
                <div className="space-y-2">
                    <h3 className="font-display text-xl text-amber-300">Active Map Settings</h3>
                    <div className={`bg-slate-900/70 p-3 rounded space-y-4 ${!activeMap ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div>
                            <label htmlFor="token-size" className="block text-sm font-bold text-slate-400 mb-1">Token Size ({tokenSizeValue.toFixed(2)}x)</label>
                            <input id="token-size" type="range" min="0.25" max="2.5" step="0.05" value={tokenSizeValue} onChange={handleTokenSizeChange} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" disabled={!activeMap}/>
                        </div>
                        <div>
                            <h4 className="font-display text-lg text-amber-300">Entities on Map</h4>
                            <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1 custom-scrollbar mt-2">
                                {activeMap && allEntities.map(entity => {
                                    const entityId = entity.id.replace(/[.#$[\]]/g, '_');
                                    const tokenData = activeMap.tokens?.[entityId];
                                    if (!tokenData) return null;

                                    return (
                                        <div key={entityId} className="flex items-center justify-between bg-slate-800/70 p-2 rounded">
                                            <span className={`truncate text-sm ${entity.type === 'player' ? 'text-green-300' : 'text-purple-300'}`}>{entity.name}</span>
                                            <button onClick={() => handleToggleVisibility(entityId, tokenData.visible)} title={tokenData.visible ? 'Hide' : 'Show'}>
                                                {tokenData.visible ? <EyeIcon className="h-5 w-5 text-slate-300 hover:text-white" /> : <EyeSlashIcon className="h-5 w-5 text-slate-500 hover:text-slate-300" />}
                                            </button>
                                        </div>
                                    )
                                })}
                                {!activeMap && <p className="text-slate-500 text-sm italic">No active map.</p>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MapManager;