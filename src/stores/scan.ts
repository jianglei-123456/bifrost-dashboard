/**
 * 扫描状态：顶栏呼吸灯 + 扫描管理页共用。
 * 管理 REST 的扫描端点是同步的（POST /api/scan 返回最终统计），
 * 状态轮询用于捕捉定时扫描 / 外部触发的扫描。
 */
import { defineStore } from 'pinia'

import { fetchScanStatus, scanAll, scanLibraryRoot } from '@/api/libraryRoots'
import type { LibraryRoot, ScanStats } from '@/api/types'
import { parseScanStats } from '@/utils/format'

export const useScanStore = defineStore('scan', {
  state: () => ({
    scanning: false,
    roots: [] as LibraryRoot[],
  }),
  getters: {
    /** 全局上次扫描统计（聚合各库根，取最新一次） */
    lastStats(): ScanStats | null {
      let latest: ScanStats | null = null
      let latestAt = 0
      for (const root of this.roots) {
        const stats = parseScanStats(root.lastScanStats)
        if (stats) {
          const at = root.lastScanAt ? new Date(root.lastScanAt).getTime() : 0
          if (at >= latestAt) {
            latestAt = at
            latest = stats
          }
        }
      }
      return latest
    },
    lastScanAt(): string | null {
      let latest: string | null = null
      for (const root of this.roots) {
        if (root.lastScanAt && (!latest || root.lastScanAt > latest)) latest = root.lastScanAt
      }
      return latest
    },
  },
  actions: {
    async refresh() {
      const view = await fetchScanStatus()
      this.scanning = view.scanning
      this.roots = view.roots
    },
    /** 全量扫描（同步，完成后刷新状态） */
    async startFull(): Promise<ScanStats> {
      const stats = await scanAll()
      await this.refresh()
      return stats
    },
    /** 单根扫描 */
    async startRoot(id: number): Promise<ScanStats> {
      const stats = await scanLibraryRoot(id)
      await this.refresh()
      return stats
    },
  },
})
