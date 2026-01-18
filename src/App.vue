<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useScheduleStore } from './stores/store';

    const store = useScheduleStore()
    
    // Load user tasks from Firebase on mount
    onMounted(async () => {
      if (!store.synced) {
        await store.loadUserTasks()
      }
    })
    
    const currentDate: any = ref(new Date())
    const selectedDate: any = ref<Date | number>(new Date())
    const calendarView = ref<'day' | 'week' | 'month'>('month')
    const showAddForm: any = ref(false)
    const editingTaskId = ref<string | null>(null)
    const showTodoList = ref(true)
    const newTask: any = ref({
      title: '',
      time: '09:00',
      endTime: '10:00',
      description: '',
      completed: false,
      meetingType: 'none',
      meetingUrl: '',
      guestEmailsText: ''
    })
    
    // Timer state
    const currentTime = ref(new Date())
    const timerMinutes = ref(50)
    const timerSeconds = ref(0)
    const isTimerRunning = ref(false)
    const isBreakTime = ref(false)
    const timerInterval: any = ref(null)
    
    // Notification tracking
    const notifiedTasks = ref<Set<string>>(new Set())
    const lastBreakNotification = ref<number>(0)
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Create audio context for notification sounds
    const playNotificationSound = (type: 'break' | 'task' = 'task') => {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()
        
        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)
        
        if (type === 'break') {
          // Break sound: two-tone chime
          oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
          oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1)
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
          oscillator.start(audioContext.currentTime)
          oscillator.stop(audioContext.currentTime + 0.5)
        } else {
          // Task start sound: gentle beep
          oscillator.frequency.setValueAtTime(600, audioContext.currentTime)
          gainNode.gain.setValueAtTime(0.2, audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
          oscillator.start(audioContext.currentTime)
          oscillator.stop(audioContext.currentTime + 0.3)
        }
      } catch (error) {
        console.warn('Could not play notification sound:', error)
      }
    }
    
    // Check for upcoming tasks and play notification
    const checkUpcomingTasks = () => {
      const dateKey = todayFormatted.value
      const tasks = store.getTasksForDate(dateKey)
        .filter(task => !task.completed)
        .sort((a, b) => a.time.localeCompare(b.time))
      
      if (tasks.length === 0) return
      
      const currentTimeStr = getCurrentTimeString()
      const [currentHour, currentMin] = currentTimeStr.split(':').map(Number)
      const currentTotalMinutes = currentHour * 60 + currentMin
      
      tasks.forEach(task => {
        // Skip if already notified
        if (notifiedTasks.value.has(task.id)) return
        
        const [taskHour, taskMin] = task.time.split(':').map(Number)
        const taskTotalMinutes = taskHour * 60 + taskMin
        
        // Play sound exactly when task time is reached
        if (taskTotalMinutes === currentTotalMinutes) {
          playNotificationSound('task')
          notifiedTasks.value.add(task.id)
          
          // Show notification
          const message = `⏰ Task starting now: ${task.title}`
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Schedule Manager', { body: message })
          } else if ('Notification' in window && Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
              if (permission === 'granted') {
                new Notification('Schedule Manager', { body: message })
              }
            })
          }
        }
      })
    }
    
    // Update current time every second and check tasks
    setInterval(() => {
      currentTime.value = new Date()
      checkAndCompletePassedTasks()
      checkUpcomingTasks()
    }, 1000)
    
    const currentTimeFormatted = computed(() => {
      const hours = String(currentTime.value.getHours()).padStart(2, '0')
      const minutes = String(currentTime.value.getMinutes()).padStart(2, '0')
      const seconds = String(currentTime.value.getSeconds()).padStart(2, '0')
      return `${hours}:${minutes}:${seconds}`
    })
    
    // Get current time in HH:MM format for comparison
    const getCurrentTimeString = () => {
      const hours = String(currentTime.value.getHours()).padStart(2, '0')
      const minutes = String(currentTime.value.getMinutes()).padStart(2, '0')
      return `${hours}:${minutes}`
    }

    const getMinutesFromTime = (timeStr: string) => {
      if (!timeStr) return 0
      const [hours, minutes] = timeStr.split(':').map(Number)
      return hours * 60 + minutes
    }
    
    // Get current time position for indicator line (Teams-style)
    const getCurrentTimePosition = () => {
      const hour = currentTime.value.getHours()
      const minute = currentTime.value.getMinutes()
      const startHour = 6
      
      if (hour < startHour || hour > 23) return null
      
      const hourSlotHeight = getHourSlotHeight()
      const top = ((hour - startHour) * hourSlotHeight) + (minute * (hourSlotHeight / 60))
      
      return { top, display: true }
    }
    
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December']
    
    const formatDate = (date: Date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    
    // Reset notified tasks at the start of each day
    const checkDayChange = () => {
      const todayKey = formatDate(new Date())
      const storedDay = localStorage.getItem('lastNotificationDay')
      
      if (storedDay !== todayKey) {
        notifiedTasks.value.clear()
        localStorage.setItem('lastNotificationDay', todayKey)
      }
    }
    
    // Initialize day change check after formatDate is defined
    onMounted(() => {
      checkDayChange()
      // Check every minute for day change
      setInterval(checkDayChange, 60000)
    })
    
    const isDateDisabled = (date: Date) => {
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

    const getWeekStart = (date: Date) => {
      const d = new Date(date)
      const day = d.getDay()
      d.setDate(d.getDate() - day)
      d.setHours(0, 0, 0, 0)
      return d
    }

    const weekCalendarDays = computed(() => {
      const base = selectedDate.value || today
      const start = getWeekStart(base)
      const days: (Date | null)[] = []
      for (let i = 0; i < 7; i++) {
        const current = new Date(start)
        current.setDate(start.getDate() + i)
        days.push(current)
      }
      return days
    })

    const dayCalendarDays = computed(() => {
      if (!selectedDate.value) return []
      return [selectedDate.value]
    })

    const displayedCalendarDays = computed(() => {
      if (calendarView.value === 'month') return calendarDays.value
      if (calendarView.value === 'week') return weekCalendarDays.value
      if (calendarView.value === 'day') return dayCalendarDays.value
      return calendarDays.value
    })
    
    const monthName = computed(() => monthNames[currentDate.value.getMonth()])
    const currentYear = computed(() => currentDate.value.getFullYear())
    const todayFormatted = computed(() => formatDate(today))

    const calendarTitle = computed(() => {
      if (calendarView.value === 'month') {
        return `${monthName.value} ${currentYear.value}`
      }

      if (calendarView.value === 'week') {
        const base = selectedDate.value || today
        const start = getWeekStart(base)
        const end = new Date(start)
        end.setDate(start.getDate() + 6)
        return `Week ${formatDate(start)} - ${formatDate(end)}`
      }

      const base = selectedDate.value || today
      return `Day ${formatDate(base)}`
    })
    
    const currentTasks = computed(() => {
      if (!selectedDate.value) return []
      const dateKey = formatDate(selectedDate.value)
      const tasks = store.getTasksForDate(dateKey)
      // Sort by order first, then by time
      return tasks.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order
        }
        return a.time.localeCompare(b.time)
      })
    })

    // Categorize tasks for todo list
    const categorizedTasks = computed(() => {
      if (!selectedDate.value) return { workedOn: [], willStart: [], ended: [] }
      
      const dateKey = formatDate(selectedDate.value)
      const isToday = dateKey === todayFormatted.value
      const tasks = currentTasks.value
      const currentTimeStr = getCurrentTimeString()
      const currentMinutes = getMinutesFromTime(currentTimeStr)
      
      const workedOn: any[] = []
      const willStart: any[] = []
      const ended: any[] = []
      
      tasks.forEach(task => {
        const startMinutes = getMinutesFromTime(task.time)
        // Default duration 1 hour if endTime not present
        const endMinutes = task.endTime ? getMinutesFromTime(task.endTime) : startMinutes + 60

        if (task.completed) {
          workedOn.push(task)
        } else if (isToday) {
          // Check range
          if (currentMinutes > endMinutes) {
            ended.push(task)
          } else if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
            workedOn.push(task)
          } else {
            willStart.push(task)
          }
        } else {
          // For future dates, all non-completed tasks are "will start"
          willStart.push(task)
        }
      })
      
      return { workedOn, willStart, ended }
    })

    // Drag and drop state
    const draggedTaskId = ref<string | null>(null)
    const draggedOverTaskId = ref<string | null>(null)
    const draggedOverColumn = ref<string | null>(null)
    
    // Column definitions for Trello-style board
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
    
    // Get next upcoming task for today
    const nextTask = computed(() => {
      const dateKey = todayFormatted.value
      const tasks = store.getTasksForDate(dateKey)
        .filter(task => !task.completed)
        .sort((a, b) => a.time.localeCompare(b.time))
      
      const currentTimeStr = getCurrentTimeString()
      return tasks.find(task => task.time > currentTimeStr) || null
    })
    
    // Get current active task (task whose time has started but not yet completed)
    const currentActiveTask = computed(() => {
      const dateKey = todayFormatted.value
      const tasks = store.getTasksForDate(dateKey)
        .filter(task => !task.completed)
        .sort((a, b) => a.time.localeCompare(b.time))
      
      const currentTimeStr = getCurrentTimeString()
      const currentMinutes = getMinutesFromTime(currentTimeStr)
      
      // Find task where current time is within range
      return tasks.find(task => {
        const startMinutes = getMinutesFromTime(task.time)
        const endMinutes = task.endTime ? getMinutesFromTime(task.endTime) : startMinutes + 60
        return currentMinutes >= startMinutes && currentMinutes <= endMinutes
      }) || null
    })
    
    // Auto-complete tasks when their time has passed
    const checkAndCompletePassedTasks = () => {
      const dateKey = todayFormatted.value
      const tasks = store.getTasksForDate(dateKey)
      const currentTimeStr = getCurrentTimeString()
      const currentMinutes = getMinutesFromTime(currentTimeStr)
      
      tasks.forEach(task => {
        if (!task.completed) {
          const startMinutes = getMinutesFromTime(task.time)
          const endMinutes = task.endTime ? getMinutesFromTime(task.endTime) : startMinutes + 60
          
          // Auto-complete if time is past end time + buffer (e.g. 1 minute)
          if (currentMinutes > endMinutes) {
             store.toggleTaskComplete(dateKey, task.id)
          }
        }
      })
    }
    
    // Check if a task is the current active one
    const isCurrentTask = (taskId: string) => {
      return currentActiveTask.value?.id === taskId
    }
    
    // Check if a task is the next upcoming one
    const isNextTask = (taskId: string) => {
      return nextTask.value?.id === taskId
    }
    
    const hasTasksOnDate = (date: Date) => {
      const dateKey = formatDate(date)
      return store.getTasksForDate(dateKey).length > 0
    }

    const getTaskCountForDate = (date: Date) => {
      const dateKey = formatDate(date)
      return store.getTasksForDate(dateKey).length
    }

    const getMeetingCountForDate = (date: Date) => {
      const dateKey = formatDate(date)
      return store.getTasksForDate(dateKey).filter(task => task.meetingUrl).length
    }

    const getTasksForDay = (date: Date) => {
      const dateKey = formatDate(date)
      return store.getTasksForDate(dateKey).slice().sort((a, b) => a.time.localeCompare(b.time))
    }

    // Time slots for Google Calendar-style views (6 AM to 11 PM)
    const timeSlots = computed(() => {
      const slots = []
      for (let hour = 6; hour <= 23; hour++) {
        slots.push(hour)
      }
      return slots
    })

    // Get hour slot height based on screen size (for responsive task positioning)
    // These match Teams-style Tailwind classes: h-12=48px, h-14=56px, h-16=64px, h-20=80px
    const getHourSlotHeight = () => {
      if (typeof window === 'undefined') return 56
      const width = window.innerWidth
      if (width < 640) return 48  // default (h-12 = 3rem = 48px)
      if (width < 768) return 56  // sm (h-14 = 3.5rem = 56px)
      if (width < 1024) return 64  // md (h-16 = 4rem = 64px)
      return 80  // lg+ (h-20 = 5rem = 80px)
    }

    // Format hour for display
    const formatHour = (hour: number) => {
      if (hour === 0) return '12 AM'
      if (hour < 12) return `${hour} AM`
      if (hour === 12) return '12 PM'
      return `${hour - 12} PM`
    }

    // Calculate task position and height based on exact time
    const getTaskPosition = (timeStr: string, hourSlotHeight: number = 60) => {
      const [hourStr, minuteStr] = timeStr.split(':')
      const hour = parseInt(hourStr) || 0
      const minute = parseInt(minuteStr) || 0
      
      // Start from 6 AM (hour 6)
      const startHour = 6
      if (hour < startHour) return { top: 0, height: hourSlotHeight, display: false }
      if (hour > 23) return { top: 0, height: hourSlotHeight, display: false }
      
      // Calculate position: each hour = hourSlotHeight px, each minute = hourSlotHeight/60 px
      const top = ((hour - startHour) * hourSlotHeight) + (minute * (hourSlotHeight / 60))
      // Default height: 1 hour slot
      const height = hourSlotHeight
      
      return { top, height, display: true }
    }

    // Get all tasks for a specific day (for exact positioning)
    const getAllTasksForDay = (date: Date) => {
      const dateKey = formatDate(date)
      return store.getTasksForDate(dateKey).sort((a, b) => a.time.localeCompare(b.time))
    }

    // Get tasks for a specific day and hour slot (for filtering)
    const getTasksForDayAndHour = (date: Date, hour: number) => {
      const dateKey = formatDate(date)
      const tasks = store.getTasksForDate(dateKey)
      return tasks.filter(task => {
        const [taskHour] = task.time.split(':')
        return parseInt(taskHour) === hour
      }).sort((a, b) => a.time.localeCompare(b.time))
    }

    const openGoogleCalendarForTask = () => {
      if (!selectedDate.value) return

      const title = newTask.value.title || 'Meeting'

      const descriptionParts: string[] = []
      if (newTask.value.description) descriptionParts.push(newTask.value.description)
      if (newTask.value.meetingUrl) descriptionParts.push(`Meeting link: ${newTask.value.meetingUrl}`)
      const details = descriptionParts.join('\\n\\n')

      const [hourStr, minuteStr] = (newTask.value.time || '09:00').split(':')
      const hour = Number(hourStr) || 9
      const minute = Number(minuteStr) || 0

      const start = new Date(selectedDate.value)
      start.setHours(hour, minute, 0, 0)
      const end = new Date(start)
      end.setMinutes(start.getMinutes() + 30)

      const formatForGoogle = (d: Date) => {
        const pad = (n: number) => String(n).padStart(2, '0')
        return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`
      }

      const datesParam = `${formatForGoogle(start)}/${formatForGoogle(end)}`

      const guests = (newTask.value.guestEmailsText || '')
        .split(/[,;]+/)
        .map((e: string) => e.trim())
        .filter((e: string) => e.length > 0)

      const baseUrl = 'https://calendar.google.com/calendar/u/0/r/eventedit'
      const params = new URLSearchParams()
      params.set('text', title)
      params.set('dates', datesParam)
      if (details) params.set('details', details)
      if (guests.length) params.set('add', guests.join(','))
      if (newTask.value.meetingUrl) params.set('location', newTask.value.meetingUrl)

      const url = `${baseUrl}?${params.toString()}`
      window.open(url, '_blank')
    }
    
    const getDayClass = (day: Date) => {
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
    
    const changeMonth = (delta: number) => {
      if (calendarView.value === 'month') {
      currentDate.value = new Date(
        currentDate.value.getFullYear(),
        currentDate.value.getMonth() + delta,
        1
      )
        return
      }

      // For week/day views, move the selected date
      const base = selectedDate.value || today
      const newDate = new Date(base)

      if (calendarView.value === 'week') {
        newDate.setDate(newDate.getDate() + delta * 7)
      } else {
        // day view
        newDate.setDate(newDate.getDate() + delta)
      }

      selectedDate.value = newDate
      currentDate.value = newDate
    }
    
    const handleDateClick = (date: Date) => {
      // Allow selecting past dates for view-only mode
        selectedDate.value = date
        showAddForm.value = false
    }
    
    const handleAddTask = () => {
      if (!newTask.value.title || !selectedDate.value) return
      
      const dateKey = formatDate(selectedDate.value)

      const guests = (newTask.value.guestEmailsText || '')
        .split(/[,;]+/)
        .map((e: string) => e.trim())
        .filter((e: string) => e.length > 0)

      if (editingTaskId.value) {
        // Update existing task
        store.updateTask(dateKey, {
          id: editingTaskId.value,
          ...newTask.value,
          guestEmails: guests,
          endTime: newTask.value.endTime || (() => {
             const [h, m] = newTask.value.time.split(':').map(Number)
             const endH = (h + 1) % 24
             return `${String(endH).padStart(2,'0')}:${String(m).padStart(2,'0')}`
          })()
        })
      } else {
        // Create new task
        store.addTask(dateKey, {
          ...newTask.value,
          guestEmails: guests,
          // Ensure endTime is set, default to 1 hour after time if needed
          endTime: newTask.value.endTime || (() => {
             const [h, m] = newTask.value.time.split(':').map(Number)
             const endH = (h + 1) % 24
             return `${String(endH).padStart(2,'0')}:${String(m).padStart(2,'0')}`
          })()
        })
      }
      
      newTask.value = {
        title: '',
        time: '09:00',
        endTime: '10:00',
        description: '',
        completed: false,
        meetingType: 'none',
        meetingUrl: '',
        guestEmailsText: ''
      }
      showAddForm.value = false
      editingTaskId.value = null
    }

    const handleEditTask = (task: any) => {
      editingTaskId.value = task.id
      newTask.value = {
        title: task.title,
        time: task.time,
        endTime: task.endTime || (() => {
             const [h, m] = task.time.split(':').map(Number)
             const endH = (h + 1) % 24
             return `${String(endH).padStart(2,'0')}:${String(m).padStart(2,'0')}`
          })(),
        description: task.description || '',
        completed: task.completed,
        meetingType: task.meetingType || 'none',
        meetingUrl: task.meetingUrl || '',
        guestEmailsText: (task.guestEmails || []).join(', ')
      }
      showAddForm.value = true
    }
    
    const toggleComplete = (taskId: string) => {
      // Read-only for past dates
      if (!selectedDate.value || isDateDisabled(selectedDate.value)) return
      const dateKey = formatDate(selectedDate.value)
      store.toggleTaskComplete(dateKey, taskId)
    }
    
    const deleteTaskItem = (taskId: string) => {
      // Read-only for past dates
      if (!selectedDate.value || isDateDisabled(selectedDate.value)) return
      const dateKey = formatDate(selectedDate.value)
      store.deleteTask(dateKey, taskId)
    }

    // Drag and drop handlers
    const handleDragStart = (e: DragEvent, taskId: string) => {
      if (!selectedDate.value || isDateDisabled(selectedDate.value)) return
      draggedTaskId.value = taskId
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', taskId)
      }
    }

    const handleDragOver = (e: DragEvent, taskId: string) => {
      if (!selectedDate.value || isDateDisabled(selectedDate.value)) return
      e.preventDefault()
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move'
      }
      draggedOverTaskId.value = taskId
    }

    const handleDragLeave = () => {
      draggedOverTaskId.value = null
    }

    const handleDrop = (e: DragEvent, targetTaskId?: string, targetColumn?: string) => {
      if (!selectedDate.value || isDateDisabled(selectedDate.value)) return
      e.preventDefault()
      
      const sourceTaskId = draggedTaskId.value
      if (!sourceTaskId) {
        draggedTaskId.value = null
        draggedOverTaskId.value = null
        draggedOverColumn.value = null
        return
      }

      const dateKey = formatDate(selectedDate.value)
      const tasks = [...currentTasks.value]
      const sourceTask = tasks.find(t => t.id === sourceTaskId)
      
      if (!sourceTask) {
        draggedTaskId.value = null
        draggedOverTaskId.value = null
        draggedOverColumn.value = null
        return
      }

      // If dropping on a column (not a specific task)
      if (targetColumn && !targetTaskId) {
        // Move task to the end of the target column
        const targetColumnTasks = getTasksForColumn(targetColumn)
        const newOrder = targetColumnTasks.length
        
        // Update task order
        sourceTask.order = newOrder
        
        // Save to Firebase
        store.reorderTasks(dateKey, tasks.map(t => t.id))
      } 
      // If dropping on a specific task
      else if (targetTaskId) {
        const sourceIndex = tasks.findIndex(t => t.id === sourceTaskId)
        const targetIndex = tasks.findIndex(t => t.id === targetTaskId)
        
        if (sourceIndex === -1 || targetIndex === -1) {
          draggedTaskId.value = null
          draggedOverTaskId.value = null
          draggedOverColumn.value = null
          return
        }

        // Reorder tasks
        const [removed] = tasks.splice(sourceIndex, 1)
        tasks.splice(targetIndex, 0, removed)

        // Update order values
        tasks.forEach((task, index) => {
          task.order = index
        })

        // Save new order
        const taskIds = tasks.map(t => t.id)
        store.reorderTasks(dateKey, taskIds)
      }

      draggedTaskId.value = null
      draggedOverTaskId.value = null
      draggedOverColumn.value = null
    }

    const handleColumnDragOver = (e: DragEvent, columnId: string) => {
      if (!selectedDate.value || isDateDisabled(selectedDate.value)) return
      e.preventDefault()
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move'
      }
      draggedOverColumn.value = columnId
    }

    const handleColumnDragLeave = () => {
      draggedOverColumn.value = null
    }

    const handleDragEnd = () => {
      draggedTaskId.value = null
      draggedOverTaskId.value = null
      draggedOverColumn.value = null
    }
    
    // Timer functions
    const startTimer = () => {
      if (isTimerRunning.value) return
      
      // Sync timer duration with active task end time if available
      if (!isBreakTime.value && currentActiveTask.value) {
        const now = new Date()
        const currentHours = now.getHours()
        const currentMinutes = now.getMinutes()
        const currentSeconds = now.getSeconds()
        
        const currentTotalMinutes = currentHours * 60 + currentMinutes
        
        const task = currentActiveTask.value
        const startTotalMinutes = getMinutesFromTime(task.time)
        const endTotalMinutes = task.endTime ? getMinutesFromTime(task.endTime) : startTotalMinutes + 60
        
        let remainingMinutes = endTotalMinutes - currentTotalMinutes
        
        if (remainingMinutes > 0) {
           if (currentSeconds > 0) {
             timerMinutes.value = remainingMinutes - 1
             timerSeconds.value = 60 - currentSeconds
           } else {
             timerMinutes.value = remainingMinutes
             timerSeconds.value = 0
           }
        }
      }

      isTimerRunning.value = true
      timerInterval.value = setInterval(() => {
        if (timerSeconds.value === 0) {
          if (timerMinutes.value === 0) {
            // Timer reached 0
            stopTimer()
            showNotification()
            return
          }
          timerMinutes.value--
          timerSeconds.value = 59
        } else {
          timerSeconds.value--
        }
      }, 1000)
    }
    
    const pauseTimer = () => {
      isTimerRunning.value = false
      if (timerInterval.value) {
        clearInterval(timerInterval.value)
        timerInterval.value = null
      }
    }
    
    const resetTimer = () => {
      pauseTimer()
      if (isBreakTime.value) {
        timerMinutes.value = 10
      } else {
        timerMinutes.value = 50
      }
      timerSeconds.value = 0
    }
    
    const stopTimer = () => {
      pauseTimer()
      isBreakTime.value = !isBreakTime.value
      if (isBreakTime.value) {
        timerMinutes.value = 10
      } else {
        timerMinutes.value = 50
      }
      timerSeconds.value = 0
    }
    
    const showNotification = () => {
      const now = Date.now()
      // Prevent duplicate notifications within 2 seconds
      if (now - lastBreakNotification.value < 2000) return
      
      lastBreakNotification.value = now
      
      const message = isBreakTime.value 
        ? '🎉 Break time is over! Ready to get back to work?' 
        : '⏰ Time for a break! You\'ve completed 50 minutes of focused work.'
      
      // Play notification sound
      playNotificationSound('break')
      
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Schedule Manager', { body: message })
      } else if ('Notification' in window && Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification('Schedule Manager', { body: message })
          }
        })
      }
      
      alert(message)
    }
    
    const timerDisplay = computed(() => {
      const mins = String(timerMinutes.value).padStart(2, '0')
      const secs = String(timerSeconds.value).padStart(2, '0')
      return `${mins}:${secs}`
    })

</script>

<template>
  <navbar />
  <div min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-2 sm:p-4 font-sans transition-colors duration-300>
    <div max-w-6xl mx-auto>
      <div bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden transition-colors duration-300 class="dark:shadow-gray-900/50">
        <!-- Header -->
        <div bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-800 p-3 sm:p-4 md:p-6 text-white transition-colors duration-300>
          <div flex justify-between items-center flex-wrap gap-2 sm:gap-4>
            <div flex items-center gap-2 sm:gap-3>
              <svg class="w-6 h-6 sm:w-8 sm:h-8 stroke-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <h1 class="text-xl sm:text-2xl md:text-3xl font-bold">Schedule Manager</h1>
            </div>
            <div flex flex-col items-end gap-1 sm:gap-2>
              <div class="text-xs sm:text-sm opacity-90">Today: {{ todayFormatted }}</div>
              <div class="text-sm sm:text-lg font-semibold">Time: {{ currentTimeFormatted }}</div>
            </div>
          </div>
          
          <!-- Pomodoro Timer -->
          <div class="bg-white/10 mt-3 sm:mt-4 md:mt-6 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4">
            <div flex items-center justify-between flex-wrap gap-2 sm:gap-4>
              <div flex items-center gap-2 sm:gap-3>
                <svg class="w-5 h-5 sm:w-6 sm:h-6 stroke-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                <div>
                  <div class="text-[10px] sm:text-xs opacity-75">{{ isBreakTime ? 'Break Time' : 'Focus Time' }}</div>
                  <div class="text-2xl sm:text-3xl font-bold font-mono">{{ timerDisplay }}</div>
                </div>
              </div>
              <div flex gap-1 sm:gap-2>
                <button 
                  v-if="!isTimerRunning"
                  @click="startTimer"
                  class="px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1 sm:gap-2"
                >
                  <svg class="w-4 h-4 sm:w-5 sm:h-5 stroke-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                  <span class="hidden sm:inline">Start</span>
                </button>
                <button 
                  v-if="isTimerRunning"
                  @click="pauseTimer"
                  class="px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 bg-amber-500 hover:bg-amber-600 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1 sm:gap-2"
                >
                  <svg class="w-4 h-4 sm:w-5 sm:h-5 stroke-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect x="6" y="4" width="4" height="16"/>
                    <rect x="14" y="4" width="4" height="16"/>
                  </svg>
                  <span class="hidden sm:inline">Pause</span>
                </button>
                <button 
                  @click="resetTimer"
                  class="px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1 sm:gap-2"
                >
                  <svg class="w-4 h-4 sm:w-5 sm:h-5 stroke-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <polyline points="1 4 1 10 7 10"/>
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                  </svg>
                  <span class="hidden sm:inline">Reset</span>
                </button>
              </div>
            </div>
            
            <!-- Next Task Preview -->
            <div v-if="currentActiveTask || nextTask" class="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-white/20">
              <div v-if="currentActiveTask" class="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm mb-1 sm:mb-2">
                <span class="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-emerald-500/80 rounded text-white font-semibold text-[10px] sm:text-xs">ACTIVE</span>
                <span class="opacity-90 truncate">{{ currentActiveTask.time }}</span>
                <span class="font-medium truncate">{{ currentActiveTask.title }}</span>
              </div>
              <div v-if="nextTask" class="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <span class="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-blue-500/80 rounded text-white font-semibold text-[10px] sm:text-xs">NEXT</span>
                <span class="opacity-90 truncate">{{ nextTask.time }}</span>
                <span class="font-medium truncate">{{ nextTask.title }}</span>
              </div>
            </div>
          </div>
        </div>

        <div p-3 sm:p-4 md:p-6>
          <!-- Calendar View -->
          <div>
            <div bg-gray-50 dark:bg-gray-700 rounded-xl sm:rounded-2xl p-2 sm:p-3 md:p-4 transition-colors duration-300>
              <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 mb-2 sm:mb-3 md:mb-4">
                <div class="flex gap-1 sm:gap-2 w-full sm:w-auto">
                  <button
                    @click="calendarView = 'day'"
                    :class="[
                      'flex-1 sm:flex-none px-2 sm:px-3 py-1.5 sm:py-1 rounded-md text-[10px] sm:text-xs md:text-sm border border-transparent transition-colors font-medium',
                      calendarView === 'day'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-transparent text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                    ]"
                  >
                    Day
                  </button>
                  <button
                    @click="calendarView = 'week'"
                    :class="[
                      'flex-1 sm:flex-none px-2 sm:px-3 py-1.5 sm:py-1 rounded-md text-[10px] sm:text-xs md:text-sm border border-transparent transition-colors font-medium',
                      calendarView === 'week'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-transparent text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                    ]"
                  >
                    Week
                  </button>
                  <button
                    @click="calendarView = 'month'"
                    :class="[
                      'flex-1 sm:flex-none px-2 sm:px-3 py-1.5 sm:py-1 rounded-md text-[10px] sm:text-xs md:text-sm border border-transparent transition-colors font-medium',
                      calendarView === 'month'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-transparent text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                    ]"
                  >
                    Month
                  </button>
                </div>
                <div class="flex items-center gap-1 sm:gap-2 w-full sm:w-auto justify-between sm:justify-start">
                  <button @click="changeMonth(-1)" class="bg-transparent border-none p-1.5 sm:p-2 cursor-pointer rounded-lg transition-colors hover:bg-gray-200 dark:hover:bg-gray-600 flex-shrink-0">
                    <svg class="w-4 h-4 sm:w-5 sm:h-5 stroke-2 text-gray-800 dark:text-gray-200" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                </button>
                  <h2 class="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-gray-800 dark:text-gray-100 text-center flex-1 sm:flex-none min-w-0 truncate sm:min-w-fit">
                    {{ calendarTitle }}
                  </h2>
                  <button @click="changeMonth(1)" class="bg-transparent border-none p-1.5 sm:p-2 cursor-pointer rounded-lg transition-colors hover:bg-gray-200 dark:hover:bg-gray-600 flex-shrink-0">
                    <svg class="w-4 h-4 sm:w-5 sm:h-5 stroke-2 text-gray-800 dark:text-gray-200" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
                </div>
              </div>

              <!-- Month View -->
              <template v-if="calendarView === 'month'">
                <div class="grid grid-cols-7 gap-0.5 sm:gap-1 md:gap-2 mb-1 sm:mb-2">
                  <div v-for="day in weekDays" :key="day" class="text-center text-[10px] sm:text-xs md:text-sm font-semibold text-gray-500 dark:text-gray-400 p-1 sm:p-1.5 md:p-2">{{ day }}</div>
              </div>

                <div class="grid grid-cols-7 gap-0.5 sm:gap-1 md:gap-2">
                <button
                    v-for="(day, index) in displayedCalendarDays"
                  :key="index"
                  @click="day && handleDateClick(day)"
                    :disabled="!day"
                  :class="[
                      'min-h-12 sm:min-h-14 md:min-h-16 lg:min-h-20 p-1 sm:p-1.5 md:p-2 rounded-none text-[10px] sm:text-xs md:text-sm font-medium cursor-pointer bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 transition-all relative flex flex-col items-start justify-start border border-gray-200 dark:border-gray-600',
                      {
                        'hover:bg-gray-50 dark:hover:bg-gray-600': day && !isDateDisabled(day),
                        'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500': day && isDateDisabled(day),
                        'ring-1 ring-blue-500 dark:ring-blue-400': selectedDate && day && formatDate(day) === formatDate(selectedDate),
                        'bg-blue-50/60 dark:bg-blue-900/40': selectedDate && day && formatDate(day) === formatDate(selectedDate),
                        'bg-blue-50 dark:bg-blue-900/30': day && !isDateDisabled(day) && formatDate(day) === todayFormatted && !(selectedDate && formatDate(day) === formatDate(selectedDate))
                      }
                    ]"
                  >
                    <template v-if="day">
                      <div class="flex items-center justify-between w-full">
                        <span
                    :class="[
                            'text-[10px] sm:text-xs md:text-sm font-semibold',
                            formatDate(day) === todayFormatted
                              ? 'text-blue-600 dark:text-blue-300'
                              : 'text-gray-700 dark:text-gray-200'
                          ]"
                        >
                          {{ day.getDate() }}
                        </span>
                        <span
                          v-if="getTaskCountForDate(day)"
                          class="ml-auto px-1 sm:px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-800 text-[8px] sm:text-[9px] md:text-[10px] font-semibold text-blue-700 dark:text-blue-200"
                        >
                          {{ getTaskCountForDate(day) }}
                        </span>
                      </div>

                      <div
                        v-if="getTaskCountForDate(day)"
                        class="mt-0.5 sm:mt-1 text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] font-medium text-gray-500 dark:text-gray-300 truncate w-full flex items-center gap-0.5 sm:gap-1"
                      >
                        <span>
                          {{ getTaskCountForDate(day) }}<span class="hidden sm:inline"> task</span><span v-if="getTaskCountForDate(day) > 1" class="hidden sm:inline">s</span>
                        </span>
                        <span
                          v-if="getMeetingCountForDate(day)"
                          class="text-blue-600 dark:text-blue-300"
                        >
                          <span class="hidden sm:inline">· </span>{{ getMeetingCountForDate(day) }}<span class="hidden sm:inline"> meeting</span><span v-if="getMeetingCountForDate(day) > 1" class="hidden sm:inline">s</span>
                        </span>
                      </div>
                    </template>
                </button>
              </div>
              </template>

              <!-- Week View - Teams Calendar Style -->
              <template v-else-if="calendarView === 'week'">
                <div class="flex border-b-2 border-gray-200 dark:border-gray-700 overflow-x-auto bg-white dark:bg-gray-800">
                  <div class="w-14 sm:w-16 md:w-20 lg:w-24 flex-shrink-0 border-r border-gray-200 dark:border-gray-700"></div>
                  <div class="flex-1 grid grid-cols-7 min-w-[600px] sm:min-w-0">
                    <template
                      v-for="(day, index) in weekCalendarDays"
                      :key="index"
                    >
                      <div
                        v-if="day"
                        @click="handleDateClick(day)"
                        :class="[
                          'p-2 sm:p-3 md:p-4 text-center border-r border-gray-200 dark:border-gray-700 cursor-pointer transition-all',
                          formatDate(day) === todayFormatted
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-b-2 border-b-blue-500 dark:border-b-blue-400'
                            : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50',
                          selectedDate && formatDate(day) === formatDate(selectedDate)
                            ? 'ring-2 ring-blue-500 dark:ring-blue-400 bg-blue-50 dark:bg-blue-900/20'
                            : ''
                        ]"
                      >
                        <div class="text-[10px] sm:text-xs md:text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wide">
                          {{ weekDays[day.getDay()] }}
                        </div>
                        <div
                          :class="[
                            'text-base sm:text-lg md:text-xl lg:text-2xl font-bold',
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

                <div class="flex overflow-x-auto bg-white dark:bg-gray-800">
                  <div class="w-14 sm:w-16 md:w-20 lg:w-24 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <div
                      v-for="hour in timeSlots"
                      :key="hour"
                      class="h-12 sm:h-14 md:h-16 lg:h-20 border-b border-gray-200 dark:border-gray-700 relative"
                    >
                      <div class="text-[10px] sm:text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400 absolute top-0 right-1 sm:right-2 pr-1 sm:pr-2 -mt-2.5 sm:-mt-3">
                        {{ formatHour(hour) }}
                      </div>
                    </div>
                  </div>
                  <div class="flex-1 grid grid-cols-7 min-w-[600px] sm:min-w-0">
                    <template
                      v-for="(day, dayIndex) in weekCalendarDays"
                      :key="dayIndex"
                    >
                      <div
                        v-if="day"
                        class="relative border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                        :class="{
                          'bg-blue-50/30 dark:bg-blue-900/10': formatDate(day) === todayFormatted
                        }"
                      >
                        <!-- Hour slots for click targets -->
                        <div
                          v-for="hour in timeSlots"
                          :key="hour"
                          class="hour-slot h-12 sm:h-14 md:h-16 lg:h-20 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors relative group"
                          @click="handleDateClick(day)"
                        >
                          <div class="absolute left-0 top-0 bottom-0 w-0.5 bg-transparent group-hover:bg-blue-400 dark:group-hover:bg-blue-500 transition-colors"></div>
                        </div>
                        <!-- Current time indicator line (Teams-style) -->
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
                        <!-- Tasks positioned at exact times -->
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
                            'rounded-md px-2 sm:px-2.5 md:px-3 py-1 sm:py-1.5 text-[9px] sm:text-[10px] md:text-xs font-medium cursor-pointer overflow-hidden shadow-md hover:shadow-lg transition-all border-l-4',
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
                          <div v-if="task.description" class="text-[8px] sm:text-[9px] opacity-80 truncate mt-0.5 hidden sm:block">
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
                <div v-if="selectedDate" class="flex border-b-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  <div class="w-14 sm:w-16 md:w-20 lg:w-24 flex-shrink-0 border-r border-gray-200 dark:border-gray-700"></div>
                  <div
                    class="flex-1 p-3 sm:p-4 md:p-6 text-center border-l border-gray-200 dark:border-gray-700"
                    :class="[
                      formatDate(selectedDate) === todayFormatted
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-b-2 border-b-blue-500 dark:border-b-blue-400'
                        : 'bg-white dark:bg-gray-800'
                    ]"
                  >
                    <div class="text-xs sm:text-sm md:text-base font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wide">
                      {{ weekDays[selectedDate.getDay()] }}
                    </div>
                    <div
                      :class="[
                        'text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold',
                        formatDate(selectedDate) === todayFormatted
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-900 dark:text-gray-100'
                      ]"
                    >
                      {{ selectedDate.getDate() }}
                    </div>
                    <div class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {{ formatDate(selectedDate) }}
                    </div>
                  </div>
                </div>

                <div v-if="selectedDate" class="flex overflow-x-auto bg-white dark:bg-gray-800">
                  <div class="w-14 sm:w-16 md:w-20 lg:w-24 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <div
                      v-for="hour in timeSlots"
                      :key="hour"
                      class="h-12 sm:h-14 md:h-16 lg:h-20 border-b border-gray-200 dark:border-gray-700 relative"
                    >
                      <div class="text-[10px] sm:text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400 absolute top-0 right-1 sm:right-2 pr-1 sm:pr-2 -mt-2.5 sm:-mt-3">
                        {{ formatHour(hour) }}
                      </div>
                    </div>
                  </div>
                  <div 
                    class="flex-1 border-l border-gray-200 dark:border-gray-700 relative min-w-0"
                    :class="{
                      'bg-blue-50/30 dark:bg-blue-900/10': formatDate(selectedDate) === todayFormatted
                    }"
                  >
                    <!-- Hour slots for click targets -->
                    <div
                      v-for="hour in timeSlots"
                      :key="hour"
                      class="hour-slot h-12 sm:h-14 md:h-16 lg:h-20 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors relative group"
                      @click="handleDateClick(selectedDate)"
                    >
                      <div class="absolute left-0 top-0 bottom-0 w-0.5 bg-transparent group-hover:bg-blue-400 dark:group-hover:bg-blue-500 transition-colors"></div>
                    </div>
                    <!-- Current time indicator line (Teams-style) -->
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
                    <!-- Tasks positioned at exact times -->
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
                        'rounded-lg px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm md:text-base font-medium cursor-pointer overflow-hidden shadow-lg hover:shadow-xl transition-all border-l-4',
                        task.meetingUrl
                          ? 'bg-blue-500 dark:bg-blue-600 text-white border-l-blue-700 dark:border-l-blue-400'
                          : task.completed
                          ? 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 border-l-gray-400 dark:border-l-gray-500 opacity-75'
                          : 'bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100 border-l-blue-500 dark:border-l-blue-400'
                      ]"
                      @click.stop="handleDateClick(selectedDate)"
                    >
                      <div class="flex items-center justify-between mb-1.5">
                        <div class="font-bold text-sm sm:text-base md:text-lg">{{ task.time }} - {{ task.endTime || '...' }}</div>
                        <div v-if="task.meetingUrl" class="flex items-center gap-1">
                          <svg class="w-3 h-3 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"/>
                          </svg>
                          <span class="text-[10px] sm:text-xs font-semibold">Meeting</span>
                        </div>
                      </div>
                      <div class="font-bold text-sm sm:text-base md:text-lg mb-1 truncate">{{ task.title }}</div>
                      <div v-if="task.description" class="text-[10px] sm:text-xs md:text-sm opacity-90 line-clamp-2">
                        {{ task.description }}
                      </div>
                    </div>
                  </div>
                </div>
                <div v-else class="flex items-center justify-center py-12 sm:py-16 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800">
                  <div class="text-center">
                    <svg class="w-16 h-16 sm:w-20 sm:h-20 stroke-2 opacity-50 mb-4 mx-auto text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <p class="text-sm sm:text-base font-medium">Select a date to view</p>
                  </div>
                </div>
              </template>
            </div>
          </div>

          <!-- Day Detail View (under calendar) -->
          <div mt-3 sm:mt-4 md:mt-6>
            <div v-if="selectedDate" bg-gray-50 dark:bg-gray-700 rounded-xl sm:rounded-2xl p-3 sm:p-4 transition-colors duration-300>
              <div flex justify-between items-center mb-3 sm:mb-4 flex-wrap gap-2>
                <h2 class="text-base sm:text-lg md:text-xl font-bold text-gray-800 dark:text-gray-100">{{ formatDate(selectedDate) }}</h2>
                <button
                  v-if="!isDateDisabled(selectedDate)"
                  @click="showAddForm = true"
                  class="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 bg-blue-600 dark:bg-blue-500 text-white border-none rounded-lg cursor-pointer text-xs sm:text-sm font-medium transition-colors hover:bg-blue-700 dark:hover:bg-blue-600"
                >
                  <svg class="w-4 h-4 sm:w-5 sm:h-5 stroke-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  <span class="hidden sm:inline">Add Task</span>
                  <span class="sm:hidden">Add</span>
                </button>
              </div>

              <!-- Todo List View Toggle -->
              <div class="flex gap-2 mb-3 sm:mb-4">
                <button
                  @click="showTodoList = !showTodoList"
                  :class="[
                    'px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-2',
                    showTodoList
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200'
                  ]"
                >
                  <svg class="w-4 h-4 stroke-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M9 11l3 3L22 4"/>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                  </svg>
                  Todo List
                </button>
              </div>

              <!-- Trello-Style Kanban Board -->
              <div v-if="showTodoList" class="mb-4">
                <div class="flex gap-3 sm:gap-4 overflow-x-auto pb-2" style="scrollbar-width: thin;">
                  <div
                    v-for="column in columns"
                    :key="column.id"
                    @dragover="handleColumnDragOver($event, column.id)"
                    @dragleave="handleColumnDragLeave"
                    @drop="handleDrop($event, undefined, column.id)"
                    :class="[
                      'flex-shrink-0 w-72 sm:w-80 bg-gray-100 dark:bg-gray-800 rounded-lg p-3 transition-colors',
                      draggedOverColumn === column.id ? 'ring-2 ring-blue-500 dark:ring-blue-400 bg-gray-200 dark:bg-gray-700' : ''
                    ]"
                  >
                    <!-- Column Header -->
                    <div class="flex items-center justify-between mb-3">
                      <div class="flex items-center gap-2">
                        <div :class="[
                          'w-3 h-3 rounded-full',
                          column.color === 'blue' ? 'bg-blue-500' : '',
                          column.color === 'emerald' ? 'bg-emerald-500' : '',
                          column.color === 'gray' ? 'bg-gray-500' : ''
                        ]"></div>
                        <h3 class="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300">
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
                            <h4 :class="[
                              'text-sm sm:text-base font-semibold text-gray-800 dark:text-gray-100 mb-1 break-words',
                              task.completed || column.id === 'ended' ? 'line-through opacity-75' : ''
                            ]">
                              {{ task.title }}
                            </h4>
                            <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
                              <svg class="w-3 h-3 stroke-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
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
                              <svg class="w-4 h-4 stroke-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
                            <button
                              v-if="!isDateDisabled(selectedDate)"
                              @click.stop="deleteTaskItem(task.id)"
                              class="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-all flex-shrink-0 opacity-60 hover:opacity-100"
                            >
                              <svg class="w-4 h-4 stroke-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                              </svg>
                            </button>
                          </div>
                        </div>

                        <!-- Card Description -->
                        <p v-if="task.description" class="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2 break-words line-clamp-2">
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
                                <polyline points="20 6 9 17 4 12"/>
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
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <line x1="9" y1="3" x2="9" y2="21"/>
                    <line x1="15" y1="3" x2="15" y2="21"/>
                  </svg>
                  <p class="text-sm sm:text-base font-medium">No tasks yet</p>
                  <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Add a task to get started</p>
                </div>
              </div>

              <!-- Tasks List (Original View) -->
              <div v-else max-h-96 sm:max-h-100 overflow-y-auto>
                <div v-if="currentTasks.length === 0" class="text-center py-8 sm:py-12 px-4 text-gray-500 dark:text-gray-400">
                  <svg class="w-10 h-10 sm:w-12 sm:h-12 stroke-2 opacity-50 mb-2 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <p class="text-sm sm:text-base">No tasks scheduled</p>
                </div>

                <div
                  v-for="task in currentTasks"
                  :key="task.id"
                  draggable="true"
                  @dragstart="handleDragStart($event, task.id)"
                  @dragover="handleDragOver($event, task.id)"
                  @dragleave="handleDragLeave"
                  @drop="handleDrop($event, task.id)"
                  @dragend="handleDragEnd"
                  :class="[
                    'bg-white dark:bg-gray-600 p-3 sm:p-4 rounded-lg mb-2 sm:mb-3 shadow-sm flex justify-between items-start transition-colors duration-300',
                    { 'opacity-60': task.completed },
                    { 'ring-2 ring-emerald-500 dark:ring-emerald-400 bg-emerald-50 dark:bg-emerald-900/20': isCurrentTask(task.id) && formatDate(selectedDate) === todayFormatted },
                    { 'ring-2 ring-blue-500 dark:ring-blue-400 bg-blue-50 dark:bg-blue-900/20': isNextTask(task.id) && formatDate(selectedDate) === todayFormatted },
                    draggedTaskId === task.id ? 'opacity-50' : '',
                    draggedOverTaskId === task.id ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''
                  ]"
                >
                  <div class="flex gap-2 sm:gap-3 flex-1 min-w-0">
                    <svg class="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5 sm:mt-1 cursor-move" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <line x1="3" y1="12" x2="21" y2="12"/>
                      <line x1="3" y1="6" x2="21" y2="6"/>
                      <line x1="3" y1="18" x2="21" y2="18"/>
                    </svg>
                    <button
                      @click="toggleComplete(task.id)"
                      :disabled="isDateDisabled(selectedDate)"
                      :class="[
                        'w-4 h-4 sm:w-5 sm:h-5 min-w-4 sm:min-w-5 border-2 rounded flex items-center justify-center cursor-pointer transition-all mt-0.5 sm:mt-1 flex-shrink-0',
                        task.completed 
                          ? 'bg-emerald-500 dark:bg-emerald-600 border-emerald-500 dark:border-emerald-600' 
                          : 'bg-transparent border-gray-300 dark:border-gray-400 hover:border-emerald-500 dark:hover:border-emerald-400',
                        { 'cursor-not-allowed': isDateDisabled(selectedDate) }
                      ]"
                    >
                      <svg v-if="task.completed" class="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </button>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-1 sm:gap-2 flex-wrap mb-1">
                        <div class="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-semibold">
                          <svg class="w-3 h-3 sm:w-4 sm:h-4 stroke-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12 6 12 12 16 14"/>
                          </svg>
                          <span>{{ task.time }} - {{ task.endTime || '...' }}</span>
                        </div>
                        <span 
                          v-if="isCurrentTask(task.id) && formatDate(selectedDate) === todayFormatted"
                          class="px-1.5 sm:px-2 py-0.5 bg-emerald-500 dark:bg-emerald-600 text-white text-[10px] sm:text-xs font-bold rounded-full flex items-center gap-0.5 sm:gap-1"
                        >
                          <svg class="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3"/>
                          </svg>
                          <span class="hidden sm:inline">ACTIVE NOW</span>
                          <span class="sm:hidden">ACTIVE</span>
                        </span>
                        <span 
                          v-if="isNextTask(task.id) && formatDate(selectedDate) === todayFormatted"
                          class="px-1.5 sm:px-2 py-0.5 bg-blue-500 dark:bg-blue-600 text-white text-[10px] sm:text-xs font-bold rounded-full flex items-center gap-0.5 sm:gap-1"
                        >
                          <svg class="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <polyline points="9 18 15 12 9 6"/>
                          </svg>
                          <span class="hidden sm:inline">UP NEXT</span>
                          <span class="sm:hidden">NEXT</span>
                        </span>
                      </div>
                      <h3 :class="['text-sm sm:text-base font-semibold text-gray-800 dark:text-gray-100 mb-1 break-words', { 'line-through': task.completed }]">{{ task.title }}</h3>
                      <p v-if="task.description" class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 break-words">{{ task.description }}</p>

                      <div v-if="task.meetingUrl" class="mt-2 flex items-center gap-2">
                        <span
                          v-if="task.meetingType === 'google'"
                          class="px-1.5 py-0.5 rounded-full bg-green-100 text-[10px] sm:text-xs font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-200"
                        >
                          Google Meet
                        </span>
                        <span
                          v-else-if="task.meetingType === 'teams'"
                          class="px-1.5 py-0.5 rounded-full bg-blue-100 text-[10px] sm:text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
                        >
                          Microsoft Teams
                        </span>
                        <a
                          :href="task.meetingUrl"
                          target="_blank"
                          rel="noreferrer"
                          class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-600 text-white text-[10px] sm:text-xs font-medium hover:bg-blue-700"
                        >
                          <svg class="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M14 3h7v7"/>
                            <path d="M10 14L21 3"/>
                            <path d="M5 5v14h14"/>
                          </svg>
                          Join meeting
                        </a>
                      </div>
                    </div>
                  </div>
                  <div class="flex items-center">
                    <button
                      v-if="!isDateDisabled(selectedDate)"
                      @click="handleEditTask(task)"
                      class="bg-transparent border-none p-1 text-blue-500 dark:text-blue-400 cursor-pointer rounded transition-colors hover:bg-blue-100 dark:hover:bg-blue-900/30 flex-shrink-0"
                    >
                      <svg class="w-4 h-4 sm:w-5 sm:h-5 stroke-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button
                      v-if="!isDateDisabled(selectedDate)"
                      @click="deleteTaskItem(task.id)"
                      class="bg-transparent border-none p-1 text-red-500 dark:text-red-400 cursor-pointer rounded transition-colors hover:bg-red-100 dark:hover:bg-red-900/30 flex-shrink-0"
                    >
                      <svg class="w-4 h-4 sm:w-5 sm:h-5 stroke-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <div v-if="isDateDisabled(selectedDate)" class="mt-3 sm:mt-4 p-2 sm:p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg text-xs sm:text-sm text-amber-800 dark:text-amber-300 transition-colors duration-300">
                This date is in the past. Viewing only.
              </div>
            </div>

            <div v-else class="flex flex-col items-center justify-center py-8 sm:py-12 text-gray-500 dark:text-gray-400 text-center">
              <svg class="w-12 h-12 sm:w-16 sm:h-16 stroke-2 opacity-50 mb-3 sm:mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <p class="text-sm sm:text-base">Select a date to view or add tasks</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Add Task Modal -->
  <div
    v-if="showAddForm && selectedDate && !isDateDisabled(selectedDate)"
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4"
    @click.self="() => { showAddForm = false; editingTaskId = null; }"
  >
    <div class="bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl md:rounded-2xl shadow-2xl w-full max-w-md p-3 sm:p-4 md:p-6 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
      <div class="flex justify-between items-center mb-2 sm:mb-3 md:mb-4">
        <h3 class="text-sm sm:text-base md:text-lg font-semibold text-gray-800 dark:text-gray-100 pr-2">
          {{ editingTaskId ? 'Edit Task' : 'Add Task' }} – {{ formatDate(selectedDate) }}
        </h3>
        <button
          @click="() => { showAddForm = false; editingTaskId = null; }"
          class="bg-transparent border-none text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer text-lg sm:text-xl md:text-2xl leading-none flex-shrink-0"
        >
          ✕
        </button>
      </div>

      <div>
        <input
          v-model="newTask.title"
          type="text"
          placeholder="Task title"
          class="w-full p-2.5 sm:p-3 border border-gray-300 dark:border-gray-500 dark:bg-gray-700 dark:text-gray-100 rounded-lg mb-2 sm:mb-3 font-sans text-sm focus:outline-none focus:border-blue-600 dark:focus:border-blue-400 focus:ring-2 sm:focus:ring-3 focus:ring-blue-600/10 dark:focus:ring-blue-400/20 transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />
        <input
          v-model="newTask.time"
          type="time"
          class="w-full p-2.5 sm:p-3 border border-gray-300 dark:border-gray-500 dark:bg-gray-700 dark:text-gray-100 rounded-lg mb-2 sm:mb-3 font-sans text-sm focus:outline-none focus:border-blue-600 dark:focus:border-blue-400 focus:ring-2 sm:focus:ring-3 focus:ring-blue-600/10 dark:focus:ring-blue-400/20 transition-colors"
        />
        <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">To:</div>
        <input
          v-model="newTask.endTime"
          type="time"
          class="w-full p-2.5 sm:p-3 border border-gray-300 dark:border-gray-500 dark:bg-gray-700 dark:text-gray-100 rounded-lg mb-2 sm:mb-3 font-sans text-sm focus:outline-none focus:border-blue-600 dark:focus:border-blue-400 focus:ring-2 sm:focus:ring-3 focus:ring-blue-600/10 dark:focus:ring-blue-400/20 transition-colors"
        />
        <textarea
          v-model="newTask.description"
          placeholder="Description (optional)"
          class="w-full p-2.5 sm:p-3 border border-gray-300 dark:border-gray-500 dark:bg-gray-700 dark:text-gray-100 rounded-lg mb-2 sm:mb-3 font-sans text-sm resize-none focus:outline-none focus:border-blue-600 dark:focus:border-blue-400 focus:ring-2 sm:focus:ring-3 focus:ring-blue-600/10 dark:focus:ring-blue-400/20 transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500"
          rows="3"
        ></textarea>
        <div class="mb-2 sm:mb-3">
          <label class="block text-xs sm:text-sm font-medium text-gray-200 mb-1">Meeting</label>
          <div class="flex flex-col gap-2">
            <select
              v-model="newTask.meetingType"
              class="w-full p-2.5 sm:p-2.5 border border-gray-300 dark:border-gray-500 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-xs sm:text-sm focus:outline-none focus:border-blue-600 dark:focus:border-blue-400 focus:ring-2 sm:focus:ring-3 focus:ring-blue-600/10 dark:focus:ring-blue-400/20 transition-colors"
            >
              <option value="none">No meeting</option>
              <option value="google">Google Meet</option>
              <option value="teams">Microsoft Teams</option>
              <option value="custom">Other link</option>
            </select>
            <input
              v-if="newTask.meetingType !== 'none'"
              v-model="newTask.meetingUrl"
              type="url"
              placeholder="Paste meeting link (e.g. Google Meet or Teams)"
              class="w-full p-2.5 sm:p-2.5 border border-gray-300 dark:border-gray-500 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-xs sm:text-sm focus:outline-none focus:border-blue-600 dark:focus:border-blue-400 focus:ring-2 sm:focus:ring-3 focus:ring-blue-600/10 dark:focus:ring-blue-400/20 transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
            <div class="flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
              <input
                v-model="newTask.guestEmailsText"
                type="text"
                placeholder="Guest emails (comma separated)"
                class="w-full sm:flex-1 p-2.5 sm:p-2.5 border border-gray-300 dark:border-gray-500 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-[10px] sm:text-xs focus:outline-none focus:border-blue-600 dark:focus:border-blue-400 focus:ring-2 sm:focus:ring-3 focus:ring-blue-600/10 dark:focus:ring-blue-400/20 transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
              <button
                type="button"
                @click="openGoogleCalendarForTask"
                class="px-2.5 sm:px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] sm:text-xs font-medium border-none cursor-pointer flex items-center gap-1"
              >
                <svg class="w-3.5 h-3.5 stroke-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                Google Calendar
              </button>
            </div>
            <p class="mt-1 text-[10px] sm:text-xs text-gray-400">
              This opens Google Calendar with this meeting pre-filled so you can send email invites.
            </p>
          </div>
        </div>
        <div class="flex gap-2 mt-2">
          <button @click="handleAddTask" class="flex-1 p-2.5 sm:p-3 border-none rounded-lg cursor-pointer text-sm sm:text-base font-medium transition-all bg-emerald-500 dark:bg-emerald-600 text-white hover:bg-emerald-600 dark:hover:bg-emerald-700">
            {{ editingTaskId ? 'Update' : 'Save' }}
          </button>
          <button @click="() => { showAddForm = false; editingTaskId = null; }" class="flex-1 p-2.5 sm:p-3 border-none rounded-lg cursor-pointer text-sm sm:text-base font-medium transition-all bg-gray-200 dark:bg-gray-500 text-gray-700 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-400">
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

