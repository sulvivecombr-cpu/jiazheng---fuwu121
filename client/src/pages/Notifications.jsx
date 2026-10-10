import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { EmptyState, Spinner } from '../components.jsx'
import { formatDateTime } from '../format.jsx'

export default function Notifications() {
  const [items, setItems] = useState(null)

  useEffect(() => {
    api('/notifications').then((d) => setItems(d.notifications))
    api('/notifications/mark-read', { method: 'POST', body: {} }).catch(() => {})
  }, [])

  if (!items) return <p className="muted">Carregando… <Spinner /></p>

  return (
    <>
      <h1 className="page-title">Notificações</h1>
      {items.length === 0 ? (
        <EmptyState title="Nenhuma notificação">
          Você será avisado aqui quando houver propostas, mensagens ou atualizações nos seus trabalhos.
        </EmptyState>
      ) : (
        items.map((n) => (
          <div key={n.id} className="list-item" style={n.read ? { opacity: .75 } : { borderLeft: '3px solid var(--primary)' }}>
            <div className="spread">
              <div>
                <strong>{n.title}</strong>
                {n.body && <p className="small muted" style={{ margin: '2px 0 0' }}>{n.body}</p>}
              </div>
              <span className="small muted">{formatDateTime(n.created_at)}</span>
            </div>
            {n.link && <Link to={n.link} className="small">Abrir →</Link>}
          </div>
        ))
      )}
    </>
  )
}
