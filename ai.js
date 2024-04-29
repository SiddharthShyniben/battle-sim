const { BattleStream, getPlayerStreams, Teams } = require("pokemon-showdown");
const RandomPlayerAI = require("./random-player-ai.js");

const streams = getPlayerStreams(new BattleStream());

const spec = {
  formatid: "gen7customgame",
};
const p1spec = {
  name: "Bot 1",
  team: Teams.pack(Teams.generate("gen7randombattle")),
};
const p2spec = {
  name: "Bot 2",
  team: Teams.pack(Teams.generate("gen7randombattle")),
};

const p1 = new RandomPlayerAI(streams.p1);
const p2 = new RandomPlayerAI(streams.p2);

console.log("p1 is " + p1.constructor.name);
console.log("p2 is " + p2.constructor.name);

void p1.start();
void p2.start();

void (async () => {
  for await (const chunk of streams.omniscient) {
    console.log({ chunk });
  }
})();

void streams.omniscient.write(`>start ${JSON.stringify(spec)}
>player p1 ${JSON.stringify(p1spec)}
>player p2 ${JSON.stringify(p2spec)}`);
