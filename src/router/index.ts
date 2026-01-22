import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
     {
          path: '/',
          name: 'Overview',
          component: () => import('../views/OverviewPage.vue'),
          meta: { title: 'Overview' }
     },
     {
          path: '/calendar',
          name: 'Calendar',
          component: () => import('../views/CalendarPage.vue'),
          meta: { title: 'Calendar' }
     },
     {
          path: '/profile',
          name: 'Profile',
          component: () => import('../views/ProfilePage.vue'),
          meta: { title: 'Profile' }
     }
]

const router = createRouter({
     history: createWebHistory(import.meta.env.BASE_URL),
     routes
})

// Update document title based on route
router.beforeEach((to, _from, next) => {
     document.title = `${to.meta.title || 'Schedule'} - Schedule Manager`
     next()
})

export default router
