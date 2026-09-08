// content/afflictions.js
//
// Pure-data port of mazeworld.html's AFFLICTIONS table (~line 693-702), d8.
// Every `loss: () => D(n)` closure is converted to dice-notation; the two
// permanent-phobia rows keep `loss: null` verbatim (the prototype's
// signal for "no periodic wp loss, sets a phobia instead").

export const AFFLICTIONS = [
  { dur: "d20 squares", loss: { n: 2, sides: 6, bonus: 0 }, per: 1, kind: "Poison" },
  { dur: "100 squares", loss: { n: 1, sides: 6, bonus: 0 }, per: 10, kind: "Disease" },
  { dur: "d20 squares", loss: { n: 1, sides: 6, bonus: 0 }, per: 2, kind: "Poison" },
  { dur: "d20 squares", loss: { n: 1, sides: 6, bonus: 0 }, per: 2, kind: "Poison" },
  { dur: "permanent", loss: null, phobia: true, kind: "Disease" },
  { dur: "permanent", loss: null, phobia: true, kind: "Disease" },
  { dur: "80 squares", loss: { n: 1, sides: 10, bonus: 0 }, per: 20, kind: "Poison" },
  { dur: "1 day", loss: { n: 2, sides: 20, bonus: 0 }, per: 10, kind: "Disease" },
];
