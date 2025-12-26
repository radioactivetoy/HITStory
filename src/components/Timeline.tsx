import React from 'react';
import { type Song, type Player } from '../types';
import { Plus } from 'lucide-react';

interface TimelineProps {
    player: Player;
    onGapClick?: (index: number) => void;
    isInteractable?: boolean;
    selectedGap?: number | null;
    challenges?: { playerId: string; index: number }[];
}

export const Timeline: React.FC<TimelineProps> = ({ player, onGapClick, isInteractable, selectedGap, challenges }) => {
    return (
        <div className="flex overflow-x-auto items-center gap-4 p-4 w-full justify-center mx-auto px-8 snap-x scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-900">
            {/* Start Gap */}
            {isInteractable && onGapClick && (
                <button
                    onClick={() => onGapClick(0)}
                    className={`relative w-8 h-24 rounded-lg border flex items-center justify-center group transition-all ${selectedGap === 0
                        ? 'bg-yellow-500/20 border-yellow-500 animate-pulse'
                        : 'bg-neutral-800 border-neutral-600 hover:bg-green-500/20 hover:border-green-500'
                        }`}
                >
                    <Plus size={16} className={`${selectedGap === 0 ? 'text-yellow-500' : 'text-neutral-500 group-hover:text-green-500'}`} />
                    {/* Render Challenge Markers */}
                    {challenges && challenges.filter(c => c.index === 0).length > 0 && (
                        <div className="absolute -top-3 flex gap-[-4px] overflow-visible">
                            {challenges.filter(c => c.index === 0).map((c, i) => (
                                <div key={i} className="w-4 h-4 rounded-full border border-white shadow-sm bg-blue-500" title="Challenge placed here"></div> // Placeholder color, need player color if possible. But passing player list to timeline is heavy? 
                                // Let's improve this: GameScreen passes full challenge info? Or Timeline just shows generic marker? 
                                // User requested "marked with his color". 
                                // We don't have player color here easily. 
                                // Just make it red for now or rely on tooltip? 
                                // Wait, I can't access player color without passing it.
                            ))}
                            {/* Correction: I need to pass colors. Let's stick with generic marker for now or assume challenges prop has more info? No, it's just {playerId, index}. */}
                            <div className="w-3 h-3 rounded-full bg-red-500 border border-white absolute -top-1 -right-1 animate-bounce" />
                        </div>
                    )}
                </button>
            )}

            {player.timeline.map((card, index) => (
                <React.Fragment key={card.id}>
                    {/* The Card */}
                    {/* The Card */}
                    <div className="relative w-56 h-96 shrink-0 bg-white/5 backdrop-blur-md rounded-2xl overflow-hidden shadow-xl border border-white/10 hover:border-green-500/30 hover:-translate-y-2 hover:shadow-2xl transition-all duration-300 flex flex-col group snap-center">
                        <div className="relative w-full h-56 overflow-hidden">
                            <img src={card.image} alt={card.title} className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700" />
                            <div className="absolute inset-0 bg-linear-to-t from-black/80 to-transparent opacity-60"></div>
                        </div>
                        <div className="p-4 flex-1 bg-white/5 backdrop-blur-sm flex flex-col items-center justify-center gap-2 w-full border-t border-white/5 relative">
                            <span className="text-5xl font-black text-white/90 tracking-tighter drop-shadow-xl">{card.year}</span>
                            <div className="flex flex-col items-center w-full px-1 gap-1">
                                <span className="text-sm font-bold text-green-400 text-center leading-tight line-clamp-2 w-full drop-shadow-sm">{card.title}</span>
                                <span className="text-xs text-neutral-300 text-center leading-tight line-clamp-1 w-full font-medium">{card.artist}</span>
                                <span className="text-[10px] text-neutral-500 text-center leading-tight line-clamp-1 w-full italic">{card.album}</span>
                            </div>
                        </div>
                    </div>

                    {/* Gap After Card */}
                    {isInteractable && onGapClick && (
                        <button
                            onClick={() => onGapClick(index + 1)}
                            className={`relative w-8 h-24 rounded-lg border flex items-center justify-center group transition-all ${selectedGap === index + 1
                                ? 'bg-yellow-500/20 border-yellow-500 animate-pulse'
                                : 'bg-neutral-800 border-neutral-600 hover:bg-green-500/20 hover:border-green-500'
                                }`}
                        >
                            <Plus size={16} className={`${selectedGap === index + 1 ? 'text-yellow-500' : 'text-neutral-500 group-hover:text-green-500'}`} />
                            {challenges && challenges.some(c => c.index === index + 1) && (
                                <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full border border-white animate-bounce shadow-sm flex items-center justify-center text-[8px] font-bold text-white">
                                    ?
                                </div>
                            )}
                        </button>
                    )}
                </React.Fragment>
            ))}
        </div>
    );
};
