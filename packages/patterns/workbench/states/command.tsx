import { Frame, States } from "@loupe/ui/workbench";
import { CommandLine } from "../../src/index.js";
import { COMMAND, SECRET_LINE, WORDS } from "../../src/samples.js";
import { useSaid } from "./said.js";

/** CommandLine: a command with its prompt, a line without one, and a copy the clipboard refuses. */
export function CommandStates() {
  const { say, Said } = useSaid();
  const onCopy = (text: string) => {
    say(`copy ${text}`);
    return Promise.resolve();
  };
  return (
    <States>
      <Frame title="CommandLine: a command with its prompt">
        <CommandLine text={COMMAND} words={WORDS.command} onCopy={onCopy} />
      </Frame>
      <Frame title="A line without a prompt, copying part of it">
        <CommandLine text={SECRET_LINE.text} copy={SECRET_LINE.copy} prompt={false} words={WORDS.command} onCopy={onCopy} />
      </Frame>
      <Frame title="A copy the clipboard refuses">
        <CommandLine text={COMMAND} words={WORDS.command} onCopy={() => Promise.reject(new Error("refused"))} />
      </Frame>
      <Said />
    </States>
  );
}
