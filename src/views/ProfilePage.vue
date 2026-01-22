<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useScheduleStore } from '../stores/store'
import { formatDate } from '../utils/dateUtils'

const authStore = useAuthStore()
const scheduleStore = useScheduleStore()

// Profile editing state
const isEditing = ref(false)
const editForm = ref({
  displayName: '',
  bio: '',
  timezone: ''
})

// Statistics
const userStats = computed(() => {
  const allTasks = Object.values(scheduleStore.schedules).flat()
  const totalTasks = allTasks.length
  const completedTasks = allTasks.filter((t: any) => t.completed).length
  const pendingTasks = totalTasks - completedTasks
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  // Count meetings
  const totalMeetings = allTasks.filter((t: any) => t.meetingUrl).length

  // Count days with tasks
  const daysWithTasks = Object.keys(scheduleStore.schedules).filter(
    (date) => scheduleStore.schedules[date].length > 0
  ).length

  return {
    totalTasks,
    completedTasks,
    pendingTasks,
    completionRate,
    totalMeetings,
    daysWithTasks
  }
})

// Recent activity (last 5 days)
const recentActivity = computed(() => {
  const activity: any[] = []
  const today = new Date()

  for (let i = 0; i < 5; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateKey = formatDate(date)
    const tasks = scheduleStore.schedules[dateKey] || []

    if (tasks.length > 0) {
      const completed = tasks.filter((t: any) => t.completed).length
      activity.push({
        date: dateKey,
        total: tasks.length,
        completed,
        pending: tasks.length - completed
      })
    }
  }

  return activity
})

const startEditing = () => {
  editForm.value = {
    displayName: authStore.userData?.displayName || authStore.user?.displayName || '',
    bio: (authStore.userData as any)?.bio || '',
    timezone: (authStore.userData as any)?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
  }
  isEditing.value = true
}

const cancelEditing = () => {
  isEditing.value = false
}

const saveProfile = async () => {
  try {
    // Here you would update the user profile in Firestore
    // For now, we'll just close the edit mode
    // TODO: Implement updateUserProfile function in firebase/auth.ts
    console.log('Saving profile:', editForm.value)
    isEditing.value = false
  } catch (error) {
    console.error('Error saving profile:', error)
  }
}

const handleSignOut = async () => {
  try {
    await authStore.signOut()
  } catch (error) {
    console.error('Error signing out:', error)
  }
}

onMounted(async () => {
  if (!scheduleStore.synced) {
    await scheduleStore.loadUserTasks()
  }
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4 sm:p-6 lg:p-8 transition-colors duration-300">
    <div class="max-w-5xl mx-auto">
      <!-- Page Header -->
      <div class="mb-8">
        <h1 class="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2">
          👤 Profile
        </h1>
        <p class="text-gray-600 dark:text-gray-400">
          Manage your account and view your productivity stats
        </p>
      </div>

      <!-- Profile Card -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden transition-colors duration-300 mb-6">
        <!-- Cover Image -->
        <div class="h-32 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>

        <!-- Profile Content -->
        <div class="px-6 pb-6">
          <!-- Avatar and Basic Info -->
          <div class="flex flex-col sm:flex-row items-start sm:items-end gap-4 -mt-16 mb-6">
            <div class="relative">
              <img
                :src="authStore.user?.photoURL || 'https://via.placeholder.com/150'"
                :alt="authStore.user?.displayName || 'User'"
                class="w-32 h-32 rounded-full border-4 border-white dark:border-gray-800 shadow-lg object-cover"
              />
              <div class="absolute bottom-2 right-2 w-6 h-6 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></div>
            </div>

            <div class="flex-1 sm:mb-4">
              <h2 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1">
                {{ authStore.user?.displayName || 'User' }}
              </h2>
              <p class="text-gray-600 dark:text-gray-400 mb-2">
                {{ authStore.user?.email }}
              </p>
              <p v-if="(authStore.userData as any)?.bio" class="text-gray-700 dark:text-gray-300 text-sm">
                {{ (authStore.userData as any).bio }}
              </p>
            </div>

            <div class="flex gap-2">
              <button
                v-if="!isEditing"
                @click="startEditing"
                class="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors shadow-md hover:shadow-lg flex items-center gap-2"
              >
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit Profile
              </button>
              <button
                @click="handleSignOut"
                class="px-4 py-2 bg-red-600 dark:bg-red-500 text-white rounded-lg font-medium hover:bg-red-700 dark:hover:bg-red-600 transition-colors shadow-md hover:shadow-lg flex items-center gap-2"
              >
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sign Out
              </button>
            </div>
          </div>

          <!-- Edit Form -->
          <div v-if="isEditing" class="bg-gray-50 dark:bg-gray-700 rounded-xl p-6 mb-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Edit Profile</h3>
            
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Display Name
                </label>
                <input
                  v-model="editForm.displayName"
                  type="text"
                  class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all"
                  placeholder="Enter your display name"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Bio
                </label>
                <textarea
                  v-model="editForm.bio"
                  rows="3"
                  class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all resize-none"
                  placeholder="Tell us about yourself..."
                ></textarea>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Timezone
                </label>
                <input
                  v-model="editForm.timezone"
                  type="text"
                  class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all"
                  placeholder="e.g., America/New_York"
                />
              </div>

              <div class="flex gap-3 pt-2">
                <button
                  @click="saveProfile"
                  class="px-6 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors shadow-md hover:shadow-lg"
                >
                  Save Changes
                </button>
                <button
                  @click="cancelEditing"
                  class="px-6 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>

          <!-- Account Details -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div class="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
              <div class="flex items-center gap-3 mb-2">
                <div class="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center">
                  <svg class="w-6 h-6 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <div>
                  <p class="text-sm text-gray-600 dark:text-gray-400">Account Type</p>
                  <p class="text-lg font-semibold text-gray-900 dark:text-white">Google Account</p>
                </div>
              </div>
            </div>

            <div class="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
              <div class="flex items-center gap-3 mb-2">
                <div class="w-10 h-10 bg-purple-100 dark:bg-purple-900/40 rounded-lg flex items-center justify-center">
                  <svg class="w-6 h-6 text-purple-600 dark:text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </div>
                <div>
                  <p class="text-sm text-gray-600 dark:text-gray-400">Member Since</p>
                  <p class="text-lg font-semibold text-gray-900 dark:text-white">
                    {{ authStore.user?.metadata?.creationTime ? new Date(authStore.user.metadata.creationTime).toLocaleDateString() : 'N/A' }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Productivity Stats -->
      <div class="mb-6">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span>📊</span>
          Productivity Statistics
        </h2>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <!-- Total Tasks -->
          <div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg p-6 text-white transform hover:scale-105 transition-all duration-300">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-blue-100 mb-1">Total Tasks</p>
                <p class="text-3xl font-bold">{{ userStats.totalTasks }}</p>
              </div>
              <div class="text-5xl opacity-80">📝</div>
            </div>
          </div>

          <!-- Completed Tasks -->
          <div class="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-lg p-6 text-white transform hover:scale-105 transition-all duration-300">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-green-100 mb-1">Completed</p>
                <p class="text-3xl font-bold">{{ userStats.completedTasks }}</p>
              </div>
              <div class="text-5xl opacity-80">✅</div>
            </div>
          </div>

          <!-- Completion Rate -->
          <div class="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-lg p-6 text-white transform hover:scale-105 transition-all duration-300">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-purple-100 mb-1">Completion Rate</p>
                <p class="text-3xl font-bold">{{ userStats.completionRate }}%</p>
              </div>
              <div class="text-5xl opacity-80">🎯</div>
            </div>
          </div>

          <!-- Pending Tasks -->
          <div class="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl shadow-lg p-6 text-white transform hover:scale-105 transition-all duration-300">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-orange-100 mb-1">Pending</p>
                <p class="text-3xl font-bold">{{ userStats.pendingTasks }}</p>
              </div>
              <div class="text-5xl opacity-80">⏳</div>
            </div>
          </div>

          <!-- Total Meetings -->
          <div class="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl shadow-lg p-6 text-white transform hover:scale-105 transition-all duration-300">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-indigo-100 mb-1">Meetings</p>
                <p class="text-3xl font-bold">{{ userStats.totalMeetings }}</p>
              </div>
              <div class="text-5xl opacity-80">🎥</div>
            </div>
          </div>

          <!-- Active Days -->
          <div class="bg-gradient-to-br from-pink-500 to-pink-600 rounded-2xl shadow-lg p-6 text-white transform hover:scale-105 transition-all duration-300">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-pink-100 mb-1">Active Days</p>
                <p class="text-3xl font-bold">{{ userStats.daysWithTasks }}</p>
              </div>
              <div class="text-5xl opacity-80">🔥</div>
            </div>
          </div>
        </div>

        <!-- Progress Bar -->
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Overall Progress</h3>
            <span class="text-sm font-medium text-gray-600 dark:text-gray-400">
              {{ userStats.completedTasks }} of {{ userStats.totalTasks }} tasks completed
            </span>
          </div>
          <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-6 overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-500 ease-out flex items-center justify-end pr-3"
              :class="{
                'bg-gradient-to-r from-green-400 to-green-600': userStats.completionRate >= 80,
                'bg-gradient-to-r from-blue-400 to-blue-600': userStats.completionRate >= 50 && userStats.completionRate < 80,
                'bg-gradient-to-r from-orange-400 to-orange-600': userStats.completionRate < 50
              }"
              :style="{ width: userStats.completionRate + '%' }"
            >
              <span class="text-xs font-bold text-white">{{ userStats.completionRate }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Activity -->
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span>📈</span>
          Recent Activity
        </h2>

        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
          <div v-if="recentActivity.length === 0" class="p-8 text-center text-gray-500 dark:text-gray-400">
            <div class="text-6xl mb-4">📭</div>
            <p class="text-lg">No recent activity</p>
          </div>

          <div v-else class="divide-y divide-gray-200 dark:divide-gray-700">
            <div
              v-for="(activity, index) in recentActivity"
              :key="index"
              class="p-6 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              <div class="flex items-center justify-between">
                <div class="flex-1">
                  <h4 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {{ activity.date }}
                  </h4>
                  <div class="flex items-center gap-6 text-sm">
                    <div class="flex items-center gap-2">
                      <span class="text-gray-600 dark:text-gray-400">Total:</span>
                      <span class="font-semibold text-gray-900 dark:text-white">{{ activity.total }}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-gray-600 dark:text-gray-400">Completed:</span>
                      <span class="font-semibold text-green-600 dark:text-green-400">{{ activity.completed }}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-gray-600 dark:text-gray-400">Pending:</span>
                      <span class="font-semibold text-orange-600 dark:text-orange-400">{{ activity.pending }}</span>
                    </div>
                  </div>
                </div>
                <div class="flex-shrink-0 ml-4">
                  <div class="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                    {{ Math.round((activity.completed / activity.total) * 100) }}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Smooth animations */
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.grid > div {
  animation: slideIn 0.3s ease-out;
}
</style>
