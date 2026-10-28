import { describe, expect, it } from "vitest";
import {
  assignCards,
  assignTeams,
  buildLeaderboard,
  calculateDamage,
  createBracketPairing,
  DEFAULT_CONFIG,
  redistributeTeamCards,
  type Player,
} from "./game";

const players = (count: number): Player[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    name: `Pemain ${index + 1}`,
    avatar: "🦊",
    cards: [],
    connected: true,
  }));

describe("team and card assignment", () => {
  it("keeps teams between three and five players", () => {
    for (const count of [6, 7, 10, 11, 16, 26, 50]) {
      const teams = assignTeams(players(count), () => 0.5);
      expect(teams.flatMap((team) => team.playerIds)).toHaveLength(count);
      expect(teams.every((team) => team.playerIds.length >= 3 && team.playerIds.length <= 5)).toBe(true);
    }
  });

  it("rejects rooms that cannot form two valid teams", () => {
    expect(() => assignTeams(players(5))).toThrow("Minimal 6");
  });

  it("assigns all five cards to each team", () => {
    const roster = players(6);
    const teams = assignTeams(roster, () => 0.4);
    assignCards(teams, roster, () => 0.4);
    for (const team of teams) {
      expect(team.playerIds.flatMap((id) => roster.find((player) => player.id === id)!.cards).sort()).toEqual([
        "A",
        "B",
        "C",
        "D",
        "E",
      ]);
    }
  });

  it("redistributes cards to active teammates when a player disconnects and restores on reconnect", () => {
    const roster = players(6);
    const teams = assignTeams(roster, () => 0.4);
    assignCards(teams, roster, () => 0.4);
    const team = teams[0];
    const dcPlayer = roster.find((p) => p.id === team.playerIds[0])!;
    const originalCards = [...dcPlayer.cards];

    dcPlayer.connected = false;
    redistributeTeamCards(team, roster);
    expect(dcPlayer.cards).toEqual([]);
    const activeCoverage = team.playerIds
      .map((id) => roster.find((p) => p.id === id)!)
      .filter((p) => p.connected)
      .flatMap((p) => p.cards)
      .sort();
    expect(activeCoverage).toEqual(["A", "B", "C", "D", "E"]);

    dcPlayer.connected = true;
    redistributeTeamCards(team, roster);
    expect(dcPlayer.cards).toEqual(originalCards);
  });
});

describe("tournament bracket and leaderboard", () => {
  it("assigns a bye to an odd number of teams without repeating used byes", () => {
    const usedByes = new Set<string>(["team-1", "team-2"]);
    const result = createBracketPairing(["team-1", "team-2", "team-3"], usedByes, () => 0.1);
    expect(result.byeTeamId).toBe("team-3");
    expect(result.pairs).toHaveLength(1);
    expect(usedByes.has("team-3")).toBe(true);
  });

  it("ranks MVP players by damage dealt and correct answers", () => {
    const roster = players(2);
    roster[0].teamId = "team-1";
    roster[0].stats = { correctAnswers: 1, wrongAnswers: 0, damageDealt: 20, selfDamage: 0, totalResponseMs: 3000 };
    roster[1].teamId = "team-2";
    roster[1].stats = { correctAnswers: 2, wrongAnswers: 0, damageDealt: 55, selfDamage: 0, totalResponseMs: 4000 };
    const board = buildLeaderboard(roster, [
      { id: "team-1", name: "Tim 1", playerIds: ["p1"] },
      { id: "team-2", name: "Tim 2", playerIds: ["p2"] },
    ]);
    expect(board[0].playerId).toBe("p2");
    expect(board[0].damageDealt).toBe(55);
    expect(board[0].avgResponseMs).toBe(2000);
  });
});

describe("damage calculation", () => {
  it("adds speed bonus in the first thirty percent of the answer timer", () => {
    expect(calculateDamage(DEFAULT_CONFIG, 1, 1000)).toBe(30);
    expect(calculateDamage(DEFAULT_CONFIG, 1, 3000)).toBe(20);
  });

  it("applies question multiplier after speed bonus", () => {
    expect(calculateDamage(DEFAULT_CONFIG, 1.5, 1000)).toBe(45);
  });
});
