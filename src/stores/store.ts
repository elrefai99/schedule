import { defineStore } from 'pinia'

export const useScheduleStore = defineStore('schedule', {
     state: () => ({
          schedules: {} as Record<string, any[]>
     }),

     getters: {
          getTasksForDate: (state) => (dateKey: string) => {
               return state.schedules[dateKey] || []
          }
     },

     actions: {
          addTask(dateKey: string, task: any) {
               if (!this.schedules[dateKey]) {
                    this.schedules[dateKey] = []
               }
               this.schedules[dateKey].push({
                    id: Date.now(),
                    ...task,
                    date: dateKey
               })
          },

          toggleTaskComplete(dateKey: string, taskId: string) {
               const tasks = this.schedules[dateKey]
               if (tasks) {
                    const task = tasks.find(t => t.id === taskId)
                    if (task) {
                         task.completed = !task.completed
                    }
               }
          },

          deleteTask(dateKey: string, taskId: string) {
               if (this.schedules[dateKey]) {
                    this.schedules[dateKey] = this.schedules[dateKey].filter(
                         task => task.id !== taskId
                    )
               }
          }
     }
})
