import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import '@unocss/reset/tailwind.css'
import 'uno.css'
import AuthWrapper from './AuthWrapper.vue'
import { useAuthStore } from './stores/auth'

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

const app = createApp(AuthWrapper)
app.use(pinia)

// Initialize Firebase auth
const authStore = useAuthStore()
authStore.initAuth()

app.mount('#app')
