export default function DeckPreviewPage() {
  const suits = ["S", "H", "D", "C"] as const;
  const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;
  const cards = [
    ...suits.flatMap((suit) => ranks.map((rank) => `${rank}${suit}`)),
    "JOKER1",
    "JOKER2",
    "JOKER3",
    "JOKER4",
    "BACK",
  ];

  return (
    <main style={{ minHeight: "100vh", padding: 24, background: "#f2ece0", color: "#244cdd" }}>
      <h1 style={{ fontFamily: "system-ui", marginBottom: 18 }}>Rummy 500 Approved Artwork Deck</h1>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))", gap: 18 }}>
        {cards.map((code) => (
          <figure key={code} style={{ margin: 0, textAlign: "center", fontFamily: "system-ui", fontWeight: 800, fontSize: 12 }}>
            <img src={`/cards/${code}.png`} alt={code} style={{ width: "100%", aspectRatio: "474 / 696", objectFit: "contain", filter: "drop-shadow(0 4px 8px rgba(0,0,0,.16))" }} />
            <figcaption style={{ marginTop: 6 }}>{code}</figcaption>
          </figure>
        ))}
      </section>
    </main>
  );
}
