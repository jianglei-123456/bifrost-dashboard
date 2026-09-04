<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'

import { useScanStore } from '@/stores/scan'
import ScanStatusDot from '@/components/ScanStatusDot.vue'
import { formatDateTime, parseScanStats } from '@/utils/format'

const scan = useScanStore()
const running = ref(false)

const summary = computed(() => {
  const s = scan.lastStats
  if (!s) return null
  const total = s.added + s.updated + s.missing + s.error
  return [
    { label: '新增', value: s.added, cls: 'add' },
    { label: '更新', value: s.updated, cls: 'upd' },
    { label: '缺失', value: s.missing, cls: 'miss' },
    { label: '错误', value: s.error, cls: 'err' },
    { label: '合计', value: total, cls: 'total' },
  ]
})

onMounted(() => scan.refresh().catch(() => {}))

async function startFull() {
  running.value = true
  try {
    const s = await scan.startFull()
    ElMessage.success(
      `全量扫描完成：新增 ${s.added} · 更新 ${s.updated} · 缺失 ${s.missing} · 错误 ${s.error}`,
    )
  } finally {
    running.value = false
  }
}

async function startRoot(id: number, name: string) {
  running.value = true
  try {
    const s = await scan.startRoot(id)
    ElMessage.success(
      `「${name}」扫描完成：新增 ${s.added} · 更新 ${s.updated} · 缺失 ${s.missing} · 错误 ${s.error}`,
    )
  } finally {
    running.value = false
  }
}

function statsOf(raw: string | null) {
  return parseScanStats(raw)
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2 class="page-title">扫描管理</h2>
        <p class="page-sub">手动触发扫描；定时扫描每日 03:00 自动执行</p>
      </div>
      <div class="page-actions">
        <el-button type="primary" :loading="running" :disabled="scan.scanning" @click="startFull">
          {{ scan.scanning ? '扫描进行中…' : '全量扫描' }}
        </el-button>
      </div>
    </div>

    <div class="grid-2">
      <section class="card panel">
        <h3 class="panel-title">
          当前状态
          <span class="status">
            <ScanStatusDot :scanning="scan.scanning" />
            {{ scan.scanning ? '扫描中' : '空闲' }}
          </span>
        </h3>
        <div v-if="scan.lastScanAt" class="meta-line">
          最近扫描：<span class="data-mono">{{ formatDateTime(scan.lastScanAt) }}</span>
        </div>
        <div v-if="scan.scanning" class="meta-line warn">扫描进行中，请勿重复触发（互斥）</div>
      </section>

      <section class="card panel">
        <h3 class="panel-title">上次扫描统计</h3>
        <div v-if="summary" class="summary">
          <div v-for="item in summary" :key="item.label" class="summary-item">
            <div class="summary-value data-mono" :class="item.cls">{{ item.value }}</div>
            <div class="summary-label">{{ item.label }}</div>
          </div>
        </div>
        <div v-else class="empty-hint">还没有扫描记录</div>
      </section>
    </div>

    <section class="card table-card">
      <h3 class="panel-title">库根明细</h3>
      <el-table :data="scan.roots">
        <el-table-column label="库根" min-width="160">
          <template #default="{ row }">
            <span class="root-name">{{ row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <span class="status">
              <ScanStatusDot :scanning="row.scanStatus === 'SCANNING'" />
              {{ row.scanStatus === 'SCANNING' ? '扫描中' : '空闲' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="最近扫描" width="160">
          <template #default="{ row }">
            <span class="data-mono dim">{{ formatDateTime(row.lastScanAt) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="上次统计" min-width="220">
          <template #default="{ row }">
            <template v-if="statsOf(row.lastScanStats)">
              <span class="mini add">{{ statsOf(row.lastScanStats)!.added }}</span>
              <span class="mini upd">{{ statsOf(row.lastScanStats)!.updated }}</span>
              <span class="mini miss">{{ statsOf(row.lastScanStats)!.missing }}</span>
              <span class="mini err">{{ statsOf(row.lastScanStats)!.error }}</span>
            </template>
            <span v-else class="dim">—</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" align="right">
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              :disabled="scan.scanning"
              @click="startRoot(row.id, row.name)"
            >
              扫描本根
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>
  </div>
</template>

<style scoped>
.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 16px;
}

.panel {
  padding: 18px 20px;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 14px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: var(--text-dim);
  font-weight: 400;
}

.meta-line {
  font-size: 13px;
  color: var(--text-dim);
  margin-top: 6px;
}

.meta-line.warn {
  color: var(--warn);
}

.summary {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
}

.summary-item {
  text-align: center;
}

.summary-value {
  font-size: 26px;
  font-weight: 700;
}

.summary-label {
  font-size: 12px;
  color: var(--text-dim);
  margin-top: 2px;
}

.add {
  color: var(--success);
}
.upd {
  color: var(--info);
}
.miss {
  color: var(--warn);
}
.err {
  color: var(--danger);
}
.total {
  color: var(--text);
}

.table-card {
  padding: 18px 20px 20px;
}

.table-card .panel-title {
  margin-bottom: 10px;
}

.root-name {
  font-weight: 600;
}

.dim {
  color: var(--text-dim);
}

.mini {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 11.5px;
  border-radius: 5px;
  padding: 0 6px;
  margin-right: 6px;
  line-height: 18px;
}

.mini.add {
  color: var(--success);
  background: rgba(61, 220, 151, 0.12);
}
.mini.upd {
  color: var(--info);
  background: rgba(76, 201, 240, 0.12);
}
.mini.miss {
  color: var(--warn);
  background: rgba(255, 180, 84, 0.12);
}
.mini.err {
  color: var(--danger);
  background: rgba(255, 93, 115, 0.12);
}

@media (max-width: 900px) {
  .grid-2 {
    grid-template-columns: 1fr;
  }
}
</style>
