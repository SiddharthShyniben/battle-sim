const { BattleStream, getPlayerStreams, Teams } = require("pokemon-showdown");
const RandomPlayerAI = require("./random-player-ai.js");

const streams = getPlayerStreams(new BattleStream());

const spec = { formatid: "gen7customgame" };

const team = `Lopunny||Lopunnite|Limber|icepunch,highjumpkick,return,fakeout||85,85,85,85,85,85||||80|]Shedinja||FocusSash|WonderGuard|xscissor,shadowsneak,willowisp,swordsdance||85,85,85,85,85,85|N|||88|]Starmie||ChoiceSpecs|Analytic|scald,psyshock,icebeam,thunderbolt||85,,85,85,85,85|N|,0,,,,||83|]Qwilfish||BlackSludge|Intimidate|thunderwave,toxicspikes,spikes,liquidation||85,85,85,85,85,85||||88|]Bronzong||Leftovers|Levitate|toxic,explosion,earthquake,ironhead||85,85,85,85,85,85|N|||84|]Arcanine||Leftovers|FlashFire|morningsun,toxic,closecombat,flareblitz||77,85,85,85,85,85||||84|`;

const p1spec = {
  name: "Bot 1",
  // team: Teams.pack(Teams.generate("gen7randombattle")),
  team,
};
const p2spec = {
  name: "Bot 2",
  // team: Teams.pack(Teams.generate("gen7randombattle")),
  team,
};

const p1 = new RandomPlayerAI(streams.p1);
const p2 = new RandomPlayerAI(streams.p2);

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
