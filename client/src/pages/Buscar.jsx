import React, { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { api } from '../api.js'
import { EmptyState, Badge } from '../components.jsx'
import { formatBRL } from '../format.jsx'

export default function Buscar() {
  const [params, setParams] = useSearchParams()
  const [categories, setCategories] = useState([])
  const [professionals, setProfessionals] = useState(null)
  const [filters, setFilters] = useState({
    categoria: params.get('categoria') || '',
    cidade: params.get('cidade') || '',
    remoto: params.get('remoto') === '1',
  })

  useEffect(() => { api('/categories').then((d) => setCategories(d.categories)).catch(() => {}) }, [])

  useEffect(() => {
    const q = new URLSearchParams()
    if (filters.categoria) q.set('categoria', filters.categoria)
    if (filters.cidade) q.set('cidade', filters.cidade)
    if (filters.remoto) q.set('remoto', '1')
    setParams(q, { replace: true })
    setProfessionals(null)
    const qs = q.toString()
    api(`/professionals${qs ? '?' + qs : ''}`).then((d) => setProfessionals(d.professionals)).catch(() => setProfessionals([]))
  }, [filters])

  const catName = (slug) => categories.find((c) => c.slug === slug)?.name || slug

  return (
    <>
      <h1 className="page-title">Encontrar profissionais</h1>
      <div className="filter-bar">
        <select value={filters.categoria} onChange={(e) => setFilters({ ...filters, categoria: e.target.value })} aria-label="Categoria">
          <option value="">Todas as categorias</option>
          {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
        </select>
        <input placeholder="Cidade" value={filters.cidade} onChange={(e) => setFilters({ ...filters, cidade: e.target.value })} aria-label="Cidade" />
        <label className="checkbox-row" style={{ margin: 0 }}>
          <input type="checkbox" checked={filters.remoto} onChange={(e) => setFilters({ ...filters, remoto: e.target.checked })} />
          Atende remotamente
        </label>
      </div>

      {professionals === null ? (
        <p className="muted">Buscando…</p>
      ) : professionals.length === 0 ? (
        <EmptyState title="Nenhum profissional encontrado">
          Não encontramos profissionais com esses critérios ainda. Ajuste a busca — tente outra categoria, remova o filtro de cidade ou marque "atende remotamente".
        </EmptyState>
      ) : (
        professionals.map((p) => (
          <div key={p.id} className="list-item">
            <div className="spread">
              <div>
                <h3>{p.display_name} {p.verified && <span className="verified-mark" title="Perfil verificado pela equipe JOB">✓ Verificado</span>}</h3>
                <p className="muted small" style={{ margin: 0 }}>
                  {p.city ? `${p.city} · ` : ''}
                  {p.categories.map(catName).join(', ')}
                  {p.offers_remote ? ' · Atende remotamente' : ''}
                </p>
                {p.bio && <p className="small" style={{ marginTop: 8 }}>{p.bio}</p>}
              </div>
              <div style={{ textAlign: 'right' }}>
                {p.rating && <div><Badge tone="amber">★ {p.rating.avg.toFixed(1)} ({p.rating.count})</Badge></div>}
              </div>
            </div>
          </div>
        ))
      )}
      {!filters.categoria && !filters.cidade && !filters.remoto && (
        <p className="muted small" style={{ marginTop: 10 }}>
          Quer contratar? <Link to="/cadastro/cliente">Crie sua conta</Link> e solicite orçamentos — os profissionais elegíveis enviam propostas para você.
        </p>
      )}
    </>
  )
}
