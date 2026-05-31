import { Context } from "effect"
import type { InstanceContext } from "@/project/instance-context"
import type { WorkspaceV2 } from "@miko-ai/core/workspace"

export const InstanceRef = Context.Reference<InstanceContext | undefined>("~miko/InstanceRef", {
  defaultValue: () => undefined,
})

export const WorkspaceRef = Context.Reference<WorkspaceV2.ID | undefined>("~miko/WorkspaceRef", {
  defaultValue: () => undefined,
})
