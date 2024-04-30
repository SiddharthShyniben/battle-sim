const { BattleStream, getPlayerStreams, Teams } = require("pokemon-showdown");
const BattleTextParser = require("./parser.js");
const color = require("@nuff-said/color");
const RandomPlayerAI = require("./random-player-ai.js");

const streams = getPlayerStreams(new BattleStream());

const spec = { formatid: "gen9customgame" };

const p1spec = {
  name: "Bot 1",
  team: Teams.pack(Teams.generate("gen9randombattle")),
};
const p2spec = {
  name: "Bot 2",
  team: Teams.pack(Teams.generate("gen9randombattle")),
};

const p1 = new RandomPlayerAI(streams.p1);
const p2 = new RandomPlayerAI(streams.p2);

void p1.start();
void p2.start();

const parser = new BattleTextParser();

void (async () => {
  for await (const chunk of streams.omniscient) {
    console.log(
      parser
        .extractMessage(chunk)
        .replace(/\*\*(.*?)\*\*/g, color.bold("$1"))
        .replace(/(\(.*?\))/g, color.italic("$1"))
        .replace(/(\[.*?\])/g, color.dim("$1"))
        .replace(/(== .*? ==)/g, color.red("$1")),
    );
  }
})();

void streams.omniscient.write(`>start ${JSON.stringify(spec)}
>player p1 ${JSON.stringify(p1spec)}
>player p2 ${JSON.stringify(p2spec)}`);
