import { z } from "zod";

export const clientSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only"),
  description: z.string().max(500).optional().or(z.literal("")),
  contactName: z.string().max(120).optional().or(z.literal("")),
  contactEmail: z
    .string()
    .email("Invalid email")
    .optional()
    .or(z.literal("")),
  industry: z.string().max(80).optional().or(z.literal("")),
  notes: z.string().max(5000).optional().or(z.literal("")),
});

export type ClientInput = z.infer<typeof clientSchema>;

export const channelSchema = z.object({
  clientId: z.string().min(1),
  platform: z.enum(["YOUTUBE", "LINKEDIN"]),
  displayName: z.string().min(1, "Display name is required").max(200),
  externalId: z.string().max(200).optional().or(z.literal("")),
  handle: z.string().max(200).optional().or(z.literal("")),
  url: z
    .string()
    .url("Must be a valid URL")
    .optional()
    .or(z.literal("")),
});

export type ChannelInput = z.infer<typeof channelSchema>;
