import axios from "axios"
import {
  getAccessToken,
  setAccessToken,
  removeAccessToken,
} from "./utils/token"

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  const token = getAccessToken()

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})


let isRefreshing = false
let failedQueue: any[] = []

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error)
    else prom.resolve(token)
  })

  failedQueue = []
}


api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error)
    }

    originalRequest._retry = true

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            resolve(api(originalRequest))
          },
          reject,
        })
      })
    }

    isRefreshing = true

    try {
      const { data } = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
        {},
        { withCredentials: true }
      )

      setAccessToken(data.accessToken)

      processQueue(null, data.accessToken)

      originalRequest.headers.Authorization = `Bearer ${data.accessToken}`

      return api(originalRequest)
    } catch (err) {
      processQueue(err, null)

      removeAccessToken()

      window.location.href = "/signin"

      return Promise.reject(err)
    } finally {
      isRefreshing = false
    }
  }
)
