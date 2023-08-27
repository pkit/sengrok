import { Cli } from "./cli";

function main() {
  const cli = new Cli();
  cli.setup();
  cli.run();
}

main();
