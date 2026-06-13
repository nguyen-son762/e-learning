"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { login } from "@/hooks/useAuth";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFieldError(null);
    try {
      const res = await login({ email, password });
      toast.success("Đăng nhập thành công");
      // v6 — new accounts (and any pre-v6 user whose language was nulled) go
      // to the language gate before the dashboard.
      router.replace(
        res.user.language === null ? "/choose-language" : "/dashboard",
      );
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "INVALID_CREDENTIALS") {
          toast.error("Email hoặc mật khẩu không đúng");
          setFieldError("Email hoặc mật khẩu không đúng");
        } else if (err.code === "VALIDATION_ERROR") {
          setFieldError(err.message);
        } else {
          toast.error(err.message);
        }
      } else {
        toast.error("Đã xảy ra lỗi. Vui lòng thử lại.");
      }
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">Đăng nhập</CardTitle>
        <CardDescription>
          Đăng nhập để tiếp tục học tiếng Anh.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!fieldError}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Mật khẩu</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!fieldError}
            />
          </div>
          {fieldError && (
            <p className="text-sm text-[var(--destructive)]">{fieldError}</p>
          )}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="animate-spin" />}
            Đăng nhập
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-[var(--muted-foreground)]">
          Chưa có tài khoản?{" "}
          <Link
            href="/register"
            className="font-medium text-[var(--primary)] hover:underline"
          >
            Đăng ký
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
