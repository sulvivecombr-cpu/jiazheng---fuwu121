export function formatBRL(cents) {
  if (cents == null || isNaN(cents)) return '—'
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function parseBRL(str) {
  if (!str) return NaN
  const normalized = str.replace(/[R$\s.]/g, '').replace(',', '.')
  const value = Number(normalized)
  if (isNaN(value)) return NaN
  return Math.round(value * 100)
}

export function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return iso
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return iso
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export const REQUEST_STATUS = {
  OPEN: { label: 'Aberta a propostas', tone: 'blue' },
  PROPOSALS_AVAILABLE: { label: 'Propostas recebidas', tone: 'purple' },
  PROFESSIONAL_SELECTED: { label: 'Profissional escolhido', tone: 'amber' },
  IN_PROGRESS: { label: 'Em andamento', tone: 'amber' },
  COMPLETED: { label: 'Concluído', tone: 'green' },
  CANCELLED: { label: 'Cancelada', tone: 'gray' },
  DISPUTED: { label: 'Em disputa', tone: 'red' },
}

export const JOB_STATUS = {
  CONFIRMED: { label: 'Confirmado', tone: 'blue' },
  SCHEDULED: { label: 'Agendado', tone: 'purple' },
  IN_PROGRESS: { label: 'Em andamento', tone: 'amber' },
  PENDING_CONFIRMATION: { label: 'Aguardando confirmação', tone: 'amber' },
  COMPLETED: { label: 'Concluído', tone: 'green' },
  CANCELLED: { label: 'Cancelado', tone: 'gray' },
  DISPUTED: { label: 'Em disputa', tone: 'red' },
}

export function statusBadge(status, map) {
  const s = map[status] || { label: status, tone: 'gray' }
  return <span className={`badge tone-${s.tone}`}>{s.label}</span>
}
