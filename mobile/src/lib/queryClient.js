import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: (failureCount, err) => {
        const status = err?.statusCode ?? err?.status
        if (status >= 400 && status < 500) return false
        return failureCount < 2
      },
    },
  },
})
