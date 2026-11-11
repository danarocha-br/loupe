"use client";

import { createAdapter } from "@danarocha/loupe/runtime";
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialog as Original,
} from "@fixture/design-system/components/ui/alert-dialog";

export const AlertDialog = createAdapter("AlertDialog", Original);
export {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
};
