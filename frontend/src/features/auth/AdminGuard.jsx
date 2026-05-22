import { Navigate } from 'react-router-dom'

function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return Date.now() >= payload.exp * 1000
  } catch {
    return true
  }
}

export default function AdminGuard({ children }) {
  const token = localStorage.getItem('admin_token')
  if (!token || isTokenExpired(token)) {
    localStorage.removeItem('admin_token')
    return <Navigate to="/admin/login" replace />
  }
  return children
}
