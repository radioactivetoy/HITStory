import React, { useMemo } from 'react';
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

    // Group consecutive cards with the same year
    const clusteredTimeline = useMemo(() => {
        if (player.timeline.length === 0) return [];

        const clusters: { year: number, cards: { data: Song, originalIndex: number }[] }[] = [];
        let currentCluster = { year: player.timeline[0].year, cards: [{ data: player.timeline[0], originalIndex: 0 }] };

        for (let i = 1; i < player.timeline.length; i++) {
            const card = player.timeline[i];
            if (card.year === currentCluster.year) {
                currentCluster.cards.push({ data: card, originalIndex: i });
            } else {
                clusters.push(currentCluster);
                currentCluster = { year: card.year, cards: [{ data: card, originalIndex: i }] };
            }
        }
        clusters.push(currentCluster);
        return clusters;
    }, [player.timeline]);

    return (
        <div className="flex overflow-x-auto w-full mx-auto snap-x scrollbar-thick-custom min-h-[500px] pt-8 pb-8">
            <div className="flex gap-6 m-auto px-8 items-start">
                {/* Start Gap (Always Index 0) */}
                {isInteractable && onGapClick && (
                    <button
                        onClick={() => onGapClick(0)}
                        className={`relative w-12 h-96 mt-4 shrink-0 rounded-xl border-2 border-dashed flex items-center justify-center group transition-all snap-center ${selectedGap === 0
                            ? 'bg-yellow-500/20 border-yellow-500 animate-pulse'
                            : 'bg-white/5 border-white/20 hover:bg-green-500/20 hover:border-green-500'
                            }`}
                    >
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-green-500 group-hover:text-black transition-colors">
                            <Plus size={20} className={`${selectedGap === 0 ? 'text-yellow-500' : 'text-neutral-400 group-hover:text-black'}`} />
                        </div>
                        {challenges && challenges.filter(c => c.index === 0).length > 0 && (
                            <div className="absolute -top-3 right-0">
                                <div className="w-6 h-6 rounded-full bg-red-500 border-2 border-white animate-bounce shadow-md flex items-center justify-center text-xs font-bold text-white">
                                    !
                                </div>
                            </div>
                        )}
                    </button>
                )}

                {clusteredTimeline.map((group, groupIndex) => (
                    <React.Fragment key={`group-${groupIndex}`}>
                        {/* Card Stack */}
                        <div
                            className="relative w-56 shrink-0 snap-center"
                            style={{
                                height: `${24 + (group.cards.length - 1) * 3}rem` // Dynamic height: base 24rem (96) + 3rem offset per extra card
                            }}
                        >
                            {group.cards.map((item, localIndex) => (
                                <div
                                    key={item.data.id}
                                    className="absolute w-56 h-96 rounded-2xl overflow-hidden shadow-2xl border border-white/10 hover:border-white/30 transition-all duration-300 group"
                                    style={{
                                        top: `${localIndex * 3}rem`, // Stack Offset (Solitaire style)
                                        zIndex: localIndex + 10,
                                        transform: `translateZ(0)` // Optimize render
                                    }}
                                >
                                    <div className="relative w-full h-56 overflow-hidden">
                                        <img src={item.data.image} alt={item.data.title} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-linear-to-t from-black/90 to-transparent opacity-80"></div>
                                    </div>
                                    <div className="absolute bottom-0 inset-x-0 top-56 bg-neutral-900/90 backdrop-blur-md p-4 border-t border-white/5 flex flex-col items-center text-center gap-1">
                                        <span className="text-4xl font-black text-white tracking-tighter drop-shadow-md leading-none mb-1">{item.data.year}</span>
                                        <span className="text-xs font-bold text-green-400 line-clamp-2 leading-tight">{item.data.title}</span>
                                        <span className="text-xs text-neutral-400 line-clamp-1">{item.data.artist}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Gap After Group */}
                        {/* The logical insertion index is after the LAST card of this group */}
                        {isInteractable && onGapClick && (
                            <button
                                onClick={() => onGapClick(group.cards[group.cards.length - 1].originalIndex + 1)}
                                className={`relative w-12 h-96 mt-4 shrink-0 rounded-xl border-2 border-dashed flex items-center justify-center group transition-all snap-center ${selectedGap === group.cards[group.cards.length - 1].originalIndex + 1
                                    ? 'bg-yellow-500/20 border-yellow-500 animate-pulse'
                                    : 'bg-white/5 border-white/20 hover:bg-green-500/20 hover:border-green-500'
                                    }`}
                            >
                                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-green-500 group-hover:text-black transition-colors">
                                    <Plus size={20} className={`${selectedGap === group.cards[group.cards.length - 1].originalIndex + 1 ? 'text-yellow-500' : 'text-neutral-400 group-hover:text-black'}`} />
                                </div>
                                {challenges && challenges.some(c => c.index === group.cards[group.cards.length - 1].originalIndex + 1) && (
                                    <div className="absolute -top-3 right-0">
                                        <div className="w-6 h-6 rounded-full bg-red-500 border-2 border-white animate-bounce shadow-md flex items-center justify-center text-xs font-bold text-white">
                                            !
                                        </div>
                                    </div>
                                )}
                            </button>
                        )}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};
