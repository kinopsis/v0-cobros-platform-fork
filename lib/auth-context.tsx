"use client"
import { SessionProvider, useSession, signIn, signOut } from "next-auth/react"
import { createContext, useContext, type ReactNode } from "react"
import { Usuario, UserRole } from "./types"

interface AuthContextType {
  user: Usuario | null; isAuthenticated: boolean; isLoading: boolean; isOffice365Enabled: boolean
  login: () => void; loginWithCredentials: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>; logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function AuthProviderInner({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const isOffice365Enabled = process.env.NEXT_PUBLIC_AZURE_AD_ENABLED === "true"
  const user: Usuario | null = session?.user ? {
    id: session.user.usuarioId || "", email: session.user.email || "", nombre: session.user.nombre || session.user.name || "",
    rol: (session.user.rol as UserRole) || "JUZGADO", activo: true,
    codigoDespacho: session.user.codigoDespacho || "", nombreJuzgado: session.user.nombreJuzgado || "",
    capacidadMaxima: session.user.capacidadMaxima ?? 20, especialidades: (session.user.especialidades || []) as any, disponibilidad: (session.user.disponibilidad || "DISPONIBLE") as any,
  } : null
  const loginWithCredentials = async (email: string, password: string) => {
    const result = await signIn("credentials", { email, password, redirect: false, callbackUrl: "/dashboard" })
    if (result?.error) return { ok: false, error: result.error === "CredentialsSignin" ? "Credenciales invalidas" : result.error }
    return { ok: true }
  }
  const value: AuthContextType = { user, isAuthenticated: status === "authenticated" && !!user, isLoading: status === "loading", isOffice365Enabled, login: () => signIn("azure-ad", { callbackUrl: "/dashboard" }), loginWithCredentials, logout: () => signOut({ callbackUrl: "/login" }) }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function AuthProvider({ children }: { children: ReactNode }) { return <SessionProvider><AuthProviderInner>{children}</AuthProviderInner></SessionProvider> }
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) throw new Error("useAuth debe ser usado dentro de un AuthProvider")
  return context
}