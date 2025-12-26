export type Difficulty = 'NORMAL' | 'PRO' | 'EXPERT';

export interface Song {
    id: string;
    title: string;
    artist: string;
    album: string;
    year: number;
    image: string;
    uri: string;
}

export interface Player {
    id: string;
    name: string;
    timeline: Song[];
    tokens: number;
    difficulty: Difficulty;
    color: string;
    hasWon?: boolean;
    rank?: number;
}

export type GamePhase =
    | 'SETUP'
    | 'PRE_TURN'
    | 'LISTENING'
    | 'CHALLENGE_SELECTION' // Players decide who wants to challenge
    | 'CHALLENGE_PLACEMENT' // Players place bets in order
    | 'REVEAL'
    | 'GAME_OVER';

export interface GameState {
    players: Player[];
    activePlayerIndex: number;
    currentPhase: GamePhase;
    currentSong: Song | null;
    winner: Player | null;
    pendingPlacement: number | null;

    // Advanced Challenge State
    challengerIds: { playerId: string; index: number }[]; // Valid bets placed
    challengeQueue: string[]; // Players waiting to bet
    currentChallengerIndex: number; // Index in challengeQueue

    lastResult?: {
        correct: boolean;
        actualYear: number;
        stolenBy?: string;
        tokenChanges?: Record<string, number>;
    };
    settings: {
        cooperative: boolean;
        targetScore: number;
        playlistId?: string;
        playlistName?: string;
    };
}
