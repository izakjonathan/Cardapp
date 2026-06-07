
"use client";

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { CURRENT_GAME_ID, supabase } from "../lib/supabaseClient";

type Player = { id: string; name: string; color: string };
type Round = { id: string; scores: Record<string, number>; closedBy: string | null; starterId: string; deleted?: boolean };
type HistoryItem = { gameId: string; gameName: string; winnerName: string; rounds: number; finishedAt: string };
type Game = { gameId: string | null; gameName: string; players: Player[]; targetScore: number; starterId: string; rounds: Round[]; status: "active" | "finished"; winnerId: string | null; updatedAt?: string; archived?: boolean; cardGame?: CardGameState | null };
type SyncStatus = "loading" | "synced" | "syncing" | "offline";
type DevicePresence = { clientId: string; name: string; joinedAt: string; gameName: string };
type Suit = "♠" | "♥" | "♦" | "♣";
type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";
type Card = { id: string; suit: Suit | "🃏"; rank: Rank | "JOKER"; value: number; joker?: boolean; asSuit?: Suit; asRank?: Rank; pointOwnerId?: string };
type Meld = { id: string; ownerId: string; cards: Card[]; kind: "set" | "run" };
type CardGameState = {
  roundId: string;
  dealerId: string;
  turnPlayerId: string;
  phase: "draw" | "play" | "roundOver";
  stock: Card[];
  discard: Card[];
  hands: Record<string, Card[]>;
  melds: Meld[];
  drewThisTurn: boolean;
  drewWholeDiscard?: boolean;
  meldedAfterWholeDiscard?: boolean;
  message: string;
  penalties?: Record<string, number>;
};
type CloudGame = Game & { __sync?: { clientId: string; version: number } };

const DEFAULT_PLAYERS: Player[] = [
  { id: "p1", name: "You", color: "#ffd36b" },
  { id: "p2", name: "GF", color: "#82efaa" },
  { id: "p3", name: "Player 3", color: "#93c5fd" },
  { id: "p4", name: "Player 4", color: "#f0abfc" }
];

const STORAGE_KEY = "rummy500_clean_v51";
const HISTORY_KEY = "rummy500_clean_v51_history";
const CLOUD_UPDATED_KEY = "rummy500_clean_v51_cloud_updated_at";
const CLIENT_ID_KEY = "rummy500_clean_v51_client_id";
const SAVE_DEBOUNCE_MS = 700;
const PENDING_SYNC_KEY = "rummy500_clean_v52_pending_sync";

const GAME_LIBRARY_KEY = "rummy500_multi_game_library_v139";
const GAME_LIBRARY_BACKUP_KEY = "rummy500_multi_game_library_backup_v149";
const GAME_LIBRARY_INDEX_KEY = "rummy500_multi_game_index_v149";
const ACTIVE_GAME_KEY = "rummy500_active_game_id_v139";
const DEVICE_NAME_KEY = "rummy500_device_name_v144";
const DEVICE_PLAYER_KEY = "rummy500_device_player_v151";

function cloudUpdatedKey(gameId: string) { return `${CLOUD_UPDATED_KEY}_${gameId}`; }
function pendingSyncKey(gameId: string) { return `${PENDING_SYNC_KEY}_${gameId}`; }
function gameCloudId(game: Game) { return game.gameId || CURRENT_GAME_ID; }
function formatGameUpdated(value?: string) {
  if (!value) return "Not played yet";
  try { return new Date(value).toLocaleDateString(); } catch { return "Saved"; }
}
function getUrlGameId() {
  if (typeof window === "undefined") return "";
  try { return new URL(window.location.href).searchParams.get("game") || ""; } catch { return ""; }
}
function setUrlGameId(gameId: string) {
  if (typeof window === "undefined" || !gameId) return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("game", gameId);
    window.history.replaceState({}, "", url.toString());
  } catch {}
}
function gameStorageKey(gameId: string) { return `rummy500_saved_game_${gameId}`; }
function devicePlayerKey(gameId?: string | null) { return `${DEVICE_PLAYER_KEY}_${gameId || "local"}`; }

function readStoredGame(gameId: string): Game | null {
  if (typeof window === "undefined" || !gameId) return null;

  try {
    const raw = localStorage.getItem(gameStorageKey(gameId));
    return raw ? JSON.parse(raw) as Game : null;
  } catch {
    return null;
  }
}

function mergeGameLists(...lists: Game[][]) {
  const byId = new Map<string, Game>();

  lists.flat().forEach((item) => {
    if (!item?.gameId) return;

    const previous = byId.get(item.gameId);
    if (!previous) {
      byId.set(item.gameId, item);
      return;
    }

    const previousUpdated = String(previous.updatedAt || "");
    const itemUpdated = String(item.updatedAt || "");

    byId.set(item.gameId, itemUpdated >= previousUpdated ? item : previous);
  });

  return sortGameLibrary(Array.from(byId.values()));
}

function readGameArray(key: string): Game[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed as Game[] : [];
  } catch {
    return [];
  }
}

function readGameLibrary(): Game[] {
  if (typeof window === "undefined") return [];

  const primary = readGameArray(GAME_LIBRARY_KEY);
  const backup = readGameArray(GAME_LIBRARY_BACKUP_KEY);

  let indexed: Game[] = [];
  try {
    const rawIndex = localStorage.getItem(GAME_LIBRARY_INDEX_KEY);
    const ids = rawIndex ? JSON.parse(rawIndex) : [];
    if (Array.isArray(ids)) {
      indexed = ids
        .map((id) => readStoredGame(String(id)))
        .filter(Boolean) as Game[];
    }
  } catch {}

  let legacy: Game[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) as Game : null;
    if (parsed?.gameId) legacy = [parsed];
  } catch {}

  return mergeGameLists(primary, backup, indexed, legacy);
}

function writeGameLibrary(games: Game[]) {
  if (typeof window === "undefined") return;

  const next = sortGameLibrary(games.filter((item) => item?.gameId));

  try {
    localStorage.setItem(GAME_LIBRARY_KEY, JSON.stringify(next));
    localStorage.setItem(GAME_LIBRARY_BACKUP_KEY, JSON.stringify(next));
    localStorage.setItem(GAME_LIBRARY_INDEX_KEY, JSON.stringify(next.map((item) => item.gameId)));
    next.forEach((item) => {
      if (item.gameId) localStorage.setItem(gameStorageKey(item.gameId), JSON.stringify(item));
    });
  } catch {}
}

function removeGameFromStorage(gameId: string) {
  if (typeof window === "undefined" || !gameId) return;

  try {
    localStorage.removeItem(gameStorageKey(gameId));
    const remaining = readGameLibrary().filter((item) => item.gameId !== gameId);
    localStorage.setItem(GAME_LIBRARY_INDEX_KEY, JSON.stringify(remaining.map((item) => item.gameId)));
    localStorage.setItem(GAME_LIBRARY_KEY, JSON.stringify(remaining));
    localStorage.setItem(GAME_LIBRARY_BACKUP_KEY, JSON.stringify(remaining));
  } catch {}
}

function touchGame(game: Game) {
  return { ...game, updatedAt: new Date().toISOString() };
}

function sortGameLibrary(games: Game[]) {
  return [...games].sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

function upsertGameInLibrary(games: Game[], game: Game) {
  if (!game.gameId) return games;

  const previous = games.find((item) => item.gameId === game.gameId);
  const isPlaceholder = game.gameName.startsWith("Loading shared game") && game.rounds.length === 0;

  if (previous && isPlaceholder) return sortGameLibrary(games);

  const saved = touchGame({ ...game, archived: game.archived ?? previous?.archived ?? false });
  const next = mergeGameLists([saved], games.filter((item) => item.gameId !== game.gameId));
  return next;
}

function visibleSavedGames(games: Game[], showArchived: boolean) {
  return sortGameLibrary(games).filter((item) => showArchived || !item.archived);
}
function shortGameCode(gameId?: string | null) {
  return gameId ? gameId.slice(0, 6).toUpperCase() : "LOCAL";
}
function getDeviceName() {
  if (typeof window === "undefined") return "This device";

  try {
    const saved = localStorage.getItem(DEVICE_NAME_KEY);
    if (saved) return saved;

    const ua = navigator.userAgent || "";
    const type = /iPhone/i.test(ua) ? "iPhone" : /iPad/i.test(ua) ? "iPad" : /Android/i.test(ua) ? "Android" : "Device";
    const name = `${type} ${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    localStorage.setItem(DEVICE_NAME_KEY, name);
    return name;
  } catch {
    return "This device";
  }
}
function uniquePresence(devices: DevicePresence[]) {
  const byId = new Map<string, DevicePresence>();
  devices.forEach((device) => {
    if (device?.clientId) byId.set(device.clientId, device);
  });
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const RANK_ORDER: Record<Rank, number> = { A: 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10, J: 11, Q: 12, K: 13 };

function cardValue(rank: Rank | "JOKER") {
  if (rank === "A" || rank === "JOKER") return 15;
  if (["10", "J", "Q", "K"].includes(rank)) return 10;
  return 5;
}

function buildDeck() {
  const normalDeck = SUITS.flatMap((suit) => RANKS.map((rank) => ({ id: `${rank}${suit}`, suit, rank, value: cardValue(rank) } as Card)));
  const jokers = Array.from({ length: 4 }, (_item, index) => ({ id: `JOKER-${index + 1}`, suit: "🃏" as const, rank: "JOKER" as const, value: 15, joker: true }));
  return [...normalDeck, ...jokers];
}

function shuffleCards(cards: Card[]) {
  const next = [...cards];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
}

function effectiveRank(card: Card) { return card.asRank || (card.rank === "JOKER" ? "A" : card.rank); }
function effectiveSuit(card: Card) { return card.asSuit || (card.suit === "🃏" ? "♠" : card.suit); }
function isJoker(card: Card) { return Boolean(card.joker || card.rank === "JOKER"); }
function asCard(joker: Card, rank: Rank, suit: Suit): Card { return { ...joker, asRank: rank, asSuit: suit }; }
function clearJoker(card: Card): Card { return isJoker(card) ? { id: card.id, suit: "🃏", rank: "JOKER", value: 15, joker: true } : card; }
function withPointOwner(card: Card, playerId: string): Card { return { ...card, pointOwnerId: playerId }; }
function sortCards(cards: Card[]) {
  return [...cards].sort((a, b) => {
    const jokerDiff = Number(isJoker(a)) - Number(isJoker(b));
    if (jokerDiff !== 0) return jokerDiff;
    return effectiveSuit(a).localeCompare(effectiveSuit(b)) || RANK_ORDER[effectiveRank(a)] - RANK_ORDER[effectiveRank(b)];
  });
}

const RUN_CYCLE: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const RUN_POSITION = RUN_CYCLE.reduce((acc, rank, index) => ({ ...acc, [rank]: index }), {} as Record<Rank, number>);

function cyclicRankAt(index: number) {
  return RUN_CYCLE[((index % RUN_CYCLE.length) + RUN_CYCLE.length) % RUN_CYCLE.length];
}

function orderCyclicRun(cards: Card[]) {
  if (cards.length === 0 || cards.length > RUN_CYCLE.length) return null;
  const suit = effectiveSuit(cards[0]);
  if (!cards.every((card) => effectiveSuit(card) === suit)) return null;

  const positions = cards.map((card) => RUN_POSITION[effectiveRank(card)]);
  if (positions.some((position) => position === undefined)) return null;
  if (new Set(positions).size !== positions.length) return null;

  for (let start = 0; start < RUN_CYCLE.length; start += 1) {
    const sequence = Array.from({ length: cards.length }, (_item, index) => (start + index) % RUN_CYCLE.length);
    if (!positions.every((position) => sequence.includes(position))) continue;
    const ordered = sequence
      .map((position) => cards.find((card) => RUN_POSITION[effectiveRank(card)] === position))
      .filter(Boolean) as Card[];
    if (ordered.length === cards.length) return { cards: ordered, suit, start, sequence };
  }

  return null;
}

function orderMeldCards(meld: Meld, cards: Card[]) {
  if (meld.kind === "run") return orderCyclicRun(cards)?.cards || cards;
  return sortCards(cards);
}

function nextPlayerId(players: Player[], currentPlayerId: string) {
  const index = players.findIndex((player) => player.id === currentPlayerId);
  return players[((index < 0 ? 0 : index) + 1) % players.length]?.id || players[0]?.id || currentPlayerId;
}

function createCardRound(players: Player[], dealerId: string): CardGameState {
  const deck = shuffleCards(buildDeck());
  const cardsEach = players.length <= 2 ? 13 : 7;
  const hands: Record<string, Card[]> = {};
  players.forEach((player) => { hands[player.id] = []; });

  for (let cardIndex = 0; cardIndex < cardsEach; cardIndex += 1) {
    players.forEach((player) => {
      const card = deck.shift();
      if (card) hands[player.id].push(card);
    });
  }

  Object.keys(hands).forEach((playerId) => { hands[playerId] = sortCards(hands[playerId]); });
  const firstDiscard = deck.shift();

  return {
    roundId: crypto.randomUUID(),
    dealerId,
    turnPlayerId: nextPlayerId(players, dealerId),
    phase: "draw",
    stock: deck,
    discard: firstDiscard ? [firstDiscard] : [],
    hands,
    melds: [],
    drewThisTurn: false,
    drewWholeDiscard: false,
    meldedAfterWholeDiscard: false,
    penalties: {},
    message: "Draw from stock, top discard, or pick up the whole discard pile."
  };
}

function removeCards(cards: Card[], ids: string[]) {
  const remove = new Set(ids);
  return cards.filter((card) => !remove.has(card.id));
}


function selectedCardsFromHand(hand: Card[], ids: string[]) {
  const wanted = new Set(ids);
  const selected = hand.filter((card) => wanted.has(card.id));
  return selected.length === wanted.size ? selected : null;
}

function hasDuplicateCardIds(cards: Card[]) {
  const seen = new Set<string>();
  return cards.some((card) => {
    if (seen.has(card.id)) return true;
    seen.add(card.id);
    return false;
  });
}

function cardStateHasDuplicateIds(state: CardGameState) {
  const allCards = [
    ...state.stock,
    ...state.discard,
    ...Object.values(state.hands).flat(),
    ...state.melds.flatMap((meld) => meld.cards)
  ];
  return hasDuplicateCardIds(allCards);
}

function sameCardSet(a: Card[], b: Card[]) {
  return a.length === b.length && a.every((card) => b.some((other) => other.id === card.id));
}

function createAssignedSet(cards: Card[]): { kind: "set"; cards: Card[] } | null {
  const natural = cards.filter((card) => !isJoker(card));
  const jokers = cards.filter(isJoker);
  const baseRank = (natural[0]?.rank || "A") as Rank;
  if (!natural.every((card) => card.rank === baseRank)) return null;
  const usedSuits = new Set(natural.map((card) => card.suit as Suit));
  if (usedSuits.size !== natural.length) return null;
  const availableSuits = SUITS.filter((suit) => !usedSuits.has(suit));
  if (jokers.length > availableSuits.length) return null;
  return { kind: "set", cards: sortCards([...natural, ...jokers.map((joker, index) => asCard(joker, baseRank, availableSuits[index]))]) };
}

function createAssignedRun(cards: Card[]): { kind: "run"; cards: Card[] } | null {
  const natural = cards.filter((card) => !isJoker(card));
  const jokers = cards.filter(isJoker);
  const baseSuit = (natural[0]?.suit || "♠") as Suit;
  if (!natural.every((card) => card.suit === baseSuit)) return null;
  if (cards.length > RUN_CYCLE.length) return null;

  const naturalPositions = natural.map((card) => RUN_POSITION[card.rank as Rank]);
  if (new Set(naturalPositions).size !== naturalPositions.length) return null;

  for (let start = 0; start < RUN_CYCLE.length; start += 1) {
    const sequence = Array.from({ length: cards.length }, (_item, index) => (start + index) % RUN_CYCLE.length);
    if (!naturalPositions.every((position) => sequence.includes(position))) continue;

    const missingPositions = sequence.filter((position) => !naturalPositions.includes(position));
    if (missingPositions.length !== jokers.length) continue;

    const assignedJokers = jokers.map((joker, index) => asCard(joker, cyclicRankAt(missingPositions[index]), baseSuit));
    const assignedCards = [...natural, ...assignedJokers];
    const ordered = sequence
      .map((position) => assignedCards.find((card) => RUN_POSITION[effectiveRank(card)] === position))
      .filter(Boolean) as Card[];

    if (ordered.length === cards.length) return { kind: "run", cards: ordered };
  }

  return null;
}
function classifyMeld(cards: Card[]): { kind: "set" | "run"; cards: Card[] } | null {
  if (cards.length < 3) return null;
  return createAssignedSet(cards) || createAssignedRun(cards);
}

function getLayOffCard(card: Card, meld: Meld): Card | null {
  if (meld.kind === "set") {
    const rank = effectiveRank(meld.cards[0]);
    const usedSuits = new Set(meld.cards.map(effectiveSuit));
    if (isJoker(card)) {
      const suit = SUITS.find((item) => !usedSuits.has(item));
      return suit ? asCard(card, rank, suit) : null;
    }
    return card.rank === rank && !usedSuits.has(card.suit as Suit) ? card : null;
  }

  const orderedRun = orderCyclicRun(meld.cards);
  if (!orderedRun || orderedRun.cards.length >= RUN_CYCLE.length) return null;

  const previousRank = cyclicRankAt(orderedRun.start - 1);
  const nextRank = cyclicRankAt(orderedRun.start + orderedRun.cards.length);
  const suit = orderedRun.suit as Suit;

  if (isJoker(card)) {
    return asCard(card, nextRank, suit);
  }

  if (card.suit !== suit) return null;
  return card.rank === previousRank || card.rank === nextRank ? card : null;
}
function canLayOff(card: Card, meld: Meld) { return Boolean(getLayOffCard(card, meld)); }

function findExchangeInMeld(handCard: Card, meld: Meld) {
  if (isJoker(handCard)) return null;
  return meld.cards.find((card) => isJoker(card) && card.asRank === handCard.rank && card.asSuit === handCard.suit) || null;
}

function meldPoints(melds: Meld[], playerId: string) {
  return melds.flatMap((meld) => meld.cards.map((card) => ({ card, fallbackOwnerId: meld.ownerId }))).reduce((sum, item) => {
    return (item.card.pointOwnerId || item.fallbackOwnerId) === playerId ? sum + item.card.value : sum;
  }, 0);
}

function cardPointOwnerId(card: Card, meld: Meld) {
  return card.pointOwnerId || meld.ownerId;
}

function pointOwnerSegments(meld: Meld) {
  const segments: { ownerId: string; cards: Card[] }[] = [];
  meld.cards.forEach((card) => {
    const ownerId = cardPointOwnerId(card, meld);
    const last = segments[segments.length - 1];
    if (last && last.ownerId === ownerId) {
      last.cards.push(card);
    } else {
      segments.push({ ownerId, cards: [card] });
    }
  });
  return segments;
}

function handPoints(cards: Card[]) {
  return cards.reduce((sum, card) => sum + card.value, 0);
}

function calculateCardRoundScores(state: CardGameState, players: Player[]) {
  const scores: Record<string, number> = {};
  players.forEach((player) => {
    scores[player.id] = meldPoints(state.melds, player.id) - handPoints(state.hands[player.id] || []) + Number(state.penalties?.[player.id] || 0);
  });
  return scores;
}

function cardLabel(card?: Card) {
  if (!card) return "—";
  if (isJoker(card)) return card.asRank && card.asSuit ? `🃏=${card.asRank}${card.asSuit}` : "🃏";
  return `${card.rank}${card.suit}`;
}
function cardFaceRank(card: Card) {
  return isJoker(card) ? "JKR" : card.rank;
}
function cardFaceSuit(card: Card) {
  return isJoker(card) ? (card.asSuit || "★") : card.suit;
}
function cardFaceCenter(card: Card) {
  return cardFaceSuit(card);
}


function cardAssetCode(card?: Card | null) {
  if (!card) return "BACK";
  if (isJoker(card)) {
    const match = String(card.id || "").match(/(\d+)$/);
    const jokerIndex = match ? Math.min(4, Math.max(1, Number(match[1]))) : 1;
    return `JOKER${jokerIndex}`;
  }
  const suitCode = card.suit === "♠" ? "S" : card.suit === "♥" ? "H" : card.suit === "♦" ? "D" : "C";
  return `${card.rank}${suitCode}`;
}

function cardAssetSrc(card?: Card | null) {
  return `/cards/${cardAssetCode(card)}.png`;
}

function CardAssetFace({ card }: { card?: Card | null }) {
  const label = card ? cardLabel(card) : "Card back";
  return (
    <img
      className="card-asset-face"
      src={cardAssetSrc(card)}
      alt={label}
      draggable={false}
      loading="eager"
    />
  );
}


type CardFaceSuit = Suit | "★";

type PipPoint = { x: number; y: number; scale?: number };

function isRedSuitValue(suit?: CardFaceSuit | null) {
  return suit === "♥" || suit === "♦";
}
function svgToneClass(card: Card) {
  if (isJoker(card)) return "card-svg-joker-card";
  return isRedSuitValue(card.suit as Suit) ? "card-svg-red" : "card-svg-black";
}
function suitTone(suit?: CardFaceSuit | null) {
  return isRedSuitValue(suit) ? "#cc2a2a" : "#181818";
}

function SuitMark({ suit, x = 50, y = 58, scale = 1, className = "svg-suit" }: { suit: CardFaceSuit; x?: number; y?: number; scale?: number; className?: string }) {
  const transform = `translate(${x} ${y}) scale(${scale}) translate(-50 -50)`;

  if (suit === "♥") {
    return (
      <g transform={transform} className={className}>
        <path d="M50 84 C22 59 13 43 20 29 C25 18 39 17 50 32 C61 17 75 18 80 29 C87 43 78 59 50 84 Z" />
      </g>
    );
  }

  if (suit === "♦") {
    return (
      <g transform={transform} className={className}>
        <path d="M50 10 L82 50 L50 90 L18 50 Z" />
      </g>
    );
  }

  if (suit === "♣") {
    return (
      <g transform={transform} className={className}>
        <circle cx="50" cy="27" r="17" />
        <circle cx="34" cy="49" r="17" />
        <circle cx="66" cy="49" r="17" />
        <path d="M46 58 C45 70 37 78 31 85 L69 85 C63 78 55 70 54 58 Z" />
      </g>
    );
  }

  if (suit === "♠") {
    return (
      <g transform={transform} className={className}>
        <path d="M50 13 C24 36 15 52 24 66 C31 76 43 72 48 62 C47 74 39 82 33 88 L67 88 C61 82 53 74 52 62 C57 72 69 76 76 66 C85 52 76 36 50 13 Z" />
      </g>
    );
  }

  return (
    <g transform={transform} className={className}>
      <path d="M50 13 L60 39 L88 39 L65 56 L74 84 L50 67 L26 84 L35 56 L12 39 L40 39 Z" />
    </g>
  );
}

const PIP_LAYOUTS: Record<string, PipPoint[]> = {
  A: [{ x: 50, y: 69, scale: 0.54 }],
  "2": [{ x: 50, y: 40, scale: 0.36 }, { x: 50, y: 98, scale: 0.36 }],
  "3": [{ x: 50, y: 34, scale: 0.34 }, { x: 50, y: 69, scale: 0.36 }, { x: 50, y: 104, scale: 0.34 }],
  "4": [{ x: 31, y: 40, scale: 0.32 }, { x: 69, y: 40, scale: 0.32 }, { x: 31, y: 98, scale: 0.32 }, { x: 69, y: 98, scale: 0.32 }],
  "5": [{ x: 31, y: 40, scale: 0.31 }, { x: 69, y: 40, scale: 0.31 }, { x: 50, y: 69, scale: 0.34 }, { x: 31, y: 98, scale: 0.31 }, { x: 69, y: 98, scale: 0.31 }],
  "6": [{ x: 31, y: 34, scale: 0.3 }, { x: 69, y: 34, scale: 0.3 }, { x: 31, y: 69, scale: 0.3 }, { x: 69, y: 69, scale: 0.3 }, { x: 31, y: 104, scale: 0.3 }, { x: 69, y: 104, scale: 0.3 }],
  "7": [{ x: 50, y: 24, scale: 0.27 }, { x: 31, y: 38, scale: 0.28 }, { x: 69, y: 38, scale: 0.28 }, { x: 50, y: 69, scale: 0.3 }, { x: 31, y: 98, scale: 0.28 }, { x: 69, y: 98, scale: 0.28 }, { x: 50, y: 114, scale: 0.27 }],
  "8": [{ x: 31, y: 24, scale: 0.27 }, { x: 69, y: 24, scale: 0.27 }, { x: 31, y: 46, scale: 0.27 }, { x: 69, y: 46, scale: 0.27 }, { x: 31, y: 92, scale: 0.27 }, { x: 69, y: 92, scale: 0.27 }, { x: 31, y: 114, scale: 0.27 }, { x: 69, y: 114, scale: 0.27 }],
  "9": [{ x: 50, y: 22, scale: 0.24 }, { x: 31, y: 36, scale: 0.26 }, { x: 69, y: 36, scale: 0.26 }, { x: 31, y: 58, scale: 0.26 }, { x: 69, y: 58, scale: 0.26 }, { x: 50, y: 70, scale: 0.28 }, { x: 31, y: 102, scale: 0.26 }, { x: 69, y: 102, scale: 0.26 }, { x: 50, y: 116, scale: 0.24 }],
  "10": [{ x: 31, y: 22, scale: 0.23 }, { x: 69, y: 22, scale: 0.23 }, { x: 31, y: 40, scale: 0.23 }, { x: 69, y: 40, scale: 0.23 }, { x: 31, y: 58, scale: 0.23 }, { x: 69, y: 58, scale: 0.23 }, { x: 31, y: 82, scale: 0.23 }, { x: 69, y: 82, scale: 0.23 }, { x: 31, y: 100, scale: 0.23 }, { x: 69, y: 100, scale: 0.23 }],
};

function CornerIndex({ rank, suit, mirrored = false }: { rank: string; suit: CardFaceSuit; mirrored?: boolean }) {
  const tone = suitTone(suit);
  const transform = mirrored ? "rotate(180 80 111)" : undefined;
  const x = mirrored ? 80 : 20;
  const y = mirrored ? 111 : 22;
  return (
    <g transform={transform}>
      <text className="card-svg-corner-rank" x={x} y={y} style={{ fill: tone }}>{rank}</text>
      <g transform={`translate(${mirrored ? 80 : 20} ${mirrored ? 118 : 29}) scale(0.15) translate(-50 -50)`} style={{ fill: tone }}>
        <SuitMark suit={suit} />
      </g>
    </g>
  );
}

function NumberPips({ rank, suit }: { rank: string; suit: CardFaceSuit }) {
  const points = PIP_LAYOUTS[rank] || PIP_LAYOUTS.A;
  return (
    <g className="card-svg-center">
      {points.map((point, index) => (
        <g key={`${rank}-${index}`} style={{ fill: suitTone(suit) }}>
          <SuitMark suit={suit} x={point.x} y={point.y} scale={point.scale || 0.3} />
        </g>
      ))}
    </g>
  );
}

function RoyalCenter({ rank, suit }: { rank: string; suit: CardFaceSuit }) {
  const tone = suitTone(suit);
  return (
    <g className="card-svg-center">
      <rect className="card-svg-royal-panel" x="24" y="34" width="52" height="72" rx="13" />
      <rect className="card-svg-royal-inner" x="28" y="38" width="44" height="64" rx="10" />
      <SuitMark suit={suit} x={50} y={51} scale={0.18} className="svg-suit" />
      <text className="card-svg-royal-rank" x="50" y="78" style={{ fill: tone }}>{rank}</text>
      <text className="card-svg-royal-word" x="50" y="95">{rank === "J" ? "JACK" : rank === "Q" ? "QUEEN" : "KING"}</text>
      <path className="card-svg-royal-line" d="M34 88 H66" />
      <SuitMark suit={suit} x={38} y={95} scale={0.12} className="svg-suit" />
      <SuitMark suit={suit} x={62} y={95} scale={0.12} className="svg-suit" />
    </g>
  );
}

function JokerMark() {
  return (
    <g className="card-svg-center svg-joker-mark" aria-hidden="true">
      <path className="joker-cap-red" d="M26 82 C28 60 34 49 44 41 C44 51 39 60 34 69 C42 67 47 64 52 58 C53 68 50 75 44 82 Z" />
      <path className="joker-cap-black" d="M74 82 C72 60 66 49 56 41 C56 51 61 60 66 69 C58 67 53 64 48 58 C47 68 50 75 56 82 Z" />
      <path className="joker-face" d="M37 82 C37 69 43 60 50 60 C57 60 63 69 63 82 C63 95 57 104 50 104 C43 104 37 95 37 82 Z" />
      <circle className="joker-cap-red" cx="34" cy="69" r="3.2" />
      <circle className="joker-cap-black" cx="66" cy="69" r="3.2" />
      <circle className="joker-cap-gold" cx="50" cy="44" r="4" />
      <path className="joker-collar" d="M38 93 C43 88 47 86 50 86 C53 86 57 88 62 93 C56 97 53 100 50 104 C47 100 44 97 38 93 Z" />
      <circle className="joker-eye" cx="45" cy="81" r="1.6" />
      <circle className="joker-eye" cx="55" cy="81" r="1.6" />
      <path className="joker-smile" d="M44 88 C47 91 53 91 56 88" />
    </g>
  );
}

function SvgCardFace({ card }: { card: Card }) {
  const jokerCard = isJoker(card);
  const faceSuit = cardFaceSuit(card) as CardFaceSuit;
  const faceRank = cardFaceRank(card);
  const assigned = jokerCard && card.asRank && card.asSuit;
  const tone = suitTone(faceSuit);
  const showRoyal = ["J", "Q", "K"].includes(faceRank);
  const cornerSuit = jokerCard && !card.asSuit ? "★" as CardFaceSuit : faceSuit;

  return (
    <svg className={`card-svg detailed-card-svg ${svgToneClass(card)}`} viewBox="0 0 100 140" role="img" aria-label={cardLabel(card)}>
      <rect className="card-svg-shadow" x="5" y="6" width="90" height="128" rx="13" />
      <rect className="card-svg-face" x="4" y="4" width="92" height="130" rx="13" />
      <rect className="card-svg-edge" x="7" y="7" width="86" height="124" rx="11" />
      <rect className="card-svg-inner" x="11" y="11" width="78" height="116" rx="9" />
      <CornerIndex rank={jokerCard ? "JKR" : faceRank} suit={cornerSuit} />
      <CornerIndex rank={jokerCard ? "JKR" : faceRank} suit={cornerSuit} mirrored />
      {jokerCard ? (
        <>
          <JokerMark />
          <text className="card-svg-joker" x="50" y="115">JOKER</text>
          {assigned ? <text className={`card-svg-assigned ${isRedSuitValue(card.asSuit) ? "assigned-red" : "assigned-black"}`} x="50" y="124">{card.asRank}{card.asSuit}</text> : null}
        </>
      ) : showRoyal ? (
        <RoyalCenter rank={faceRank} suit={faceSuit} />
      ) : (
        <NumberPips rank={faceRank} suit={faceSuit} />
      )}
      {!jokerCard && faceRank === "A" ? <path className="card-svg-ace-ring" d="M29 69 C29 54 39 43 50 43 C61 43 71 54 71 69 C71 84 61 95 50 95 C39 95 29 84 29 69 Z" style={{ stroke: `${tone}22` }} /> : null}
    </svg>
  );
}

type UiStudioTab = "type" | "space" | "radius" | "color" | "layout" | "presets";

const UI_STUDIO_DEFAULTS: Record<string, string> = {
  "--font-size-caption": "10px",
  "--font-size-body": "14px",
  "--font-size-title": "16px",
  "--font-size-display": "28px",
  "--font-size-input": "34px",
  "--font-size-score": "42px",
  "--font-weight-label": "700",
  "--font-weight-body": "600",
  "--font-weight-title": "800",
  "--font-weight-score": "900",
  "--radius-sm": "12px",
  "--radius-lg": "24px",
  "--radius-xl": "32px",
  "--ui-density-scale": "1",
  "--top-section-gap": "16px",
  "--scoreboard-gap": "16px",
  "--last-round-gap": "8px",
  "--input-card-gap": "18px",
  "--penalty-gap": "14px",
  "--bottom-gap": "12px",
  "--passport-blue": "#244cdd",
  "--passport-bg": "#efe9dc",
  "--passport-muted": "#244cdd"
};

const UI_STUDIO_PRESETS: Record<string, Record<string, string>> = {
  Default: UI_STUDIO_DEFAULTS,
  Compact: {
    ...UI_STUDIO_DEFAULTS,
    "--font-size-caption": "9px",
    "--font-size-body": "12px",
    "--font-size-title": "15px",
    "--font-size-display": "24px",
    "--font-size-input": "30px",
    "--font-size-score": "38px",
    "--ui-density-scale": "0.9",
    "--top-section-gap": "12px",
    "--scoreboard-gap": "12px",
    "--last-round-gap": "5px",
    "--input-card-gap": "14px",
    "--penalty-gap": "10px",
    "--bottom-gap": "8px"
  },
  Large: {
    ...UI_STUDIO_DEFAULTS,
    "--font-size-caption": "11px",
    "--font-size-body": "15px",
    "--font-size-title": "18px",
    "--font-size-display": "32px",
    "--font-size-input": "40px",
    "--font-size-score": "50px",
    "--ui-density-scale": "1.12",
    "--top-section-gap": "20px",
    "--scoreboard-gap": "20px",
    "--last-round-gap": "10px",
    "--input-card-gap": "22px",
    "--penalty-gap": "16px",
    "--bottom-gap": "14px"
  }
};


function createDefaultGame(): Game {
  return { gameId: null, gameName: "No game", players: DEFAULT_PLAYERS.slice(0, 2), targetScore: 1500, starterId: "p1", rounds: [], status: "active", winnerId: null };
}

function activeRounds(rounds: Round[]) { return rounds.filter((round) => !round.deleted); }

function nextStarterId(players: Player[], currentStarterId: string) {
  const index = players.findIndex((player) => player.id === currentStarterId);
  const safeIndex = index >= 0 ? index : 0;
  return players[(safeIndex + 1) % players.length]?.id || players[0]?.id || currentStarterId;
}

function totals(game: Game) {
  const result: Record<string, number> = {};
  game.players.forEach((player) => { result[player.id] = 0; });
  activeRounds(game.rounds).forEach((round) => {
    game.players.forEach((player) => {
      result[player.id] += Number(round.scores[player.id] || 0);
      if (round.closedBy === player.id) result[player.id] += 15;
    });
  });
  return result;
}

function signed(value: number) { return value > 0 ? `+${value}` : String(value); }
function haptic(pattern: number | number[] = 8) { if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern); }
function stripSync(raw: unknown): Game {
  const value = raw as CloudGame;
  const { __sync: _ignored, ...game } = value;
  return game as Game;
}
function gameSignature(game: Game) { return JSON.stringify(game); }
function isUntouchedDefault(game: Game) { return !game.gameId && game.rounds.length === 0 && game.gameName === "No game"; }
function getClientId() {
  if (typeof window === "undefined") return "server";
  const existing = localStorage.getItem(CLIENT_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(CLIENT_ID_KEY, id);
  return id;
}

function getAnalytics(game: Game, history: HistoryItem[]) {
  const rounds = activeRounds(game.rounds);
  const scoreTotals = totals(game);
  const totalRoundPoints = rounds.reduce((sum, round) => {
    return sum + game.players.reduce((inner, player) => inner + Number(round.scores[player.id] || 0), 0);
  }, 0);

  const leader = [...game.players].sort((a, b) => (scoreTotals[b.id] || 0) - (scoreTotals[a.id] || 0))[0];

  return {
    roundsPlayed: rounds.length,
    averageRoundPoints: rounds.length ? Math.round(totalRoundPoints / rounds.length) : 0,
    leaderName: leader?.name || "None",
    gamesFinished: history.length
  };
}

function getShareUrl(game: Game) {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  url.searchParams.set("game", game.gameId || CURRENT_GAME_ID);
  return url.toString();
}


type ScoreboardProps = { game: Game; scoreTotals: Record<string, number>; compact?: boolean; activePlayerId?: string | null };
const Scoreboard = memo(function Scoreboard({ game, scoreTotals, compact = false, activePlayerId = null }: ScoreboardProps) {
  if (compact) {
    return (
      <section className="glass scoreboard scoreboard-stable compact-scoreboard">
        <div className="label">Scoreboard</div>
        <div className="compact-score-grid">
          {game.players.map((player) => {
            const total = scoreTotals[player.id] || 0;
            const progress = Math.max(0, Math.min(100, Math.round((total / game.targetScore) * 100)));
            return (
              <div key={player.id} className={`glass-soft compact-score-chip ${player.id === activePlayerId ? "active" : ""}`}>
                <div className="compact-score-name" style={{ color: player.color }}>{player.name}</div>
                <div className="compact-score-total">{total}</div>
                <div className="compact-score-progress"><div className="progress-fill" style={{ width: `${progress}%`, background: player.color }} /></div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section className="glass scoreboard scoreboard-stable">
      <div className="label">Scoreboard</div>
      {game.players.map((player) => {
        const total = scoreTotals[player.id] || 0;
        const progress = Math.max(0, Math.min(100, Math.round((total / game.targetScore) * 100)));
        return (
          <div key={player.id} className="glass-soft player-card score-transition">
            <div className="ring" style={{ color: player.color }}>{progress}%</div>
            <div>
              <div className="player-name">{player.name}</div>
              <div className="progress"><div className="progress-fill" style={{ width: `${progress}%`, background: player.color }} /></div>
            </div>
            <div className="total score-transition">{total}</div>
          </div>
        );
      })}
    </section>
  );
});

export default function RummyApp() {
  const [game, setGame] = useState<Game>(() => createDefaultGame());
  const [savedGames, setSavedGames] = useState<Game[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [typographyOpen, setTypographyOpen] = useState(false);
  const [uiStudioTab, setUiStudioTab] = useState<UiStudioTab>("type");
  const [uiValues, setUiValues] = useState<Record<string, string>>(() => ({ ...UI_STUDIO_DEFAULTS }));
  const [showRoundsPopup, setShowRoundsPopup] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [showArchivedGames, setShowArchivedGames] = useState(false);
  const [gameOpen, setGameOpen] = useState(false);
  const [playerCount, setPlayerCount] = useState(2);
  const [target, setTarget] = useState<number | "custom">(1500);
  const [customTarget, setCustomTarget] = useState("");
  const [gameName, setGameName] = useState("");
  const [names, setNames] = useState<string[]>(DEFAULT_PLAYERS.map((p) => p.name));
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const [roomLoadStatus, setRoomLoadStatus] = useState<"idle" | "loading" | "loaded" | "missing">("idle");
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "shared">("idle");
  const [connectedDevices, setConnectedDevices] = useState<DevicePresence[]>([]);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [selectedMeldId, setSelectedMeldId] = useState<string | null>(null);
  const [devicePlayerId, setDevicePlayerId] = useState<string>("");

  const clientId = useRef("");
  const cloudLoaded = useRef(false);
  const applyingRemote = useRef(false);
  const initialSyncFinished = useRef(false);
  const currentSignature = useRef("");
  const localVersion = useRef(0);
  const pendingGame = useRef<Game | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncInFlight = useRef(false);
  const localLibraryLoaded = useRef(false);
  const suppressNextSaveForRemoteLoad = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      clientId.current = getClientId();
      window.history.scrollRestoration = "manual";
      window.scrollTo(0, 0);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(devicePlayerKey(game.gameId));
      const valid = saved && game.players.some((player) => player.id === saved) ? saved : "";
      setDevicePlayerId(valid);
    } catch {
      setDevicePlayerId("");
    }
  }, [game.gameId, game.players]);

  function chooseDevicePlayer(playerId: string) {
    setDevicePlayerId(playerId);
    setSelectedCards([]);
    setSelectedMeldId(null);
    try {
      if (typeof window !== "undefined") localStorage.setItem(devicePlayerKey(game.gameId), playerId);
    } catch {}
  }


  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    try {
      const library = readGameLibrary();
      const savedGame = localStorage.getItem(STORAGE_KEY);
      const savedHistory = localStorage.getItem(HISTORY_KEY);
      const urlGameId = getUrlGameId();
      const activeGameId = urlGameId || localStorage.getItem(ACTIVE_GAME_KEY) || "";
      let nextLibrary = library;

      if (savedGame) {
        const legacyGame = JSON.parse(savedGame) as Game;
        if (legacyGame.gameId && !nextLibrary.some((item) => item.gameId === legacyGame.gameId)) {
          nextLibrary = upsertGameInLibrary(nextLibrary, legacyGame);
          writeGameLibrary(nextLibrary);
        }
      }

      setSavedGames(sortGameLibrary(nextLibrary));

      const selectedGame = activeGameId
        ? nextLibrary.find((item) => item.gameId === activeGameId) || null
        : (savedGame ? JSON.parse(savedGame) as Game : null);

      if (selectedGame) {
        currentSignature.current = gameSignature(selectedGame);
        setGame(selectedGame);
        if (selectedGame.gameId) setUrlGameId(selectedGame.gameId);
      } else if (urlGameId) {
        const placeholder = { ...createDefaultGame(), gameId: urlGameId, gameName: `Loading shared game ${urlGameId.slice(0, 5).toUpperCase()}` };
        suppressNextSaveForRemoteLoad.current = true;
        setRoomLoadStatus("loading");
        currentSignature.current = gameSignature(placeholder);
        setGame(placeholder);
        setUrlGameId(urlGameId);
      } else if (savedGame) {
        const parsed = JSON.parse(savedGame) as Game;
        currentSignature.current = gameSignature(parsed);
        setGame(parsed);
        if (parsed.gameId) setUrlGameId(parsed.gameId);
      }

      if (savedHistory) setHistory(JSON.parse(savedHistory));
    } catch {}

    localLibraryLoaded.current = true;
  }, []);

  const queueCloudSave = useCallback((nextGame: Game) => {
    if (!cloudLoaded.current || applyingRemote.current || !initialSyncFinished.current || isUntouchedDefault(nextGame)) return;

    const cloudId = gameCloudId(nextGame);
    pendingGame.current = nextGame;
    try { localStorage.setItem(pendingSyncKey(cloudId), JSON.stringify(nextGame)); } catch {}
    setSyncStatus("syncing");

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (!pendingGame.current || syncInFlight.current) return;

      syncInFlight.current = true;
      const version = Date.now();
      localVersion.current = Math.max(localVersion.current, version);
      const gameToSave = pendingGame.current;
      const cloudId = gameCloudId(gameToSave);
      const cloudGame: CloudGame = {
        ...gameToSave,
        __sync: {
          clientId: clientId.current,
          version
        }
      };

      const { data, error } = await supabase
        .from("rummy_current_game")
        .upsert(
          {
            id: cloudId,
            game_state: cloudGame,
            updated_at: new Date(version).toISOString()
          },
          { onConflict: "id" }
        )
        .select("updated_at")
        .single();

      syncInFlight.current = false;

      if (error) {
        setSyncStatus("offline");
        return;
      }

      if (data?.updated_at) {
        try { localStorage.setItem(cloudUpdatedKey(cloudId), data.updated_at); } catch {}
      }

      pendingGame.current = null;
      try { localStorage.removeItem(pendingSyncKey(cloudId)); } catch {}
      setSyncStatus("synced");
    }, SAVE_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    if (!localLibraryLoaded.current) return;

    if (suppressNextSaveForRemoteLoad.current && roomLoadStatus === "loading") return;

    const signature = gameSignature(game);
    currentSignature.current = signature;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
      if (game.gameId) {
        localStorage.setItem(ACTIVE_GAME_KEY, game.gameId);
        setUrlGameId(game.gameId);
      }
    } catch {}

    if (game.gameId) {
      setSavedGames((previous) => {
        const next = upsertGameInLibrary(previous, game);
        writeGameLibrary(next);
        return next;
      });
    }

    if (!applyingRemote.current) {
      localVersion.current = Math.max(localVersion.current, Date.now());
      queueCloudSave(game);
    }
  }, [game, queueCloudSave]);

  useEffect(() => { try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch {} }, [history]);

  useEffect(() => {
    let mounted = true;
    const activeCloudId = gameCloudId(game);

    cloudLoaded.current = false;
    initialSyncFinished.current = false;
    pendingGame.current = null;

    async function loadCloud() {
      setSyncStatus("loading");
      setRoomLoadStatus("loading");

      if (!supabase) {
        cloudLoaded.current = true;
        initialSyncFinished.current = true;
        suppressNextSaveForRemoteLoad.current = false;
        setSyncStatus("offline");
        setRoomLoadStatus("missing");
        return;
      }

      const { data, error } = await supabase
        .from("rummy_current_game")
        .select("game_state, updated_at")
        .eq("id", activeCloudId)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        cloudLoaded.current = true;
        initialSyncFinished.current = true;
        suppressNextSaveForRemoteLoad.current = false;
        setSyncStatus("offline");
        setRoomLoadStatus("missing");
        return;
      }

      if (data?.game_state) {
        const remoteRaw = data.game_state as CloudGame;
        const remoteGame = { ...stripSync(remoteRaw), gameId: activeCloudId, updatedAt: data.updated_at || new Date().toISOString() };
        const remoteSignature = gameSignature(remoteGame);
        const localUpdated = localStorage.getItem(cloudUpdatedKey(activeCloudId)) || "";
        const remoteUpdated = data.updated_at || "";
        const shouldApplyRemote =
          !isUntouchedDefault(remoteGame) &&
          remoteSignature !== currentSignature.current &&
          (!localUpdated || remoteUpdated >= localUpdated);

        if (shouldApplyRemote) {
          applyingRemote.current = true;
          currentSignature.current = remoteSignature;
          setGame(remoteGame);
          setSavedGames((previous) => {
            const next = upsertGameInLibrary(previous, remoteGame);
            writeGameLibrary(next);
            return next;
          });
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteGame));
            localStorage.setItem(ACTIVE_GAME_KEY, activeCloudId);
            localStorage.setItem(cloudUpdatedKey(activeCloudId), remoteUpdated);
          } catch {}
          suppressNextSaveForRemoteLoad.current = false;
          setRoomLoadStatus("loaded");
          setTimeout(() => { applyingRemote.current = false; }, 0);
        }
      }

      if (!data?.game_state) {
        setRoomLoadStatus("missing");
        suppressNextSaveForRemoteLoad.current = false;
      } else {
        setRoomLoadStatus("loaded");
        suppressNextSaveForRemoteLoad.current = false;
      }

      cloudLoaded.current = true;
      initialSyncFinished.current = true;
      setSyncStatus("synced");
    }

    loadCloud();

    const channel = supabase
      .channel(`rummy-live-${activeCloudId}-${clientId.current || "client"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rummy_current_game",
          filter: `id=eq.${activeCloudId}`
        },
        (payload) => {
          const row = payload.new as { game_state?: CloudGame; updated_at?: string };
          if (!row?.game_state) return;

          const meta = row.game_state.__sync;
          if (meta?.clientId && meta.clientId === clientId.current) {
            setSyncStatus("synced");
            return;
          }

          const remoteGame = { ...stripSync(row.game_state), gameId: activeCloudId, updatedAt: row.updated_at || new Date().toISOString() };
          if (isUntouchedDefault(remoteGame)) return;

          const remoteSignature = gameSignature(remoteGame);
          if (remoteSignature === currentSignature.current) {
            setSyncStatus("synced");
            return;
          }

          if (meta?.version && meta.version < localVersion.current && pendingGame.current) {
            return;
          }

          applyingRemote.current = true;
          currentSignature.current = remoteSignature;
          setGame(remoteGame);
          setSavedGames((previous) => {
            const next = upsertGameInLibrary(previous, remoteGame);
            writeGameLibrary(next);
            return next;
          });
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteGame));
            localStorage.setItem(ACTIVE_GAME_KEY, activeCloudId);
            if (row.updated_at) localStorage.setItem(cloudUpdatedKey(activeCloudId), row.updated_at);
          } catch {}

          suppressNextSaveForRemoteLoad.current = false;
          setRoomLoadStatus("loaded");
          setTimeout(() => { applyingRemote.current = false; }, 0);
          setSyncStatus("synced");
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setSyncStatus("synced");
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setSyncStatus("offline");
          if (roomLoadStatus === "loading") setRoomLoadStatus("missing");
        }
      });

    return () => {
      mounted = false;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      supabase.removeChannel(channel);
    };
  }, [game.gameId]);


  useEffect(() => {
    const activeCloudId = gameCloudId(game);

    if (!clientId.current) clientId.current = getClientId();

    const localPresence: DevicePresence = {
      clientId: clientId.current || "local",
      name: getDeviceName(),
      joinedAt: new Date().toISOString(),
      gameName: game.gameName || "Rummy 500"
    };

    if (!supabase || !activeCloudId) {
      setConnectedDevices([localPresence]);
      return;
    }

    const channel = supabase.channel(`rummy-presence-${activeCloudId}`, {
      config: { presence: { key: localPresence.clientId } }
    });

    const updatePresence = () => {
      const state = channel.presenceState() as Record<string, DevicePresence[]>;
      const remoteDevices = Object.values(state).flat();
      setConnectedDevices(uniquePresence(remoteDevices.length ? remoteDevices : [localPresence]));
    };

    channel
      .on("presence", { event: "sync" }, updatePresence)
      .on("presence", { event: "join" }, updatePresence)
      .on("presence", { event: "leave" }, updatePresence)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track(localPresence);
          updatePresence();
        }
      });

    return () => {
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
    };
  }, [game.gameId, game.gameName]);

  useEffect(() => {
    function flushPendingSync() {
      try {
        const pending = localStorage.getItem(pendingSyncKey(gameCloudId(game)));
        if (pending) {
          queueCloudSave(JSON.parse(pending) as Game);
        }
      } catch {}
    }

    window.addEventListener("online", flushPendingSync);
    flushPendingSync();

    return () => window.removeEventListener("online", flushPendingSync);
  }, [queueCloudSave, game.gameId]);

  const rounds = useMemo(() => activeRounds(game.rounds), [game.rounds]);
  const scoreTotals = useMemo(() => totals(game), [game]);
  const winner = game.winnerId ? game.players.find((player) => player.id === game.winnerId) : null;
  const latestRound = rounds[rounds.length - 1];
  const analytics = useMemo(() => getAnalytics(game, history), [game, history]);
  const cardState = game.cardGame || null;
  const currentPlayer = cardState ? game.players.find((player) => player.id === cardState.turnPlayerId) || game.players[0] : game.players[0];
  const claimedPlayer = devicePlayerId ? game.players.find((player) => player.id === devicePlayerId) || null : null;
  const activeHandPlayer = claimedPlayer || currentPlayer;
  const activeHand = cardState && activeHandPlayer ? sortCards(cardState.hands[activeHandPlayer.id] || []) : [];
  const handRows = activeHand.length > 8 ? 2 : 1;
  const handColumns = Math.max(1, Math.ceil(activeHand.length / handRows));
  const selectedHandCards = activeHand.filter((card) => selectedCards.includes(card.id));
  const topDiscard = cardState?.discard[cardState.discard.length - 1];
  const canOperateCardTurn = Boolean(cardState && (!devicePlayerId || cardState.turnPlayerId === devicePlayerId));
  const selectedMeld = cardState && selectedMeldId ? cardState.melds.find((meld) => meld.id === selectedMeldId) || null : null;
  const canExchangeJoker = Boolean(cardState?.phase === "play" && selectedMeld && selectedHandCards.length === 1 && findExchangeInMeld(selectedHandCards[0], selectedMeld));
  const isWatchingOtherTurn = Boolean(cardState && devicePlayerId && cardState.turnPlayerId !== devicePlayerId);

  function showDeviceTurnMessage() {
    setGame((previous: Game) => previous.cardGame ? { ...previous, cardGame: { ...previous.cardGame, message: `This device is claimed as ${claimedPlayer?.name || "another player"}. Wait for your turn or switch seat.` } } : previous);
  }

  function startPlayableRound() {
    if (!game.gameId) { setGameOpen(true); return; }
    setGame((previous: Game) => {
      const dealerId = previous.starterId || previous.players[0]?.id || "p1";
      return { ...previous, cardGame: createCardRound(previous.players, dealerId), status: "active", winnerId: null };
    });
    setSelectedCards([]);
    setSelectedMeldId(null);
    haptic([8, 18, 8]);
  }

  function toggleCard(cardId: string) {
    setSelectedCards((previous) => previous.includes(cardId) ? previous.filter((id) => id !== cardId) : [...previous, cardId]);
  }

  function drawFromStock() {
    if (!canOperateCardTurn) { showDeviceTurnMessage(); return; }
    if (!cardState || cardState.phase !== "draw" || !currentPlayer) return;
    setGame((previous: Game) => {
      const state = previous.cardGame;
      if (!state || state.phase !== "draw") return previous;
      const stock = [...state.stock];
      const discard = [...state.discard];
      if (stock.length === 0 && discard.length <= 1) return { ...previous, cardGame: { ...state, message: "No cards left to draw." } };
      let nextDiscard = discard;
      if (stock.length === 0) {
        const keepTop = discard.pop();
        stock.push(...shuffleCards(discard));
        nextDiscard = keepTop ? [keepTop] : [];
      }
      const card = stock.shift();
      if (!card) return previous;
      const hand = sortCards([...(state.hands[state.turnPlayerId] || []), card]);
      return { ...previous, cardGame: { ...state, stock, discard: nextDiscard, hands: { ...state.hands, [state.turnPlayerId]: hand }, phase: "play", drewThisTurn: true, drewWholeDiscard: false, meldedAfterWholeDiscard: false, message: `${previous.players.find((player) => player.id === state.turnPlayerId)?.name || "Player"} drew from stock.` } };
    });
    setSelectedCards([]);
  }

  function drawFromDiscard() {
    if (!canOperateCardTurn) { showDeviceTurnMessage(); return; }
    if (!cardState || cardState.phase !== "draw") return;
    setGame((previous: Game) => {
      const state = previous.cardGame;
      if (!state || state.phase !== "draw" || state.discard.length === 0) return previous;
      const discard = [...state.discard];
      const card = discard.pop();
      if (!card) return previous;
      const hand = sortCards([...(state.hands[state.turnPlayerId] || []), card]);
      return { ...previous, cardGame: { ...state, discard, hands: { ...state.hands, [state.turnPlayerId]: hand }, phase: "play", drewThisTurn: true, drewWholeDiscard: false, meldedAfterWholeDiscard: false, message: `${previous.players.find((player) => player.id === state.turnPlayerId)?.name || "Player"} picked up ${cardLabel(card)}.` } };
    });
    setSelectedCards([]);
  }

  function drawWholeDiscardPile() {
    if (!canOperateCardTurn) { showDeviceTurnMessage(); return; }
    if (!cardState || cardState.phase !== "draw") return;
    setGame((previous: Game) => {
      const state = previous.cardGame;
      if (!state || state.phase !== "draw" || state.discard.length === 0) return previous;
      const pickedUp = [...state.discard];
      const hand = sortCards([...(state.hands[state.turnPlayerId] || []), ...pickedUp]);
      return {
        ...previous,
        cardGame: {
          ...state,
          discard: [],
          hands: { ...state.hands, [state.turnPlayerId]: hand },
          phase: "play",
          drewThisTurn: true,
          drewWholeDiscard: true,
          meldedAfterWholeDiscard: false,
          message: `${previous.players.find((player) => player.id === state.turnPlayerId)?.name || "Player"} picked up the whole discard pile. They must make a meld this turn or take a -50 penalty.`
        }
      };
    });
    setSelectedCards([]);
  }

  function makeMeld() {
    if (!canOperateCardTurn) { showDeviceTurnMessage(); return; }
    if (!cardState || !currentPlayer || selectedHandCards.length < 3) return;
    setGame((previous: Game) => {
      const state = previous.cardGame;
      if (!state || state.phase !== "play") return previous;
      const hand = state.hands[state.turnPlayerId] || [];
      const selectedFromState = selectedCardsFromHand(hand, selectedCards);
      if (!selectedFromState || selectedFromState.length < 3) return previous;
      const assignedMeld = classifyMeld(selectedFromState);
      if (!assignedMeld) {
        return { ...previous, cardGame: { ...state, message: "Select 3+ cards of the same rank, or a same-suit run." } };
      }
      const meld: Meld = { id: crypto.randomUUID(), ownerId: state.turnPlayerId, cards: assignedMeld.cards.map((meldCard) => withPointOwner(meldCard, state.turnPlayerId)), kind: assignedMeld.kind };
      const nextCardGame = { ...state, hands: { ...state.hands, [state.turnPlayerId]: removeCards(hand, selectedCards) }, melds: [...state.melds, meld], meldedAfterWholeDiscard: state.meldedAfterWholeDiscard || state.drewWholeDiscard || false, message: `${previous.players.find((player) => player.id === state.turnPlayerId)?.name || "Player"} made a ${assignedMeld.kind}. Discard to end the turn.` };
      return cardStateHasDuplicateIds(nextCardGame) ? { ...previous, cardGame: { ...state, message: "Move blocked because the card state looked out of sync. Try again." } } : { ...previous, cardGame: nextCardGame };
    });
    setSelectedCards([]);
  }

  function layOffSelected() {
    if (!canOperateCardTurn) { showDeviceTurnMessage(); return; }
    if (!cardState || !selectedMeldId || selectedHandCards.length !== 1) return;
    setGame((previous: Game) => {
      const state = previous.cardGame;
      if (!state || state.phase !== "play") return previous;
      const hand = state.hands[state.turnPlayerId] || [];
      const selectedFromState = selectedCardsFromHand(hand, selectedCards);
      const card = selectedFromState?.[0];
      const targetMeld = state.melds.find((meld) => meld.id === selectedMeldId);
      const layOffCard = card && targetMeld ? getLayOffCard(card, targetMeld) : null;
      if (!card || !targetMeld || !layOffCard) {
        return { ...previous, cardGame: { ...state, message: "That card cannot be laid off on the selected meld." } };
      }
      const nextCardGame = {
        ...state,
        hands: { ...state.hands, [state.turnPlayerId]: removeCards(hand, [card.id]) },
        melds: state.melds.map((meld) => meld.id === selectedMeldId ? { ...meld, cards: orderMeldCards(meld, [...meld.cards, withPointOwner(layOffCard, state.turnPlayerId)]) } : meld),
        message: `${previous.players.find((player) => player.id === state.turnPlayerId)?.name || "Player"} laid off ${cardLabel(layOffCard)}.`
      };
      return cardStateHasDuplicateIds(nextCardGame) ? { ...previous, cardGame: { ...state, message: "Move blocked because the card state looked out of sync. Try again." } } : { ...previous, cardGame: nextCardGame };
    });
    setSelectedCards([]);
    setSelectedMeldId(null);
  }

  function exchangeSelectedJoker() {
    if (!canOperateCardTurn) { showDeviceTurnMessage(); return; }
    if (!cardState || !selectedMeldId || selectedHandCards.length !== 1) return;
    setGame((previous: Game) => {
      const state = previous.cardGame;
      if (!state || state.phase !== "play") return previous;
      const hand = state.hands[state.turnPlayerId] || [];
      const selectedFromState = selectedCardsFromHand(hand, selectedCards);
      const handCard = selectedFromState?.[0];
      const targetMeld = state.melds.find((meld) => meld.id === selectedMeldId);
      const joker = handCard && targetMeld ? findExchangeInMeld(handCard, targetMeld) : null;
      if (!handCard || !targetMeld || !joker) {
        return { ...previous, cardGame: { ...state, message: "Select the real card from your hand and the meld where the matching joker is used." } };
      }
      const cleanJoker = clearJoker(joker);
      const nextCardGame = {
        ...state,
        hands: { ...state.hands, [state.turnPlayerId]: sortCards([...removeCards(hand, [handCard.id]), cleanJoker]) },
        melds: state.melds.map((meld) => meld.id === selectedMeldId ? { ...meld, cards: meld.cards.map((card) => card.id === joker.id ? withPointOwner(handCard, state.turnPlayerId) : card) } : meld),
        message: `${previous.players.find((player) => player.id === state.turnPlayerId)?.name || "Player"} exchanged ${cardLabel(handCard)} for a joker.`
      };
      return cardStateHasDuplicateIds(nextCardGame) ? { ...previous, cardGame: { ...state, message: "Move blocked because the card state looked out of sync. Try again." } } : { ...previous, cardGame: nextCardGame };
    });
    setSelectedCards([]);
    setSelectedMeldId(null);
  }

  function discardSelected() {
    if (!canOperateCardTurn) { showDeviceTurnMessage(); return; }
    if (!cardState || selectedHandCards.length !== 1) return;
    setGame((previous: Game) => {
      const state = previous.cardGame;
      if (!state || state.phase !== "play") return previous;
      const turnHand = state.hands[state.turnPlayerId] || [];
      const selectedFromState = selectedCardsFromHand(turnHand, selectedCards);
      const card = selectedFromState?.[0];
      if (!card) return { ...previous, cardGame: { ...state, message: "Select one card from your current hand to discard." } };
      const hand = removeCards(turnHand, [card.id]);
      const nextDealer = state.dealerId;
      const nextTurn = nextPlayerId(previous.players, state.turnPlayerId);
      const wholeDiscardPenalty = Boolean(state.drewWholeDiscard && !state.meldedAfterWholeDiscard);
      const penaltyMessage = wholeDiscardPenalty ? " They did not make a meld after taking the whole discard pile, so a -50 penalty will be included when the round closes." : "";
      const nextPenalties = wholeDiscardPenalty
        ? { ...(state.penalties || {}), [state.turnPlayerId]: Number(state.penalties?.[state.turnPlayerId] || 0) - 50 }
        : (state.penalties || {});

      const afterDiscard: CardGameState = {
        ...state,
        hands: { ...state.hands, [state.turnPlayerId]: hand },
        discard: [...state.discard, card],
        turnPlayerId: nextTurn,
        phase: "draw",
        drewThisTurn: false,
        drewWholeDiscard: false,
        meldedAfterWholeDiscard: false,
        penalties: nextPenalties,
        message: `${previous.players.find((player) => player.id === state.turnPlayerId)?.name || "Player"} discarded ${cardLabel(card)}. Next: ${previous.players.find((player) => player.id === nextTurn)?.name || "Player"}.${penaltyMessage}`
      };

      if (hand.length === 0) {
        const scores = calculateCardRoundScores(afterDiscard, previous.players);
        const round: Round = { id: afterDiscard.roundId, scores, closedBy: state.turnPlayerId, starterId: previous.starterId };
        const nextRounds = [...previous.rounds, round];
        const draft = { ...previous, rounds: nextRounds, cardGame: { ...afterDiscard, phase: "roundOver" as const, message: `${previous.players.find((player) => player.id === state.turnPlayerId)?.name || "Player"} closed by discarding their last card. Scores were added automatically, including the +15 closing bonus.${penaltyMessage}` }, starterId: nextStarterId(previous.players, nextDealer) };
        const nextTotals = totals(draft);
        const winnerPlayer = previous.players.find((player) => (nextTotals[player.id] || 0) >= previous.targetScore);
        if (winnerPlayer) {
          const item: HistoryItem = { gameId: previous.gameId || crypto.randomUUID(), gameName: previous.gameName, winnerName: winnerPlayer.name, rounds: activeRounds(nextRounds).length, finishedAt: new Date().toISOString() };
          setHistory((old: HistoryItem[]) => [item, ...old].slice(0, 20));
          return { ...draft, status: "finished", winnerId: winnerPlayer.id };
        }
        return draft;
      }

      return { ...previous, cardGame: afterDiscard };
    });
    setSelectedCards([]);
    setSelectedMeldId(null);
  }



  function createGame() {
    const players = DEFAULT_PLAYERS.slice(0, playerCount).map((player, index) => ({ ...player, name: names[index]?.trim() || player.name }));
    const nextGame: Game = touchGame({ gameId: crypto.randomUUID(), gameName: gameName.trim() || `Game ${new Date().toLocaleDateString()}`, players, targetScore: target === "custom" ? Number(customTarget || 1500) : target, starterId: players[0].id, rounds: [], status: "active", winnerId: null, archived: false });
    setGame(nextGame);
    setSavedGames((previous) => {
      const next = upsertGameInLibrary(previous, nextGame);
      writeGameLibrary(next);
      return next;
    });
    if (nextGame.gameId) setUrlGameId(nextGame.gameId);
    setGameOpen(false); haptic([8, 18, 8]);
  }

  function toggleStarter() {
    setGame((previous: Game) => ({ ...previous, starterId: nextStarterId(previous.players, previous.starterId) }));
  }



  function undo() {
    setGame((previous: Game) => {
      const nextRounds = [...previous.rounds];
      for (let index = nextRounds.length - 1; index >= 0; index -= 1) {
        if (!nextRounds[index].deleted) { nextRounds[index] = { ...nextRounds[index], deleted: true }; break; }
      }
      return { ...previous, rounds: nextRounds, status: "active", winnerId: null };
    });
    haptic([10, 24, 10]);
  }

  function resetGame() { setGame((previous: Game) => ({ ...previous, rounds: [], status: "active", winnerId: null, cardGame: null })); setSettingsOpen(false); }
  function rematch() { setGame((previous: Game) => ({ ...previous, gameId: crypto.randomUUID(), gameName: `${previous.gameName} rematch`, rounds: [], status: "active", winnerId: null, cardGame: null })); }
  function newSetup() { setGame(createDefaultGame()); setGameOpen(true); }

  
  function uiValue(name: string) {
    return uiValues[name] || UI_STUDIO_DEFAULTS[name] || "0";
  }

  function setUiVar(name: string, value: string) {
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty(name, value);
    }

    setUiValues((previous) => ({ ...previous, [name]: value }));

    try {
      localStorage.setItem(`rummy-type-${name}`, value);
    } catch {}
  }

  function editUiVar(name: string, fallback: string) {
    const current = uiValue(name) || fallback;
    const value = typeof window !== "undefined" ? window.prompt(`Set ${name}`, current) : null;
    if (!value) return;

    setUiVar(name, value.trim());
  }

  function adjustUiVar(
    name: string,
    step: number,
    fallback: number,
    unit: "px" | "number" | "opacity" = "px",
    min = 0,
    max = 999
  ) {
    const current = uiValue(name);
    const parsed = parseFloat(current || String(fallback));
    const nextNumber = Math.min(max, Math.max(min, parsed + step));
    const rounded = unit === "opacity" ? Math.round(nextNumber * 100) / 100 : Math.round(nextNumber);
    const value = unit === "px" ? `${rounded}px` : `${rounded}`;

    setUiVar(name, value);
  }

  function updateTypeVar(name: string, value: string) {
    setUiVar(name, value);
  }

  function applyUiPreset(values: Record<string, string>) {
    Object.entries(values).forEach(([name, value]) => setUiVar(name, value));
  }

  function getStoredUiPresets(): Record<string, Record<string, string>> {
    try {
      const raw = localStorage.getItem("rummy-ui-custom-presets");
      return raw ? JSON.parse(raw) as Record<string, Record<string, string>> : {};
    } catch {
      return {};
    }
  }

  function setStoredUiPresets(presets: Record<string, Record<string, string>>) {
    try {
      localStorage.setItem("rummy-ui-custom-presets", JSON.stringify(presets));
    } catch {}
  }

  function saveCustomUiPreset() {
    if (typeof window === "undefined") return;
    const name = window.prompt("Preset name", "My UI");
    if (!name) return;

    const presets = getStoredUiPresets();
    presets[name] = uiValues;
    setStoredUiPresets(presets);
  }

  function loadCustomUiPreset() {
    if (typeof window === "undefined") return;
    const presets = getStoredUiPresets();
    const names = Object.keys(presets);

    if (!names.length) return;
    const name = window.prompt(`Load preset:\n${names.join("\n")}`, names[0]);
    if (!name || !presets[name]) return;

    applyUiPreset(presets[name]);
  }

  function renameCustomUiPreset() {
    if (typeof window === "undefined") return;
    const presets = getStoredUiPresets();
    const names = Object.keys(presets);

    if (!names.length) return;
    const oldName = window.prompt(`Rename preset:\n${names.join("\n")}`, names[0]);
    if (!oldName || !presets[oldName]) return;
    const newName = window.prompt("New preset name", oldName);
    if (!newName || newName === oldName) return;

    presets[newName] = presets[oldName];
    delete presets[oldName];
    setStoredUiPresets(presets);
  }

  function deleteCustomUiPreset() {
    if (typeof window === "undefined") return;
    const presets = getStoredUiPresets();
    const names = Object.keys(presets);

    if (!names.length) return;
    const name = window.prompt(`Delete preset:\n${names.join("\n")}`, names[0]);
    if (!name || !presets[name]) return;

    delete presets[name];
    setStoredUiPresets(presets);
  }

  function exportUiPreset() {
    try {
      navigator.clipboard?.writeText(JSON.stringify(uiValues, null, 2));
    } catch {}
  }

  function importUiPreset() {
    const value = typeof window !== "undefined" ? window.prompt("Paste UI preset JSON") : null;
    if (!value) return;

    try {
      applyUiPreset(JSON.parse(value) as Record<string, string>);
    } catch {}
  }

  useEffect(() => {
    if (typeof document === "undefined") return;

    const nextValues: Record<string, string> = { ...UI_STUDIO_DEFAULTS };

    Object.keys(UI_STUDIO_DEFAULTS).forEach((name) => {
      try {
        const saved = localStorage.getItem(`rummy-type-${name}`);
        const value = saved || UI_STUDIO_DEFAULTS[name];
        nextValues[name] = value;
        document.documentElement.style.setProperty(name, value);
      } catch {}
    });

    setUiValues(nextValues);
  }, []);


  function openGameLibrary() {
    setSettingsOpen(false);
    setGamesOpen(true);
  }

  function repairSavedGamesLibrary() {
    const repaired = readGameLibrary();
    setSavedGames(repaired);
    writeGameLibrary(repaired);
    haptic(8);
  }

  function switchSavedGame(nextGame: Game) {
    const opened = touchGame(nextGame);
    applyingRemote.current = true;
    currentSignature.current = gameSignature(opened);
    setGame(opened);
    setGamesOpen(false);
    if (opened.gameId) {
      setUrlGameId(opened.gameId);
      try { localStorage.setItem(ACTIVE_GAME_KEY, opened.gameId); } catch {}
    }
    setSavedGames((previous) => {
      const next = upsertGameInLibrary(previous, opened);
      writeGameLibrary(next);
      return next;
    });
    setTimeout(() => { applyingRemote.current = false; }, 0);
  }

  function deleteSavedGame(gameId: string) {
    const next = savedGames.filter((item) => item.gameId !== gameId);
    setSavedGames(next);
    removeGameFromStorage(gameId);
    writeGameLibrary(next);

    if (game.gameId === gameId) {
      const fallback = next[0] || createDefaultGame();
      setGame(fallback);
      if (fallback.gameId) setUrlGameId(fallback.gameId);
    }
  }

  function duplicateCurrentGame() {
    const copy: Game = touchGame({
      ...game,
      gameId: crypto.randomUUID(),
      gameName: `${game.gameName || "Game"} copy`,
      status: "active",
      winnerId: null,
      archived: false
    });
    setGame(copy);
    setGamesOpen(false);
    haptic([8, 18, 8]);
  }

  async function copySavedGameLink(nextGame: Game) {
    const url = getShareUrl(nextGame);

    try {
      await navigator.clipboard.writeText(url);
      setShareStatus("copied");
      haptic(8);
    } catch {}

    setTimeout(() => setShareStatus("idle"), 1400);
  }

  function openInvitePanel() {
    setSettingsOpen(false);
    setGamesOpen(false);
    setInviteOpen(true);
  }

  async function copyCurrentGameLink() {
    await copySavedGameLink(game);
  }

  async function shareCurrentGame() {
    const url = getShareUrl(game);
    const text = `Join my Rummy 500 game: ${game.gameName || "Rummy 500"}\n${url}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: game.gameName || "Rummy 500", text, url });
        setShareStatus("copied");
        haptic(8);
      } else {
        await navigator.clipboard.writeText(text);
        setShareStatus("copied");
        haptic(8);
      }
    } catch {}

    setTimeout(() => setShareStatus("idle"), 1400);
  }

  function renameSavedGame(gameId: string) {
    const current = savedGames.find((item) => item.gameId === gameId);
    if (!current) return;

    const nextName = typeof window !== "undefined" ? window.prompt("Game name", current.gameName || "Game") : null;
    if (!nextName?.trim()) return;

    const renamed = touchGame({ ...current, gameName: nextName.trim() });
    const next = upsertGameInLibrary(savedGames.filter((item) => item.gameId !== gameId), renamed);
    setSavedGames(next);
    writeGameLibrary(next);

    if (game.gameId === gameId) setGame(renamed);
  }

  function archiveSavedGame(gameId: string) {
    const current = savedGames.find((item) => item.gameId === gameId);
    if (!current) return;

    const archived = touchGame({ ...current, archived: !current.archived });
    const next = upsertGameInLibrary(savedGames.filter((item) => item.gameId !== gameId), archived);
    setSavedGames(next);
    writeGameLibrary(next);

    if (game.gameId === gameId) setGame(archived);
  }

  function saveGame() { queueCloudSave(game); setSettingsOpen(false); }

  async function shareGame() {
    const url = getShareUrl(game);

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Rummy 500",
          text: "Join the current Rummy 500 game",
          url
        });
        setShareStatus("shared");
      } else {
        await navigator.clipboard.writeText(url);
        setShareStatus("copied");
      }
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setShareStatus("copied");
      } catch {}
    }

    setTimeout(() => setShareStatus("idle"), 1600);
  }

  return (
    <motion.main className={`app players-${game.players.length} ${cardState ? "card-table-active" : ""}`} initial={{ opacity: 0.98 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}>
      <div className="bg" aria-hidden="true" />
      <div className="ui">
        <header className="header game-topbar">
          <button type="button" onClick={toggleStarter} className="glass-soft pill topbar-chip"><span>Starter</span><strong>{game.players.find((player) => player.id === game.starterId)?.name || "You"}</strong></button>
          <button type="button" onClick={() => setSettingsOpen(true)} className="glass-soft pill topbar-chip"><span>{game.gameId ? game.gameName : "No game"}</span><strong>{game.targetScore}</strong><i className={`sync-dot sync-${syncStatus}`} /></button>
        </header>

        <Scoreboard game={game} scoreTotals={scoreTotals} compact={Boolean(cardState)} activePlayerId={cardState?.turnPlayerId || null} />

        <section className="glass playable-cardgame">
          <div className="playable-topline game-status-panel">
            <div className="turn-chip">
              <span>Turn</span>
              <strong>{cardState ? currentPlayer?.name || "Player" : "Cards not dealt"}</strong>
            </div>
            <button type="button" onClick={startPlayableRound} className="glass-soft card-action primary-card-action">
              {cardState?.phase === "roundOver" ? "Next deal" : cardState ? "Redeal" : "Deal cards"}
            </button>
          </div>

          <div className="seat-selector" aria-label="This device player">
            <span>This phone</span>
            <button type="button" onClick={() => chooseDevicePlayer("")} className={!devicePlayerId ? "selected" : ""}>Table</button>
            {game.players.map((player) => (
              <button type="button" key={player.id} onClick={() => chooseDevicePlayer(player.id)} className={devicePlayerId === player.id ? "selected" : ""}>{player.name}</button>
            ))}
          </div>

          {!cardState ? (
            <div className="card-empty-state">Deal a 56-card deck including 4 jokers. Jokers can be used as any card, exchanged back out with the real matching card, and automatic round scores are added only when a player closes by discarding their last card.</div>
          ) : (
            <>
              <div className="card-table-row">
                <button type="button" disabled={cardState.phase !== "draw" || !canOperateCardTurn} onClick={drawFromStock} className="card-pile stock-pile card-pile-with-asset deck-pile-card">
                  <div className="pile-copy">
                    <span>Stock</span>
                    <strong>{cardState.stock.length}</strong>
                  </div>
                  <div className="pile-art"><CardAssetFace /></div>
                </button>
                <button type="button" disabled={cardState.phase !== "draw" || cardState.discard.length === 0 || !canOperateCardTurn} onClick={drawFromDiscard} className="card-pile discard-pile card-pile-with-asset deck-pile-card">
                  <div className="pile-copy">
                    <span>Discard</span>
                    <strong>{topDiscard ? cardLabel(topDiscard) : "—"}</strong>
                  </div>
                  <div className="pile-art">{topDiscard ? <CardAssetFace card={topDiscard} /> : null}</div>
                </button>
                <button type="button" disabled={cardState.phase !== "draw" || cardState.discard.length === 0 || !canOperateCardTurn} onClick={drawWholeDiscardPile} className="card-pile discard-pile whole-discard-pile">
                  <span>Full pile</span>
                  <strong>{cardState.discard.length}</strong>
                </button>
              </div>

              <div className="card-message">{cardState.message}</div>

              <div className="hand-scroll-wrap">
              <div
                className={`hand-scroll ${handRows > 1 ? "two-row-hand" : ""}`}
                style={handRows > 1 ? { gridTemplateColumns: `repeat(${handColumns}, var(--hand-card-width, 50px))`, gridTemplateRows: `repeat(${handRows}, minmax(0, 1fr))` } : undefined}
                aria-label={`${activeHandPlayer?.name || "Player"} hand`}
              >
                {activeHand.map((card) => {
                  const faceSuit = cardFaceSuit(card);
                  const jokerCard = isJoker(card);
                  return (
                    <button
                      type="button"
                      key={card.id}
                      onClick={() => toggleCard(card.id)}
                      className={`playing-card svg-playing-card ${selectedCards.includes(card.id) ? "selected" : ""} ${faceSuit === "♥" || faceSuit === "♦" ? "red-card" : ""} ${jokerCard ? "joker-card" : ""}`}
                      aria-label={cardLabel(card)}
                    >
                      <CardAssetFace card={card} />
                    </button>
                  );
                })}
              </div>
              </div>

              <div className="card-controls-grid">
                <button type="button" disabled={cardState.phase !== "play" || selectedHandCards.length < 3 || !canOperateCardTurn} onClick={makeMeld} className="glass-soft card-action">Make meld</button>
                <button type="button" disabled={cardState.phase !== "play" || selectedHandCards.length !== 1 || !selectedMeldId || !canOperateCardTurn} onClick={layOffSelected} className="glass-soft card-action">Lay off</button>
                <button type="button" disabled={!canExchangeJoker || !canOperateCardTurn} onClick={exchangeSelectedJoker} className="glass-soft card-action">Exchange joker</button>
                <button type="button" disabled={cardState.phase !== "play" || selectedHandCards.length !== 1 || !canOperateCardTurn} onClick={discardSelected} className="glass-soft card-action">Discard</button>
              </div>

              <div className="meld-zone">
                {cardState.melds.length === 0 ? (
                  <div className="mini-help">Melds will appear here. Tap a meld, then select one card to lay off or exchange a matching joker.</div>
                ) : cardState.melds.map((meld, meldIndex) => {
                  const owner = game.players.find((player) => player.id === meld.ownerId);
                  return (
                    <button type="button" key={meld.id} onClick={() => setSelectedMeldId(selectedMeldId === meld.id ? null : meld.id)} className={`meld-card rendered-meld-card ${selectedMeldId === meld.id ? "selected" : ""}`}>
                      <div className="meld-heading">
                        <span>Meld {meldIndex + 1}</span>
                        <strong>{owner?.name || "Player"} · {meld.kind}</strong>
                      </div>
                      <div className="meld-card-tray" aria-label={meld.cards.map(cardLabel).join(" ")}>
                        {meld.cards.map((card) => {
                          const pointOwnerId = cardPointOwnerId(card, meld);
                          const pointOwner = game.players.find((player) => player.id === pointOwnerId) || owner;
                          const isBaseOwner = pointOwnerId === meld.ownerId;
                          return (
                            <span key={card.id} className={`meld-owned-card ${isBaseOwner ? "base-owned-card" : "layoff-owned-card"}`} title={`Points: ${pointOwner?.name || owner?.name || "Player"}`}>
                              <span className="meld-svg-card"><CardAssetFace card={card} /></span>
                              <em>{pointOwner?.name || "Player"}</em>
                            </span>
                          );
                        })}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="opponent-hands">
                {game.players.map((player) => (
                  <div key={player.id} className={player.id === cardState.turnPlayerId ? "active" : ""}>
                    <span>{player.name}</span>
                    <strong>{cardState.hands[player.id]?.length || 0}</strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="rounds">
          <button
            type="button"
            className={`glass rounds-card ${cardState ? "compact-rounds-card" : ""}` }
            onClick={() => setShowRoundsPopup(true)}
            aria-label="Open rounds overview"
          >
            {rounds.length === 0 ? (
              <>
                <div className="empty-title">No rounds yet</div>
                <div className="empty-sub">Tap to view round history</div>
              </>
            ) : (
              <>
                <div className="last-round-top centered">
                  <div className="last-round-label">LAST ROUND #{rounds.length}</div>
                </div>

                <div
                  className="last-round-grid"
                  style={{ gridTemplateColumns: `repeat(${game.players.length}, minmax(0, 1fr))` }}
                >
                  {game.players.map((player) => {
                    const value = Number(latestRound?.scores[player.id] || 0) + (latestRound?.closedBy === player.id ? 15 : 0);
                    return (
                      <div key={player.id} className="last-round-player">
                        <div className="last-round-player-name" style={{ color: player.color }}>{player.name}</div>
                        <div className="last-round-player-score">{signed(value)}</div>
                      </div>
                    );
                  })}
                </div>

                <div className="last-round-hint">Tap for full rounds overview</div>
              </>
            )}
          </button>
        </section>
      </div>


      {settingsOpen && (
        <>
          <div className="modal-shade" onClick={() => setSettingsOpen(false)} />
          <section className="glass modal settings-modal">
            <div className="modal-title">Settings</div>
            <div className="sync-line">Cloud sync: {syncStatus}</div>
            <div className="sync-line">Room {shortGameCode(game.gameId)} · {roomLoadStatus}</div>
            <div className="room-meta-row">
              <span>Shared game</span>
              <span>Anyone with link can edit</span>
              <span>{connectedDevices.length} connected</span>
            </div>
            <div className="analytics-grid">
              <div><span>Rounds</span><strong>{analytics.roundsPlayed}</strong></div>
              <div><span>Avg</span><strong>{analytics.averageRoundPoints}</strong></div>
              <div><span>Leader</span><strong>{analytics.leaderName}</strong></div>
              <div><span>Games</span><strong>{analytics.gamesFinished}</strong></div>
            </div>
            <button type="button" onClick={shareGame} className="glass-soft modal-btn share-game-btn">
              {shareStatus === "copied" ? "Copied link" : shareStatus === "shared" ? "Shared" : "Share current game"}
            </button>
            <button type="button" onClick={() => { setSettingsOpen(false); setTypographyOpen(true); }} className="glass-soft modal-btn typography-settings-button">UI Studio</button>
            <div className="modal-grid">
              <button type="button" onClick={undo} className="glass-soft modal-btn">Undo</button>
              <button type="button" onClick={openGameLibrary} className="glass-soft modal-btn">Saved Games</button>
              <button type="button" onClick={openInvitePanel} className="glass-soft modal-btn">Invite</button>
              <button type="button" onClick={() => { setSettingsOpen(false); setGameOpen(true); }} className="glass-soft modal-btn">Game</button>
              <button type="button" onClick={startPlayableRound} className="glass-soft modal-btn">Deal Cards</button>
              <button type="button" onClick={saveGame} className="glass-soft modal-btn">Save</button>
              <button type="button" onClick={resetGame} className="glass-soft modal-btn danger">Reset</button>
              
            </div>
          </section>
        </>
      )}



      {inviteOpen && (
        <>
          <div className="modal-shade" onClick={() => setInviteOpen(false)} />
          <section className="glass sheet invite-panel">
            <div className="modal-title">Invite Players</div>
            <div className="sync-line">Share this game with anyone who should play or follow along.</div>
            <div className={`room-status room-status-${roomLoadStatus}`}>Room status: {roomLoadStatus}</div>
            <div className="room-meta-row">
              <span>Room: {shortGameCode(game.gameId)}</span>
              <span>Shared game</span>
              <span>Anyone with link can edit</span>
            </div>

            <div className="invite-card">
              <div className="invite-code-label">Game code</div>
              <div className="invite-code">{shortGameCode(game.gameId)}</div>
              <div className="invite-game-name">{game.gameName || "Untitled game"}</div>
              <div className="invite-url">{getShareUrl(game)}</div>
            </div>

            <div className="invite-section-title">Players in this game</div>
            <div className="invite-players">
              {game.players.map((player) => (
                <div key={player.id} className="invite-player">
                  <span>{player.name}</span>
                </div>
              ))}
            </div>

            <div className="invite-section-title">Connected devices</div>
            <div className="presence-list">
              {connectedDevices.length === 0 ? (
                <div className="presence-item">Only this device</div>
              ) : connectedDevices.map((device) => (
                <div key={device.clientId} className="presence-item">
                  <span>{device.name}</span>
                  <small>{device.clientId === clientId.current ? "You" : "Connected"}</small>
                </div>
              ))}
            </div>

            {roomLoadStatus === "missing" && (
              <div className="room-warning">This room has not been found in cloud sync yet. Create or save the game on the original phone, then reopen this link.</div>
            )}

            <div className="modal-grid">
              <button type="button" onClick={copyCurrentGameLink} className="glass-soft modal-btn">{shareStatus === "copied" ? "Copied" : "Copy link"}</button>
              <button type="button" onClick={shareCurrentGame} className="glass-soft modal-btn">Share</button>
              <button type="button" onClick={() => { setInviteOpen(false); setGamesOpen(true); }} className="glass-soft modal-btn">Saved Games</button>
              <button type="button" onClick={() => setInviteOpen(false)} className="glass-soft modal-btn">Done</button>
            </div>
          </section>
        </>
      )}

      {gamesOpen && (
        <>
          <div className="modal-shade" onClick={() => setGamesOpen(false)} />
          <section className="glass sheet game-library-panel">
            <div className="modal-title">Saved Games</div>
            <div className="sync-line">Each game has its own shared link and sync room.</div>

            <div className="game-library-toolbar">
              <button type="button" onClick={() => { setGamesOpen(false); setGameOpen(true); }} className="glass-soft modal-btn">New game</button>
              <button type="button" onClick={duplicateCurrentGame} className="glass-soft modal-btn">Duplicate</button>
              <button type="button" onClick={openInvitePanel} className="glass-soft modal-btn">Invite current</button>
              <button type="button" onClick={() => setShowArchivedGames((value) => !value)} className="glass-soft modal-btn">
                {showArchivedGames ? "Hide archived" : "Show archived"}
              </button>
              <button type="button" onClick={repairSavedGamesLibrary} className="glass-soft modal-btn">Repair list</button>
            </div>

            <div className="history game-library-list">
              {visibleSavedGames(savedGames, showArchivedGames).length === 0 ? (
                <div className="history-item">No saved games yet</div>
              ) : visibleSavedGames(savedGames, showArchivedGames).map((item) => (
                <div key={item.gameId || item.gameName} className={`history-item game-library-item ${item.gameId === game.gameId ? "active" : ""} ${item.archived ? "archived" : ""}`}>
                  <button type="button" onClick={() => switchSavedGame(item)} className="game-library-main">
                    <strong>{item.gameName || "Untitled game"}</strong>
                    <span>{item.players.map((player) => player.name).join(" · ")}</span>
                    <span>{item.players.length} players · {activeRounds(item.rounds).length} rounds · {item.targetScore} target · Room {shortGameCode(item.gameId)} · Shared</span>
                    <span>{item.archived ? "Archived" : `Last opened ${formatGameUpdated(item.updatedAt)}`}</span>
                  </button>
                  <div className="game-library-actions">
                    <button type="button" onClick={() => copySavedGameLink(item)}>{shareStatus === "copied" ? "Copied" : "Link"}</button>
                    <button type="button" onClick={() => item.gameId && renameSavedGame(item.gameId)}>Rename</button>
                    <button type="button" onClick={() => item.gameId && archiveSavedGame(item.gameId)}>{item.archived ? "Unarchive" : "Archive"}</button>
                    <button type="button" onClick={() => item.gameId && deleteSavedGame(item.gameId)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {showRoundsPopup && (
        <>
          <div className="modal-shade" onClick={() => setShowRoundsPopup(false)} />
          <div className="sheet glass">
            <div className="modal-title rounds-popup-title">Rounds Overview</div>
            <div className="history">
              {rounds.length === 0 ? <div className="history-item">No rounds yet</div> : rounds.map((round, index) => (
                <div key={round.id} className="history-item">
                  <div><strong>Round {index + 1}</strong></div>
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${game.players.length}, auto)`, gap: "12px" }}>
                    {game.players.map((player) => {
                      const score = Number(round.scores[player.id] || 0) + (round.closedBy === player.id ? 15 : 0);
                      return <div key={player.id}><span style={{ color: player.color }}>{player.name}</span> {signed(score)}</div>;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}


      {typographyOpen && (
        <>
          <div className="modal-shade" onClick={() => setTypographyOpen(false)} />
          <section className="glass sheet typography-panel ui-studio-panel">
            <div className="modal-title">UI Studio</div>

            <div className="ui-studio-tabs">
              {[
                ["type", "Type"],
                ["space", "Space"],
                ["radius", "Radius"],
                ["color", "Color"],
                ["layout", "Layout"],
                ["presets", "Presets"]
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={uiStudioTab === id ? "active" : ""}
                  onClick={() => setUiStudioTab(id as UiStudioTab)}
                >
                  {label}
                </button>
              ))}
            </div>

            {uiStudioTab === "type" && (
              <div className="ui-studio-page">
                <div className="ui-studio-section">Font sizes</div>
                {[
                  ["Caption", "--font-size-caption", 1, 10, "px", 6, 20],
                  ["Body", "--font-size-body", 1, 14, "px", 8, 26],
                  ["Title", "--font-size-title", 1, 16, "px", 10, 32],
                  ["Display", "--font-size-display", 1, 28, "px", 14, 54],
                  ["Input", "--font-size-input", 1, 34, "px", 20, 70],
                  ["Total score", "--font-size-score", 1, 42, "px", 24, 82]
                ].map(([label, name, step, fallback, unit, min, max]) => (
                  <div key={String(name)} className="ui-control-row">
                    <span>{label}</span>
                    <button type="button" onClick={() => adjustUiVar(String(name), -Number(step), Number(fallback), unit as "px", Number(min), Number(max))}>−</button>
                    <button type="button" className="ui-value-button" onClick={() => editUiVar(String(name), UI_STUDIO_DEFAULTS[String(name)] || String(fallback))}>{uiValue(String(name))}</button>
                    <button type="button" onClick={() => adjustUiVar(String(name), Number(step), Number(fallback), unit as "px", Number(min), Number(max))}>+</button>
                    <button type="button" className="mini-reset" onClick={() => setUiVar(String(name), UI_STUDIO_DEFAULTS[String(name)])}>Reset</button>
                  </div>
                ))}

                <div className="ui-studio-section">Weights</div>
                {[
                  ["Label", "--font-weight-label", 100, 700],
                  ["Body", "--font-weight-body", 100, 600],
                  ["Title", "--font-weight-title", 100, 800],
                  ["Score", "--font-weight-score", 100, 900]
                ].map(([label, name, step, fallback]) => (
                  <div key={String(name)} className="ui-control-row">
                    <span>{label}</span>
                    <button type="button" onClick={() => adjustUiVar(String(name), -Number(step), Number(fallback), "number", 100, 950)}>−</button>
                    <button type="button" className="ui-value-button" onClick={() => editUiVar(String(name), UI_STUDIO_DEFAULTS[String(name)] || String(fallback))}>{uiValue(String(name))}</button>
                    <button type="button" onClick={() => adjustUiVar(String(name), Number(step), Number(fallback), "number", 100, 950)}>+</button>
                    <button type="button" className="mini-reset" onClick={() => setUiVar(String(name), UI_STUDIO_DEFAULTS[String(name)])}>Reset</button>
                  </div>
                ))}
              </div>
            )}

            {uiStudioTab === "space" && (
              <div className="ui-studio-page">
                <div className="ui-studio-section">Main section gaps</div>
                {[
                  ["Top gap", "--top-section-gap", 1, 16, 4, 30],
                  ["Score gap", "--scoreboard-gap", 1, 16, 4, 30],
                  ["Last → Controls", "--last-round-gap", 1, 8, 0, 24]
                ].map(([label, name, step, fallback, min, max]) => (
                  <div key={String(name)} className="ui-control-row">
                    <span>{label}</span>
                    <button type="button" onClick={() => adjustUiVar(String(name), -Number(step), Number(fallback), "px", Number(min), Number(max))}>−</button>
                    <button type="button" className="ui-value-button" onClick={() => editUiVar(String(name), UI_STUDIO_DEFAULTS[String(name)] || `${fallback}px`)}>{uiValue(String(name))}</button>
                    <button type="button" onClick={() => adjustUiVar(String(name), Number(step), Number(fallback), "px", Number(min), Number(max))}>+</button>
                    <button type="button" className="mini-reset" onClick={() => setUiVar(String(name), UI_STUDIO_DEFAULTS[String(name)])}>Reset</button>
                  </div>
                ))}

                <div className="ui-studio-section">Bottom gaps</div>
                {[
                  ["Input cards", "--input-card-gap", 1, 18, 6, 32],
                  ["Penalty gap", "--penalty-gap", 1, 14, 4, 28],
                  ["Bottom gap", "--bottom-gap", 1, 12, 0, 28]
                ].map(([label, name, step, fallback, min, max]) => (
                  <div key={String(name)} className="ui-control-row">
                    <span>{label}</span>
                    <button type="button" onClick={() => adjustUiVar(String(name), -Number(step), Number(fallback), "px", Number(min), Number(max))}>−</button>
                    <button type="button" className="ui-value-button" onClick={() => editUiVar(String(name), UI_STUDIO_DEFAULTS[String(name)] || `${fallback}px`)}>{uiValue(String(name))}</button>
                    <button type="button" onClick={() => adjustUiVar(String(name), Number(step), Number(fallback), "px", Number(min), Number(max))}>+</button>
                    <button type="button" className="mini-reset" onClick={() => setUiVar(String(name), UI_STUDIO_DEFAULTS[String(name)])}>Reset</button>
                  </div>
                ))}
              </div>
            )}

            {uiStudioTab === "radius" && (
              <div className="ui-studio-page">
                <div className="ui-studio-section">Corner radius</div>
                {[
                  ["Small controls", "--radius-sm", 1, 12, 0, 30],
                  ["Cards", "--radius-lg", 1, 24, 0, 48],
                  ["Large modules", "--radius-xl", 1, 32, 0, 64]
                ].map(([label, name, step, fallback, min, max]) => (
                  <div key={String(name)} className="ui-control-row">
                    <span>{label}</span>
                    <button type="button" onClick={() => adjustUiVar(String(name), -Number(step), Number(fallback), "px", Number(min), Number(max))}>−</button>
                    <button type="button" className="ui-value-button" onClick={() => editUiVar(String(name), UI_STUDIO_DEFAULTS[String(name)] || `${fallback}px`)}>{uiValue(String(name))}</button>
                    <button type="button" onClick={() => adjustUiVar(String(name), Number(step), Number(fallback), "px", Number(min), Number(max))}>+</button>
                    <button type="button" className="mini-reset" onClick={() => setUiVar(String(name), UI_STUDIO_DEFAULTS[String(name)])}>Reset</button>
                  </div>
                ))}
              </div>
            )}

            {uiStudioTab === "color" && (
              <div className="ui-studio-page">
                <div className="ui-studio-section">Blueprint colors</div>
                {[
                  ["Text / Border Blue", "--passport-blue", "#244cdd"],
                  ["Background Beige", "--passport-bg", "#efe9dc"],
                  ["Soft Line", "--passport-muted", "#244cdd"]
                ].map(([label, name, fallback]) => (
                  <div key={String(name)} className="ui-control-row color-control-row">
                    <span>{label}</span>
                    <input
                      type="color"
                      className="ui-color-picker"
                      value={uiValue(String(name)).startsWith("#") ? uiValue(String(name)) : String(fallback)}
                      onChange={(event) => setUiVar(String(name), event.target.value)}
                      aria-label={String(label)}
                    />
                    <button type="button" className="ui-value-button color-value-button" onClick={() => editUiVar(String(name), String(fallback))}>{uiValue(String(name))}</button>
                    <button type="button" className="mini-reset" onClick={() => setUiVar(String(name), UI_STUDIO_DEFAULTS[String(name)])}>Reset</button>
                  </div>
                ))}
              </div>
            )}

            {uiStudioTab === "layout" && (
              <div className="ui-studio-page">
                <div className="ui-studio-section">Density</div>
                <div className="ui-control-row">
                  <span>Density</span>
                  <button type="button" onClick={() => adjustUiVar("--ui-density-scale", -0.05, 1, "opacity", 0.75, 1.25)}>−</button>
                  <button type="button" className="ui-value-button" onClick={() => editUiVar("--ui-density-scale", UI_STUDIO_DEFAULTS["--ui-density-scale"])}>{uiValue("--ui-density-scale")}</button>
                  <button type="button" onClick={() => adjustUiVar("--ui-density-scale", 0.05, 1, "opacity", 0.75, 1.25)}>+</button>
                  <button type="button" className="mini-reset" onClick={() => setUiVar("--ui-density-scale", UI_STUDIO_DEFAULTS["--ui-density-scale"])}>Reset</button>
                </div>

                <div className="ui-studio-section">Quick density</div>
                {[
                  ["Compact", "0.9"],
                  ["Balanced", "1"],
                  ["Comfortable", "1.08"],
                  ["Large", "1.16"]
                ].map(([label, value]) => (
                  <button key={label} type="button" className="ui-studio-wide-btn" onClick={() => setUiVar("--ui-density-scale", value)}>
                    {label}
                  </button>
                ))}
              </div>
            )}

            {uiStudioTab === "presets" && (
              <div className="ui-studio-page">
                <div className="ui-studio-section">Presets</div>
                <div className="ui-preset-grid">
                  {Object.entries(UI_STUDIO_PRESETS).map(([name, values]) => (
                    <button key={name} type="button" onClick={() => applyUiPreset(values)}>{name}</button>
                  ))}
                </div>

                <div className="ui-studio-section">Custom</div>
                <div className="ui-preset-grid">
                  <button type="button" onClick={saveCustomUiPreset}>Save</button>
                  <button type="button" onClick={loadCustomUiPreset}>Load</button>
                  <button type="button" onClick={renameCustomUiPreset}>Rename</button>
                  <button type="button" onClick={deleteCustomUiPreset}>Delete</button>
                  <button type="button" onClick={exportUiPreset}>Copy JSON</button>
                  <button type="button" onClick={importUiPreset}>Paste JSON</button>
                  <button type="button" onClick={() => applyUiPreset(UI_STUDIO_DEFAULTS)}>Reset all</button>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {gameOpen && (
        <>
          <div className="modal-shade" onClick={() => setGameOpen(false)} />
          <section className="glass sheet">
            <div className="modal-title">Game</div>
            <div className="form-grid">
              <input value={gameName} onChange={(event) => setGameName(event.target.value)} placeholder="Game name" className="form-input" />
              <div className="segment" style={{ "--count": 5 } as React.CSSProperties}>{[500, 1000, 1500, 2000, "custom"].map((value) => <button key={String(value)} type="button" onClick={() => setTarget(value as number | "custom")} className={target === value ? "selected" : ""}>{value === "custom" ? "Custom" : value}</button>)}</div>
              {target === "custom" && <input value={customTarget} onChange={(event) => setCustomTarget(event.target.value)} inputMode="numeric" placeholder="Custom target" className="form-input" />}
              <div className="segment" style={{ "--count": 3 } as React.CSSProperties}>{[2, 3, 4].map((count) => <button key={count} type="button" onClick={() => setPlayerCount(count)} className={playerCount === count ? "selected" : ""}>{count}</button>)}</div>
              {Array.from({ length: playerCount }, (_, index) => <input key={index} value={names[index] || ""} onChange={(event) => setNames((previous: string[]) => previous.map((name, nameIndex) => nameIndex === index ? event.target.value : name))} placeholder={DEFAULT_PLAYERS[index]?.name || `Player ${index + 1}`} className="form-input" />)}
              <button type="button" onClick={createGame} className="primary">Create / save game</button>
            </div>
            <div className="history">{history.slice(0, 5).map((item) => <div key={item.gameId} className="history-item"><strong>{item.gameName}</strong><span>{item.winnerName}</span></div>)}</div>
          </section>
        </>
      )}

      {game.status === "finished" && winner && (
        <>
          <div className="modal-shade" />
          <section className="glass modal">
            <div className="modal-title">Winner</div>
            <div style={{ textAlign: "center", fontSize: 42, fontWeight: 900, letterSpacing: "-.08em" }}>{winner.name}</div>
            <div className="modal-grid" style={{ marginTop: 16 }}>
              <button type="button" onClick={rematch} className="glass-soft modal-btn">Rematch</button>
              <button type="button" onClick={newSetup} className="glass-soft modal-btn">New game</button>
            </div>
          </section>
        </>
      )}
    </motion.main>
  );
}
