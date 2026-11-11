import { Badge } from "@fixture/design-system/components/ui/badge";
import { Button } from "@fixture/design-system/components/ui/button";

import { MemberRowMenu } from "@/components/product/member-row-menu";

import { members } from "./members";

// A server component: Badge renders on the server, and MemberRowMenu is one
// call site rendered once per member.
export default function MembersPage() {
  const admins = members.filter((member) => member.role === "admin").length;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-10">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-medium">Members</h1>
        <Button>Invite</Button>
      </header>
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {members.map((member) => (
          <li key={member.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-medium">{member.name}</span>
              <span className="text-xs text-muted-foreground">{member.email}</span>
            </div>
            <Badge variant={member.role === "admin" ? "default" : "muted"}>
              {member.role}
            </Badge>
            <MemberRowMenu
              name={member.name}
              isSoleAdmin={member.role === "admin" && admins === 1}
            />
          </li>
        ))}
      </ul>
    </main>
  );
}
