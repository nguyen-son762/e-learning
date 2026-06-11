"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, LogOut, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { clearToken } from "@/lib/auth";
import type { User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";


function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-9 w-9" />;
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Chuyển chế độ sáng/tối"
    >
      {resolvedTheme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}

export function TopNav({ user }: { user: User }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/dashboard", label: "Tổng quan" },
    { href: "/topics", label: "Flashcard" },
    { href: "/reading", label: "Reading" },
    { href: "/vocabulary", label: "Từ vựng của tôi" },
    ...(user.role === "ADMIN" ? [{ href: "/admin/reading", label: "Quản trị" }] : []),
  ];

  function logout() {
    clearToken();
    router.replace("/login");
  }

  const initials = (user.name || user.email || "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--background)]">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-6">
          {/* Mobile hamburger */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Mở menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetTitle className="mb-4 text-[var(--primary)]">
                📚 EngLearn
              </SheetTitle>
              <nav className="flex flex-col gap-1">
                {links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm font-medium hover:bg-[var(--secondary)]",
                      isActive(pathname, l.href)
                        ? "bg-[var(--secondary)] text-[var(--primary)]"
                        : "text-[var(--foreground)]",
                    )}
                  >
                    {l.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>

          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-lg font-bold text-[var(--primary)]"
          >
            <span aria-hidden>📚</span>
            <span>EngLearn</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--secondary)]",
                  isActive(pathname, l.href)
                    ? "text-[var(--primary)]"
                    : "text-[var(--muted-foreground)]",
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-1">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label="Menu người dùng"
            >
              <Avatar>
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="flex flex-col">
              <span className="truncate">{user.name}</span>
              <span className="truncate text-xs font-normal text-[var(--muted-foreground)]">
                {user.email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={logout}
              className="text-[var(--destructive)]"
            >
              <LogOut className="h-4 w-4" />
              Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
