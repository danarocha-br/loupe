"use client";

import { createAdapter } from "@danarocha/loupe/runtime";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem as Original,
  DropdownMenuTrigger,
} from "@fixture/design-system/components/ui/dropdown-menu";

export const DropdownMenuItem = createAdapter("DropdownMenuItem", Original);
export { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger };
