import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { firebaseAuth, googleAuthProvider } from '@/lib/firebase'

type AuthContextValue = {
  currentUser: User | null
  isInitializing: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      setCurrentUser(user)
      setIsInitializing(false)
    })
    return () => unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    await signInWithPopup(firebaseAuth, googleAuthProvider)
  }

  const signOut = async () => {
    await firebaseSignOut(firebaseAuth)
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      isInitializing,
      signInWithGoogle,
      signOut,
    }),
    [currentUser, isInitializing]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}


