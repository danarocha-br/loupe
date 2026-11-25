import { Card } from "@loupe/ui";
import { Frame, States } from "@loupe/ui/workbench";
import { InstanceNote, Notice } from "../../src/index.js";
import { MISSING_NOTICE, NOT_GENERATED_NOTICE, NOTE, OVERRIDES_OFF_NOTICE, STALE_NOTICE, WORDS } from "../../src/samples.js";
import { useSaid } from "./said.js";

/** Notice, amber and red, with rows and its command, with a command and without; and the InstanceNote. */
export function NoticeStates() {
  const { say, Said } = useSaid();
  const onCopy = (text: string) => {
    say(`copy ${text}`);
    return Promise.resolve();
  };
  return (
    <States>
      <Frame title="Notice: amber, with rows and the command; the second's copy refused">
        <Notice notice={STALE_NOTICE} words={WORDS.command} onCopy={onCopy} />
        <Notice notice={NOT_GENERATED_NOTICE} words={WORDS.command} onCopy={() => Promise.reject(new Error("refused"))} />
      </Frame>
      <Frame title="Notice: red, with a command and without">
        <Notice notice={MISSING_NOTICE} words={WORDS.command} onCopy={onCopy} />
        <Notice notice={OVERRIDES_OFF_NOTICE} words={WORDS.command} onCopy={onCopy} />
      </Frame>
      <Frame title="InstanceNote: why nothing on an Instance can change, in the Inspector's card">
        <Card look="divided">
          <InstanceNote note={NOTE} />
        </Card>
      </Frame>
      <Said />
    </States>
  );
}
