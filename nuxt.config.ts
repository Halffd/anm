// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-03-05',
  
  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt'
  ],

  typescript: {
    strict: true,
    typeCheck: true
  },

  // Move any Vite config here
  vite: {
    // Your vite config options
  }
})
