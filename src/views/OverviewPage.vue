<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useScheduleStore } from '../stores/store'
import { formatDate } from '../utils/dateUtils'

const store = useScheduleStore()
const currentDate = ref(new Date())
const selectedMonth = ref(new Date())

// Pomodoro Timer State
const timerMinutes = ref(50)
const timerSeconds = ref(0)
const isTimerRunning = ref(false)
const isBreakTime = ref(false)
const currentTask = ref<any>(null)
let timerInterval: any = null

const timerDisplay = computed(() => {
  const mins = String(timerMinutes.value).padStart(2, '0')
  const secs = String(timerSeconds.value).padStart(2, '0')
  return `${mins}:${secs}`
})

const timerProgress = computed(() => {
  const totalSeconds = isBreakTime.value ? 10 * 60 : 50 * 60
  const currentSeconds = timerMinutes.value * 60 + timerSeconds.value
  return ((totalSeconds - currentSeconds) / totalSeconds) * 100
})

// Sound notification
const playSound = () => {
  const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUKvm8LRiHAU2kdXy0HgsBS1+zPLaizsKGGS56+mnVBELTKXh8bllHgU1jtTyz3YpBSh6y/HajDwLGGG36Oqo')
  audio.play().catch(() => {})
}

const startTimer = (task?: any) => {
  if (task) currentTask.value = task
  isTimerRunning.value = true
  
  if (!timerInterval) {
    timerInterval = setInterval(() => {
      if (timerSeconds.value === 0) {
        if (timerMinutes.value === 0) {
          playSound()
          if (isBreakTime.value) {
            isBreakTime.value = false
            timerMinutes.value = 50
            timerSeconds.value = 0
          } else {
            isBreakTime.value = true
            timerMinutes.value = 10
            timerSeconds.value = 0
          }
        } else {
          timerMinutes.value--
          timerSeconds.value = 59
        }
      } else {
        timerSeconds.value--
      }
    }, 1000)
  }
}

const pauseTimer = () => {
  isTimerRunning.value = false
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

const resetTimer = () => {
  pauseTimer()
  isBreakTime.value = false
  timerMinutes.value = 50
  timerSeconds.value = 0
  currentTask.value = null
}

// Auto-start timer
const checkTaskTimes = () => {
  const now = new Date()
  const today = formatDate(now)
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  
  const todayTasks = store.schedules[today] || []
  const matchingTask = todayTasks.find((task: any) => task.time === currentTime && !task.completed)
  
  if (matchingTask && !isTimerRunning.value) {
    startTimer(matchingTask)
    playSound()
  }
}

// Today's statistics
const todayStats = computed(() => {
  const today = formatDate(currentDate.value)
  const tasks = store.schedules[today] || []
  const total = tasks.length
  const completed = tasks.filter((t: any) => t.completed).length
  const pending = total - completed
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0
  
  return { total, completed, pending, rate }
})

// Monthly statistics
const monthlyStats = computed(() => {
  const year = selectedMonth.value.getFullYear()
  const month = selectedMonth.value.getMonth()
  
  let totalTasks = 0
  let completedTasks = 0
  let totalMeetings = 0
  let daysWithTasks = 0
  
  // Iterate through all days in the month
  for (let day = 1; day <= 31; day++) {
    const date = new Date(year, month, day)
    if (date.getMonth() !== month) break // Stop if we've gone to next month
    
    const dateKey = formatDate(date)
    const tasks = store.schedules[dateKey] || []
    
    if (tasks.length > 0) {
      daysWithTasks++
      totalTasks += tasks.length
      completedTasks += tasks.filter((t: any) => t.completed).length
      totalMeetings += tasks.filter((t: any) => t.meetingLink).length
    }
  }
  
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
  const avgTasksPerDay = daysWithTasks > 0 ? (totalTasks / daysWithTasks).toFixed(1) : '0'
  
  return {
    totalTasks,
    completedTasks,
    pending: totalTasks - completedTasks,
    totalMeetings,
    daysWithTasks,
    completionRate,
    avgTasksPerDay
  }
})

// Recent tasks (last 7 days)
const recentTasks = computed(() => {
  const tasks: any[] = []
  const today = new Date()
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateKey = formatDate(date)
    const dayTasks = store.schedules[dateKey] || []
    
    dayTasks.forEach((task: any) => {
      tasks.push({
        ...task,
        date: dateKey,
        dateObj: new Date(date)
      })
    })
  }
  
  return tasks.sort((a, b) => {
    if (a.dateObj.getTime() !== b.dateObj.getTime()) {
      return b.dateObj.getTime() - a.dateObj.getTime()
    }
    return (a.from || '').localeCompare(b.from || '')
  }).slice(0, 10)
})

const monthName = computed(() => {
  return selectedMonth.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
})

const previousMonth = () => {
  const newDate = new Date(selectedMonth.value)
  newDate.setMonth(newDate.getMonth() - 1)
  selectedMonth.value = newDate
}

const nextMonth = () => {
  const newDate = new Date(selectedMonth.value)
  newDate.setMonth(newDate.getMonth() + 1)
  selectedMonth.value = newDate
}

const getMotivationalMessage = (rate: number) => {
  if (rate === 100) return 'Perfect! 🎉'
  if (rate >= 80) return 'Excellent work! 🌟'
  if (rate >= 60) return 'Great progress! 💪'
  if (rate >= 40) return 'Keep going! 🚀'
  return 'You got this! 💪'
}

onMounted(async () => {
  if (!store.synced) {
    await store.loadUserTasks()
  }
  
  setInterval(checkTaskTimes, 60000)
  checkTaskTimes()
})

onUnmounted(() => {
  if (timerInterval) {
    clearInterval(timerInterval)
  }
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4 sm:p-6 lg:p-8 transition-colors duration-300">
    <div class="max-w-7xl mx-auto">
      <!-- Page Header -->
      <div class="mb-8">
        <h1 class="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2">
          📊 Overview
        </h1>
        <p class="text-gray-600 dark:text-gray-400">
          Track your productivity and task completion
        </p>
      </div>

      <!-- Today's Stats -->
      <div class="mb-8">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span>📅</span>
          Today's Progress
        </h2>
        
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <!-- Total Tasks -->
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border-l-4 border-blue-500 transform hover:scale-105 transition-all duration-300">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Total Tasks</p>
                <p class="text-3xl font-bold text-gray-900 dark:text-white">{{ todayStats.total }}</p>
              </div>
              <div class="text-4xl">📝</div>
            </div>
          </div>

          <!-- Completed -->
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border-l-4 border-green-500 transform hover:scale-105 transition-all duration-300">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Completed</p>
                <p class="text-3xl font-bold text-green-600 dark:text-green-400">{{ todayStats.completed }}</p>
              </div>
              <div class="text-4xl">✅</div>
            </div>
          </div>

          <!-- Pending -->
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border-l-4 border-orange-500 transform hover:scale-105 transition-all duration-300">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Pending</p>
                <p class="text-3xl font-bold text-orange-600 dark:text-orange-400">{{ todayStats.pending }}</p>
              </div>
              <div class="text-4xl">⏳</div>
            </div>
          </div>

          <!-- Completion Rate -->
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border-l-4 border-purple-500 transform hover:scale-105 transition-all duration-300">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Completion</p>
                <p class="text-3xl font-bold text-purple-600 dark:text-purple-400">{{ todayStats.rate }}%</p>
              </div>
              <div class="text-4xl">🎯</div>
            </div>
          </div>
        </div>

        <!-- Progress Bar -->
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Today's Progress</h3>
            <span class="text-sm font-medium text-gray-600 dark:text-gray-400">
              {{ getMotivationalMessage(todayStats.rate) }}
            </span>
          </div>
          <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
            <div 
              class="h-full rounded-full transition-all duration-500 ease-out"
              :class="{
                'bg-gradient-to-r from-green-400 to-green-600': todayStats.rate >= 80,
                'bg-gradient-to-r from-blue-400 to-blue-600': todayStats.rate >= 50 && todayStats.rate < 80,
                'bg-gradient-to-r from-orange-400 to-orange-600': todayStats.rate < 50
              }"
              :style="{ width: todayStats.rate + '%' }"
            ></div>
          </div>
        </div>
      </div>

      <!-- Pomodoro Timer -->
      <div class="mb-8">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span>⏱️</span>
          Focus Timer
        </h2>
        
        <div class="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-2xl p-8 text-white">
          <div class="text-center mb-6">
            <div class="text-6xl sm:text-7xl font-bold mb-2 font-mono">
              {{ timerDisplay }}
            </div>
            <p class="text-lg opacity-90">
              {{ isBreakTime ? '☕ Break Time' : '💼 Focus Time' }}
            </p>
            <p v-if="currentTask" class="text-sm opacity-75 mt-2">
              {{ currentTask.title }}
            </p>
          </div>

          <!-- Progress Circle -->
          <div class="relative w-32 h-32 mx-auto mb-6">
            <svg class="transform -rotate-90 w-32 h-32">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                stroke-width="8"
                fill="none"
                class="opacity-30"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                stroke-width="8"
                fill="none"
                :stroke-dasharray="2 * Math.PI * 56"
                :stroke-dashoffset="2 * Math.PI * 56 * (1 - timerProgress / 100)"
                class="transition-all duration-1000"
              />
            </svg>
            <div class="absolute inset-0 flex items-center justify-center">
              <span class="text-2xl font-bold">{{ Math.round(timerProgress) }}%</span>
            </div>
          </div>

          <!-- Timer Controls -->
          <div class="flex items-center justify-center gap-4">
            <button
              v-if="!isTimerRunning"
              @click="startTimer()"
              class="px-6 py-3 bg-white text-indigo-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors shadow-lg flex items-center gap-2"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
              Start
            </button>
            <button
              v-else
              @click="pauseTimer"
              class="px-6 py-3 bg-white text-indigo-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors shadow-lg flex items-center gap-2"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
              </svg>
              Pause
            </button>
            <button
              @click="resetTimer"
              class="px-6 py-3 bg-white/20 text-white rounded-lg font-semibold hover:bg-white/30 transition-colors flex items-center gap-2"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
              </svg>
              Reset
            </button>
          </div>

          <div class="mt-6 text-center text-sm opacity-75">
            <p>🎯 50 minutes work • ☕ 10 minutes break</p>
            <p class="mt-1">Timer auto-starts when task time matches current time</p>
          </div>
        </div>
      </div>

      <!-- Monthly Stats -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>📆</span>
            Monthly Overview
          </h2>
          <div class="flex items-center gap-2">
            <button
              @click="previousMonth"
              class="p-2 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-md"
            >
              ←
            </button>
            <span class="text-lg font-semibold text-gray-900 dark:text-white min-w-[200px] text-center">
              {{ monthName }}
            </span>
            <button
              @click="nextMonth"
              class="p-2 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-md"
            >
              →
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <!-- Total Monthly Tasks -->
          <div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg p-6 text-white transform hover:scale-105 transition-all duration-300">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-blue-100 mb-1">Total Tasks</p>
                <p class="text-3xl font-bold">{{ monthlyStats.totalTasks }}</p>
              </div>
              <div class="text-4xl opacity-80">📋</div>
            </div>
          </div>

          <!-- Completed Monthly -->
          <div class="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-lg p-6 text-white transform hover:scale-105 transition-all duration-300">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-green-100 mb-1">Completed</p>
                <p class="text-3xl font-bold">{{ monthlyStats.completedTasks }}</p>
              </div>
              <div class="text-4xl opacity-80">✨</div>
            </div>
          </div>

          <!-- Meetings -->
          <div class="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-lg p-6 text-white transform hover:scale-105 transition-all duration-300">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-purple-100 mb-1">Meetings</p>
                <p class="text-3xl font-bold">{{ monthlyStats.totalMeetings }}</p>
              </div>
              <div class="text-4xl opacity-80">🎥</div>
            </div>
          </div>

          <!-- Active Days -->
          <div class="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl shadow-lg p-6 text-white transform hover:scale-105 transition-all duration-300">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-orange-100 mb-1">Active Days</p>
                <p class="text-3xl font-bold">{{ monthlyStats.daysWithTasks }}</p>
              </div>
              <div class="text-4xl opacity-80">🔥</div>
            </div>
          </div>
        </div>

        <!-- Monthly Insights -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Monthly Completion Rate</h3>
            <div class="flex items-center gap-4">
              <div class="flex-1">
                <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-6 overflow-hidden">
                  <div 
                    class="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                    :style="{ width: monthlyStats.completionRate + '%' }"
                  >
                    <span class="text-xs font-bold text-white">{{ monthlyStats.completionRate }}%</span>
                  </div>
                </div>
              </div>
              <div class="text-3xl">
                {{ monthlyStats.completionRate >= 80 ? '🏆' : monthlyStats.completionRate >= 50 ? '⭐' : '💪' }}
              </div>
            </div>
          </div>

          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Average Tasks per Day</h3>
            <div class="flex items-center justify-between">
              <div>
                <p class="text-4xl font-bold text-indigo-600 dark:text-indigo-400">{{ monthlyStats.avgTasksPerDay }}</p>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">tasks per active day</p>
              </div>
              <div class="text-5xl">📊</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Activity -->
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span>🕒</span>
          Recent Activity
        </h2>
        
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
          <div v-if="recentTasks.length === 0" class="p-8 text-center text-gray-500 dark:text-gray-400">
            <div class="text-6xl mb-4">📭</div>
            <p class="text-lg">No recent tasks found</p>
          </div>
          
          <div v-else class="divide-y divide-gray-200 dark:divide-gray-700">
            <div 
              v-for="(task, index) in recentTasks" 
              :key="index"
              class="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              <div class="flex items-start gap-3">
                <div class="flex-shrink-0 mt-1">
                  <div 
                    class="w-3 h-3 rounded-full"
                    :class="task.completed ? 'bg-green-500' : 'bg-orange-500'"
                  ></div>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-start justify-between gap-2">
                    <div class="flex-1">
                      <h4 class="text-base font-semibold text-gray-900 dark:text-white mb-1">
                        {{ task.title }}
                      </h4>
                      <p v-if="task.description" class="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {{ task.description }}
                      </p>
                      <div class="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span class="flex items-center gap-1">
                          📅 {{ task.date }}
                        </span>
                        <span v-if="task.from && task.to" class="flex items-center gap-1">
                          🕐 {{ task.from }} - {{ task.to }}
                        </span>
                        <span v-if="task.meetingLink" class="flex items-center gap-1">
                          🎥 Meeting
                        </span>
                      </div>
                    </div>
                    <div class="flex-shrink-0">
                      <span 
                        class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                        :class="task.completed 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                          : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'"
                      >
                        {{ task.completed ? 'Completed' : 'Pending' }}
                      </span>
                    </div>
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
/* Add smooth animations */
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
