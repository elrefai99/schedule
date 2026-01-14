import { defineStore } from 'pinia'
import { useAuthStore } from './auth'
import { saveTask, getTasksForDate, deleteTask as deleteTaskFromFirebase, getAllUserTasks } from '../firebase/tasks'

export const useScheduleStore = defineStore('schedule', {
     state: () => ({
          schedules: {} as Record<string, any[]>,
          loading: false,
          synced: false
     }),

     getters: {
          getTasksForDate: (state) => (dateKey: string) => {
               return state.schedules[dateKey] || []
          }
     },

     actions: {
          async loadUserTasks() {
               const authStore = useAuthStore()
               if (!authStore.user) return

               try {
                    this.loading = true
                    const tasks = await getAllUserTasks(authStore.user.uid)

                    this.schedules = {}
                    tasks.forEach(task => {
                         if (!this.schedules[task.date]) {
                              this.schedules[task.date] = []
                         }
                         this.schedules[task.date].push(task)
                    })

                    this.synced = true
               } catch (error) {
                    console.error('Error loading tasks:', error)
               } finally {
                    this.loading = false
               }
          },

          async loadTasksForDate(dateKey: string) {
               const authStore = useAuthStore()
               if (!authStore.user) return

               try {
                    const tasks = await getTasksForDate(authStore.user.uid, dateKey)
                    this.schedules[dateKey] = tasks
               } catch (error) {
                    console.error('Error loading tasks for date:', error)
               }
          },

          async addTask(dateKey: string, task: any) {
               const authStore = useAuthStore()

               const newTask = {
                    id: Date.now().toString(),
                    ...task,
                    date: dateKey
               }

               if (!this.schedules[dateKey]) {
                    this.schedules[dateKey] = []
               }
               this.schedules[dateKey].push(newTask)


               if (authStore.user) {
                    try {
                         const { date, userId, ...taskToSave } = newTask as any
                         await saveTask(authStore.user.uid, dateKey, taskToSave)
                    } catch (error) {
                         console.error('Error saving task to Firebase:', error)
                    }
               }
          },

          async toggleTaskComplete(dateKey: string, taskId: string) {
               const authStore = useAuthStore()

               const tasks = this.schedules[dateKey]
               if (tasks) {
                    const task = tasks.find(t => t.id === taskId)
                    if (task) {
                         task.completed = !task.completed

                         if (authStore.user) {
                              try {
                                   await saveTask(authStore.user.uid, dateKey, task)
                              } catch (error) {
                                   console.error('Error updating task in Firebase:', error)
                              }
                         }
                    }
               }
          },

          async deleteTask(dateKey: string, taskId: string) {
               const authStore = useAuthStore()

               if (this.schedules[dateKey]) {
                    const taskToDelete = this.schedules[dateKey].find(t => t.id === taskId)

                    this.schedules[dateKey] = this.schedules[dateKey].filter(
                         task => task.id !== taskId
                    )

                    if (authStore.user) {
                         try {
                              await deleteTaskFromFirebase(authStore.user.uid, dateKey, taskId)
                         } catch (error) {
                              console.error('Error deleting task from Firebase:', error)
                              if (taskToDelete) {
                                   this.schedules[dateKey].push(taskToDelete)
                              }
                         }
                    }
               }
          }
     }
})
