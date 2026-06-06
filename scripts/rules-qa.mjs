const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const RUN_CYCLE = RANKS;
const RUN_POSITION = Object.fromEntries(RUN_CYCLE.map((rank, index) => [rank, index]));
const cardValue = (rank) => rank === "A" || rank === "JOKER" ? 15 : ["10", "J", "Q", "K"].includes(rank) ? 10 : 5;
const c = (rank, suit, id = `${rank}${suit}`) => ({ id, rank, suit, value: cardValue(rank) });
const j = (id = "JOKER-1") => ({ id, rank: "JOKER", suit: "🃏", value: 15, joker: true });
const isJoker = (card) => Boolean(card.joker || card.rank === "JOKER");
const effectiveRank = (card) => card.asRank || (card.rank === "JOKER" ? "A" : card.rank);
const effectiveSuit = (card) => card.asSuit || (card.suit === "🃏" ? "♠" : card.suit);
const asCard = (joker, rank, suit) => ({ ...joker, asRank: rank, asSuit: suit });
const withPointOwner = (card, playerId) => ({ ...card, pointOwnerId: playerId });
const cyclicRankAt = (index) => RUN_CYCLE[((index % RUN_CYCLE.length) + RUN_CYCLE.length) % RUN_CYCLE.length];
function orderCyclicRun(cards) {
  if (cards.length === 0 || cards.length > RUN_CYCLE.length) return null;
  const suit = effectiveSuit(cards[0]);
  if (!cards.every((card) => effectiveSuit(card) === suit)) return null;
  const positions = cards.map((card) => RUN_POSITION[effectiveRank(card)]);
  if (positions.some((position) => position === undefined)) return null;
  if (new Set(positions).size !== positions.length) return null;
  for (let start = 0; start < RUN_CYCLE.length; start += 1) {
    const sequence = Array.from({ length: cards.length }, (_item, index) => (start + index) % RUN_CYCLE.length);
    if (!positions.every((position) => sequence.includes(position))) continue;
    const ordered = sequence.map((position) => cards.find((card) => RUN_POSITION[effectiveRank(card)] === position)).filter(Boolean);
    if (ordered.length === cards.length) return { cards: ordered, suit, start, sequence };
  }
  return null;
}
function createAssignedSet(cards) {
  const natural = cards.filter((card) => !isJoker(card));
  const jokers = cards.filter(isJoker);
  const baseRank = natural[0]?.rank || "A";
  if (!natural.every((card) => card.rank === baseRank)) return null;
  const usedSuits = new Set(natural.map((card) => card.suit));
  if (usedSuits.size !== natural.length) return null;
  const availableSuits = SUITS.filter((suit) => !usedSuits.has(suit));
  if (jokers.length > availableSuits.length) return null;
  return { kind: "set", cards: [...natural, ...jokers.map((joker, index) => asCard(joker, baseRank, availableSuits[index]))] };
}
function createAssignedRun(cards) {
  const natural = cards.filter((card) => !isJoker(card));
  const jokers = cards.filter(isJoker);
  const baseSuit = natural[0]?.suit || "♠";
  if (!natural.every((card) => card.suit === baseSuit)) return null;
  if (cards.length > RUN_CYCLE.length) return null;
  const naturalPositions = natural.map((card) => RUN_POSITION[card.rank]);
  if (new Set(naturalPositions).size !== naturalPositions.length) return null;
  for (let start = 0; start < RUN_CYCLE.length; start += 1) {
    const sequence = Array.from({ length: cards.length }, (_item, index) => (start + index) % RUN_CYCLE.length);
    if (!naturalPositions.every((position) => sequence.includes(position))) continue;
    const missingPositions = sequence.filter((position) => !naturalPositions.includes(position));
    if (missingPositions.length !== jokers.length) continue;
    const assignedJokers = jokers.map((joker, index) => asCard(joker, cyclicRankAt(missingPositions[index]), baseSuit));
    const assignedCards = [...natural, ...assignedJokers];
    const ordered = sequence.map((position) => assignedCards.find((card) => RUN_POSITION[effectiveRank(card)] === position)).filter(Boolean);
    if (ordered.length === cards.length) return { kind: "run", cards: ordered };
  }
  return null;
}
function classifyMeld(cards) { return cards.length >= 3 ? createAssignedSet(cards) || createAssignedRun(cards) : null; }
function getLayOffCard(card, meld) {
  if (meld.kind === "set") {
    const rank = effectiveRank(meld.cards[0]);
    const usedSuits = new Set(meld.cards.map(effectiveSuit));
    if (isJoker(card)) {
      const suit = SUITS.find((item) => !usedSuits.has(item));
      return suit ? asCard(card, rank, suit) : null;
    }
    return card.rank === rank && !usedSuits.has(card.suit) ? card : null;
  }
  const orderedRun = orderCyclicRun(meld.cards);
  if (!orderedRun || orderedRun.cards.length >= RUN_CYCLE.length) return null;
  const previousRank = cyclicRankAt(orderedRun.start - 1);
  const nextRank = cyclicRankAt(orderedRun.start + orderedRun.cards.length);
  const suit = orderedRun.suit;
  if (isJoker(card)) return asCard(card, nextRank, suit);
  if (card.suit !== suit) return null;
  return card.rank === previousRank || card.rank === nextRank ? card : null;
}
function meldPoints(melds, playerId) {
  return melds.flatMap((meld) => meld.cards.map((card) => ({ card, fallbackOwnerId: meld.ownerId }))).reduce((sum, item) => (item.card.pointOwnerId || item.fallbackOwnerId) === playerId ? sum + item.card.value : sum, 0);
}
function findExchangeInMeld(handCard, meld) {
  if (isJoker(handCard)) return null;
  return meld.cards.find((card) => isJoker(card) && card.asRank === handCard.rank && card.asSuit === handCard.suit) || null;
}
function assert(name, condition) {
  if (!condition) throw new Error(`FAIL: ${name}`);
  console.log(`PASS: ${name}`);
}
const names = (cards) => cards.map((card) => `${effectiveRank(card)}${effectiveSuit(card)}`).join(" ");

assert("Deck point values", cardValue("2") === 5 && cardValue("9") === 5 && cardValue("10") === 10 && cardValue("K") === 10 && cardValue("A") === 15 && cardValue("JOKER") === 15);
assert("A low run A-2-3", names(classifyMeld([c("A", "♠"), c("2", "♠"), c("3", "♠")]).cards) === "A♠ 2♠ 3♠");
assert("A high run Q-K-A", names(classifyMeld([c("Q", "♦"), c("K", "♦"), c("A", "♦")]).cards) === "Q♦ K♦ A♦");
assert("A wrap run Q-K-A-2", names(classifyMeld([c("Q", "♥"), c("K", "♥"), c("A", "♥"), c("2", "♥")]).cards) === "Q♥ K♥ A♥ 2♥");
assert("Joker fills same-suit run gap", names(classifyMeld([c("5", "♣"), j(), c("7", "♣")]).cards) === "5♣ 6♣ 7♣");
assert("Joker fills set suit", classifyMeld([c("8", "♠"), c("8", "♥"), j()]).cards.some((card) => isJoker(card) && effectiveRank(card) === "8"));
assert("Mixed suit run rejected", classifyMeld([c("5", "♣"), c("6", "♦"), c("7", "♣")]) === null);
assert("Duplicate natural suit in set rejected", classifyMeld([c("9", "♣", "9♣a"), c("9", "♣", "9♣b"), c("9", "♦")]) === null);
const runMeld = { id: "m1", ownerId: "p1", kind: "run", cards: classifyMeld([c("Q", "♠"), c("K", "♠"), c("A", "♠")]).cards.map((card) => withPointOwner(card, "p1")) };
assert("Lay off 2 after Q-K-A", getLayOffCard(c("2", "♠"), runMeld)?.rank === "2");
assert("Lay off J before Q-K-A", getLayOffCard(c("J", "♠"), runMeld)?.rank === "J");
const jokerRun = { id: "m2", ownerId: "p1", kind: "run", cards: classifyMeld([c("10", "♦"), j("JOKER-X"), c("Q", "♦")]).cards.map((card) => withPointOwner(card, "p1")) };
assert("Exchange matching joker", findExchangeInMeld(c("J", "♦"), jokerRun)?.id === "JOKER-X");
const scoredMeld = { id: "m3", ownerId: "p1", kind: "run", cards: [withPointOwner(c("4", "♥"), "p1"), withPointOwner(c("5", "♥"), "p2"), withPointOwner(c("6", "♥"), "p1")] };
assert("Lay-off ownership points", meldPoints([scoredMeld], "p2") === 5 && meldPoints([scoredMeld], "p1") === 10);
console.log("All V169 rule QA checks passed.");
