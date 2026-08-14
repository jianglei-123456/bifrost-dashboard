<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

import SidebarNav from './SidebarNav.vue'
import TopBar from './TopBar.vue'
import { useScanStore } from '@/stores/scan'

const scan = useScanStore()

let timer: number | undefined

onMounted(() => {
  // 顶栏扫描状态：加载一次 + 每 10s 静默轮询（捕捉定时/外部扫描）
  scan.refresh().catch(() => {})
  timer = window.setInterval(() => {
    scan.refresh().catch(() => {})
  }, 10_000)
})

onUnmounted(() => {
  if (timer !== undefined) window.clearInterval(timer)
})
</script>

<template>
  <div class="app-shell">
    <SidebarNav />
    <div class="app-main">
      <TopBar />
      <main class="app-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  min-height: 100vh;
}

.app-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.app-content {
  flex: 1;
}

@media (max-width: 1024px) {
  .app-main {
    margin-left: 0;
  }
}
</style>
