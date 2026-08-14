/** 库根与扫描 API（T4.2/T4.3） */
import { request } from './client'
import type { LibraryRoot, ScanStats, ScanStatusView } from './types'

export interface LibraryRootRequest {
  name: string
  path: string
  enabled?: boolean
}

export function fetchLibraryRoots(): Promise<LibraryRoot[]> {
  return request<LibraryRoot[]>({ method: 'get', url: '/api/library-roots' })
}

export function createLibraryRoot(body: LibraryRootRequest): Promise<LibraryRoot> {
  return request<LibraryRoot>({ method: 'post', url: '/api/library-roots', data: body })
}

export function updateLibraryRoot(
  id: number,
  body: Partial<LibraryRootRequest>,
): Promise<LibraryRoot> {
  return request<LibraryRoot>({ method: 'put', url: `/api/library-roots/${id}`, data: body })
}

export function deleteLibraryRoot(id: number): Promise<void> {
  return request<void>({ method: 'delete', url: `/api/library-roots/${id}` })
}

/** 单根扫描（同步：扫描完成才返回统计） */
export function scanLibraryRoot(id: number): Promise<ScanStats> {
  return request<ScanStats>({ method: 'post', url: `/api/library-roots/${id}/scan` })
}

/** 全量扫描（同步，全部启用库根串行） */
export function scanAll(): Promise<ScanStats> {
  return request<ScanStats>({ method: 'post', url: '/api/scan' })
}

export function fetchScanStatus(): Promise<ScanStatusView> {
  return request<ScanStatusView>({ method: 'get', url: '/api/scan/status' })
}
