const { PRNG } = require("pokemon-showdown");

class BattlePlayer {
  constructor(playerStream, debug = false) {
    this.stream = playerStream;
    this.log = [];
    this.debug = debug;
  }

  async start() {
    for await (const chunk of this.stream) {
      this.receive(chunk);
    }
  }

  receive(chunk) {
    for (const line of chunk.split("\n")) {
      this.receiveLine(line);
    }
  }

  receiveLine(line) {
    if (this.debug) console.log(line);
    if (!line.startsWith("|")) return;
    const [cmd, rest] = splitFirst(line.slice(1), "|");
    if (cmd === "request") return this.receiveRequest(JSON.parse(rest));
    if (cmd === "error") return this.receiveError(new Error(rest));
    this.log.push(line);
  }

  receiveError(error) {
    throw error;
  }

  choose(choice) {
    void this.stream.write(choice);
  }
}
module.exports = class RandomPlayerAI extends BattlePlayer {
  constructor(playerStream, options = {}, debug = false) {
    super(playerStream, debug);
    this.move = options.move || 1.0;
    this.mega = options.mega || 0;
    this.prng =
      options.seed && !Array.isArray(options.seed)
        ? options.seed
        : new PRNG(options.seed);
  }

  receiveError(error) {
    // If we made an unavailable choice we will receive a followup request to
    // allow us the opportunity to correct our decision.
    if (error.message.startsWith("[Unavailable choice]")) return;
    throw error;
  }

  receiveRequest(request) {
    if (request.wait) {
      // wait request
      // do nothing
    } else if (request.forceSwitch) {
      // switch request
      const pokemon = request.side.pokemon;
      const chosen = [];
      const choices = request.forceSwitch.map((mustSwitch, i) => {
        if (!mustSwitch) return `pass`;

        const canSwitch = range(1, 6).filter(
          (j) =>
            pokemon[j - 1] &&
            // not active
            j > request.forceSwitch.length &&
            // not chosen for a simultaneous switch
            !chosen.includes(j) &&
            // not fainted or fainted and using Revival Blessing
            !!(
              +!!pokemon[i].reviving ^
              +!pokemon[j - 1].condition.endsWith(` fnt`)
            ),
        );

        if (!canSwitch.length) return `pass`;
        const target = this.chooseSwitch(
          request.active,
          canSwitch.map((slot) => ({ slot, pokemon: pokemon[slot - 1] })),
        );
        chosen.push(target);
        return `switch ${target}`;
      });

      this.choose(choices.join(`, `));
    } else if (request.active) {
      // move request
      let [canMegaEvo, canUltraBurst, canZMove, canDynamax, canTerastallize] = [
        true,
        true,
        true,
        true,
        true,
      ];
      const pokemon = request.side.pokemon;
      const chosen = [];
      const choices = request.active.map((active, i) => {
        if (pokemon[i].condition.endsWith(` fnt`) || pokemon[i].commanding)
          return `pass`;

        canMegaEvo = canMegaEvo && active.canMegaEvo;
        canUltraBurst = canUltraBurst && active.canUltraBurst;
        canZMove = canZMove && !!active.canZMove;
        canDynamax = canDynamax && !!active.canDynamax;
        canTerastallize = canTerastallize && !!active.canTerastallize;

        // Determine whether we should change form if we do end up switching
        const change =
          (canMegaEvo || canUltraBurst || canDynamax) &&
          this.prng.next() < this.mega;
        // If we've already dynamaxed or if we're planning on potentially dynamaxing
        // we need to use the maxMoves instead of our regular moves

        const useMaxMoves =
          (!active.canDynamax && active.maxMoves) || (change && canDynamax);
        const possibleMoves = useMaxMoves
          ? active.maxMoves.maxMoves
          : active.moves;

        let canMove = range(1, possibleMoves.length)
          .filter(
            (j) =>
              // not disabled
              !possibleMoves[j - 1].disabled,
            // NOTE: we don't actually check for whether we have PP or not because the
            // simulator will mark the move as disabled if there is zero PP and there are
            // situations where we actually need to use a move with 0 PP (Gen 1 Wrap).
          )
          .map((j) => ({
            slot: j,
            move: possibleMoves[j - 1].move,
            target: possibleMoves[j - 1].target,
            zMove: false,
          }));
        if (canZMove) {
          canMove.push(
            ...range(1, active.canZMove.length)
              .filter((j) => active.canZMove[j - 1])
              .map((j) => ({
                slot: j,
                move: active.canZMove[j - 1].move,
                target: active.canZMove[j - 1].target,
                zMove: true,
              })),
          );
        }

        // Filter out adjacentAlly moves if we have no allies left, unless they're our
        // only possible move options.
        const hasAlly =
          pokemon.length > 1 && !pokemon[i ^ 1].condition.endsWith(` fnt`);
        const filtered = canMove.filter(
          (m) => m.target !== `adjacentAlly` || hasAlly,
        );
        canMove = filtered.length ? filtered : canMove;

        const moves = canMove.map((m) => {
          let move = `move ${m.slot}`;
          // NOTE: We don't generate all possible targeting combinations.
          if (request.active.length > 1) {
            if ([`normal`, `any`, `adjacentFoe`].includes(m.target)) {
              move += ` ${1 + Math.floor(this.prng.next() * 2)}`;
            }
            if (m.target === `adjacentAlly`) {
              move += ` -${(i ^ 1) + 1}`;
            }
            if (m.target === `adjacentAllyOrSelf`) {
              if (hasAlly) {
                move += ` -${1 + Math.floor(this.prng.next() * 2)}`;
              } else {
                move += ` -${i + 1}`;
              }
            }
          }
          if (m.zMove) move += ` zmove`;
          return { choice: move, move: m };
        });

        const canSwitch = range(1, 6).filter(
          (j) =>
            pokemon[j - 1] &&
            // not active
            !pokemon[j - 1].active &&
            // not chosen for a simultaneous switch
            !chosen.includes(j) &&
            // not fainted
            !pokemon[j - 1].condition.endsWith(` fnt`),
        );
        const switches = active.trapped ? [] : canSwitch;

        if (
          switches.length &&
          (!moves.length || this.prng.next() > this.move)
        ) {
          const target = this.chooseSwitch(
            active,
            canSwitch.map((slot) => ({ slot, pokemon: pokemon[slot - 1] })),
          );
          chosen.push(target);
          return `switch ${target}`;
        } else if (moves.length) {
          const move = this.chooseMove(active, moves);
          if (move.endsWith(` zmove`)) {
            canZMove = false;
            return move;
          } else if (change) {
            if (canTerastallize) {
              canTerastallize = false;
              return `${move} terastallize`;
            } else if (canDynamax) {
              canDynamax = false;
              return `${move} dynamax`;
            } else if (canMegaEvo) {
              canMegaEvo = false;
              return `${move} mega`;
            } else {
              canUltraBurst = false;
              return `${move} ultra`;
            }
          } else {
            return move;
          }
        } else {
          throw new Error(
            `${this.constructor.name} unable to make choice ${i}. request='${request}',` +
              ` chosen='${chosen}', (mega=${canMegaEvo}, ultra=${canUltraBurst}, zmove=${canZMove},` +
              ` dynamax='${canDynamax}', terastallize=${canTerastallize})`,
          );
        }
      });
      this.choose(choices.join(`, `));
    } else {
      // team preview?
      this.choose(this.chooseTeamPreview(request.side.pokemon));
    }
  }

  chooseTeamPreview(team) {
    return `default`;
  }

  chooseMove(active, moves) {
    return this.prng.sample(moves).choice;
  }

  chooseSwitch(active, switches) {
    return this.prng.sample(switches).slot;
  }
};

// Creates an array of numbers progressing from start up to and including end
function range(start, end, step = 1) {
  if (end === undefined) {
    end = start;
    start = 0;
  }
  const result = [];
  for (; start <= end; start += step) {
    result.push(start);
  }
  return result;
}

function splitFirst(str, delimiter, limit = 1) {
  const splitStr = [];
  while (splitStr.length < limit) {
    const delimiterIndex = str.indexOf(delimiter);
    if (delimiterIndex >= 0) {
      splitStr.push(str.slice(0, delimiterIndex));
      str = str.slice(delimiterIndex + delimiter.length);
    } else {
      splitStr.push(str);
      str = "";
    }
  }
  splitStr.push(str);
  return splitStr;
}
