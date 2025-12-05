import { useContext } from 'react'
import { AppContext, type AppContextType } from '@/contexts/AppContextTypes'

export const useApp = (): AppContextType => {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}
