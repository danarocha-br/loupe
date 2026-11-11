"use client";

import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@fixture/design-system/components/ui/alert-dialog";
import { Button } from "@fixture/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@fixture/design-system/components/ui/dropdown-menu";

type MemberRowMenuProps = {
  name: string;
  isSoleAdmin: boolean;
};

// A client product component built from design-system parts: a render-prop
// trigger, menu items in a portal, and a dialog opened from app state.
export function MemberRowMenu({ name, isSoleAdmin }: MemberRowMenuProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" aria-label={`Actions for ${name}`} />}
        >
          ⋯
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem disabled={isSoleAdmin}>Change role</DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={isSoleAdmin}
            onClick={() => setConfirming(true)}
          >
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogTitle>Remove {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            They lose access to this organization right away.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => setConfirming(false)}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
