<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useScheduleStore } from '../stores/store'
import { formatDate, formatHour, isDateDisabled, weekDays } from '../utils/dateUtils'
import { getHourSlotHeight, getTaskPosition } from '../utils/calendarUtils'
// @ts-ignore
import html2pdf from 'html2pdf.js'
import { useCalendar } from '../shared/useCalendar'
import { useTaskLogic } from '../shared/useTaskLogic'
import { useTimer } from '../shared/useTimer'
import { useNotifications } from '../shared/useNotifications'
import { useDragDrop } from '../shared/useDragDrop'

const store = useScheduleStore()

// Calendar Logic
const {
  todayFormatted,
  selectedDate,
  calendarView,
  weekCalendarDays,
  displayedCalendarDays,
  calendarTitle,
  changeMonth,
  handleDateClick: calendarHandleDateClick,
  timeSlots
} = useCalendar()

// Time State
const currentTime = ref(new Date())

// Task Logic
const {
  showAddForm,
  editingTaskId,
  showTodoList,
  newTask,
  currentTasks,
  categorizedTasks,
  nextTask,
  currentActiveTask,
  handleAddTask,
  handleEditTask,
  toggleComplete,
  deleteTaskItem,
  openGoogleCalendarForTask,
  checkAndCompletePassedTasks,
  isCurrentTask,
  isNextTask
} = useTaskLogic(store, selectedDate, todayFormatted, currentTime)

// Timer Logic
const triggerNotification = ref(() => {})
const onTimerComplete = () => {
  triggerNotification.value()
}

const { isBreakTime } = useTimer(currentActiveTask, onTimerComplete)

const { checkUpcomingTasks, checkDayChange, showNotification } = useNotifications(
  store,
  todayFormatted,
  isBreakTime
)

// Assign the real function
triggerNotification.value = showNotification

// Drag and Drop Logic
const columns = [
  { id: 'willStart', title: 'To Do', color: 'blue', icon: '→' },
  { id: 'workedOn', title: 'In Progress', color: 'emerald', icon: '✓' },
  { id: 'ended', title: 'Done', color: 'gray', icon: '✓' }
]

const getTasksForColumn = (columnId: string) => {
  if (columnId === 'willStart') return categorizedTasks.value.willStart
  if (columnId === 'workedOn') return categorizedTasks.value.workedOn
  if (columnId === 'ended') return categorizedTasks.value.ended
  return []
}

const {
  draggedTaskId,
  draggedOverTaskId,
  draggedOverColumn,
  handleDragStart,
  handleDragOver,
  handleDragLeave,
  handleColumnDragOver,
  handleColumnDragLeave,
  handleDragEnd,
  handleDrop
} = useDragDrop(selectedDate, store, currentTasks, getTasksForColumn)

// View Helpers
const handleDateClick = (date: Date) => {
  calendarHandleDateClick(date)
  showAddForm.value = false
}

// Report Logic
const showReport = ref(false)
const reportStats = computed(() => {
  const tasks = currentTasks.value
  const total = tasks.length
  const completed = tasks.filter((t: any) => t.completed).length
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0
  const pending = total - completed

  // Encouraging message
  let message = 'Keep it up!'
  if (rate === 100 && total > 0) message = 'Perfect Day! 🌟'
  else if (rate >= 80) message = 'Great Job! 🚀'
  else if (rate >= 50) message = 'Good Effort! 👍'
  else if (total === 0) message = 'No tasks for today 🌴'
  else message = 'Tomorrow is a new start! 💪'

  return { total, completed, rate, pending, message }
})

const downloadReport = () => {
  const element = document.getElementById('daily-report-content')
  if (!element || !selectedDate.value) return

  const opt: any = {
    margin: 0.5,
    filename: `Daily_Report_${formatDate(selectedDate.value).replace(/ /g, '_')}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'in', format: 'a5', orientation: 'portrait' }
  }

  html2pdf().set(opt).from(element).save()
}

const getCurrentTimePosition = () => {
  const hour = currentTime.value.getHours()
  const minute = currentTime.value.getMinutes()
  const startHour = 6
  if (hour < startHour || hour > 23) return null
  const hourSlotHeight = getHourSlotHeight()
  const top = (hour - startHour) * hourSlotHeight + minute * (hourSlotHeight / 60)
  return { top, display: true }
}

const getAllTasksForDay = (date: Date) => {
  const dateKey = formatDate(date)
  return store.getTasksForDate(dateKey).sort((a: any, b: any) => a.time.localeCompare(b.time))
}

const getTaskCountForDate = (date: Date) => {
  const dateKey = formatDate(date)
  return store.getTasksForDate(dateKey).length
}

const getMeetingCountForDate = (date: Date) => {
  const dateKey = formatDate(date)
  return store.getTasksForDate(dateKey).filter((task: any) => task.meetingUrl).length
}

// Lifecycle
onMounted(async () => {
  if (!store.synced) {
    await store.loadUserTasks()
  }

  checkDayChange()

  setInterval(() => {
    currentTime.value = new Date()
    checkAndCompletePassedTasks()
    checkUpcomingTasks()
  }, 1000)

  setInterval(checkDayChange, 60000)
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4 sm:p-6 lg:p-8 transition-colors duration-300">
    <div class="max-w-7xl mx-auto">
      <!-- Page Header -->
      <div class="mb-6">
        <h1 class="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2">
          📅 Calendar
        </h1>
        <p class="text-gray-600 dark:text-gray-400">
          Manage your schedule and tasks
        </p>
      </div>

      <!-- Calendar Container -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden transition-colors duration-300">
        <div class="p-4 sm:p-6">
          <!-- Calendar View -->
          <div class="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 transition-colors duration-300 mb-6">
            <!-- View Controls -->
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <!-- View Switcher -->
              <div class="flex gap-2 w-full sm:w-auto">
                <button
                  @click="calendarView = 'day'"
                  :class="[
                    'flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all',
                    calendarView === 'day'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-500'
                  ]"
                >
                  Day
                </button>
                <button
                  @click="calendarView = 'week'"
                  :class="[
                    'flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all',
                    calendarView === 'week'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-500'
                  ]"
                >
                  Week
                </button>
                <button
                  @click="calendarView = 'month'"
                  :class="[
                    'flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all',
                    calendarView === 'month'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-500'
                  ]"
                >
                  Month
                </button>
              </div>

              <!-- Month Navigation -->
              <div class="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                <button
                  @click="changeMonth(-1)"
                  class="p-2 rounded-lg bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-500 transition-colors shadow-sm"
                >
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <h2 class="text-lg font-bold text-gray-800 dark:text-gray-100 min-w-[200px] text-center">
                  {{ calendarTitle }}
                </h2>
                <button
                  @click="changeMonth(1)"
                  class="p-2 rounded-lg bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-500 transition-colors shadow-sm"
                >
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Month View -->
            <template v-if="calendarView === 'month'">
              <div class="grid grid-cols-7 gap-2 mb-2">
                <div
                  v-for="day in weekDays"
                  :key="day"
                  class="text-center text-sm font-semibold text-gray-500 dark:text-gray-400 p-2"
                >
                  {{ day }}
                </div>
              </div>

              <div class="grid grid-cols-7 gap-2">
                <button
                  v-for="(day, index) in displayedCalendarDays"
                  :key="index"
                  @click="day && handleDateClick(day)"
                  :disabled="!day"
                  :class="[
                    'min-h-20 p-2 rounded-lg text-sm font-medium cursor-pointer bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 transition-all relative flex flex-col items-start justify-start border border-gray-200 dark:border-gray-600',
                    {
                      'hover:bg-gray-50 dark:hover:bg-gray-600': day && !isDateDisabled(day),
                      'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500':
                        day && isDateDisabled(day),
                      'ring-2 ring-blue-500 dark:ring-blue-400':
                        selectedDate && day && formatDate(day) === formatDate(selectedDate),
                      'bg-blue-50/60 dark:bg-blue-900/40':
                        selectedDate && day && formatDate(day) === formatDate(selectedDate),
                      'bg-blue-50 dark:bg-blue-900/30':
                        day &&
                        !isDateDisabled(day) &&
                        formatDate(day) === todayFormatted &&
                        !(selectedDate && formatDate(day) === formatDate(selectedDate))
                    }
                  ]"
                >
                  <template v-if="day">
                    <div class="flex items-center justify-between w-full">
                      <span
                        :class="[
                          'text-sm font-semibold',
                          formatDate(day) === todayFormatted
                            ? 'text-blue-600 dark:text-blue-300'
                            : 'text-gray-700 dark:text-gray-200'
                        ]"
                      >
                        {{ day.getDate() }}
                      </span>
                      <span
                        v-if="getTaskCountForDate(day)"
                        class="ml-auto px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-800 text-[10px] font-semibold text-blue-700 dark:text-blue-200"
                      >
                        {{ getTaskCountForDate(day) }}
                      </span>
                    </div>

                    <div
                      v-if="getTaskCountForDate(day)"
                      class="mt-1 text-[10px] font-medium text-gray-500 dark:text-gray-300 truncate w-full flex items-center gap-1"
                    >
                      <span>
                        {{ getTaskCountForDate(day) }}
                        <span class="hidden sm:inline">task</span>
                        <span v-if="getTaskCountForDate(day) > 1" class="hidden sm:inline">s</span>
                      </span>
                      <span v-if="getMeetingCountForDate(day)" class="text-blue-600 dark:text-blue-300">
                        <span class="hidden sm:inline">· </span>
                        {{ getMeetingCountForDate(day) }}
                        <span class="hidden sm:inline">meeting</span>
                        <span v-if="getMeetingCountForDate(day) > 1" class="hidden sm:inline">s</span>
                      </span>
                    </div>
                  </template>
                </button>
              </div>
            </template>

            <!-- Week View - Teams Calendar Style -->
            <template v-else-if="calendarView === 'week'">
              <!-- Week header with days -->
              <div class="flex border-b-2 border-gray-200 dark:border-gray-700 overflow-x-auto bg-white dark:bg-gray-800 rounded-t-lg">
                <div class="w-20 flex-shrink-0 border-r border-gray-200 dark:border-gray-700"></div>
                <div class="flex-1 grid grid-cols-7 min-w-[600px] sm:min-w-0">
                  <template v-for="(day, index) in weekCalendarDays" :key="index">
                    <div
                      v-if="day"
                      @click="handleDateClick(day)"
                      :class="[
                        'p-4 text-center border-r border-gray-200 dark:border-gray-700 cursor-pointer transition-all',
                        formatDate(day) === todayFormatted
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-b-2 border-b-blue-500 dark:border-b-blue-400'
                          : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50',
                        selectedDate && formatDate(day) === formatDate(selectedDate)
                          ? 'ring-2 ring-blue-500 dark:ring-blue-400 bg-blue-50 dark:bg-blue-900/20'
                          : ''
                      ]"
                    >
                      <div class="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wide">
                        {{ weekDays[day.getDay()] }}
                      </div>
                      <div
                        :class="[
                          'text-2xl font-bold',
                          formatDate(day) === todayFormatted
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-gray-900 dark:text-gray-100'
                        ]"
                      >
                        {{ day.getDate() }}
                      </div>
                    </div>
                  </template>
                </div>
              </div>

              <!-- Week time slots -->
              <div class="flex overflow-x-auto bg-white dark:bg-gray-800 rounded-b-lg max-h-[600px] overflow-y-auto">
                <!-- Time column -->
                <div class="w-20 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  <div
                    v-for="hour in timeSlots"
                    :key="hour"
                    class="h-20 border-b border-gray-200 dark:border-gray-700 relative"
                  >
                    <div class="text-xs font-medium text-gray-600 dark:text-gray-400 absolute top-0 right-2 pr-2 -mt-3">
                      {{ formatHour(hour) }}
                    </div>
                  </div>
                </div>

                <!-- Days columns -->
                <div class="flex-1 grid grid-cols-7 min-w-[600px] sm:min-w-0">
                  <template v-for="(day, dayIndex) in weekCalendarDays" :key="dayIndex">
                    <div
                      v-if="day"
                      class="relative border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                      :class="{
                        'bg-blue-50/30 dark:bg-blue-900/10': formatDate(day) === todayFormatted
                      }"
                    >
                      <!-- Hour slots -->
                      <div
                        v-for="hour in timeSlots"
                        :key="hour"
                        class="hour-slot h-20 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors relative group"
                        @click="handleDateClick(day)"
                      >
                        <div class="absolute left-0 top-0 bottom-0 w-0.5 bg-transparent group-hover:bg-blue-400 dark:group-hover:bg-blue-500 transition-colors"></div>
                      </div>

                      <!-- Current time indicator -->
                      <div
                        v-if="formatDate(day) === todayFormatted && getCurrentTimePosition()?.display"
                        :style="{
                          position: 'absolute',
                          top: `${getCurrentTimePosition()?.top}px`,
                          left: '0',
                          right: '0',
                          zIndex: 20,
                          pointerEvents: 'none'
                        }"
                        class="flex items-center"
                      >
                        <div class="w-2 h-2 rounded-full bg-red-500 dark:bg-red-400 -ml-1 flex-shrink-0"></div>
                        <div class="flex-1 h-0.5 bg-red-500 dark:bg-red-400"></div>
                      </div>

                      <!-- Tasks -->
                      <div
                        v-for="task in getAllTasksForDay(day)"
                        :key="task.id"
                        :style="{
                          position: 'absolute',
                          top: `${getTaskPosition(task.time, getHourSlotHeight()).top}px`,
                          height: `${Math.max(getTaskPosition(task.time, getHourSlotHeight()).height * 0.85, 50)}px`,
                          left: '4px',
                          right: '4px',
                          zIndex: 10
                        }"
                        :class="[
                          'rounded-md px-2 py-1 text-[10px] font-medium cursor-pointer overflow-hidden shadow-md hover:shadow-lg transition-all border-l-4',
                          task.meetingUrl
                            ? 'bg-blue-500 dark:bg-blue-600 text-white border-l-blue-700 dark:border-l-blue-400'
                            : task.completed
                            ? 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 border-l-gray-400 dark:border-l-gray-500 opacity-75'
                            : 'bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100 border-l-blue-500 dark:border-l-blue-400'
                        ]"
                        @click.stop="handleDateClick(day)"
                      >
                        <div class="font-bold truncate mb-0.5">{{ task.time }} - {{ task.endTime || '...' }}</div>
                        <div class="truncate font-semibold">{{ task.title }}</div>
                        <div v-if="task.description" class="text-[8px] opacity-80 truncate mt-0.5 hidden sm:block">
                          {{ task.description }}
                        </div>
                      </div>
                    </div>
                  </template>
                </div>
              </div>
            </template>

            <!-- Day View - Teams Calendar Style -->
            <template v-else-if="calendarView === 'day'">
              <div v-if="selectedDate" class="flex border-b-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-t-lg">
                <div class="w-20 flex-shrink-0 border-r border-gray-200 dark:border-gray-700"></div>
                <div
                  class="flex-1 p-6 text-center border-l border-gray-200 dark:border-gray-700"
                  :class="[
                    formatDate(selectedDate) === todayFormatted
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-b-2 border-b-blue-500 dark:border-b-blue-400'
                      : 'bg-white dark:bg-gray-800'
                  ]"
                >
                  <div class="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wide">
                    {{ weekDays[selectedDate.getDay()] }}
                  </div>
                  <div
                    :class="[
                      'text-5xl font-bold',
                      formatDate(selectedDate) === todayFormatted
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-900 dark:text-gray-100'
                    ]"
                  >
                    {{ selectedDate.getDate() }}
                  </div>
                  <div class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {{ formatDate(selectedDate) }}
                  </div>
                </div>
              </div>

              <div v-if="selectedDate" class="flex overflow-x-auto bg-white dark:bg-gray-800 rounded-b-lg max-h-[600px] overflow-y-auto">
                <!-- Time column -->
                <div class="w-20 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  <div
                    v-for="hour in timeSlots"
                    :key="hour"
                    class="h-20 border-b border-gray-200 dark:border-gray-700 relative"
                  >
                    <div class="text-xs font-medium text-gray-600 dark:text-gray-400 absolute top-0 right-2 pr-2 -mt-3">
                      {{ formatHour(hour) }}
                    </div>
                  </div>
                </div>

                <!-- Day column -->
                <div
                  class="flex-1 border-l border-gray-200 dark:border-gray-700 relative min-w-0"
                  :class="{
                    'bg-blue-50/30 dark:bg-blue-900/10': formatDate(selectedDate) === todayFormatted
                  }"
                >
                  <!-- Hour slots -->
                  <div
                    v-for="hour in timeSlots"
                    :key="hour"
                    class="hour-slot h-20 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors relative group"
                    @click="handleDateClick(selectedDate)"
                  >
                    <div class="absolute left-0 top-0 bottom-0 w-0.5 bg-transparent group-hover:bg-blue-400 dark:group-hover:bg-blue-500 transition-colors"></div>
                  </div>

                  <!-- Current time indicator -->
                  <div
                    v-if="formatDate(selectedDate) === todayFormatted && getCurrentTimePosition()?.display"
                    :style="{
                      position: 'absolute',
                      top: `${getCurrentTimePosition()?.top}px`,
                      left: '0',
                      right: '0',
                      zIndex: 20,
                      pointerEvents: 'none'
                    }"
                    class="flex items-center"
                  >
                    <div class="w-2.5 h-2.5 rounded-full bg-red-500 dark:bg-red-400 -ml-1.5 flex-shrink-0 shadow-lg"></div>
                    <div class="flex-1 h-0.5 bg-red-500 dark:bg-red-400 shadow-sm"></div>
                  </div>

                  <!-- Tasks -->
                  <div
                    v-for="task in getAllTasksForDay(selectedDate)"
                    :key="task.id"
                    :style="{
                      position: 'absolute',
                      top: `${getTaskPosition(task.time, getHourSlotHeight()).top}px`,
                      height: `${Math.max(getTaskPosition(task.time, getHourSlotHeight()).height * 0.9, 60)}px`,
                      left: '8px',
                      right: '8px',
                      zIndex: 10
                    }"
                    :class="[
                      'rounded-lg px-4 py-3 text-sm font-medium cursor-pointer overflow-hidden shadow-lg hover:shadow-xl transition-all border-l-4',
                      task.meetingUrl
                        ? 'bg-blue-500 dark:bg-blue-600 text-white border-l-blue-700 dark:border-l-blue-400'
                        : task.completed
                        ? 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 border-l-gray-400 dark:border-l-gray-500 opacity-75'
                        : 'bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100 border-l-blue-500 dark:border-l-blue-400'
                    ]"
                    @click.stop="handleDateClick(selectedDate)"
                  >
                    <div class="flex items-center justify-between mb-1.5">
                      <div class="font-bold text-base">{{ task.time }} - {{ task.endTime || '...' }}</div>
                      <div v-if="task.meetingUrl" class="flex items-center gap-1">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                        </svg>
                        <span class="text-xs font-semibold">Meeting</span>
                      </div>
                    </div>
                    <div class="font-bold text-lg mb-1 truncate">{{ task.title }}</div>
                    <div v-if="task.description" class="text-xs opacity-90 line-clamp-2">
                      {{ task.description }}
                    </div>
                  </div>
                </div>
              </div>

              <div v-else class="flex items-center justify-center py-16 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg">
                <div class="text-center">
                  <svg class="w-20 h-20 stroke-2 opacity-50 mb-4 mx-auto text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <p class="text-base font-medium">Select a date to view</p>
                </div>
              </div>
            </template>
          </div>

          <!-- Task Management Section -->
          <div v-if="selectedDate" class="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 transition-colors duration-300">
            <div class="flex justify-between items-center mb-4 flex-wrap gap-2">
              <h2 class="text-xl font-bold text-gray-800 dark:text-gray-100">{{ formatDate(selectedDate) }}</h2>
              <div class="flex gap-2">
                <button
                  v-if="!isDateDisabled(selectedDate)"
                  @click="showReport = true"
                  class="flex items-center gap-2 px-4 py-2 bg-violet-600 dark:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors hover:bg-violet-700 dark:hover:bg-violet-600 shadow-sm hover:shadow-md"
                >
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                  <span>End Day Report</span>
                </button>
                <button
                  v-if="!isDateDisabled(selectedDate)"
                  @click="showAddForm = true"
                  class="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors hover:bg-blue-700 dark:hover:bg-blue-600 shadow-sm hover:shadow-lg"
                >
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>Add Task</span>
                </button>
              </div>
            </div>

            <!-- Todo List Toggle -->
            <div class="flex gap-2 mb-4">
              <button
                @click="showTodoList = !showTodoList"
                :class="[
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                  showTodoList
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200'
                ]"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
                Kanban Board
              </button>
            </div>

            <!-- Kanban Board View -->
            <div v-if="showTodoList" class="mb-4">
              <div class="flex gap-4 overflow-x-auto pb-2" style="scrollbar-width: thin">
                <div
                  v-for="column in columns"
                  :key="column.id"
                  @dragover="handleColumnDragOver($event, column.id)"
                  @dragleave="handleColumnDragLeave"
                  @drop="handleDrop($event, undefined, column.id)"
                  :class="[
                    'flex-shrink-0 w-80 bg-gray-100 dark:bg-gray-800 rounded-lg p-3 transition-colors',
                    draggedOverColumn === column.id ? 'ring-2 ring-blue-500 dark:ring-blue-400 bg-gray-200 dark:bg-gray-700' : ''
                  ]"
                >
                  <!-- Column Header -->
                  <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center gap-2">
                      <div
                        :class="[
                          'w-3 h-3 rounded-full',
                          column.color === 'blue' ? 'bg-blue-500' : '',
                          column.color === 'emerald' ? 'bg-emerald-500' : '',
                          column.color === 'gray' ? 'bg-gray-500' : ''
                        ]"
                      ></div>
                      <h3 class="text-base font-semibold text-gray-700 dark:text-gray-300">
                        {{ column.title }}
                      </h3>
                      <span class="px-2 py-0.5 rounded-full bg-gray-300 dark:bg-gray-700 text-xs font-medium text-gray-600 dark:text-gray-400">
                        {{ getTasksForColumn(column.id).length }}
                      </span>
                    </div>
                  </div>

                  <!-- Column Drop Zone -->
                  <div
                    class="min-h-[200px] max-h-[600px] overflow-y-auto space-y-2"
                    :class="[
                      draggedOverColumn === column.id ? 'bg-blue-50/50 dark:bg-blue-900/20 rounded p-2' : ''
                    ]"
                  >
                    <!-- Empty State -->
                    <div
                      v-if="getTasksForColumn(column.id).length === 0"
                      class="text-center py-8 text-gray-400 dark:text-gray-500 text-sm"
                    >
                      Drop tasks here
                    </div>

                    <!-- Task Cards -->
                    <div
                      v-for="task in getTasksForColumn(column.id)"
                      :key="task.id"
                      draggable="true"
                      @dragstart="handleDragStart($event, task.id)"
                      @dragover="handleDragOver($event, task.id)"
                      @dragleave="handleDragLeave"
                      @drop="handleDrop($event, task.id)"
                      @dragend="handleDragEnd"
                      :class="[
                        'bg-white dark:bg-gray-700 rounded-lg shadow-sm p-3 cursor-move transition-all hover:shadow-md',
                        draggedTaskId === task.id ? 'opacity-50 rotate-2' : '',
                        draggedOverTaskId === task.id ? 'ring-2 ring-blue-500 dark:ring-blue-400' : '',
                        column.id === 'ended' ? 'opacity-75' : ''
                      ]"
                    >
                      <!-- Card Header -->
                      <div class="flex items-start justify-between gap-2 mb-2">
                        <div class="flex-1 min-w-0">
                          <h4
                            :class="[
                              'text-base font-semibold text-gray-800 dark:text-gray-100 mb-1 break-words',
                              task.completed || column.id === 'ended' ? 'line-through opacity-75' : ''
                            ]"
                          >
                            {{ task.title }}
                          </h4>
                          <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
                            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 16 14" />
                            </svg>
                            <span>{{ task.time }} - {{ task.endTime || '...' }}</span>
                          </div>
                        </div>
                        <div class="flex items-center">
                          <button
                            v-if="!isDateDisabled(selectedDate)"
                            @click.stop="handleEditTask(task)"
                            class="p-1 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-all flex-shrink-0 opacity-60 hover:opacity-100"
                          >
                            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            v-if="!isDateDisabled(selectedDate)"
                            @click.stop="deleteTaskItem(task.id)"
                            class="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-all flex-shrink-0 opacity-60 hover:opacity-100"
                          >
                            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      <!-- Card Description -->
                      <p v-if="task.description" class="text-sm text-gray-600 dark:text-gray-400 mb-2 break-words line-clamp-2">
                        {{ task.description }}
                      </p>

                      <!-- Card Footer -->
                      <div class="flex items-center justify-between mt-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                        <div class="flex items-center gap-2">
                          <button
                            @click.stop="toggleComplete(task.id)"
                            :disabled="isDateDisabled(selectedDate)"
                            :class="[
                              'w-4 h-4 border-2 rounded flex items-center justify-center cursor-pointer transition-all',
                              task.completed
                                ? 'bg-emerald-500 dark:bg-emerald-600 border-emerald-500 dark:border-emerald-600'
                                : 'bg-transparent border-gray-300 dark:border-gray-500 hover:border-emerald-500 dark:hover:border-emerald-400',
                              { 'cursor-not-allowed opacity-50': isDateDisabled(selectedDate) }
                            ]"
                          >
                            <svg v-if="task.completed" class="w-2.5 h-2.5 stroke-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </button>
                          <span
                            v-if="isNextTask(task.id) && formatDate(selectedDate) === todayFormatted && column.id === 'willStart'"
                            class="px-1.5 py-0.5 bg-blue-500 dark:bg-blue-600 text-white text-[10px] font-bold rounded"
                          >
                            NEXT
                          </span>
                          <span
                            v-if="isCurrentTask(task.id) && formatDate(selectedDate) === todayFormatted && column.id === 'workedOn'"
                            class="px-1.5 py-0.5 bg-emerald-500 dark:bg-emerald-600 text-white text-[10px] font-bold rounded"
                          >
                            ACTIVE
                          </span>
                        </div>
                        <div v-if="task.meetingUrl" class="flex items-center gap-1">
                          <span
                            v-if="task.meetingType === 'google'"
                            class="px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-[10px] font-semibold text-green-700 dark:text-green-200"
                          >
                            Meet
                          </span>
                          <span
                            v-else-if="task.meetingType === 'teams'"
                            class="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-[10px] font-semibold text-blue-700 dark:text-blue-200"
                          >
                            Teams
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Empty State -->
              <div
                v-if="categorizedTasks.workedOn.length === 0 && categorizedTasks.willStart.length === 0 && categorizedTasks.ended.length === 0"
                class="text-center py-12 px-4 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <svg class="w-12 h-12 stroke-2 opacity-50 mb-3 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                  <line x1="15" y1="3" x2="15" y2="21" />
                </svg>
                <p class="text-base font-medium">No tasks yet</p>
                <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Add a task to get started</p>
              </div>
            </div>

            <!-- Simple List View -->
            <div v-else class="max-h-96 overflow-y-auto">
              <div v-if="currentTasks.length === 0" class="text-center py-12 px-4 text-gray-500 dark:text-gray-400">
                <svg class="w-12 h-12 stroke-2 opacity-50 mb-2 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <p class="text-base">No tasks scheduled</p>
              </div>

              <div
                v-for="task in currentTasks"
                :key="task.id"
                :class="[
                  'bg-white dark:bg-gray-600 p-4 rounded-lg mb-3 shadow-sm flex justify-between items-start transition-colors duration-300',
                  { 'opacity-60': task.completed },
                  {
                    'ring-2 ring-emerald-500 dark:ring-emerald-400 bg-emerald-50 dark:bg-emerald-900/20':
                      isCurrentTask(task.id) && formatDate(selectedDate) === todayFormatted
                  },
                  {
                    'ring-2 ring-blue-500 dark:ring-blue-400 bg-blue-50 dark:bg-blue-900/20':
                      isNextTask(task.id) && formatDate(selectedDate) === todayFormatted
                  }
                ]"
              >
                <div class="flex gap-3 flex-1 min-w-0">
                  <button
                    @click="toggleComplete(task.id)"
                    :disabled="isDateDisabled(selectedDate)"
                    :class="[
                      'w-5 h-5 min-w-5 border-2 rounded flex items-center justify-center cursor-pointer transition-all mt-1 flex-shrink-0',
                      task.completed
                        ? 'bg-emerald-500 dark:bg-emerald-600 border-emerald-500 dark:border-emerald-600'
                        : 'bg-transparent border-gray-300 dark:border-gray-400 hover:border-emerald-500 dark:hover:border-emerald-400',
                      { 'cursor-not-allowed': isDateDisabled(selectedDate) }
                    ]"
                  >
                    <svg v-if="task.completed" class="w-3 h-3 stroke-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </button>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap mb-1">
                      <div class="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-sm font-semibold">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <span>{{ task.time }} - {{ task.endTime || '...' }}</span>
                      </div>
                      <span
                        v-if="isNextTask(task.id) && formatDate(selectedDate) === todayFormatted"
                        class="px-2 py-0.5 bg-blue-500 dark:bg-blue-600 text-white text-[10px] font-bold rounded"
                      >
                        UP NEXT
                      </span>
                      <span
                        v-if="isCurrentTask(task.id) && formatDate(selectedDate) === todayFormatted"
                        class="px-2 py-0.5 bg-emerald-500 dark:bg-emerald-600 text-white text-[10px] font-bold rounded"
                      >
                        ACTIVE NOW
                      </span>
                    </div>
                    <h3
                      :class="[
                        'text-base font-semibold text-gray-800 dark:text-gray-100 mb-1',
                        { 'line-through': task.completed }
                      ]"
                    >
                      {{ task.title }}
                    </h3>
                    <p v-if="task.description" class="text-sm text-gray-600 dark:text-gray-300 mb-2">
                      {{ task.description }}
                    </p>
                    <div v-if="task.meetingUrl" class="flex items-center gap-2 mt-2">
                      <span
                        v-if="task.meetingType === 'google'"
                        class="px-2 py-1 rounded bg-green-100 dark:bg-green-900/40 text-xs font-semibold text-green-700 dark:text-green-200"
                      >
                        📹 Google Meet
                      </span>
                      <span
                        v-else-if="task.meetingType === 'teams'"
                        class="px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/40 text-xs font-semibold text-blue-700 dark:text-blue-200"
                      >
                        📹 Teams
                      </span>
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    v-if="!isDateDisabled(selectedDate)"
                    @click="handleEditTask(task)"
                    class="p-2 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-all"
                  >
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    v-if="!isDateDisabled(selectedDate)"
                    @click="deleteTaskItem(task.id)"
                    class="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-all"
                  >
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
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

.hour-slot {
  animation: slideIn 0.2s ease-out;
}
</style>
