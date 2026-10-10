import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'

const STEPS = [
  { n: 1, t: 'Descreva o serviço', d: 'Diga o que precisa, onde e quando. Leva menos de 2 minutos.' },
  { n: 2, t: 'Receba propostas', d: 'Profissionais compatíveis com a sua necessidade enviam propostas reais.' },
  { n: 3, t: 'Escolha e acompanhe', d: 'Compare preços e prazos, escolha o profissional e acompanhe o trabalho até o fim.' },
]

export default function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState({ categoria: '', cidade: '' })

  useEffect(() => { api('/categories').then((d) => setCategories(d.categories)).catch(() => {}) }, [])

  function search(e) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (form.categoria) params.set('categoria', form.categoria)
    if (form.cidade) params.set('cidade', form.cidade)
    navigate(`/buscar?${params.toString()}`)
  }

  const requestCta = user?.role === 'client' ? '/painel/solicitacoes/nova' : '/cadastro/cliente'

  return (
    <>
      <section className="hero">
        <h1>Contrate profissionais de confiança para o que você precisa</h1>
        <p>Serviços presenciais e digitais, de limpeza e reparos a design e programação. Descreva o serviço, receba até 3 propostas reais e escolha a melhor.</p>
        <form className="hero-search" onSubmit={search}>
          <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} aria-label="Categoria">
            <option value="">Todas as categorias</option>
            {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select>
          <input placeholder="Cidade (opcional)" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} aria-label="Cidade" />
          <button className="btn btn-primary" type="submit">Buscar</button>
        </form>
        <div style={{ marginTop: 18 }}>
          {user?.role === 'client' ? (
            <Link to={requestCta} className="btn btn-primary">Solicitar orçamento</Link>
          ) : !user ? (
            <>
              <Link to={requestCta} className="btn btn-primary" style={{ background: 'var(--accent)', color: '#422b00' }}>Solicitar orçamento</Link>{' '}
              <Link to="/cadastro/profissional" className="btn btn-ghost" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.4)' }}>Sou profissional</Link>
            </>
          ) : null}
        </div>
      </section>

      <section className="section">
        <h2>Categorias de serviço</h2>
        {categories.length === 0 ? (
          <p className="muted">Nenhuma categoria configurada ainda.</p>
        ) : (
          <div className="cat-grid">
            {categories.map((c) => (
              <Link key={c.id} className="cat-card" to={`/buscar?categoria=${c.slug}`}>
                <span aria-hidden>{c.icon || '•'}</span>{c.name}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <h2>Como funciona</h2>
        <div className="grid-3">
          {STEPS.map((s) => (
            <div key={s.n} className="card">
              <h3>{s.n}. {s.t}</h3>
              <p className="muted">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section card">
        <div className="spread">
          <div>
            <h2 style={{ marginBottom: 4 }}>É profissional?</h2>
            <p className="muted" style={{ marginBottom: 0 }}>Crie seu perfil, escolha as categorias que atende e receba solicitações compatíveis com o seu trabalho.</p>
          </div>
          <Link to="/cadastro/profissional" className="btn btn-primary">Criar perfil profissional</Link>
        </div>
      </section>
    </>
  )
}
