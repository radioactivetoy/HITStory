import React, { useEffect, useState } from 'react';
import { useGame } from '../context/GameContext';
import { Timeline } from './Timeline';
import { fetchPlaylist, fetchRandomTrack, playTrack, pauseTrack, getPlaybackState, seekTrack } from '../lib/spotify';
import { Play, RefreshCw, Pause, RotateCcw, FastForward, Rewind } from 'lucide-react';
import { ResultModal } from './ResultModal';
import GameLogo from '../assets/HITStory_Logo.png';

export const GameScreen: React.FC = () => {
    const { state, dispatch, token, deviceId, logout, login } = useGame();
    // ... [state decls] ...

    // ...



    // Auto-pause when revealing or game over
    const [playlistTotal, setPlaylistTotal] = useState<number>(0);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [revealData, setRevealData] = useState<{ correct: boolean, actualYear: number } | null>(null);
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [isChallengeModalOpen, setIsChallengeModalOpen] = useState(false);
    const [placingBetPlayerId, setPlacingBetPlayerId] = useState<string | null>(null);
    const [progressMs, setProgressMs] = useState<number>(0);
    const [durationMs, setDurationMs] = useState<number>(0);

    // Poll for progress when playing
    useEffect(() => {
        let interval: any;
        if (isPlaying && token) {
            // Immediate update
            getPlaybackState(token).then(s => {
                if (s && s.item) {
                    setProgressMs(s.progress_ms);
                    setDurationMs(s.item.duration_ms);
                }
            });

            interval = setInterval(() => {
                getPlaybackState(token).then(s => {
                    if (s && s.item) {
                        setProgressMs(s.progress_ms);
                        setDurationMs(s.item.duration_ms);
                    }
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isPlaying, token]);

    // Auto-pause when revealing or game over
    useEffect(() => {
        if ((state.currentPhase === 'REVEAL' || state.currentPhase === 'GAME_OVER') && isPlaying) {
            if (token && deviceId) {
                pauseTrack(token, deviceId).catch(err => console.error("Pause failed", err));
                setIsPlaying(false);
            }
        }
    }, [state.currentPhase, isPlaying, token, deviceId]);

    const activePlayer = state.players[state.activePlayerIndex];







    useEffect(() => {
        if (!token || playlistTotal > 0 || !state.players.length) return;
        const pid = state.settings.playlistId || '2wc7CFraGUUOXYfeHWTfFY';

        console.log('Fetching Playlist Info for:', pid);
        fetchPlaylist(token, pid).then(data => {
            console.log('Playlist Info:', data);
            if (data && data.tracks) {
                setPlaylistTotal(data.tracks.total);
            } else {
                console.error('Invalid playlist data:', data);
                const errorMsg = data?.error?.message || 'Check Playlist ID';
                setError(`Playlist Error: ${errorMsg}`);
            }
        }).catch(err => {
            console.error('Fetch Playlist Error:', err);
            setError(`Network Error: ${err.message}`);
        });
    }, [token, playlistTotal, state.players.length, state.settings.playlistId]);

    // Initial Card Distribution Effect
    useEffect(() => {
        const distributeCards = async () => {
            if (!token || playlistTotal === 0) return;
            const playersNeedingCards = state.players.filter(p => p.timeline.length === 0);

            if (playersNeedingCards.length === 0) return;

            console.log('Distributing initial cards to:', playersNeedingCards.length, 'players');
            setIsLoading(true);

            try {
                const pid = state.settings.playlistId || '37i9dQZF1DWTJzZ1pYFF9V';
                const updates = await Promise.all(playersNeedingCards.map(async (player) => {
                    let track = null;
                    let attempts = 0;
                    while (!track && attempts < 5) {
                        try {
                            track = await fetchRandomTrack(token, pid, playlistTotal);
                        } catch (e) { console.warn('Retry init card fetch', e); }
                        attempts++;
                    }

                    if (!track) return null;

                    const song = {
                        id: track.id,
                        title: track.name,
                        artist: track.artists[0].name,
                        album: track.album.name,
                        year: parseInt(track.album.release_date.split('-')[0]),
                        image: track.album.images[0].url,
                        uri: track.uri
                    };
                    return { playerId: player.id, song };
                }));

                const validUpdates = updates.filter((u): u is { playerId: string, song: any } => u !== null);
                if (validUpdates.length > 0) {
                    dispatch({ type: 'DISTRIBUTE_INITIAL_CARDS', payload: validUpdates });
                }
            } catch (err) {
                console.error('Error distributing initial cards:', err);
                setError('Failed to deal starting cards.');
            } finally {
                setIsLoading(false);
            }
        };
        distributeCards();
    }, [token, playlistTotal, state.players, dispatch]); // Added playlistTotal to deps to run only when ready

    const handlePlaySong = async () => {
        if (isLoading) return;
        setIsLoading(true);
        setError(null);

        if (!token) {
            setError("No Spotify Token found. Please re-login.");
            setIsLoading(false);
            return;
        }
        if (!deviceId) {
            setError("Player not connected. Wait for 'Player Ready' status.");
            setIsLoading(false);
            return;
        }

        const pid = state.settings.playlistId || '37i9dQZF1DWTJzZ1pYFF9V';

        try {
            console.log('Fetching random track from:', pid, 'Total:', playlistTotal);
            let track = null;
            let attempts = 0;
            const MAX_ATTEMPTS = 5;

            while (!track && attempts < MAX_ATTEMPTS) {
                if (attempts > 0) console.log(`Retry fetching track (${attempts + 1}/${MAX_ATTEMPTS})...`);
                try {
                    track = await fetchRandomTrack(token, pid, playlistTotal);
                } catch (err) {
                    console.warn('Track fetch failed, retrying...', err);
                }
                attempts++;
            }

            if (!track) {
                setError("Failed to fetch a track after multiple attempts. Playlist might be empty or network down.");
                setIsLoading(false);
                return;
            }

            const song = {
                id: track.id,
                title: track.name,
                artist: track.artists[0].name,
                album: track.album.name,
                year: parseInt(track.album.release_date.split('-')[0]),
                image: track.album.images[0].url,
                uri: track.uri
            };

            dispatch({ type: 'SET_CURRENT_SONG', payload: song });

            console.log('Playing:', song.uri);
            await playTrack(token, deviceId, song.uri);
            setIsPlaying(true);
        } catch (err: any) {
            console.error('Playback Error:', err);
            setError(`Error: ${err.message || 'Unknown playback error'}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGapClick = (index: number) => {
        if (state.currentPhase === 'CHALLENGE_PLACEMENT') {
            dispatch({ type: 'PLACE_CHALLENGE_BET', payload: { index } });
            return;
        }
        if (state.currentPhase === 'LISTENING') {
            dispatch({ type: 'GUESS_PLACEMENT', payload: { index } });
        }
    };

    const handleConfirmReveal = () => {
        dispatch({ type: 'CONFIRM_REVEAL' });
    };

    if (error) {
        const isAuthError = error.includes('token expired') || error.includes('401');
        return (
            <div className="flex h-screen items-center justify-center flex-col gap-4 text-red-500 bg-neutral-900">
                <h2 className="text-3xl font-bold">Error</h2>
                <p className="text-xl">{error}</p>
                <div className="flex gap-4 mt-6">
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-neutral-700 text-white px-6 py-3 rounded-full hover:bg-neutral-600 transition font-bold"
                    >
                        Refresh Page
                    </button>
                    <button
                        onClick={() => { logout(); login(); }}
                        className="bg-green-500 text-black px-6 py-3 rounded-full hover:bg-green-600 transition font-bold"
                    >
                        Re-Login
                    </button>
                    <button
                        onClick={() => {
                            localStorage.clear();
                            window.location.href = '/';
                        }}
                        className="bg-red-900/50 text-red-200 px-4 py-3 rounded-full hover:bg-red-900 transition font-bold text-sm"
                    >
                        Hard Reset
                    </button>
                </div>
            </div>
        );
    }

    if (!activePlayer) {
        return <div className="text-white p-8 text-center">Loading Game Data...</div>;
    }

    return (
        <div className="min-h-screen w-full bg-neutral-900 text-white flex flex-col items-center">
            <div className="w-full p-4 bg-neutral-800 shadow-md flex justify-between items-center">
                <div>
                    <img src={GameLogo} alt="HITStory" className="h-12 w-auto object-contain" />
                    {state.settings.playlistName && (
                        <div className="text-[10px] text-neutral-400 font-mono tracking-tighter opacity-70">
                            Playlist: {state.settings.playlistName}
                        </div>
                    )}
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={() => {
                            if (window.confirm("Are you sure you want to end the current game? All progress will be lost.")) {
                                window.localStorage.removeItem('hitstory_game_state');
                                window.location.reload();
                            }
                        }}
                        className="bg-red-900/40 hover:bg-red-600 border border-red-500/30 text-red-200 px-4 py-2 rounded-full text-xs font-bold transition-all"
                    >
                        End Game
                    </button>
                    {/* ... other helper buttons if needed */}
                </div>
                <div className="flex gap-4">
                    {state.players.map((p, i) => (
                        <div key={p.id} className={`flex items-center gap-3 px-4 py-2 rounded-full border transition-all ${p.hasWon ? 'bg-black/40 border-yellow-500/50 opacity-70' : i === state.activePlayerIndex ? 'bg-green-500/20 border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]' : 'bg-neutral-800 border-neutral-700'}`}>
                            <div className="flex flex-col leading-none">
                                <span className={`font-bold text-sm ${p.hasWon ? 'text-yellow-500' : i === state.activePlayerIndex ? 'text-green-400' : 'text-neutral-300'}`}>
                                    {p.name} {p.hasWon && `(#${p.rank})`}
                                </span>
                                {p.hasWon && <span className="text-[10px] text-yellow-500/80 uppercase tracking-wider">Finished</span>}
                                {!p.hasWon && i === state.activePlayerIndex && <span className="text-[10px] text-green-500/80 uppercase tracking-wider">Active</span>}
                            </div>

                            <div className="h-6 w-px bg-neutral-600 mx-1"></div>

                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1" title="Cards Collected">
                                    <span className="text-blue-400 text-xs">🎵</span>
                                    <span className="font-bold text-white">{p.timeline.length}</span>
                                </div>
                                {!p.hasWon && (
                                    <div className="flex items-center gap-1" title="Tokens">
                                        <div className="w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center text-black font-bold text-xs shadow-sm">
                                            {p.tokens}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Game Content */}
            <div className="flex-1 w-full flex flex-col items-center justify-center p-4 gap-4">
                <h2 className="text-4xl font-bold mb-2 animate-fade-in text-center min-h-[4rem] flex flex-col items-center justify-center">
                    {state.currentPhase === 'REVEAL' && (
                        <div className="flex flex-col items-center">
                            {state.lastResult?.correct ? (
                                <span className="text-green-500 block mb-2 drop-shadow-lg">✅ Correct!</span>
                            ) : (
                                <span className="text-red-500 block mb-2 drop-shadow-lg">
                                    ❌ Wrong! <span className="text-sm text-white block mt-1">(Year: {state.lastResult?.actualYear})</span>
                                    {state.lastResult?.stolenBy && (
                                        <span className="text-blue-400 block text-lg mt-1 animate-bounce">Stolen by {state.lastResult.stolenBy}! 😈</span>
                                    )}
                                </span>
                            )}
                            {state.winner && (
                                <span className="text-yellow-400 block mb-2 drop-shadow-lg">🎉 WE HAVE A WINNER! 🎉</span>
                            )}
                            {state.players.filter(p => p.hasWon).length > 0 && (
                                <span className="text-blue-400 block mb-2 drop-shadow-lg">🥈 Place Decided!</span>
                            )}
                        </div>
                    )}
                    {state.currentPhase === 'PRE_TURN' && `${activePlayer.name}'s Turn`}
                    {state.currentPhase === 'LISTENING' && `Listening...`}
                    {state.currentPhase === 'CHALLENGE_SELECTION' && `Who wants to challenge?`}
                    {state.currentPhase === 'CHALLENGE_PLACEMENT' && `Challenge Round!`}
                </h2>

                {/* Leaderboard Logic - Display ALWAYS if Game Over */}
                {state.currentPhase === 'GAME_OVER' && (
                    <div className="w-full max-w-md bg-neutral-800 rounded-xl p-6 border border-neutral-700 animate-fade-in mb-8">
                        <h3 className="text-2xl font-bold text-center mb-4 text-white">Current Standings</h3>
                        <ul className="space-y-2">
                            {/* Sort by Rank (if won) then by Cards */}
                            {[...state.players]
                                .sort((a, b) => (a.rank || 999) - (b.rank || 999) || b.timeline.length - a.timeline.length)
                                .map((p, i) => (
                                    <li key={p.id} className={`flex justify-between items-center p-3 rounded-lg ${p.rank === 1 ? 'bg-yellow-500/20 border border-yellow-500' : 'bg-neutral-700'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className="flex flex-col items-center w-8">
                                                {p.rank ? (
                                                    <span className="font-bold text-2xl">{p.rank}</span>
                                                ) : (
                                                    <span className="text-neutral-500 text-sm">#{state.players.filter(pl => pl.hasWon).length + 1 + [...state.players].filter(pl => !pl.hasWon && pl.timeline.length > p.timeline.length).length}</span>
                                                )}
                                                {p.rank === 1 && <span className="text-[10px]">👑</span>}
                                            </div>
                                            <span className="font-bold" style={{ color: p.color }}>{p.name}</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-xs text-neutral-400">Cards</span>
                                            <span className="font-bold" style={{ color: p.hasWon ? p.color : 'inherit' }}>{p.timeline.length}</span>
                                        </div>
                                    </li>
                                ))}
                        </ul>
                        {!state.winner && (
                            <button
                                onClick={() => window.location.reload()}
                                className="mt-6 w-full bg-green-500 hover:bg-green-400 text-black px-6 py-3 rounded-full font-bold shadow-lg"
                            >
                                Start New Game
                            </button>
                        )}
                    </div>
                )}

                {state.currentPhase === 'GAME_OVER' && state.winner && (
                    <div className="flex flex-col items-center gap-6 animate-fade-in bg-neutral-800/80 p-8 rounded-2xl border-2 border-yellow-500 shadow-2xl backdrop-blur-sm z-50">
                        <div className="text-6xl mb-4">
                            {state.players.filter(p => p.hasWon).length === 0 ? '🏆' : '🥈'}
                        </div>
                        <h2 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 animate-pulse text-center">
                            {state.winner.name}
                            {state.players.filter(p => p.hasWon).length === 0
                                ? ' Wins!'
                                : ` takes ${(state.players.filter(p => p.hasWon).length + 1) === 2 ? '2nd' : (state.players.filter(p => p.hasWon).length + 1) === 3 ? '3rd' : (state.players.filter(p => p.hasWon).length + 1) + 'th'} Place!`}
                        </h2>
                        <div className="text-2xl text-neutral-300">
                            Reached {state.settings.targetScore} cards!
                        </div>

                        <div className="flex gap-4 mt-4">
                            {/* Require at least 2 remaining players (losers) to continue. If only 1 loser left, game ends. */}
                            {state.players.filter(p => !p.hasWon && p.id !== state.winner?.id).length > 1 ? (
                                <>
                                    <button
                                        onClick={() => dispatch({ type: 'CONTINUE_GAME' })}
                                        className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-full font-bold text-lg shadow-lg transition-transform hover:scale-105 flex items-center gap-2"
                                    >
                                        Continue Playing <span className="text-xs opacity-75">(for {(state.players.filter(p => p.hasWon).length + 2) === 2 ? '2nd' : (state.players.filter(p => p.hasWon).length + 2) === 3 ? '3rd' : (state.players.filter(p => p.hasWon).length + 2) + 'th'} place)</span>
                                    </button>
                                    <button
                                        onClick={() => window.location.reload()}
                                        className="bg-neutral-600 hover:bg-neutral-500 text-white px-8 py-3 rounded-full font-bold text-lg shadow-xl transition-transform hover:scale-105"
                                    >
                                        New Game
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => window.location.reload()}
                                    className="bg-green-500 hover:bg-green-400 text-black px-8 py-3 rounded-full font-bold text-lg shadow-xl transition-transform hover:scale-105"
                                >
                                    Start New Game
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {state.currentPhase === 'PRE_TURN' && !revealData && (
                    <div className="flex flex-col items-center gap-4">
                        {error && (
                            <div className="bg-red-900/50 text-red-200 px-4 py-2 rounded text-sm text-center max-w-md border border-red-500/50">
                                {error}
                            </div>
                        )}

                        {!state.currentSong ? (
                            <button
                                onClick={handlePlaySong}
                                disabled={isLoading}
                                className={`px-8 py-4 rounded-full font-bold text-xl flex items-center gap-3 transition-all transform hover:scale-105 shadow-xl ${isLoading
                                    ? 'bg-neutral-600 text-neutral-400 cursor-wait'
                                    : 'bg-green-500 hover:bg-green-400 text-black'
                                    }`}
                            >
                                {isLoading ? (
                                    <>
                                        <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                        Loading...
                                    </>
                                ) : (
                                    <>
                                        <Play size={28} fill="currentColor" />
                                        Play Song
                                    </>
                                )}
                            </button>
                        ) : (
                            <div className="flex flex-col items-center gap-4 w-full max-w-md px-4 text-center">
                                <img src={state.currentSong.image} alt={state.currentSong.title} className="w-48 h-48 rounded-xl shadow-2xl" />
                                <div className="space-y-1">
                                    <p className="text-xl font-bold leading-tight break-words">{state.currentSong.title}</p>
                                    <p className="text-neutral-400 font-medium text-lg brake-words">{state.currentSong.artist}</p>
                                </div>
                                <button
                                    onClick={() => dispatch({ type: 'RESET_CURRENT_SONG' })}
                                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-full text-sm flex items-center gap-2"
                                >
                                    <RefreshCw size={16} /> Reset Song
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {state.currentPhase === 'LISTENING' && (
                    <div className="flex flex-col items-center gap-6">
                        <div className="flex items-center gap-8">
                            {/* Rewind Button */}
                            <button
                                onClick={async () => {
                                    if (!token || !deviceId) return;
                                    try {
                                        const state = await getPlaybackState(token);
                                        if (state && state.progress_ms !== null) {
                                            const newPos = Math.max(0, state.progress_ms - 20000);
                                            await seekTrack(token, deviceId, newPos);
                                        }
                                    } catch (e) {
                                        console.error("Seek failed", e);
                                    }
                                }}
                                className="p-3 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-all border border-neutral-700 hover:border-neutral-500"
                                title="-20s"
                            >
                                <Rewind size={24} />
                            </button>

                            {/* Main Playback Circle with SVG Progress */}
                            <div className="relative w-32 h-32 flex items-center justify-center">
                                {/* Pulse Effects */}
                                {isPlaying && (
                                    <>
                                        <div className="absolute inset-0 bg-green-500/30 rounded-full animate-ping" />
                                        <div className="absolute inset-0 bg-green-500/20 rounded-full animate-pulse blur-xl" />
                                    </>
                                )}

                                {/* SVG Progress Ring */}
                                <svg className="absolute inset-0 transform -rotate-90 pointer-events-none" width="128" height="128">
                                    <circle
                                        stroke="rgba(34, 197, 94, 0.2)"
                                        strokeWidth="4"
                                        fill="transparent"
                                        r="60"
                                        cx="64"
                                        cy="64"
                                    />
                                    <circle
                                        stroke="#22c55e"
                                        strokeWidth="4"
                                        fill="transparent"
                                        r="60"
                                        cx="64"
                                        cy="64"
                                        strokeDasharray={2 * Math.PI * 60}
                                        strokeDashoffset={2 * Math.PI * 60 - (progressMs / (durationMs || 1)) * 2 * Math.PI * 60}
                                        strokeLinecap="round"
                                        className="transition-all duration-300 linear" // Use linear for smoother progress if we had faster updates, usually ease-out looks ok-ish for 1s
                                    />
                                </svg>

                                <div className="w-24 h-24 bg-neutral-900 rounded-full flex items-center justify-center relative overflow-hidden group z-10 shadow-lg border border-neutral-700">
                                    <button
                                        onClick={async () => {
                                            if (!token || !deviceId || !state.currentSong) return;
                                            if (isPlaying) {
                                                await pauseTrack(token, deviceId);
                                                setIsPlaying(false);
                                            } else {
                                                await playTrack(token, deviceId, state.currentSong.uri);
                                                setIsPlaying(true);
                                            }
                                        }}
                                        className="w-full h-full flex items-center justify-center hover:bg-white/10 transition-colors"
                                    >
                                        {isPlaying ? (
                                            <Pause fill="currentColor" className="text-white w-8 h-8" />
                                        ) : (
                                            <Play fill="currentColor" className="text-white w-8 h-8 ml-1" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Fast Forward Button */}
                            <button
                                onClick={async () => {
                                    if (!token || !deviceId) return;
                                    try {
                                        const state = await getPlaybackState(token);
                                        if (state && state.progress_ms !== null) {
                                            const newPos = state.progress_ms + 20000;
                                            await seekTrack(token, deviceId, newPos);
                                        }
                                    } catch (e) {
                                        console.error("Seek failed", e);
                                    }
                                }}
                                className="p-3 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-all border border-neutral-700 hover:border-neutral-500"
                                title="+20s"
                            >
                                <FastForward size={24} />
                            </button>
                        </div>

                        {/* Restart Button */}
                        <button
                            onClick={async () => {
                                if (!token || !deviceId || !state.currentSong) return;
                                await playTrack(token, deviceId, state.currentSong.uri);
                                setIsPlaying(true);
                            }}
                            className="text-xs text-neutral-400 flex items-center gap-1 hover:text-white transition-colors"
                        >
                            <RotateCcw size={12} /> Restart Song
                        </button>

                        {/* Token Actions */}
                        <div className="flex gap-4">
                            <button
                                onClick={() => dispatch({ type: 'SKIP_SONG' })}
                                disabled={activePlayer.tokens < 1}
                                className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors ${activePlayer.tokens >= 1
                                    ? 'border-yellow-500 text-yellow-500 hover:bg-yellow-500/10'
                                    : 'border-neutral-700 text-neutral-600 cursor-not-allowed'
                                    }`}
                            >
                                Discard Card (-1)
                            </button>
                            <button
                                onClick={() => dispatch({ type: 'AUTO_PLACE_SONG' })}
                                disabled={activePlayer.tokens < 3}
                                className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors ${activePlayer.tokens >= 3
                                    ? 'border-purple-500 text-purple-500 hover:bg-purple-500/10'
                                    : 'border-neutral-700 text-neutral-600 cursor-not-allowed'
                                    }`}
                            >
                                Auto Play (-3)
                            </button>
                        </div>
                    </div>
                )}

                {state.currentPhase === 'CHALLENGE_SELECTION' && (
                    <div className="flex flex-col items-center gap-6 animate-fade-in w-full max-w-2xl">
                        <div className="bg-neutral-800 p-6 rounded-xl border border-neutral-700 w-full">
                            <h3 className="text-xl font-bold text-center mb-4">Select Challengers</h3>
                            <p className="text-neutral-400 text-center text-sm mb-6">
                                Anyone who wants to place a bet (cost: 1 Token) should be selected below.
                                <br />
                                Order will be randomized!
                            </p>

                            <div className="grid grid-cols-2 gap-4 mb-6">
                                {state.players.filter(p => !p.hasWon && p.id !== activePlayer.id).map(p => {
                                    const isSelected = state.challengeQueue.includes(p.id);
                                    const canAfford = p.tokens > 0;
                                    return (
                                        <button
                                            key={p.id}
                                            disabled={!canAfford}
                                            onClick={() => dispatch({ type: 'TOGGLE_CHALLENGER', payload: { playerId: p.id } })}
                                            className={`p-4 rounded-lg border-2 flex items-center justify-between transition-all ${isSelected
                                                ? 'bg-yellow-500/20 border-yellow-500 text-yellow-500'
                                                : canAfford ? 'bg-neutral-700 border-transparent hover:bg-neutral-600' : 'bg-neutral-800 border-neutral-700 opacity-50 cursor-not-allowed'
                                                }`}
                                        >
                                            <span className="font-bold">{p.name}</span>
                                            <div className="flex items-center gap-2 text-xs">
                                                <div className="w-5 h-5 bg-yellow-500 text-black rounded-full flex items-center justify-center font-bold">
                                                    {p.tokens}
                                                </div>
                                                {isSelected && <span className="font-bold">READY</span>}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="flex gap-4 justify-center">
                                <button
                                    onClick={handleConfirmReveal}
                                    className="bg-neutral-700 hover:bg-neutral-600 text-white px-6 py-3 rounded-full font-bold transition-all"
                                >
                                    No Challenges (Reveal)
                                </button>
                                <button
                                    onClick={() => dispatch({ type: 'START_CHALLENGE_ROUND' })}
                                    disabled={state.challengeQueue.length === 0}
                                    className={`px-8 py-3 rounded-full font-bold transition-all shadow-lg ${state.challengeQueue.length > 0
                                        ? 'bg-yellow-500 hover:bg-yellow-400 text-black transform hover:scale-105'
                                        : 'bg-neutral-700 text-neutral-500 cursor-not-allowed'
                                        }`}
                                >
                                    Start Challenge Round!
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {state.currentPhase === 'CHALLENGE_PLACEMENT' && (
                    <div className="flex flex-col items-center gap-6 animate-fade-in w-full max-w-2xl">
                        {/* Queue Visualization */}
                        <div className="flex gap-2 mb-4 items-center overflow-x-auto max-w-full p-2">
                            {state.challengeQueue.map((pid, idx) => {
                                const p = state.players.find(pl => pl.id === pid);
                                if (!p) return null;
                                const isCurrent = idx === state.currentChallengerIndex;
                                const isDone = idx < state.currentChallengerIndex;
                                return (
                                    <div key={pid} className={`flex flex-col items-center transition-all ${isCurrent ? 'scale-110 z-10' : 'opacity-60 scale-90'}`}>
                                        <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-black mb-1 ${isCurrent ? 'bg-yellow-500 border-white shadow-glow' :
                                            isDone ? 'bg-green-500 border-green-600' : 'bg-neutral-600 border-neutral-500'
                                            }`}>
                                            {p.name.charAt(0)}
                                        </div>
                                        {isCurrent && <span className="text-xs text-yellow-500 font-bold animate-pulse">BETTING</span>}
                                    </div>
                                );
                            })}
                        </div>

                        {state.currentChallengerIndex < state.challengeQueue.length ? (
                            <div className="bg-neutral-800 p-6 rounded-xl border-2 border-yellow-500/50 shadow-2xl text-center animate-bounce-in">
                                <h3 className="text-2xl font-bold mb-2">
                                    <span style={{ color: state.players.find(p => p.id === state.challengeQueue[state.currentChallengerIndex])?.color }}>
                                        {state.players.find(p => p.id === state.challengeQueue[state.currentChallengerIndex])?.name}
                                    </span>
                                    's Turn
                                </h3>
                                <p className="text-neutral-400 mb-6">
                                    Click a GAP in the timeline to place your bet (-1 Token).
                                    <br />
                                    Or Pass if your spot is taken.
                                </p>
                                <button
                                    onClick={() => dispatch({ type: 'PASS_CHALLENGE' })}
                                    className="bg-neutral-700 hover:bg-neutral-600 text-white px-8 py-3 rounded-full font-bold transition-all border border-neutral-500 hover:border-white"
                                >
                                    Pass Turn
                                </button>
                            </div>
                        ) : (
                            <div className="bg-neutral-800 p-6 rounded-xl border border-green-500 shadow-2xl text-center">
                                <h3 className="text-xl font-bold text-green-500 mb-4">All Bets Placed!</h3>
                                <button
                                    onClick={handleConfirmReveal}
                                    className="bg-green-500 hover:bg-green-400 text-black px-8 py-4 rounded-full font-bold text-xl shadow-lg transition-transform hover:scale-105"
                                >
                                    Reveal Results
                                </button>
                            </div>
                        )}
                    </div>
                )}



                <ResultModal
                    isOpen={state.currentPhase === 'REVEAL'}
                    song={state.currentSong}
                    result={state.lastResult}
                    onNextTurn={() => dispatch({ type: 'NEXT_TURN' })}
                    players={state.players}
                />

                <div className="w-full h-full flex-1 flex flex-col justify-center overflow-hidden">
                    <Timeline
                        player={activePlayer}
                        isInteractable={state.currentPhase === 'LISTENING' || state.currentPhase === 'CHALLENGE_PLACEMENT'}
                        onGapClick={handleGapClick}
                        selectedGap={state.pendingPlacement}
                        challenges={state.challengerIds}
                    />
                </div>
            </div>
        </div>
    );
};
