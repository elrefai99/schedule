<script setup lang="ts">
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()

const handleLogout = async () => {
  try {
    await authStore.signOut()
  } catch (error) {
    console.error('Logout failed:', error)
  }
}
</script>

<template>
  <header>
    <nav class="w-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 dark:text-gray-200">
      <div class="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">

        <!-- Logo/Brand -->
        <div class="flex items-center gap-2">
          <svg class="w-6 h-6 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke-width="2"/>
            <line x1="16" y1="2" x2="16" y2="6" stroke-width="2"/>
            <line x1="8" y1="2" x2="8" y2="6" stroke-width="2"/>
            <line x1="3" y1="10" x2="21" y2="10" stroke-width="2"/>
          </svg>
          <span class="font-bold text-lg text-gray-800 dark:text-gray-100">Schedule Manager</span>
        </div>

        <!-- Right Section -->
        <div class="flex items-center gap-4">
          <darkmode />
          
          <!-- User Profile & Logout -->
          <div v-if="authStore.isAuthenticated && authStore.user" class="flex items-center gap-3">
            <img
              :src="authStore.user.photoURL || '/default-avatar.png'"
              class="w-9 h-9 rounded-full border-2 border-blue-500 dark:border-blue-400"
              :alt="authStore.user.displayName || 'User'"
            />
            <div class="hidden sm:block">
              <p class="text-sm font-medium text-gray-800 dark:text-gray-100">
                {{ authStore.user.displayName }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ authStore.user.email }}
              </p>
            </div>
            <button
              @click="handleLogout"
              class="px-3 py-1.5 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium"
            >
              Logout
            </button>
          </div>
        </div>

      </div>
    </nav>
  </header>
</template>
