"use client";

import Link from "next/link";
import { LogOut, Package, Store, Heart, Sparkles, LifeBuoy } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Profile } from "@/types/user";

/**
 * Solo lo que el menú necesita pintar. Se deriva de `Profile` para que, cuando
 * la 3.3 conecte `useAuth`, el perfil real encaje sin adaptadores.
 */
export type NavUser = Pick<Profile, "display_name" | "avatar_url" | "role">;

type UserMenuProps = {
  /** `null` = visitante sin sesión. En esta fase siempre es null. */
  user: NavUser | null;
  onLogout?: () => void;
};

/** Iniciales para el avatar cuando no hay imagen. */
function initials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function UserMenu({ user, onLogout }: UserMenuProps) {
  if (!user) {
    return (
      // `nativeButton={false}`: el elemento renderizado es un <a>, no un
      // <button>; sin esto Base UI avisa de que se pierden las semánticas.
      <Button render={<Link href="/login" />} nativeButton={false} size="sm">
        Ingresar
      </Button>
    );
  }

  const canSell = user.role === "seller" || user.role === "admin";
  const name = user.display_name ?? "Mi cuenta";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        aria-label={`Menú de ${name}`}
      >
        <Avatar>
          {user.avatar_url ? (
            <AvatarImage src={user.avatar_url} alt="" />
          ) : null}
          <AvatarFallback>{initials(user.display_name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52">
        {/* GroupLabel debe vivir dentro de un Group: Base UI lanza
            "MenuGroupContext is missing" si se usa suelto. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>{name}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        <DropdownMenuItem render={<Link href="/pedidos" />} nativeButton={false}>
          <Package aria-hidden="true" />
          Mis pedidos
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/favoritos" />} nativeButton={false}>
          <Heart aria-hidden="true" />
          Favoritos
        </DropdownMenuItem>
        {/* Omitidas a propósito en la sesión 3 (decisión 3, Fase 4.7): la IA exige sesión. */}
        <DropdownMenuItem render={<Link href="/asistente" />} nativeButton={false}>
          <Sparkles aria-hidden="true" />
          Asistente
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/soporte" />} nativeButton={false}>
          <LifeBuoy aria-hidden="true" />
          Soporte
        </DropdownMenuItem>

        {canSell ? (
          <DropdownMenuItem
            render={<Link href="/vendedor/productos" />}
            nativeButton={false}
          >
            <Store aria-hidden="true" />
            Panel del vendedor
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onLogout}>
          <LogOut aria-hidden="true" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
