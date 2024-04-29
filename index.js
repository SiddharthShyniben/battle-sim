const { BattleStream } = require("pokemon-showdown");
const {
  green,
  yellow,
  bold,
  redBr,
  blink,
  red,
  dim,
  blue,
  underline,
} = require("@nuff-said/color");
const prompts = require("prompts");

const stream = new BattleStream();

const colors = {
  p1: green,
  p2: yellow,
  default: bold,
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
        bold("Game started at"),
        new Date(+actual.split("|")[2]).toLocaleString(),
      );
      console.log();
    } else if (actual.startsWith("|player|")) {
      const [, , player, playerName, _avatar, _elo] = actual.split("|");
      playerNames[player] = playerName;
    } else if (actual.startsWith("|error|")) {
      const [, , error] = actual.split("|");
      console.log(playerString(), redBr(blink(error)));
    } else if (actual.startsWith("|request|")) {
      const [, , requestData] = actual.split("|");
      const parsed = JSON.parse(requestData);

      data[player] = parsed;
      playerNames[player] = parsed.side.name;

      console.log(playerString(), parsed.side.name + "'s turn...");

      console.log(playerString(), "Moves:");

      if (parsed?.active)
        for (const move of parsed.active[0].moves) // NOTE: assumes 1v1
          console.log(
            playerString(),
            `\t${red(move.move)} ${dim(`${move.pp}/${move.maxpp}`)}`,
          );
      else if (parsed.wait) console.log(playerString(), "\tWaiting...");
      else console.log(playerString(), "\tYou have no active pokemon! Switch.");
      choice = player;

      console.log(playerString());
      console.log(playerString(), "Pokemon:");

      for (const pokemon of parsed.side.pokemon) // NOTE: assumes 1v1
        console.log(
          playerString(),
          `\t${pokemon.active ? red(pokemon.details) : pokemon.details} ${blue(underline(pokemon.condition))} ${pokemon.item ? `holding ${pokemon.item} ` : ""}(${pokemon.ability})`,
        );
      console.log(playerString());

      // console.log(
      //   color.bold(player.padEnd(10, " ")),
      //   JSON.stringify(JSON.parse(requestData), null, 2),
      // );
    } else if (output.startsWith("update\n|\n")) {
      console.log();
      const [, , , timestamp, ...rest] = output.split("|");

      for (let i = 0; i < rest.length; i++) {
        const item = rest[i].trim();

        if (item == "move") {
          let str = " ".repeat(11);

          const [player, mover] = rest[++i].trim().split("a: "); // TODO: generalize
          const move = rest[++i].trim();
          const [player2, mover2] = rest[++i].trim().split("a: ");

          (str +=
            `${playerNames[player]}'s ${mover} uses ${move}` +
            (mover !== mover2
              ? ` on ${playerNames[player2]}'s ${mover2}`
              : "")),
            i++;

          const slurped = [];
          while (i < rest.length && rest[i] !== "move") slurped.push(rest[i++]);
          i--;

          for (let j = 0; j < slurped.length; j++) {
            const item = slurped[j].trim();
            if (item == "-damage") {
              j++;
              const status = slurped[++j].trim().split("/")[0];
              j += 2;
              const statusPercentage = slurped[++j].trim().split("/")[0];
              str += ` and does ${status} (${statusPercentage}%) damage`;
            } else if (item == "-boost") {
              j++;
              const stat = slurped[++j].trim();
              const stages = slurped[++j].trim();
              str += ` and raises it's ${stat} by ${stages} stages`;
            } else if (item == "-fail") {
              j += 2;
              str += `... but it fails!`;
            } else if (item == "-block") {
              const pokemon = slurped[++j].trim();
              const effect = slurped[++j].trim();
              if (slurped[j + 1][0] !== "-") j += 2;
              str += `... but ${effect} on ${pokemon} was blocked`;
            } else if (item == "-notarget") {
              if (item[j + 1][0] != "-") j++;
              str += `... but there is no one to target!`;
            } else if (item == "-miss") str += `...but it missed!`;
            else if (item == "-immune")
              str += `... but it's immune! (${slurped[++j]})`;
            else if (item == "-supereffective")
              str += `. It's super effective!`;
            else if (item == "-status")
              str += ` and gives it the status effect ${slurped[++j].trim()}`;
            else if (item == "-heal") {
              j++;
              const status = slurped[++j].trim();
              const why = slurped[++j].trim();
              j += 2;
              const statusPercentage = slurped[++j].trim();
              const why2 = slurped[++j].trim();
              str += ` and heals for ${status}hp (${why}) (${statusPercentage}% ${why2})`;
            } else if (
              item == "p1" ||
              item == "p2" ||
              item == "upkeep" ||
              item == "[still]" ||
              item == "split"
            ) {
            } else if (item == "turn")
              str += `\n${" ".repeat(11)} Turn ${slurped[++j]}`;
            else if (item == "faint")
              str += `\n${slurped[++j].split("|")[1]} fainted!`;
            else console.log(item);
          }

          console.log(str);
        } else console.log({ item });
      }
      console.log();
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
      } else if (!a.wait) {
        const { pokemon } = await prompts({
          type: "select",
          name: "pokemon",
          message: `(${choice}) Switch into...`,
          choices: a.side.pokemon
            .filter((a) => !a.active)
            .map((p) => ({
              title: p.details,
              value: p.ident.split(" ")[1],
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
