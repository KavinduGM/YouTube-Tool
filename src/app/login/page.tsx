import { Suspense } from "react";
import { LineChart } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · Social Analytics" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm animate-fade-in space-y-8">
          <div className="flex flex-col items-center space-y-3 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-border/60 bg-card">
              <LineChart className="h-5 w-5 text-foreground" strokeWidth={1.75} />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-semibold tracking-tight">
                Social Analytics
              </h1>
              <p className="text-sm text-muted-foreground">
                Sign in to continue to your dashboard
              </p>
            </div>
          </div>

          <Suspense>
            <LoginForm />
          </Suspense>

          <p className="text-center text-xs text-muted-foreground">
            Internal tool &middot; Admin access only
          </p>
        </div>
      </div>
    </div>
  );
}
