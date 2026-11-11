"use client";

import { Button } from "@fixture/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@fixture/design-system/components/ui/dropdown-menu";

type InvitationRowMenuProps = {
  email: string;
};

// The same trigger JSX as MemberRowMenu, from another file: another call site of
// Button, so a group Override on one leaves the other alone.
export function InvitationRowMenu({ email }: InvitationRowMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label={`Actions for ${email}`} />}
      >
        ⋯
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Resend</DropdownMenuItem>
        <DropdownMenuItem variant="destructive">Revoke</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
