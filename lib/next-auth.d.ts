import { DefaultSession, DefaultJWT } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      rol?: string; usuarioId?: string; nombre?: string; codigoDespacho?: string; nombreJuzgado?: string
      capacidadMaxima?: number; especialidades?: string[]; disponibilidad?: string
    } & DefaultSession["user"]
  }
  interface User {
    rol?: string; usuarioId?: string; nombre?: string; codigoDespacho?: string; nombreJuzgado?: string
    capacidadMaxima?: number; especialidades?: string[]; disponibilidad?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    rol?: string; usuarioId?: string; nombre?: string; blocked?: boolean; codigoDespacho?: string; nombreJuzgado?: string
    capacidadMaxima?: number; especialidades?: string[]; disponibilidad?: string
  }
}