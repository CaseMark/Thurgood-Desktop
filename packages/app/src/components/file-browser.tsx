import { useLocal, type LocalFile } from "@/context/local"
import { useLayout } from "@/context/layout"
import { usePlatform } from "@/context/platform"
import { useSync } from "@/context/sync"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { createEffect, createMemo, createSignal } from "solid-js"
import FileTree from "./file-tree"
import { getFilename } from "@opencode-ai/util/path"

export function FileBrowser() {
  const layout = useLayout()
  const local = useLocal()
  const platform = usePlatform()
  const sync = useSync()

  const projectName = createMemo(() => getFilename(sync.data.path.directory))
  const [rootLoaded, setRootLoaded] = createSignal(false)

  // Load root files when browser is first opened
  createEffect(() => {
    if (layout.fileBrowser.opened() && !rootLoaded()) {
      setRootLoaded(true)
      // Load root level files - expand("") now handles this specially
      local.file.expand("")
    }
  })

  const handleFileClick = (file: LocalFile) => {
    if (file.type === "file" && platform.openPath) {
      platform.openPath(file.absolute)
    }
  }

  return (
    <div
      class="hidden xl:flex flex-col bg-background-base border-l border-border-weak-base shrink-0"
      style={{ width: `${layout.fileBrowser.width()}px` }}
    >
      {/* Header */}
      <div class="flex items-center justify-between px-3 py-2.5 shrink-0 border-b border-border-weak-base">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-14-medium text-text-strong truncate">{projectName()}</span>
        </div>
        <Tooltip value="Close files" placement="left">
          <IconButton
            icon="close"
            variant="ghost"
            size="normal"
            onClick={layout.fileBrowser.close}
          />
        </Tooltip>
      </div>

      {/* File Tree */}
      <div class="flex-1 overflow-y-auto min-h-0 px-1 py-2">
        <FileTree
          path=""
          onFileClick={handleFileClick}
          nodeClass="rounded-md"
        />
      </div>
    </div>
  )
}
