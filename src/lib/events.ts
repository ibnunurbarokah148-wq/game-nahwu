import type { CardLetter, RoomConfig, RoomSnapshot } from "./game";

export type HostCreateReply = (result: { roomId: string; code: string; hostId: string; hostToken: string; error?: string }) => void;

export type ClientToServerEvents = {
  "host:create": (...args: [reply: HostCreateReply] | [payload: { quizId?: string }, reply: HostCreateReply]) => void;
  "host:resume": (payload: { roomId: string; hostId: string; hostToken: string }, reply: (result: { error?: string }) => void) => void;
  "room:join": (payload: { code: string; name: string; avatar: string; token?: string }, reply: (result: { roomId?: string; playerId?: string; token?: string; error?: string }) => void) => void;
  "host:start": (payload: { roomId: string }, reply: (result: { error?: string }) => void) => void;
  "host:kick": (payload: { roomId: string; playerId: string }, reply: (result: { error?: string }) => void) => void;
  "host:pause": (payload: { roomId: string; matchId?: string }, reply: (result: { paused?: boolean; error?: string }) => void) => void;
  "host:skip": (payload: { roomId: string; matchId?: string }, reply: (result: { error?: string }) => void) => void;
  "card:raise": (payload: { roomId: string; matchId: string; questionId: string; card: CardLetter }, reply: (result: { error?: string }) => void) => void;
  "room:subscribe": (payload: { roomId: string; playerId?: string; token?: string; hostId?: string; hostToken?: string }, reply: (result: { error?: string }) => void) => void;
  "room:spectate": (payload: { roomIdOrCode: string }, reply: (result: { roomId?: string; error?: string }) => void) => void;
  "host:configure": (payload: { roomId: string; config: Partial<RoomConfig> }, reply: (result: { error?: string }) => void) => void;
};

export type ServerToClientEvents = {
  "room:update": (snapshot: RoomSnapshot) => void;
  "player:cards": (cards: CardLetter[]) => void;
  "room:error": (message: string) => void;
};
