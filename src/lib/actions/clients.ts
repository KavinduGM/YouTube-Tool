"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clientSchema, type ClientInput } from "@/lib/validators";
import { slugify } from "@/lib/utils";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session;
}

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createClient(raw: ClientInput): Promise<ActionResult<{ slug: string }>> {
  await requireAdmin();

  const slug = raw.slug?.trim() || slugify(raw.name ?? "");
  const parsed = clientSchema.safeParse({ ...raw, slug });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const exists = await prisma.client.findUnique({ where: { slug } });
  if (exists) {
    return {
      ok: false,
      error: "A client with that slug already exists",
      fieldErrors: { slug: ["Slug already in use"] },
    };
  }

  await prisma.client.create({
    data: {
      name: parsed.data.name,
      slug,
      description: parsed.data.description || null,
      contactName: parsed.data.contactName || null,
      contactEmail: parsed.data.contactEmail || null,
      industry: parsed.data.industry || null,
      notes: parsed.data.notes || null,
    },
  });

  revalidatePath("/clients");
  revalidatePath("/dashboard");
  return { ok: true, data: { slug } };
}

export async function updateClient(
  id: string,
  raw: ClientInput
): Promise<ActionResult<{ slug: string }>> {
  await requireAdmin();

  const parsed = clientSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const current = await prisma.client.findUnique({ where: { id } });
  if (!current) return { ok: false, error: "Client not found" };

  if (parsed.data.slug !== current.slug) {
    const conflict = await prisma.client.findUnique({
      where: { slug: parsed.data.slug },
    });
    if (conflict) {
      return {
        ok: false,
        error: "Slug already in use",
        fieldErrors: { slug: ["Slug already in use"] },
      };
    }
  }

  await prisma.client.update({
    where: { id },
    data: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description || null,
      contactName: parsed.data.contactName || null,
      contactEmail: parsed.data.contactEmail || null,
      industry: parsed.data.industry || null,
      notes: parsed.data.notes || null,
    },
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${parsed.data.slug}`);
  if (parsed.data.slug !== current.slug) {
    revalidatePath(`/clients/${current.slug}`);
  }
  return { ok: true, data: { slug: parsed.data.slug } };
}

export async function deleteClient(id: string): Promise<ActionResult> {
  await requireAdmin();

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) return { ok: false, error: "Client not found" };

  await prisma.client.delete({ where: { id } });

  revalidatePath("/clients");
  revalidatePath("/dashboard");
  redirect("/clients");
}
