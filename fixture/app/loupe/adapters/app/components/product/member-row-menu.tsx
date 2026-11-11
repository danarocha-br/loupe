"use client";

// A product component's Adapter. page.tsx is a Server Component; MemberRowMenu
// is already a client module, so the swap moves that boundary by one component
// and adds none (PER-86).
import { createAdapter } from "@danarocha/loupe/runtime";
import { MemberRowMenu as Original } from "@/components/product/member-row-menu";

export const MemberRowMenu = createAdapter("MemberRowMenu", Original);
