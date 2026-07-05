import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { auth } from "@/lib/auth"

const SMMLV_2026 = 1423500

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const juzgadoFiltro = searchParams.get("juzgado") || undefined
  const rol = session.user.rol

  function convertirSancionACOP(cantidad_sancion: any, tipo_sancion: string | null): number {
    if (!cantidad_sancion) return 0
    const num = parseFloat(String(cantidad_sancion).replace(/[^0-9.]/g, ""))
    return isNaN(num) ? 0 : num
  }

  let solicitudesQuery = supabase.from("solicitudes").select(
    "id, estado, nombre_juzgado, clase_proceso, asunto, fecha_solicitud, fecha_asignacion, etapa_preliminar, abogado_asignado_id, sancionados(cantidad_sancion, tipo_sancion, nombre_completo, numero_documento, tipo_documento)"
  )

  if (rol === "JUZGADO") {
    solicitudesQuery = solicitudesQuery.eq("nombre_juzgado", session.user.nombreJuzgado || juzgadoFiltro || "")
  } else if (juzgadoFiltro) {
    solicitudesQuery = solicitudesQuery.ilike("nombre_juzgado", `%${juzgadoFiltro}%`)
  }

  const { data: solicitudes, error } = await solicitudesQuery.order("fecha_solicitud", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!solicitudes?.length) return NextResponse.json(EMPTY_BI_RESPONSE)
  return NextResponse.json(procesarSolicitudes(solicitudes))
}

const EMPTY_BI_RESPONSE = {
  kpi: { totalSancionados: 0, totalRadicaciones: 0, valorTotalSancionesCOP: 0, valorTotalSancionesSMMLV: 0, montoTotalPendiente: 0, totalActivas: 0, tasaRecaudo: 0, tiempoPromedioCierre: 0 },
  montoPorJuzgado: [], solicitudesPorEstado: {}, distribucionNaturaleza: [], distribucionConcepto: [],
  sancionadosPorJuzgado: [], radicacionesPorJuzgado: [], topSancionados: [],
}

function procesarSolicitudes(solicitudes: any[]) {
  let totalSancionados = 0, valorTotalCOP = 0, valorTotalSMMLV = 0
  const juzgadosMap = new Map(), estadosMap: Record<string, number> = {}
  const naturalezaMap = new Map(), conceptoMap = new Map(), sancionadosMap = new Map()
  for (const sol of solicitudes) {
    const sancionadosList = sol.sancionados || []
    totalSancionados += sancionadosList.length
    for (const san of sancionadosList) {
      const montoCOP = convertirSancionACOP(san.cantidad_sancion, san.tipo_sancion)
      valorTotalCOP += montoCOP
      if (san.tipo_sancion === "SMMLV") valorTotalSMMLV += parseFloat(String(san.cantidad_sancion || 0).replace(/[^0-9.]/g, "")) || 0
      const key = `${san.numero_documento || 'sin-doc'}_${san.nombre_completo || 'sin-nombre'}`
      const existing = sancionadosMap.get(key) || { nombre: san.nombre_completo || 'Sin nombre', documento: san.numero_documento || '', tipoDoc: san.tipo_documento || 'CC', montoCOP: 0, solicitudes: 0 }
      existing.montoCOP += montoCOP; existing.solicitudes += 1
      sancionadosMap.set(key, existing)
    }
    const juzgado = sol.nombre_juzgado || "Sin Juzgado"
    if (!juzgadosMap.has(juzgado)) juzgadosMap.set(juzgado, { monto_pendiente: 0, casos: 0 })
    juzgadosMap.get(juzgado).monto_pendiente += valorTotalCOP / (sancionadosList.length || 1)
    juzgadosMap.get(juzgado).casos += 1
    estadosMap[sol.estado || "DESCONOCIDO"] = (estadosMap[sol.estado || "DESCONOCIDO"] || 0) + 1
    const nat = sol.clase_proceso || "Sin Naturaleza"
    if (!naturalezaMap.has(nat)) naturalezaMap.set(nat, { total: 0, activos: 0, monto: 0 })
    naturalezaMap.get(nat).total += 1
    const con = sol.asunto || "Sin Concepto"
    if (!conceptoMap.has(con)) conceptoMap.set(con, { total: 0, activos: 0, monto: 0 })
    conceptoMap.get(con).total += 1
  }
  const topSancionados = Array.from(sancionadosMap.values()).sort((a: any, b: any) => b.montoCOP - a.montoCOP).slice(0, 10)
  return {
    kpi: { totalSancionados, totalRadicaciones: solicitudes.length, valorTotalSancionesCOP: valorTotalCOP, valorTotalSancionesSMMLV: valorTotalSMMLV, montoTotalPendiente: valorTotalCOP, totalActivas: solicitudes.filter((s: any) => s.estado !== "RADICADA_EN_GCC").length, tasaRecaudo: 0, tiempoPromedioCierre: 0 },
    montoPorJuzgado: Array.from(juzgadosMap.entries()).map(([j, d]) => ({ juzgado: j, ...d })),
    solicitudesPorEstado: estadosMap,
    distribucionNaturaleza: Array.from(naturalezaMap.entries()).map(([c, d]) => ({ clase: c, ...d })),
    distribucionConcepto: Array.from(conceptoMap.entries()).map(([c, d]) => ({ clase: c, ...d })),
    sancionadosPorJuzgado: [], radicacionesPorJuzgado: [], topSancionados,
  }
}