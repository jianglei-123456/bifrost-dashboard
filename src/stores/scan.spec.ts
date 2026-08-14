import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/libraryRoots', () => ({
  fetchScanStatus: vi.fn(),
  scanAll: vi.fn(),
  scanLibraryRoot: vi.fn(),
}))

import { fetchScanStatus, scanAll, scanLibraryRoot } from '@/api/libraryRoots'
import type { LibraryRoot } from '@/api/types'
import { useScanStore } from '@/stores/scan'

const mockedStatus = vi.mocked(fetchScanStatus)
const mockedScanAll = vi.mocked(scanAll)
const mockedScanRoot = vi.mocked(scanLibraryRoot)

function root(overrides: Partial<LibraryRoot> = {}): LibraryRoot {
  return {
    id: 1,
    name: '测试库',
    path: 'E:/Music',
    enabled: true,
    lastScanAt: null,
    scanStatus: 'IDLE',
    lastScanStats: null,
    createdAt: '2026-08-14T00:00:00Z',
    updatedAt: '2026-08-14T00:00:00Z',
    ...overrides,
  }
}

describe('scan store', () => {
  beforeEach(() => {
    mockedStatus.mockReset()
    mockedScanAll.mockReset()
    mockedScanRoot.mockReset()
  })

  it('refresh 载入状态与库根', async () => {
    mockedStatus.mockResolvedValue({
      scanning: false,
      roots: [root({ id: 1 }), root({ id: 2, name: '库B' })],
    })
    const store = useScanStore()

    await store.refresh()

    expect(store.scanning).toBe(false)
    expect(store.roots).toHaveLength(2)
  })

  it('lastStats 取最近一次扫描统计', async () => {
    mockedStatus.mockResolvedValue({
      scanning: false,
      roots: [
        root({
          lastScanAt: '2026-08-13T00:00:00Z',
          lastScanStats: '{"added":1,"updated":0,"missing":0,"error":0}',
        }),
        root({
          id: 2,
          lastScanAt: '2026-08-14T00:00:00Z',
          lastScanStats: '{"added":5,"updated":2,"missing":1,"error":1}',
        }),
      ],
    })
    const store = useScanStore()
    await store.refresh()

    expect(store.lastStats).toEqual({ added: 5, updated: 2, missing: 1, error: 1 })
  })

  it('无扫描记录 → lastStats 为 null', async () => {
    mockedStatus.mockResolvedValue({ scanning: false, roots: [root()] })
    const store = useScanStore()
    await store.refresh()

    expect(store.lastStats).toBeNull()
  })

  it('startFull 触发全量扫描并刷新', async () => {
    mockedScanAll.mockResolvedValue({ added: 3, updated: 0, missing: 0, error: 0 })
    mockedStatus.mockResolvedValue({ scanning: false, roots: [] })
    const store = useScanStore()

    const stats = await store.startFull()

    expect(stats.added).toBe(3)
    expect(mockedStatus).toHaveBeenCalledTimes(1)
  })

  it('startRoot 触发单根扫描并刷新', async () => {
    mockedScanRoot.mockResolvedValue({ added: 1, updated: 0, missing: 0, error: 0 })
    mockedStatus.mockResolvedValue({ scanning: false, roots: [] })
    const store = useScanStore()

    await store.startRoot(7)

    expect(mockedScanRoot).toHaveBeenCalledWith(7)
    expect(mockedStatus).toHaveBeenCalledTimes(1)
  })
})
