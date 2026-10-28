export const CARD_LETTERS = ["A", "B", "C", "D", "E"] as const;
export type CardLetter = (typeof CARD_LETTERS)[number];

export type PlayerStats = {
  correctAnswers: number;
  wrongAnswers: number;
  damageDealt: number;
  selfDamage: number;
  totalResponseMs: number;
};

export type Player = {
  id: string;
  name: string;
  avatar: string;
  teamId?: string;
  cards: CardLetter[];
  baseCards?: CardLetter[];
  connected: boolean;
  stats?: PlayerStats;
};

export type Team = { id: string; name: string; playerIds: string[] };

export type QuizQuestion = {
  id: string;
  text: string;
  options: [string, string, string, string, string];
  correctIndex: number;
  multiplier: number;
  category?: string;
};

export type Quiz = {
  id: string;
  title: string;
  description: string;
  category: string;
  updatedAt: string;
  questions: QuizQuestion[];
};

export type MatchPhase = "countdown" | "reading" | "answering" | "locked";

export type PublicQuestion = Omit<QuizQuestion, "correctIndex"> & {
  number: number;
  readEndsAt: number;
  endsAt: number;
  pausedRemainingMs?: number;
};

export type RoomConfig = {
  startingHp: number;
  baseDamage: number;
  speedBonus: number;
  readingSeconds: number;
  questionSeconds: number;
  questionsPerMatch: number;
  quizId?: string;
};

export type AnswerFeedback = {
  playerId: string;
  playerName: string;
  card: CardLetter;
  correct: boolean;
  damage: number;
  targetTeamId?: string;
  hp: Record<string, number>;
  responseMs?: number;
};

export type MatchView = {
  id: string;
  round?: number;
  teamIds: [string, string];
  tieBreaker?: boolean;
  paused?: boolean;
  phase?: MatchPhase;
  countdownEndsAt?: number;
  hp: Record<string, number>;
  question?: PublicQuestion;
  questionNumber: number;
  status: "waiting" | "question" | "paused" | "locked" | "finished";
  winnerTeamId?: string;
  feedback?: AnswerFeedback;
};

export type BracketMatchSummary = {
  id: string;
  round: number;
  teamIds: [string, string];
  hp: Record<string, number>;
  status: MatchView["status"];
  winnerTeamId?: string;
  tieBreaker?: boolean;
};

export type BracketRound = {
  round: number;
  matches: BracketMatchSummary[];
  byeTeamId?: string;
};

export type LeaderboardEntry = {
  playerId: string;
  playerName: string;
  avatar: string;
  teamId?: string;
  teamName?: string;
  correctAnswers: number;
  wrongAnswers: number;
  damageDealt: number;
  selfDamage: number;
  avgResponseMs: number;
};

export type RoomSnapshot = {
  id: string;
  code: string;
  status: "lobby" | "running" | "finished";
  hostId: string;
  quizTitle?: string;
  config: RoomConfig;
  players: Player[];
  teams: Team[];
  match?: MatchView;
  matches?: MatchView[];
  currentRound?: number;
  bracket?: BracketRound[];
  championTeamId?: string;
  leaderboard?: LeaderboardEntry[];
};

export const DEFAULT_CONFIG: RoomConfig = {
  startingHp: 100,
  baseDamage: 20,
  speedBonus: 10,
  readingSeconds: 5,
  questionSeconds: 5,
  questionsPerMatch: 5,
  quizId: "nahwu-dasar",
};

export function createEmptyStats(): PlayerStats {
  return {
    correctAnswers: 0,
    wrongAnswers: 0,
    damageDealt: 0,
    selfDamage: 0,
    totalResponseMs: 0,
  };
}

export function shuffle<T>(items: readonly T[], random = Math.random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function assignTeams(players: Player[], random = Math.random): Team[] {
  if (players.length < 6) throw new Error("Minimal 6 pemain diperlukan untuk dua tim.");
  const teamCount = Math.ceil(players.length / 5);
  const shuffled = shuffle(players, random);
  const teamSizes = Array.from({ length: teamCount }, () => Math.floor(players.length / teamCount));
  for (let index = 0; index < players.length % teamCount; index += 1) teamSizes[index] += 1;
  if (teamSizes.some((size) => size < 3 || size > 5)) throw new Error("Jumlah pemain tidak dapat dibagi menjadi tim valid.");

  let cursor = 0;
  return teamSizes.map((size, teamIndex) => {
    const members = shuffled.slice(cursor, cursor + size);
    cursor += size;
    const teamId = `team-${teamIndex + 1}`;
    return { id: teamId, name: `Tim ${teamIndex + 1}`, playerIds: members.map((player) => player.id) };
  });
}

export function assignCards(teams: Team[], players: Player[], random = Math.random): void {
  for (const team of teams) {
    const members = team.playerIds.map((id) => players.find((player) => player.id === id)!).filter(Boolean);
    const cards = shuffle([...CARD_LETTERS], random);
    members.forEach((player, index) => {
      player.teamId = team.id;
      player.cards = [];
      player.cards.push(cards[index % cards.length]);
    });
    for (let index = members.length; index < cards.length; index += 1) {
      members[Math.floor(random() * members.length)].cards.push(cards[index]);
    }
    for (const member of members) {
      member.baseCards = [...member.cards];
    }
    redistributeTeamCards(team, players);
  }
}

/**
 * Mengalihkan kartu pemain yang disconnect (bot-slot) ke rekan setim yang masih terhubung,
 * dan mengembalikan kartu ke pemilik aslinya saat reconnect.
 */
export function redistributeTeamCards(team: Team, players: Player[]): void {
  const members = team.playerIds
    .map((id) => players.find((player) => player.id === id))
    .filter((player): player is Player => Boolean(player));
  if (members.length === 0) return;

  for (const member of members) {
    if (!member.baseCards || member.baseCards.length === 0) {
      member.baseCards = [...member.cards];
    }
  }

  const activeMembers = members.filter((member) => member.connected);
  if (activeMembers.length === 0) {
    for (const member of members) {
      member.cards = [...(member.baseCards ?? [])];
    }
    return;
  }

  const orphanCards: CardLetter[] = [];
  for (const member of members) {
    if (member.connected) {
      member.cards = [...(member.baseCards ?? [])];
    } else {
      orphanCards.push(...(member.baseCards ?? []));
      member.cards = [];
    }
  }

  orphanCards.forEach((card, index) => {
    const recipient = activeMembers[index % activeMembers.length];
    if (!recipient.cards.includes(card)) {
      recipient.cards.push(card);
    }
  });
}

export function createBracketPairing(
  activeTeamIds: string[],
  usedByes: Set<string>,
  random = Math.random
): { pairs: [string, string][]; byeTeamId?: string } {
  const pool = shuffle(activeTeamIds, random);
  let byeTeamId: string | undefined;

  if (pool.length % 2 === 1) {
    const eligibleIndex = pool.findIndex((teamId) => !usedByes.has(teamId));
    const pickIndex = eligibleIndex >= 0 ? eligibleIndex : 0;
    [byeTeamId] = pool.splice(pickIndex, 1);
    usedByes.add(byeTeamId);
  }

  const pairs: [string, string][] = [];
  for (let index = 0; index < pool.length; index += 2) {
    pairs.push([pool[index], pool[index + 1]]);
  }
  return { pairs, byeTeamId };
}

export function calculateDamage(config: RoomConfig, multiplier: number, elapsedMs: number): number {
  const speedThreshold = config.questionSeconds * 1000 * 0.3;
  const speedBonus = elapsedMs <= speedThreshold ? config.speedBonus : 0;
  return Math.round((config.baseDamage + speedBonus) * multiplier);
}

export function buildLeaderboard(players: Player[], teams: Team[]): LeaderboardEntry[] {
  const teamMap = new Map(teams.map((team) => [team.id, team.name]));
  return players
    .map((player) => {
      const stats = player.stats ?? createEmptyStats();
      const totalAnswered = stats.correctAnswers + stats.wrongAnswers;
      return {
        playerId: player.id,
        playerName: player.name,
        avatar: player.avatar,
        teamId: player.teamId,
        teamName: player.teamId ? teamMap.get(player.teamId) : undefined,
        correctAnswers: stats.correctAnswers,
        wrongAnswers: stats.wrongAnswers,
        damageDealt: stats.damageDealt,
        selfDamage: stats.selfDamage,
        avgResponseMs: totalAnswered > 0 ? Math.round(stats.totalResponseMs / totalAnswered) : 0,
      };
    })
    .sort((a, b) => {
      if (b.damageDealt !== a.damageDealt) return b.damageDealt - a.damageDealt;
      if (b.correctAnswers !== a.correctAnswers) return b.correctAnswers - a.correctAnswers;
      if (a.selfDamage !== b.selfDamage) return a.selfDamage - b.selfDamage;
      return (a.avgResponseMs || Number.MAX_SAFE_INTEGER) - (b.avgResponseMs || Number.MAX_SAFE_INTEGER);
    });
}
