<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'

import {
  createLibraryRoot,
  deleteLibraryRoot,
  fetchLibraryRoots,
  updateLibraryRoot,
} from '@/api/libraryRoots'
import type { LibraryRoot } from '@/api/types'
import { useScanStore } from '@/stores/scan'
import { formatDateTime, parseScanStats } from '@/utils/format'

const scan = useScanStore()

const roots = ref<LibraryRoot[]>([])
const loading = ref(false)

const dialog = reactive({
  visible: false,
  editing: false,
  saving: false,
  id: 0,
})
const formRef = ref<FormInstance>()
const form = reactive({ name: '', path: '', enabled: true })

const rules: FormRules = {
  name: [{ required: true, message: '请输入库根名称', trigger: 'blur' }],
  path: [{ required: true, message: '请输入目录绝对路径', trigger: 'blur' }],
}

async function load() {
  loading.value = true
  try {
    roots.value = await fetchLibraryRoots()
  } finally {
    loading.value = false
  }
}

onMounted(load)

function openCreate() {
  dialog.visible = true
  dialog.editing = false
  dialog.id = 0
  form.name = ''
  form.path = ''
  form.enabled = true
}

function openEdit(row: unknown) {
  const root = row as LibraryRoot
  dialog.visible = true
  dialog.editing = true
  dialog.id = root.id
  form.name = root.name
  form.path = root.path
  form.enabled = root.enabled
}

async function save() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  dialog.saving = true
  try {
    if (dialog.editing) {
      await updateLibraryRoot(dialog.id, { ...form })
      ElMessage.success('库根已更新')
    } else {
      await createLibraryRoot({ ...form })
      ElMessage.success('库根已添加')
    }
    dialog.visible = false
    await load()
  } finally {
    dialog.saving = false
  }
}

async function toggleEnabled(row: unknown, enabled: unknown) {
  const root = row as LibraryRoot
  const enable = Boolean(enabled)
  await updateLibraryRoot(root.id, { enabled: enable })
  ElMessage.success(enable ? '已启用' : '已停用（曲目将隐藏）')
  await load()
}

async function remove(row: unknown) {
  const root = row as LibraryRoot
  await ElMessageBox.confirm(
    `删除库根「${root.name}」后，其曲目将标记为缺失并隐藏（记录保留）。确定删除？`,
    '删除库根',
    { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
  )
  await deleteLibraryRoot(root.id)
  ElMessage.success('库根已删除')
  await load()
}

async function scanRoot(row: unknown) {
  const root = row as LibraryRoot
  const stats = await scan.startRoot(root.id)
  ElMessage.success(
    `扫描完成：新增 ${stats.added} · 更新 ${stats.updated} · 缺失 ${stats.missing} · 错误 ${stats.error}`,
  )
  await load()
}

function statsOf(row: unknown) {
  return parseScanStats((row as LibraryRoot).lastScanStats)
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2 class="page-title">库根管理</h2>
        <p class="page-sub">挂载进媒体库的顶层目录；停用的库根不参与扫描</p>
      </div>
      <div class="page-actions">
        <el-button type="primary" @click="openCreate">添加库根</el-button>
      </div>
    </div>

    <div class="card table-card">
      <el-table v-loading="loading" :data="roots">
        <el-table-column label="名称" min-width="140">
          <template #default="{ row }">
            <span class="root-name">{{ row.name }}</span>
          </template>
        </el-table-column>

        <el-table-column label="路径" min-width="260">
          <template #default="{ row }">
            <span class="data-mono path">{{ row.path }}</span>
          </template>
        </el-table-column>

        <el-table-column label="启用" width="80" align="center">
          <template #default="{ row }">
            <el-switch :model-value="row.enabled" @change="(val) => toggleEnabled(row, val)" />
          </template>
        </el-table-column>

        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <span class="status" :class="{ scanning: row.scanStatus === 'SCANNING' }">
              <span class="status-dot" />
              {{ row.scanStatus === 'SCANNING' ? '扫描中' : '空闲' }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="最近扫描" width="150">
          <template #default="{ row }">
            <span class="data-mono dim">{{ formatDateTime(row.lastScanAt) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="上次统计" min-width="200">
          <template #default="{ row }">
            <template v-if="statsOf(row)">
              <span class="chip add">+{{ statsOf(row)!.added }}</span>
              <span class="chip upd">~{{ statsOf(row)!.updated }}</span>
              <span class="chip miss">-{{ statsOf(row)!.missing }}</span>
              <span class="chip err">!{{ statsOf(row)!.error }}</span>
            </template>
            <span v-else class="dim">—</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="190" align="right">
          <template #default="{ row }">
            <el-button link type="primary" :disabled="scan.scanning" @click="scanRoot(row)">
              扫描
            </el-button>
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog
      v-model="dialog.visible"
      :title="dialog.editing ? '编辑库根' : '添加库根'"
      width="520px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="如：我的音乐库" />
        </el-form-item>
        <el-form-item label="目录绝对路径" prop="path">
          <el-input v-model="form.path" placeholder="如：E:/Music" class="data-mono" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="dialog.saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.table-card {
  padding: 6px 14px 14px;
}

.root-name {
  font-weight: 600;
}

.path {
  font-size: 12.5px;
  color: var(--text-dim);
}

.dim {
  color: var(--text-dim);
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: var(--text-dim);
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--success);
}

.status.scanning .status-dot {
  background: var(--warn);
  animation: breathe 2s ease-in-out infinite;
}

.chip {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 11.5px;
  border-radius: 5px;
  padding: 0 6px;
  margin-right: 6px;
  line-height: 18px;
}

.chip.add {
  color: var(--success);
  background: rgba(61, 220, 151, 0.12);
}
.chip.upd {
  color: var(--info);
  background: rgba(76, 201, 240, 0.12);
}
.chip.miss {
  color: var(--warn);
  background: rgba(255, 180, 84, 0.12);
}
.chip.err {
  color: var(--danger);
  background: rgba(255, 93, 115, 0.12);
}
</style>
