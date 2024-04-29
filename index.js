const Sim = require("pokemon-showdown");
const color = require("@nuff-said/color");
const prompts = require("prompts");

const stream = new Sim.BattleStream();

const colors = {
  p1: color.green,
  p2: color.yellow,
  default: color.bold,
};

let choice = null;

const data = {};
const playerNames = {};

(async () => {
  for await (const output of stream) {
    let updateKind, player, actual;
    if (output.startsWith("update")) {
      [updateKind, actual] = output.split("\n");
    } else if (output.startsWith("sideupdate")) {
      [updateKind, player, actual] = output.split("\n");
    }

    const playerString = () =>
      colors[player]((playerNames[player] || player).padEnd(10, " "));

    if (actual.startsWith("|t:|")) {
      console.log(
        color.bold("Game started at"),
        new Date(+actual.split("|")[2]).toLocaleString(),
      );
      console.log();
    } else if (actual.startsWith("|player|")) {
      const [, , player, playerName, _avatar, _elo] = actual.split("|");
      playerNames[player] = playerName;
    } else if (actual.startsWith("|error|")) {
      const [, , error] = actual.split("|");
      console.log(playerString(), color.redBr(color.blink(error)));
    } else if (actual.startsWith("|request|")) {
      const [, , requestData] = actual.split("|");
      const parsed = JSON.parse(requestData);

      data[player] = parsed;
      playerNames[player] = parsed.side.name;

      console.log(playerString(), parsed.side.name + "'s turn...");
      choice = player;

      console.log(playerString(), "Moves:");

      if (parsed?.active?.[0])
        for (const move of parsed.active[0].moves) // NOTE: assumes 1v1
          console.log(
            playerString(),
            `\t${color.red(move.move)} ${color.dim(`${move.pp}/${move.maxpp}`)}`,
          );
      else console.log(playerString(), "You have no active pokemon! Switch.");

      console.log(playerString());
      console.log(playerString(), "Pokemon:");

      for (const pokemon of parsed.side.pokemon) // NOTE: assumes 1v1
        console.log(
          playerString(),
          `\t${pokemon.active ? color.red(pokemon.details) : pokemon.details} ${color.dim(pokemon.condition)} ${pokemon.item ? `holding ${pokemon.item} ` : ""}(${pokemon.ability})`,
        );
      console.log(playerString());

      // console.log(
      //   color.bold(player.padEnd(10, " ")),
      //   JSON.stringify(JSON.parse(requestData), null, 2),
      // );
    } else console.log(output);

    if (choice) {
      const a = choice == "p1" ? data.p1 : data.p2;
      // const b = choice == "p1" ? data.p2 : data.p1;

      if (a.active) {
        const { move } = await prompts({
          type: "select",
          name: "move",
          message: `Pick a move for ${choice}`,
          choices: a.active[0].moves.map((move) => ({
            title: move.move,
            value: move.id,
          })),
        });

        stream.write(`>${choice} move ${move}`);
      } else {
        const { pokemon } = await prompts({
          type: "select",
          name: "pokemon",
          message: `(${choice}) Switch into...`,
          choices: a.side.pokemon
            .filter((a) => !a.active)
            .map((p) => ({
              title: p.details,
              value: p.ident,
            })),
        });

        stream.write(`>${choice} switch ${pokemon}`);
      }
      choice = null;
    }
  }
})();

stream.write(`>start {"formatid":"gen7randombattle"}`);
stream.write(`>player p1 {"name":"Alice"}`);
stream.write(`>player p2 {"name":"Bob"}`);
