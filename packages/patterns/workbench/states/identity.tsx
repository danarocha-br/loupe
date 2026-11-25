import { Button, Card } from "@loupe/ui";
import { Frame, States } from "@loupe/ui/workbench";
import { Identity } from "../../src/index.js";
import { GONE, IDENTITY, NOT_GENERATED, WORDS } from "../../src/samples.js";
import { useSaid } from "./said.js";

/** Identity: the Inspector's head, with its crumbs, keys and tags; bare; not generated yet; and gone. */
export function IdentityStates() {
  const { say, Said } = useSaid();
  const bare = { ...IDENTITY, keys: [], tags: [], chips: [], crumbs: [] };
  return (
    <States>
      <Frame title="Identity: its crumbs, its change numbers, its tags and chips">
        <Card look="divided">
          <Identity identity={IDENTITY} words={WORDS.inspector} onBack={() => say("back")} onCrumb={(id) => say(`select ${id}`)} />
        </Card>
      </Frame>
      <Frame title="Identity: nothing reaches it">
        <Card look="divided">
          <Identity identity={bare} words={WORDS.inspector} onBack={() => say("back")} />
        </Card>
      </Frame>
      <Frame title="Identity: not generated yet, with the command">
        <Card look="divided">
          <Identity identity={{ ...bare, status: NOT_GENERATED, notGenerated: { tag: NOT_GENERATED, command: "npx loupe generate" } }} words={WORDS.inspector} onBack={() => say("back")} />
        </Card>
      </Frame>
      <Frame title="Identity: gone, with its reset">
        <Card look="divided">
          <Identity
            identity={GONE}
            words={WORDS.inspector}
            onBack={() => say("back")}
            actions={
              <Button size="small" onClick={() => say("reset this Instance")}>
                Reset this Instance
              </Button>
            }
          />
        </Card>
      </Frame>
      <Said />
    </States>
  );
}
