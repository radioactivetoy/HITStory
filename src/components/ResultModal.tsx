import React from 'react';
import type { Song, Player } from '../types';
import { CheckCircle, XCircle, AlertTriangle, ArrowRight } from 'lucide-react';

interface ResultModalProps {
    isOpen: boolean;
    song: Song | null;
    result: { correct: boolean; actualYear: number; stolenBy?: string; tokenChanges?: Record<string, number> } | undefined;
    onNextTurn: () => void;
    players: Player[];
}

export const ResultModal: React.FC<ResultModalProps> = ({ isOpen, song, result, onNextTurn, players }) => {
    if (!isOpen || !song || !result) return null;

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 animate-fade-in backdrop-blur-sm">
            <div className="bg-neutral-800 p-8 rounded-3xl max-w-lg w-full border-2 border-neutral-700 shadow-2xl relative flex flex-col items-center gap-6 overflow-hidden">

                {/* Background Glow */}
                <div className={`absolute inset-0 opacity-20 ${result.correct ? 'bg-green-500' : 'bg-red-500'}`} />

                {/* Header Status */}
                <div className="z-10 flex flex-col items-center">
                    {result.correct ? (
                        <>
                            <CheckCircle size={64} className="text-green-500 mb-2 animate-bounce" />
                            <h2 className="text-4xl font-extrabold text-green-400 tracking-wider">CORRECT!</h2>
                        </>
                    ) : (
                        <>
                            <XCircle size={64} className="text-red-500 mb-2 animate-shake" />
                            <h2 className="text-4xl font-extrabold text-red-500 tracking-wider">WRONG!</h2>
                        </>
                    )}
                </div>

                {/* Song Card Reveal */}
                <div className="z-10 bg-neutral-900 p-6 rounded-2xl border border-neutral-600 shadow-xl flex flex-col items-center transform transition-all hover:scale-105 w-full max-w-md">
                    <img src={song.image} alt={song.title} className="w-64 h-64 object-cover rounded-xl shadow-lg mb-6" />
                    <div className="text-center w-full px-2">
                        <div className="text-4xl font-bold text-white mb-2">{result.actualYear}</div>
                        <div className="text-xl text-green-400 font-bold mb-1 leading-tight break-words">{song.title}</div>
                        <div className="text-md text-neutral-400 font-medium break-words">{song.artist}</div>
                    </div>
                </div>

                {/* Challenge Result Info */}
                {result.stolenBy && (
                    <div className="z-10 bg-yellow-500/20 border border-yellow-500/50 p-4 rounded-xl w-full flex items-center gap-4 animate-pulse">
                        <AlertTriangle className="text-yellow-500 shrink-0" size={24} />
                        <div>
                            <div className="font-bold text-yellow-500 text-lg">CARD STOLEN!</div>
                            <div className="text-neutral-300 text-sm">
                                <span className="font-bold text-white">{result.stolenBy}</span> correctly challenged and took the card!
                            </div>
                        </div>
                    </div>
                )}

                {/* Token Changes Display */}
                {result.tokenChanges && Object.keys(result.tokenChanges).length > 0 && (
                    <div className="w-full bg-neutral-900/50 rounded-xl p-4 border border-neutral-700">
                        <h4 className="text-sm font-bold text-neutral-400 mb-2 uppercase tracking-wide text-center">Token Updates</h4>
                        <div className="flex flex-wrap gap-3 justify-center">
                            {Object.entries(result.tokenChanges).map(([pid, change]) => {
                                const p = players.find(pl => pl.id === pid);
                                if (!p) return null;
                                return (
                                    <div key={pid} className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-2 ${change > 0 ? 'bg-yellow-500/20 border-yellow-500 text-yellow-500' : 'bg-red-500/20 border-red-500 text-red-500'}`}>
                                        <span style={{ color: p.color }}>{p.name}</span>
                                        <span>{change > 0 ? '+' : ''}{change}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Next Turn Button (or Timer) */}
                <button
                    onClick={onNextTurn}
                    className="z-10 mt-4 bg-neutral-100 hover:bg-white text-black px-8 py-3 rounded-full font-bold text-lg flex items-center gap-2 shadow-lg transition-transform hover:scale-105"
                >
                    Next Turn <ArrowRight size={20} />
                </button>
            </div>
        </div>
    );
};
