"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient, updateClient } from "@/lib/actions/clients";
import { slugify } from "@/lib/utils";

type ClientRecord = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  contactName: string | null;
  contactEmail: string | null;
  industry: string | null;
  notes: string | null;
};

export function ClientFormDialog({
  open,
  onOpenChange,
  client,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  client?: ClientRecord;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [name, setName] = useState(client?.name ?? "");
  const [slug, setSlug] = useState(client?.slug ?? "");
  const [slugDirty, setSlugDirty] = useState(!!client);

  useEffect(() => {
    if (open) {
      setName(client?.name ?? "");
      setSlug(client?.slug ?? "");
      setSlugDirty(!!client);
      setErrors({});
    }
  }, [open, client]);

  useEffect(() => {
    if (!slugDirty) setSlug(slugify(name));
  }, [name, slugDirty]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});
    const fd = new FormData(e.currentTarget);
    const data = {
      name: String(fd.get("name") ?? ""),
      slug: String(fd.get("slug") ?? ""),
      description: String(fd.get("description") ?? ""),
      contactName: String(fd.get("contactName") ?? ""),
      contactEmail: String(fd.get("contactEmail") ?? ""),
      industry: String(fd.get("industry") ?? ""),
      notes: String(fd.get("notes") ?? ""),
    };

    startTransition(async () => {
      const res = client
        ? await updateClient(client.id, data)
        : await createClient(data);

      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }

      toast.success(client ? "Client updated" : "Client created");
      onOpenChange(false);
      if (res.data?.slug) {
        router.push(`/clients/${res.data.slug}`);
      }
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{client ? "Edit client" : "New client"}</DialogTitle>
          <DialogDescription>
            {client
              ? "Update client details. Attached channels remain linked."
              : "Create a client profile. You can attach channels after creation."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name" error={errors.name}>
              <Input
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
                autoFocus
              />
            </Field>
            <Field label="Slug" error={errors.slug} hint="URL identifier">
              <Input
                name="slug"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugDirty(true);
                }}
                pattern="[a-z0-9\-]+"
                required
                maxLength={80}
              />
            </Field>
          </div>

          <Field label="Description" error={errors.description}>
            <Input
              name="description"
              defaultValue={client?.description ?? ""}
              maxLength={500}
              placeholder="Short description of the client"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Contact name" error={errors.contactName}>
              <Input
                name="contactName"
                defaultValue={client?.contactName ?? ""}
                maxLength={120}
              />
            </Field>
            <Field label="Contact email" error={errors.contactEmail}>
              <Input
                name="contactEmail"
                type="email"
                defaultValue={client?.contactEmail ?? ""}
                maxLength={120}
              />
            </Field>
          </div>

          <Field label="Industry" error={errors.industry}>
            <Input
              name="industry"
              defaultValue={client?.industry ?? ""}
              maxLength={80}
              placeholder="e.g. SaaS, Fashion, Media"
            />
          </Field>

          <Field label="Notes" error={errors.notes}>
            <Textarea
              name="notes"
              defaultValue={client?.notes ?? ""}
              rows={4}
              maxLength={5000}
            />
          </Field>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {client ? "Save changes" : "Create client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {hint && !error?.length && (
          <span className="text-xs text-muted-foreground">{hint}</span>
        )}
      </div>
      {children}
      {error?.length ? (
        <p className="text-xs text-destructive">{error[0]}</p>
      ) : null}
    </div>
  );
}
