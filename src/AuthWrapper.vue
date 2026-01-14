<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from './stores/auth'
import Login from './components/Login.vue'
import ScheduleApp from './App.vue'

const authStore = useAuthStore()

const showLogin = computed(() => !authStore.isAuthenticated && !authStore.loading)
const showApp = computed(() => authStore.isAuthenticated && !authStore.loading)
</script>

<template>
  <div>
    <!-- Loading State -->
    <div v-if="authStore.loading" class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div class="text-center">
        <svg class="animate-spin w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto mb-4" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
        </svg>
        <p class="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    </div>

    <!-- Login Page -->
    <Login v-if="showLogin" />

    <!-- Main App -->
    <ScheduleApp v-if="showApp" />
  </div>
</template>
