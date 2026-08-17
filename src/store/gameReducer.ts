import { type GameState, type Song, type Difficulty } from '../types';

export type GameAction =
    | { type: 'SET_TOKEN'; payload: string }
    | { type: 'ADD_PLAYER'; payload: { name: string; difficulty: Difficulty; color: string } }
    | { type: 'REMOVE_PLAYER'; payload: { playerId: string } }
    | { type: 'START_GAME'; payload: { playlistId: string; playlistName: string; targetScore: number } }
    | { type: 'NEXT_TURN' }
    | { type: 'SET_CURRENT_SONG'; payload: Song }
    | { type: 'GUESS_PLACEMENT'; payload: { index: number } }
    | { type: 'CONFIRM_REVEAL' }
    | { type: 'UPDATE_TOKENS'; payload: { playerIndex: number; amount: number } }
    | { type: 'DISTRIBUTE_INITIAL_CARDS'; payload: { playerId: string; song: Song }[] }
    | { type: 'RESET_CURRENT_SONG' }
    | { type: 'AUTO_PLACE_SONG' }
    | { type: 'START_CHALLENGE_PHASE' }
    | { type: 'TOGGLE_CHALLENGER'; payload: { playerId: string } }
    | { type: 'START_CHALLENGE_ROUND' }
    | { type: 'PLACE_CHALLENGE_BET'; payload: { index: number } }
    | { type: 'PASS_CHALLENGE' }
    | { type: 'SKIP_SONG' }
    | { type: 'CONTINUE_GAME' }
    | { type: 'RESTORE_STATE'; payload: GameState };

export const initialState: GameState = {
    players: [],
    activePlayerIndex: 0,
    currentPhase: 'SETUP',
    currentSong: null,
    pendingPlacement: null,
    winner: null,
    challengerIds: [],
    challengeQueue: [],
    currentChallengerIndex: 0,
    playedSongIds: [],
    settings: {
        cooperative: false,
        targetScore: 10,
    }
};

const COLORS = ['#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899'];

// Finds the next player who hasn't already won, wrapping around the player list.
// Used whenever a turn ends (normal reveal, auto-place, or "continue playing" after a win).
function getNextActivePlayerIndex(players: GameState['players'], currentIndex: number): number {
    let nextIndex = (currentIndex + 1) % players.length;
    let loopCount = 0;
    while (players[nextIndex].hasWon && loopCount < players.length) {
        nextIndex = (nextIndex + 1) % players.length;
        loopCount++;
    }
    return nextIndex;
}

export function gameReducer(state: GameState, action: GameAction): GameState {
    switch (action.type) {
        case 'SET_TOKEN':
            return state;

        case 'RESTORE_STATE':
            // Older saved states predate playedSongIds; default it so dedup logic never sees undefined.
            return { ...action.payload, playedSongIds: action.payload.playedSongIds || [] };

        case 'ADD_PLAYER':
            return {
                ...state,
                players: [
                    ...state.players,
                    {
                        id: crypto.randomUUID(),
                        name: action.payload.name,
                        difficulty: action.payload.difficulty,
                        tokens: action.payload.difficulty === 'PRO' ? 5 : action.payload.difficulty === 'EXPERT' ? 3 : 2,
                        timeline: [],
                        color: action.payload.color || COLORS[state.players.length % COLORS.length]
                    }
                ]
            };

        case 'REMOVE_PLAYER':
            return {
                ...state,
                players: state.players.filter(p => p.id !== action.payload.playerId)
            };

        case 'START_GAME':
            return {
                ...state,
                currentPhase: 'PRE_TURN',
                activePlayerIndex: 0,
                challengerIds: [],
                challengeQueue: [],
                currentChallengerIndex: 0,
                settings: {
                    ...state.settings,
                    playlistId: action.payload.playlistId,
                    playlistName: action.payload.playlistName,
                    targetScore: action.payload.targetScore
                }
            };

        case 'DISTRIBUTE_INITIAL_CARDS':
            return {
                ...state,
                players: state.players.map(player => {
                    const update = action.payload.find(u => u.playerId === player.id);
                    if (update) {
                        return { ...player, timeline: [...player.timeline, update.song] };
                    }
                    return player;
                })
            };

        case 'NEXT_TURN': {
            return {
                ...state,
                activePlayerIndex: getNextActivePlayerIndex(state.players, state.activePlayerIndex),
                currentPhase: 'PRE_TURN',
                currentSong: null,
                challengerIds: [],
                lastResult: undefined
            };
        }

        case 'SET_CURRENT_SONG':
            return {
                ...state,
                currentSong: action.payload,
                currentPhase: 'LISTENING',
                playedSongIds: [...state.playedSongIds, action.payload.id]
            };

        case 'RESET_CURRENT_SONG':
            return {
                ...state,
                currentSong: null,
                currentPhase: 'PRE_TURN'
            };

        case 'GUESS_PLACEMENT':
            // After the active player guesses, move straight into challenge selection
            // so other players can opt in before the reveal.
            return {
                ...state,
                pendingPlacement: action.payload.index,
                challengerIds: [],
                challengeQueue: [],
                currentChallengerIndex: 0,
                currentPhase: 'CHALLENGE_SELECTION'
            };

        case 'START_CHALLENGE_PHASE':
            return {
                ...state,
                currentPhase: 'CHALLENGE_SELECTION',
                challengeQueue: [],
                challengerIds: []
            };

        case 'TOGGLE_CHALLENGER': {
            const pid = action.payload.playerId;
            const inQueue = state.challengeQueue.includes(pid);
            return {
                ...state,
                challengeQueue: inQueue
                    ? state.challengeQueue.filter(id => id !== pid)
                    : [...state.challengeQueue, pid]
            };
        }

        case 'START_CHALLENGE_ROUND': {
            // Shuffle Queue
            const shuffled = [...state.challengeQueue].sort(() => Math.random() - 0.5);
            return {
                ...state,
                currentPhase: 'CHALLENGE_PLACEMENT',
                challengeQueue: shuffled,
                currentChallengerIndex: 0,
                challengerIds: []
            };
        }

        case 'PLACE_CHALLENGE_BET': {
            const index = action.payload.index;
            const currentPlayerId = state.challengeQueue[state.currentChallengerIndex];

            // Check if slot valid (not taken by another challenger, not active player slot)
            if (index === state.pendingPlacement) return state;
            if (state.challengerIds.some(c => c.index === index)) return state;

            const newChallengers = [...state.challengerIds, { playerId: currentPlayerId, index }];

            // Check if ALL slots are now full
            const activePlayer = state.players[state.activePlayerIndex];
            const totalSlots = activePlayer.timeline.length + 1;
            const occupiedSlots = 1 + newChallengers.length; // 1 for active player's choice + challengers

            let nextIndex = state.currentChallengerIndex + 1;

            if (occupiedSlots >= totalSlots) {
                // Auto-skip everyone else as there are no spots left
                nextIndex = state.challengeQueue.length;
            }

            return {
                ...state,
                challengerIds: newChallengers,
                currentChallengerIndex: nextIndex,
                currentPhase: 'CHALLENGE_PLACEMENT'
            };
        }

        case 'PASS_CHALLENGE': {
            const nextIndex = state.currentChallengerIndex + 1;
            return {
                ...state,
                currentChallengerIndex: nextIndex,
                currentPhase: 'CHALLENGE_PLACEMENT'
            };
        }

        case 'CONFIRM_REVEAL': {
            const playerIdx = state.activePlayerIndex;
            const activePlayer = state.players[playerIdx];
            const song = state.currentSong;
            const placementIdx = state.pendingPlacement;

            if (!song || placementIdx === null) return state;

            // Helper to check correctness
            const timeline = activePlayer.timeline;
            const checkCorrectness = (idx: number) => {
                const prev = idx > 0 ? timeline[idx - 1] : null;
                const next = idx < timeline.length ? timeline[idx] : null;
                const afterPrev = prev ? song.year >= prev.year : true;
                const beforeNext = next ? song.year <= next.year : true;
                return afterPrev && beforeNext;
            };

            const isActivePlayerCorrect = checkCorrectness(placementIdx);

            let updatedPlayers = [...state.players];
            let stolenBy: string | undefined = undefined;
            const tokenChanges: Record<string, number> = {};

            if (isActivePlayerCorrect) {
                // Active player gets card
                const newTimeline = [...activePlayer.timeline];
                newTimeline.splice(placementIdx, 0, song);

                updatedPlayers = updatedPlayers.map(p => {
                    if (p.id === activePlayer.id) return { ...p, timeline: newTimeline };
                    // Challengers lose 1 token
                    if (state.challengerIds.some(c => c.playerId === p.id)) {
                        const newTokens = Math.max(0, p.tokens - 1);
                        tokenChanges[p.id] = newTokens - p.tokens;
                        return { ...p, tokens: newTokens };
                    }
                    return p;
                });
            } else {
                // Active player is WRONG.
                // Check if any challenger is correct
                // We prioritize the FIRST correct challenger found in the array order (usually order of betting)
                const successfulChallenge = state.challengerIds.find(c => checkCorrectness(c.index));

                // Calculate Pot: 1 token from each Incorrect Challenger + (maybe Active Player?)
                // HITStory Rules: "Winning challenger gets the card + all tokens bet by others."
                // "If active player is wrong, card goes to correct challenger."
                // "If nobody is correct, card is discarded."

                // Let's gather tokens from LOSING challengers
                let pot = 0;

                // Identify winners and losers
                const losingChallengerIds = state.challengerIds.filter(c => !checkCorrectness(c.index)).map(c => c.playerId);

                // Deduct tokens from losers and add to pot
                updatedPlayers = updatedPlayers.map(p => {
                    if (losingChallengerIds.includes(p.id)) {
                        if (p.tokens > 0) {
                            pot++;
                            const newTokens = p.tokens - 1;
                            tokenChanges[p.id] = newTokens - p.tokens; // Should be -1
                            return { ...p, tokens: newTokens };
                        }
                    }
                    return p;
                });

                if (successfulChallenge) {
                    const winnerId = successfulChallenge.playerId;
                    const winner = updatedPlayers.find(p => p.id === winnerId);
                    if (winner) {
                        stolenBy = winner.name;
                        // Winner steals card AND gets pot
                        const newTimeline = [...winner.timeline, song].sort((a, b) => a.year - b.year);
                        updatedPlayers = updatedPlayers.map(p => {
                            if (p.id === winnerId) {
                                tokenChanges[p.id] = (tokenChanges[p.id] || 0) + pot;
                                return { ...p, timeline: newTimeline, tokens: p.tokens + pot };
                            }
                            return p;
                        });
                    }
                } else {
                    // Nobody won -> Pot is lost? Or returned? 
                    // Usually "Bank" takes it. We just destroyed them above.
                }
            }

            // Win Condition (Check all players)
            // Ensure target is a number (sanity check)
            const target = Number(state.settings.targetScore || 10);

            // Only check players who haven't won yet
            const winner = updatedPlayers.find(p => !p.hasWon && p.timeline.length >= target);

            return {
                ...state,
                players: updatedPlayers,
                pendingPlacement: null,
                winner: winner || null,
                currentPhase: winner ? 'GAME_OVER' : 'REVEAL',
                lastResult: {
                    correct: isActivePlayerCorrect,
                    actualYear: song.year,
                    stolenBy,
                    tokenChanges
                }
            };
        }

        case 'AUTO_PLACE_SONG': {
            const playerIdx = state.activePlayerIndex;
            const activePlayer = state.players[playerIdx];
            if (activePlayer.tokens < 5 || !state.currentSong) return state;

            // Correct placement automatically (paid for with tokens)
            const newTimeline = [...activePlayer.timeline, state.currentSong].sort((a, b) => a.year - b.year);
            const updatedPlayers = state.players.map((p, i) =>
                i === playerIdx ? { ...p, timeline: newTimeline, tokens: p.tokens - 5 } : p
            );

            const target = Number(state.settings.targetScore || 10);
            const isWinner = newTimeline.length >= target && !activePlayer.hasWon;

            if (isWinner) {
                return {
                    ...state,
                    players: updatedPlayers,
                    winner: updatedPlayers[playerIdx],
                    currentPhase: 'GAME_OVER',
                    currentSong: null
                };
            }

            // Auto-placing still resolves the turn, so it passes to the next player
            // just like a normal correct guess would.
            return {
                ...state,
                players: updatedPlayers,
                activePlayerIndex: getNextActivePlayerIndex(updatedPlayers, playerIdx),
                winner: null,
                currentPhase: 'PRE_TURN',
                currentSong: null,
                challengerIds: [],
                lastResult: undefined
            };
        }

        case 'SKIP_SONG': {
            const playerIdx = state.activePlayerIndex;
            const activePlayer = state.players[playerIdx];
            if (activePlayer.tokens < 3) return state;

            const updatedPlayers = state.players.map((p, i) =>
                i === playerIdx ? { ...p, tokens: p.tokens - 3 } : p
            );

            // Discard-and-redraw: the same player spends a token to skip a hard
            // card and immediately draws again, rather than losing their turn.
            return {
                ...state,
                players: updatedPlayers,
                currentSong: null,
                currentPhase: 'PRE_TURN'
            };
        }

        case 'CONTINUE_GAME': {
            if (!state.winner) return state;

            // Mark current winner as won and assign rank
            const winnersCount = state.players.filter(p => p.hasWon).length;
            const updatedPlayers = state.players.map(p =>
                p.id === state.winner?.id ? { ...p, hasWon: true, rank: winnersCount + 1 } : p
            );

            const nextIndex = getNextActivePlayerIndex(updatedPlayers, state.activePlayerIndex);

            return {
                ...state,
                players: updatedPlayers,
                winner: null,
                activePlayerIndex: nextIndex,
                currentPhase: 'PRE_TURN',
                currentSong: null,
                challengerIds: [],
                lastResult: undefined
            };
        }

        case 'UPDATE_TOKENS':
            return {
                ...state,
                players: state.players.map((p, i) =>
                    i === action.payload.playerIndex ? { ...p, tokens: p.tokens + action.payload.amount } : p
                )
            };

        default:
            return state;
    }
}
