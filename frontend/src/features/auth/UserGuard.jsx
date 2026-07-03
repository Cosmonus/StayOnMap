import { Navigate, useLocation } from 'react-router-dom'

function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return Date.now() >= payload.exp * 1000
  } catch {
    return true
  }
}

export default function UserGuard({ children }) {
  const location = useLocation()
  const token = localStorage.getItem('user_token')
  if (!token || isTokenExpired(token)) {
    localStorage.removeItem('user_token')
    return <Navigate to="/" state={{ from: location.pathname }} replace />
  }
  return children
}
