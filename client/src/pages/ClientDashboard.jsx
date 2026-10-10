import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { EmptyState, Badge } from '../components.jsx'
import { formatBRL, formatDate, REQUEST_STATUS, statusBadge } from '../format.jsx'

export default function ClientDashboard() {
  const [requests, setRequests] = useState(null)

  useEffect(() => { api('/requests').then((d) => setRequests(d.requests)).catch(() => setRequests([])) }, [])

  return (
    <>
      <div className="spread" style={{ marginBottom: 18 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Meu painel</h1>
        <Link to="/painel/solicitacoes/nova" className="btn btn-primary">Nova solicitação</Link>
      </div>

      {requests === null ? (
        <p className="muted">Carregando…</p>
      ) : requests.length === 0 ? (
        <EmptyState
          title="Você ainda não tem solicitações"
          action={<Link to="/painel/solicitacoes/nova" className="btn btn-primary">Solicitar orçamento</Link>}
        >
          Descreva o serviço que você precisa e receba propostas de profissionais compatíveis.
        </EmptyState>
      ) : (
        requests.map((r) => (
          <Link key={r.id} to={`/painel/solicitacoes/${r.id}`} className="list-item" style={{ display: 'block', color: 'inherit' }}>
            <div className="spread">
              <div>
                <h3>{r.title}</h3>
                <p className="muted small" style={{ margin: 0 }}>
                  {r.category_name} · {r.service_type === 'digital' ? 'Digital' : r.city}
                  {r.preferred_date ? ` · Preferência: ${r.preferred_date}` : ''} · Criada em {formatDate(r.created_at)}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                {statusBadge(r.status, REQUEST_STATUS)}
                {r.status !== 'CANCELLED' && r.budget_max != null && (
                  <div className="small muted" style={{ marginTop: 6 }}>Orçamento até {formatBRL(r.budget_max)}</div>
                )}
              </div>
            </div>
          </Link>
        ))
      )}
    </>
  )
}
