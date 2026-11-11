"use client";

import { ChevronsUpDownIcon, LogOutIcon } from "lucide-react";
import { logoutAction } from "@/server/actions/auth";
import { initials } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserMenuProps {
  name: string;
  email: string;
  roles: string[];
  avatarUrl?: string | null;
}

export function UserMenu({ name, email, roles, avatarUrl }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            className="size-9 rounded-full object-cover ring-1 ring-line/10"
          />
        ) : (
          <span className="grid size-9 place-items-center rounded-full bg-primary/15 font-display text-xs font-bold text-primary ring-1 ring-line/10">
            {initials(name)}
          </span>
        )}
        <span className="hidden leading-tight sm:block">
          <span className="block max-w-40 truncate text-sm font-semibold text-foreground">{name}</span>
          <span className="block font-label-sm text-muted-foreground">{roles[0] ?? "user"}</span>
        </span>
        <ChevronsUpDownIcon className="hidden h-4 w-4 text-muted-foreground sm:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="truncate">{name}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-danger focus:bg-danger/10 focus:text-danger"
          onSelect={(event) => {
            event.preventDefault();
            void logoutAction();
          }}
        >
          <LogOutIcon className="h-4 w-4" />
          Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
