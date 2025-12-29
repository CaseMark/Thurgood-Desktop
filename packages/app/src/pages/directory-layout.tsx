import { createMemo, Show, type ParentProps } from "solid-js"
import { useParams } from "@solidjs/router"
import { SDKProvider, useSDK } from "@/context/sdk"
import { SyncProvider, useSync } from "@/context/sync"
import { LocalProvider } from "@/context/local"
import { base64Decode } from "@opencode-ai/util/encode"
import { DataProvider } from "@opencode-ai/ui/context"
import { iife } from "@opencode-ai/util/iife"
import { useLayout } from "@/context/layout"
import { FileBrowser } from "@/components/file-browser"

export default function Layout(props: ParentProps) {
  const params = useParams()
  const layout = useLayout()
  const directory = createMemo(() => {
    return base64Decode(params.dir!)
  })
  return (
    <Show when={params.dir} keyed>
      <SDKProvider directory={directory()}>
        <SyncProvider>
          {iife(() => {
            const sync = useSync()
            const sdk = useSDK()
            return (
              <DataProvider
                data={sync.data}
                directory={directory()}
                onPermissionRespond={(input) => {
                  sdk.client.permission.respond(input)
                }}
              >
                <LocalProvider>
                  <div class="flex size-full min-h-0">
                    <div class="flex-1 min-w-0 flex flex-col">{props.children}</div>
                    <Show when={layout.fileBrowser.opened()}>
                      <FileBrowser />
                    </Show>
                  </div>
                </LocalProvider>
              </DataProvider>
            )
          })}
        </SyncProvider>
      </SDKProvider>
    </Show>
  )
}
