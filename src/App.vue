<template>
  <div class="app">
    <div class="container">
      <div class="card">
        <!-- Header -->
        <div class="header">
          <div class="header-content">
            <div class="header-title">
              <svg class="icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <h1>Schedule Manager</h1>
            </div>
            <div class="today-date">Today: {{ todayFormatted }}</div>
          </div>
        </div>

        <div class="content-grid">
          <!-- Calendar View -->
          <div class="calendar-section">
            <div class="calendar-card">
              <div class="calendar-header">
                <button @click="changeMonth(-1)" class="nav-btn">
                  <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                </button>
                <h2>{{ monthName }} {{ currentYear }}</h2>
                <button @click="changeMonth(1)" class="nav-btn">
                  <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              </div>

              <div class="weekdays">
                <div v-for="day in weekDays" :key="day" class="weekday">{{ day }}</div>
              </div>

              <div class="calendar-grid">
                <button
                  v-for="(day, index) in calendarDays"
                  :key="index"
                  @click="day && handleDateClick(day)"
                  :disabled="!day || isDateDisabled(day)"
                  :class="getDayClass(day)"
                  class="day-cell"
                >
                  <span v-if="day">{{ day.getDate() }}</span>
                  <div v-if="day && hasTasksOnDate(day)" class="task-indicator"></div>
                </button>
              </div>
            </div>
          </div>

          <!-- Day Detail View -->
          <div class="detail-section">
            <div v-if="selectedDate" class="detail-card">
              <div class="detail-header">
                <h2>{{ formatDate(selectedDate) }}</h2>
                <button
                  v-if="!isDateDisabled(selectedDate)"
                  @click="showAddForm = !showAddForm"
                  class="add-btn"
                >
                  <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Add Task
                </button>
              </div>

              <!-- Add Task Form -->
              <div v-if="showAddForm" class="add-form">
                <input
                  v-model="newTask.title"
                  type="text"
                  placeholder="Task title"
                  class="input"
                />
                <input
                  v-model="newTask.time"
                  type="time"
                  class="input"
                />
                <textarea
                  v-model="newTask.description"
                  placeholder="Description (optional)"
                  class="textarea"
                  rows="3"
                ></textarea>
                <div class="form-actions">
                  <button @click="handleAddTask" class="btn-save">Save</button>
                  <button @click="showAddForm = false" class="btn-cancel">Cancel</button>
                </div>
              </div>

              <!-- Tasks List -->
              <div class="tasks-list">
                <div v-if="currentTasks.length === 0" class="empty-state">
                  <svg class="icon-xl" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <p>No tasks scheduled</p>
                </div>

                <div
                  v-for="task in currentTasks"
                  :key="task.id"
                  :class="['task-item', { completed: task.completed }]"
                >
                  <div class="task-content">
                    <button
                      @click="toggleComplete(task.id)"
                      :disabled="isDateDisabled(selectedDate)"
                      :class="['checkbox', { checked: task.completed }]"
                    >
                      <svg v-if="task.completed" class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </button>
                    <div class="task-details">
                      <div class="task-time">
                        <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <circle cx="12" cy="12" r="10"/>
                          <polyline points="12 6 12 12 16 14"/>
                        </svg>
                        <span>{{ task.time }}</span>
                      </div>
                      <h3 :class="{ 'line-through': task.completed }">{{ task.title }}</h3>
                      <p v-if="task.description" class="task-desc">{{ task.description }}</p>
                    </div>
                  </div>
                  <button
                    v-if="!isDateDisabled(selectedDate)"
                    @click="deleteTaskItem(task.id)"
                    class="delete-btn"
                  >
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              </div>

              <div v-if="isDateDisabled(selectedDate)" class="warning">
                This date is in the past. Viewing only.
              </div>
            </div>

            <div v-else class="empty-detail">
              <svg class="icon-xxl" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <p>Select a date to view or add tasks</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import { useScheduleStore } from './stores/store';

export default {
  name: 'ScheduleApp',
  
  setup() {
    const store = useScheduleStore()
    
    const currentDate = ref(new Date())
    const selectedDate = ref(null)
    const showAddForm = ref(false)
    const newTask = ref({
      title: '',
      time: '09:00',
      description: '',
      completed: false
    })
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December']
    
    const formatDate = (date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    
    const isDateDisabled = (date) => {
      const checkDate = new Date(date)
      checkDate.setHours(0, 0, 0, 0)
      return checkDate < today
    }
    
    const calendarDays = computed(() => {
      const year = currentDate.value.getFullYear()
      const month = currentDate.value.getMonth()
      const firstDay = new Date(year, month, 1)
      const lastDay = new Date(year, month + 1, 0)
      const daysInMonth = lastDay.getDate()
      const startingDayOfWeek = firstDay.getDay()
      
      const days = []
      for (let i = 0; i < startingDayOfWeek; i++) {
        days.push(null)
      }
      for (let i = 1; i <= daysInMonth; i++) {
        days.push(new Date(year, month, i))
      }
      return days
    })
    
    const monthName = computed(() => monthNames[currentDate.value.getMonth()])
    const currentYear = computed(() => currentDate.value.getFullYear())
    const todayFormatted = computed(() => formatDate(today))
    
    const currentTasks = computed(() => {
      if (!selectedDate.value) return []
      const dateKey = formatDate(selectedDate.value)
      return store.getTasksForDate(dateKey).sort((a, b) => a.time.localeCompare(b.time))
    })
    
    const hasTasksOnDate = (date) => {
      const dateKey = formatDate(date)
      return store.getTasksForDate(dateKey).length > 0
    }
    
    const getDayClass = (day) => {
      if (!day) return ''
      
      const dateKey = formatDate(day)
      const isToday = dateKey === todayFormatted.value
      const isSelected = selectedDate.value && dateKey === formatDate(selectedDate.value)
      const disabled = isDateDisabled(day)
      const hasTasks = hasTasksOnDate(day)
      
      return {
        disabled,
        today: isToday,
        selected: isSelected,
        'has-tasks': hasTasks
      }
    }
    
    const changeMonth = (delta) => {
      currentDate.value = new Date(
        currentDate.value.getFullYear(),
        currentDate.value.getMonth() + delta,
        1
      )
    }
    
    const handleDateClick = (date) => {
      if (!isDateDisabled(date)) {
        selectedDate.value = date
        showAddForm.value = false
      }
    }
    
    const handleAddTask = () => {
      if (!newTask.value.title || !selectedDate.value) return
      
      const dateKey = formatDate(selectedDate.value)
      store.addTask(dateKey, { ...newTask.value })
      
      newTask.value = {
        title: '',
        time: '09:00',
        description: '',
        completed: false
      }
      showAddForm.value = false
    }
    
    const toggleComplete = (taskId) => {
      const dateKey = formatDate(selectedDate.value)
      store.toggleTaskComplete(dateKey, taskId)
    }
    
    const deleteTaskItem = (taskId) => {
      const dateKey = formatDate(selectedDate.value)
      store.deleteTask(dateKey, taskId)
    }
    
    return {
      currentDate,
      selectedDate,
      showAddForm,
      newTask,
      weekDays,
      calendarDays,
      monthName,
      currentYear,
      todayFormatted,
      currentTasks,
      formatDate,
      isDateDisabled,
      hasTasksOnDate,
      getDayClass,
      changeMonth,
      handleDateClick,
      handleAddTask,
      toggleComplete,
      deleteTaskItem
    }
  }
}
</script>

<style>
.app {
  min-height: 100vh;
  background: linear-gradient(135deg, #EFF6FF 0%, #E0E7FF 100%);
  padding: 1rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}

.card {
  background: white;
  border-radius: 1.5rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.header {
  background: linear-gradient(135deg, #2563EB 0%, #4F46E5 100%);
  padding: 1.5rem;
  color: white;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-title h1 {
  font-size: 1.875rem;
  font-weight: 700;
}

.today-date {
  font-size: 0.875rem;
  opacity: 0.9;
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  padding: 1.5rem;
}

@media (max-width: 768px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
}

.calendar-section, .detail-section {
  min-height: 400px;
}

.calendar-card, .detail-card {
  background: #F9FAFB;
  border-radius: 1rem;
  padding: 1rem;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.calendar-header h2 {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1F2937;
}

.nav-btn {
  background: transparent;
  border: none;
  padding: 0.5rem;
  cursor: pointer;
  border-radius: 0.5rem;
  transition: background 0.2s;
}

.nav-btn:hover {
  background: #E5E7EB;
}

.weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.weekday {
  text-align: center;
  font-size: 0.875rem;
  font-weight: 600;
  color: #6B7280;
  padding: 0.5rem;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.5rem;
}

.day-cell {
  aspect-ratio: 1;
  padding: 0.5rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  border: none;
  cursor: pointer;
  background: white;
  color: #374151;
  transition: all 0.2s;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.day-cell:hover:not(:disabled) {
  background: #E5E7EB;
}

.day-cell.disabled {
  background: #F3F4F6;
  color: #9CA3AF;
  cursor: not-allowed;
}

.day-cell.today {
  background: #E0E7FF;
  color: #4338CA;
  font-weight: 600;
}

.day-cell.selected {
  background: #2563EB;
  color: white;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
}

.day-cell.has-tasks:not(.selected) {
  background: #DBEAFE;
  color: #1E40AF;
}

.task-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #2563EB;
  margin-top: 2px;
}

.day-cell.selected .task-indicator {
  background: white;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.detail-header h2 {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1F2937;
}

.add-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #2563EB;
  color: white;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;
}

.add-btn:hover {
  background: #1D4ED8;
}

.add-form {
  background: white;
  padding: 1rem;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.input, .textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #D1D5DB;
  border-radius: 0.5rem;
  margin-bottom: 0.75rem;
  font-family: inherit;
  font-size: 0.875rem;
}

.input:focus, .textarea:focus {
  outline: none;
  border-color: #2563EB;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.form-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-save, .btn-cancel {
  flex: 1;
  padding: 0.75rem;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-save {
  background: #10B981;
  color: white;
}

.btn-save:hover {
  background: #059669;
}

.btn-cancel {
  background: #E5E7EB;
  color: #374151;
}

.btn-cancel:hover {
  background: #D1D5DB;
}

.tasks-list {
  max-height: 400px;
  overflow-y: auto;
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: #6B7280;
}

.empty-detail {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 400px;
  color: #6B7280;
  text-align: center;
}

.task-item {
  background: white;
  padding: 1rem;
  border-radius: 0.5rem;
  margin-bottom: 0.75rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.task-item.completed {
  opacity: 0.6;
}

.task-content {
  display: flex;
  gap: 0.75rem;
  flex: 1;
}

.checkbox {
  width: 20px;
  height: 20px;
  min-width: 20px;
  border: 2px solid #D1D5DB;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  margin-top: 4px;
}

.checkbox:hover:not(:disabled) {
  border-color: #10B981;
}

.checkbox.checked {
  background: #10B981;
  border-color: #10B981;
}

.checkbox:disabled {
  cursor: not-allowed;
}

.check-icon {
  width: 12px;
  height: 12px;
  stroke-width: 3;
}

.task-details {
  flex: 1;
}

.task-time {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: #6B7280;
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.task-details h3 {
  font-size: 1rem;
  font-weight: 600;
  color: #1F2937;
  margin-bottom: 0.25rem;
}

.line-through {
  text-decoration: line-through;
}

.task-desc {
  font-size: 0.875rem;
  color: #6B7280;
  margin-top: 0.25rem;
}

.delete-btn {
  background: transparent;
  border: none;
  padding: 0.25rem;
  color: #EF4444;
  cursor: pointer;
  border-radius: 0.25rem;
  transition: background 0.2s;
}

.delete-btn:hover {
  background: #FEE2E2;
}

.warning {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #FEF3C7;
  border: 1px solid #FDE68A;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  color: #92400E;
}

.icon {
  width: 20px;
  height: 20px;
  stroke-width: 2;
}

.icon-sm {
  width: 16px;
  height: 16px;
  stroke-width: 2;
}

.icon-lg {
  width: 32px;
  height: 32px;
  stroke-width: 2;
}

.icon-xl {
  width: 48px;
  height: 48px;
  stroke-width: 2;
  opacity: 0.5;
  margin-bottom: 0.5rem;
}

.icon-xxl {
  width: 64px;
  height: 64px;
  stroke-width: 2;
  opacity: 0.5;
  margin-bottom: 1rem;
}
</style>
