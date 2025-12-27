import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { fetchPlaylist } from '../lib/spotify';
import { type Difficulty } from '../types';
import { Plus, Play } from 'lucide-react';
import GameLogo from '../assets/HITStory_Logo.png';
import { PRESET_PLAYLISTS } from '../data/playlists';

export const SetupScreen: React.FC = () => {
    const { state, dispatch, login, logout, token } = useGame();
    const [name, setName] = useState('');
    const [difficulty, setDifficulty] = useState<Difficulty>('NORMAL');
    const [playlistId, setPlaylistId] = useState('37YqxciF6wUEsHVckLIIDE'); // User preferred default

    const [color, setColor] = useState('#10B981');
    const [targetScore, setTargetScore] = useState(10);
    const AVAILABLE_COLORS = ['#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

    const [selectedPlaylistOption, setSelectedPlaylistOption] = useState(PRESET_PLAYLISTS[0].id);

    // Sync manual ID when preset changes
    const handlePlaylistChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setSelectedPlaylistOption(val);
        if (val !== 'CUSTOM') {
            setPlaylistId(val);
        } else {
            setPlaylistId('');
        }
    };

    const handleAddPlayer = () => {
        if (!name.trim() || state.players.length >= 8) return;

        // Ensure we don't duplicate color if user didn't change it or state is stale
        const usedColors = new Set(state.players.map(p => p.color));
        let colorToAdd = color;

        if (usedColors.has(color)) {
            const firstFree = AVAILABLE_COLORS.find(c => !usedColors.has(c));
            if (!firstFree) return; // Should not happen with 8 limit
            colorToAdd = firstFree;
        }

        dispatch({ type: 'ADD_PLAYER', payload: { name, difficulty, color: colorToAdd } });
        setName('');

        // Auto-select next free color for convenience
        usedColors.add(colorToAdd);
        const nextFree = AVAILABLE_COLORS.find(c => !usedColors.has(c));
        if (nextFree) setColor(nextFree);
    };

    const handleStartGame = async () => {
        if (state.players.length < 1 || !token) return;

        let finalName = 'My Playlist';
        try {
            const data = await fetchPlaylist(token, playlistId);
            if (data && data.name) {
                finalName = data.name;
            }
        } catch (e) {
            console.error("Failed to fetch playlist name", e);
        }

        dispatch({ type: 'START_GAME', payload: { playlistId, targetScore, playlistName: finalName } });
    };

    if (!token) {
        return (
            <div className="flex h-screen items-center justify-center flex-col gap-4">
                <img src={GameLogo} alt="HITStory Logo" className="w-96 max-w-full h-auto drop-shadow-2xl hover:scale-105 transition-transform duration-500" />
                <button onClick={login}
                    className="bg-green-500 hover:bg-green-600 text-black font-bold py-3 px-8 rounded-full transition-all transform hover:scale-105"
                >
                    Login with Spotify
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4">
            <div className="bg-neutral-800 p-8 rounded-2xl shadow-2xl w-full max-w-lg border border-neutral-700 relative">
                <div className="flex justify-between items-center mb-6">
                    <img src={GameLogo} alt="HITStory" className="h-24 w-auto object-contain drop-shadow-lg transform hover:scale-105 transition-transform" />
                    <button
                        onClick={() => {
                            if (window.confirm("Are you sure you want to logout?")) {
                                logout();
                            }
                        }}
                        className="bg-red-600/20 text-red-200 hover:bg-red-600/40 border border-red-500/50 px-3 py-1 rounded-full text-xs font-bold transition-all"
                    >
                        Re-Login / Logout
                    </button>
                </div>

                <div className="mb-6 space-y-4">
                    {/* Player Entry */}
                    <div className="flex flex-col gap-3 p-4 bg-neutral-900/50 rounded-xl border border-neutral-700">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Player Name"
                                className="flex-1 bg-neutral-800 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-green-500 outline-none border border-neutral-600"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddPlayer()}
                            />
                            <select
                                className="bg-neutral-800 text-white px-4 py-2 rounded-lg outline-none border border-neutral-600"
                                value={difficulty}
                                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                            >
                                <option value="NORMAL">Normal</option>
                                <option value="PRO">Pro</option>
                                <option value="EXPERT">Expert</option>
                            </select>
                        </div>

                        {/* Color Picker */}
                        <div className="flex gap-2 items-center overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-neutral-700">
                            <span className="text-xs text-neutral-400 font-bold mr-2">Color:</span>
                            {AVAILABLE_COLORS.map(c => {
                                const isTaken = state.players.some(p => p.color === c);
                                return (
                                    <button
                                        key={c}
                                        onClick={() => !isTaken && setColor(c)}
                                        disabled={isTaken}
                                        className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c
                                            ? 'border-white scale-110 ring-2 ring-white/20'
                                            : isTaken
                                                ? 'opacity-20 cursor-not-allowed border-neutral-800 filter grayscale'
                                                : 'border-transparent opacity-50 hover:opacity-100 hover:scale-110'
                                            }`}
                                        style={{ backgroundColor: c }}
                                    />
                                );
                            })}
                        </div>

                        <button
                            onClick={handleAddPlayer}
                            disabled={state.players.length >= 8}
                            className={`w-full p-2 rounded-lg transition-colors font-bold flex items-center justify-center gap-2 ${state.players.length >= 8 ? 'bg-neutral-700 text-neutral-500 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600 text-black'}`}
                        >
                            <Plus size={20} /> {state.players.length >= 8 ? 'Max Players Reached (8)' : 'Add Player'}
                        </button>
                    </div>

                    {/* Player List */}
                    <div className="bg-neutral-900 rounded-lg p-4 min-h-[150px] max-h-[300px] overflow-y-auto">
                        {state.players.length === 0 ? (
                            <p className="text-neutral-500 text-center italic mt-12">Add players above...</p>
                        ) : (
                            <ul className="space-y-2">
                                {state.players.map(p => (
                                    <li key={p.id} className="flex justify-between items-center bg-neutral-800 p-3 rounded-md border border-neutral-700 animate-fade-in group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-black font-bold shadow-sm" style={{ backgroundColor: p.color }}>
                                                {p.name.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="font-semibold text-lg">{p.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs px-2 py-1 rounded font-bold ${p.difficulty === 'EXPERT' ? 'bg-red-900/50 text-red-200 border border-red-800' :
                                                p.difficulty === 'PRO' ? 'bg-yellow-900/50 text-yellow-200 border border-yellow-800' :
                                                    'bg-blue-900/50 text-blue-200 border border-blue-800'
                                                }`}>{p.difficulty}</span>
                                            <button
                                                onClick={() => dispatch({ type: 'REMOVE_PLAYER', payload: { playerId: p.id } })}
                                                className="text-neutral-500 hover:text-red-500 transition-colors p-1 opacity-0 group-hover:opacity-100"
                                                title="Remove Player"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="space-y-4 pt-4 border-t border-neutral-700">
                        <div className="space-y-1">
                            <div className="flex justify-between items-center">
                                <label className="text-xs text-neutral-400 uppercase font-bold tracking-wider">Target Score (Cards to Win)</label>
                                <span className="text-green-400 font-bold">{targetScore}</span>
                            </div>
                            <input
                                type="range"
                                min="3"
                                max="20"
                                value={targetScore}
                                onChange={(e) => setTargetScore(parseInt(e.target.value))}
                                className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs text-neutral-400 uppercase font-bold tracking-wider">Playlist</label>

                            <select
                                value={selectedPlaylistOption}
                                onChange={handlePlaylistChange}
                                className="w-full bg-neutral-700 text-neutral-300 px-3 py-2 rounded text-sm mb-2 outline-none focus:ring-1 focus:ring-green-500"
                            >
                                {PRESET_PLAYLISTS.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>

                            {selectedPlaylistOption === 'CUSTOM' && (
                                <input
                                    type="text"
                                    placeholder="Enter Spotify Playlist ID"
                                    value={playlistId}
                                    onChange={(e) => setPlaylistId(e.target.value)}
                                    className="w-full bg-neutral-800 text-white px-3 py-2 rounded text-sm font-mono focus:ring-1 focus:ring-green-500 outline-none border border-neutral-600 animate-fade-in"
                                />
                            )}
                        </div>
                    </div>

                    <button
                        onClick={handleStartGame}
                        disabled={state.players.length === 0}
                        className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all transform ${state.players.length > 0
                            ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:scale-105 shadow-lg shadow-green-900/20'
                            : 'bg-neutral-700 text-neutral-500 cursor-not-allowed'
                            }`}
                    >
                        <Play size={24} fill="currentColor" />
                        Start Game ({targetScore} cards)
                    </button>
                </div>
            </div>
        </div>
    );
};
