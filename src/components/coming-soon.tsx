import { Construction } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function ComingSoon({
  title,
  milestone,
  description,
}: {
  title: string;
  milestone: string;
  description: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border/60 bg-background">
            <Construction
              className="h-5 w-5 text-muted-foreground"
              strokeWidth={1.75}
            />
          </div>
          <div className="space-y-1">
            <div className="text-sm font-medium">
              Coming in {milestone}
            </div>
            <div className="text-xs text-muted-foreground">
              This section will be built in the next milestone.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
