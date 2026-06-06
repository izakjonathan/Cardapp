# V143 Multi-game QA + Shared URL Fix Pass

## Test flow A: 2-player shared game

1. Create a game for you + GF.
2. Open Settings → Invite.
3. Copy link.
4. Open the copied link on another phone.
5. Add a round on phone A.
6. Confirm phone B updates.
7. Add a round on phone B.
8. Confirm phone A updates.

## Test flow B: separate 4-player game

1. Create a new 4-player game.
2. Copy invite link.
3. Open it on another phone.
4. Add rounds.
5. Open Saved Games.
6. Switch back to the 2-player game.
7. Confirm the 2-player rounds are preserved.
8. Switch back to the 4-player game.
9. Confirm the 4-player rounds are preserved.

## Test flow C: new device / shared URL

1. Open `?game=<id>` on a phone that has never opened the game.
2. The app should show/loading the shared room.
3. It should not overwrite the remote shared game with a blank placeholder.
4. Once remote sync loads, the game should appear and be saved locally.

## Known behavior

Anyone with the link can edit the game.
