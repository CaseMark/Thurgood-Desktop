import { useGlobalSync } from "@/context/global-sync"
import { base64Decode } from "@opencode-ai/util/encode"
import { useParams } from "@solidjs/router"
import { createMemo } from "solid-js"

// Thurgood Desktop: Only show thurgood provider
export const popularProviders = ["thurgood"]

export function useProviders() {
  const globalSync = useGlobalSync()
  const params = useParams()
  const currentDirectory = createMemo(() => base64Decode(params.dir ?? ""))
  const providers = createMemo(() => {
    if (currentDirectory()) {
      const [projectStore] = globalSync.child(currentDirectory())
      return projectStore.provider
    }
    return globalSync.data.provider
  })
  // Thurgood Desktop: Filter to only show thurgood provider
  const thurgoodOnly = createMemo(() => providers().all.filter((p) => p.id === "thurgood"))
  const connected = createMemo(() => thurgoodOnly().filter((p) => providers().connected.includes(p.id)))
  const paid = createMemo(() => connected())
  const popular = createMemo(() => thurgoodOnly())
  return {
    all: thurgoodOnly,
    default: createMemo(() => providers().default),
    popular,
    connected,
    paid,
  }
}
