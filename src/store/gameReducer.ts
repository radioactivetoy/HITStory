import { type GameState, type Song, type Player, type Difficulty } from '../types';

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
    | { type: 'CHALLENGE_PLACEMENT'; payload: { challengerId: string; index: number } } // Legacy/Internal use
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
    settings: {
        cooperative: false,
        targetScore: 10,
    }
};

const COLORS = ['#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899'];

export function gameReducer(state: GameState, action: GameAction): GameState {
    switch (action.type) {
        case 'SET_TOKEN':
            return state;

        case 'RESTORE_STATE':
            return action.payload;

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
            let nextIndex = (state.activePlayerIndex + 1) % state.players.length;
            let loopCount = 0;
            // Skip over players who have already won
            while (state.players[nextIndex].hasWon && loopCount < state.players.length) {
                nextIndex = (nextIndex + 1) % state.players.length;
                loopCount++;
            }
            // Logic for "End Game" if no players left could go here, but UI handles "Game Over"

            return {
                ...state,
                activePlayerIndex: nextIndex,
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
                currentPhase: 'LISTENING'
            };

        case 'RESET_CURRENT_SONG':
            return {
                ...state,
                currentSong: null,
                currentPhase: 'PRE_TURN'
            };

        case 'GUESS_PLACEMENT':
            return {
                ...state,
                pendingPlacement: action.payload.index,
                challengerIds: [], // Reset challenges for new guess
                challengeQueue: [], // Reset selection queue
                currentChallengerIndex: 0,
                // Instead of direct CHALLENGE, we wait for user to click "Challenge" button
                currentPhase: 'CHALLENGE_SELECTION'
                // Wait... old flow likely went to PRE_TURN -> LISTENING -> [User Guesses] -> CHALLENGE?
                // Actually usually active player guesses, then we enter a phase where challenges CAN happen.
                // The previous code had 'CHALLENGE' phase. Now we use 'CHALLENGE_SELECTION' as the "Base" state after a guess?
                // Or maybe 'GUESS_PLACEMENT' sets 'pendingPlacement' and we stay in a "Review" state?
                // Let's assume after guess, we go to 'CHALLENGE_SELECTION' immediately so people can opt in.
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

        case 'CHALLENGE_PLACEMENT': {
            const { challengerId, index } = action.payload;

            // If active player picked this index, invalid challenge (implied, but UI should prevent)
            if (index === state.pendingPlacement) return state;

            // Find existing challenge for this player
            const existingChallengeIndex = state.challengerIds.findIndex(c => c.playerId === challengerId);

            let newChallenges = [...state.challengerIds];

            if (existingChallengeIndex !== -1) {
                // If clicking the same spot, remove the challenge (toggle off)
                if (newChallenges[existingChallengeIndex].index === index) {
                    newChallenges.splice(existingChallengeIndex, 1);
                } else {
                    // Changing bet to a new slot
                    // Check if another challenger already has this slot (if we want to enforce unique slots per person, or unique slots globally?)
                    // Let's allow multiple people on same slot for now, as per standard betting rules unless specified otherwise.
                    // Actually, earlier prompt said "if one player thinks it is wrong... places his guess... if a third player... places another option".
                    // Implies unique slots per player, but multiple players can bet on different slots.
                    // Let's update the index.
                    newChallenges[existingChallengeIndex].index = index;
                }
            } else {
                // Add new challenge
                newChallenges.push({ playerId: challengerId, index });
            }

            return {
                ...state,
                challengerIds: newChallenges
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
            if (activePlayer.tokens < 3 || !state.currentSong) return state;

            // correct placement automatically
            const newTimeline = [...activePlayer.timeline, state.currentSong].sort((a, b) => a.year - b.year);
            const updatedPlayers = state.players.map((p, i) =>
                i === playerIdx ? { ...p, timeline: newTimeline, tokens: p.tokens - 3 } : p
            );

            // Win Condition Check
            const target = Number(state.settings.targetScore || 10);
            const isWinner = newTimeline.length >= target && !activePlayer.hasWon;

            return {
                ...state,
                players: updatedPlayers,
                winner: isWinner ? updatedPlayers[playerIdx] : null,
                currentPhase: isWinner ? 'GAME_OVER' : 'PRE_TURN', // Auto Advance
                currentSong: null
            };
        }

        case 'SKIP_SONG': {
            const playerIdx = state.activePlayerIndex;
            const activePlayer = state.players[playerIdx];
            if (activePlayer.tokens < 1) return state;

            const updatedPlayers = state.players.map((p, i) =>
                i === playerIdx ? { ...p, tokens: p.tokens - 1 } : p
            );

            return {
                ...state,
                players: updatedPlayers,
                currentSong: null,
                currentPhase: 'PRE_TURN' // Effectively skips turn or resets for new draw? 
                // HITStory rules: You discard the card and draw a new one. 
                // But simplified: You spend a token to skip this hard card.
                // Let's treat it as: You lose the card, but you don't lose the turn? 
                // Actually if I set to PRE_TURN, they can draw again.
                // If I set NEXT_TURN, they lose the turn. 
                // Let's assume "Discard & Draw New" = PRE_TURN.
            };
        }

        case 'CONTINUE_GAME': {
            if (!state.winner) return state;

            // Mark current winner as won and assign rank
            const winnersCount = state.players.filter(p => p.hasWon).length;
            const updatedPlayers = state.players.map(p =>
                p.id === state.winner?.id ? { ...p, hasWon: true, rank: winnersCount + 1 } : p
            );

            // Find next active player
            let nextIndex = (state.activePlayerIndex + 1) % state.players.length;
            let loopCount = 0;
            while (updatedPlayers[nextIndex].hasWon && loopCount < state.players.length) {
                nextIndex = (nextIndex + 1) % state.players.length;
                loopCount++;
            }

            // If everyone has won (or 1 left), handle that? UI should block it, but just in case:
            if (loopCount >= state.players.length - 1) {
                // Only 1 player left or all won is handled by check in UI usually, 
                // but let's just proceed to PRE_TURN for the last standing person or end.
            }

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
