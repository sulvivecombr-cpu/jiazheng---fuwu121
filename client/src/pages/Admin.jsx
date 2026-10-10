import React, { useEffect, useState } from 'react'
import { api } from '../api.js'
import { ErrorBanner, SuccessBanner, Badge } from '../components.jsx'
import { formatDateTime } from '../format.jsx'

const TABS = [
  ['visao', 'Visão geral'],
  ['usuarios', 'Usuários'],
  ['profissionais', 'Profissionais'],
  ['categorias', 'Categorias'],
  ['denuncias', 'Denúncias'],
  ['auditoria', 'Auditoria'],
]

export default function Admin() {
  const [tab, setTab] = useState('visao')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function flash(msg) { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }

  return (
    <>
      <h1 className="page-title" style={{ fontSize: 24 }}>Administração</h1>
      <ErrorBanner message={error} />
      <SuccessBanner message={success} />
      <div className="tabs">
        {TABS.map(([id, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'visao' && <Overview />}
      {tab === 'usuarios' && <Users onError={setError} flash={flash} />}
      {tab === 'profissionais' && <Professionals onError={setError} flash={flash} />}
      {tab === 'categorias' && <Categories onError={setError} flash={flash} />}
      {tab === 'denuncias' && <Reports onError={setError} flash={flash} />}
      {tab === 'auditoria' && <AuditLog />}
    </>
  )
}

function Overview() {
  const [stats, setStats] = useState(null)
  useEffect(() => { api('/admin/stats').then(setStats).catch(() => setStats({})) }, [])
  if (!stats) return <p className="muted">Carregando…</p>
  const CARDS = [
    ['Clientes', stats.clients], ['Profissionais', stats.professionals],
    ['Solicitações', stats.requests], ['Abertas a propostas', stats.openRequests],
    ['Propostas', stats.proposals], ['Trabalhos', stats.jobs],
    ['Trabalhos concluídos', stats.completedJobs], ['Denúncias abertas', stats.openReports],
    ['Verificações pendentes', stats.pendingVerifications],
  ]
  return (
    <>
      <div className="stat-cards">
        {CARDS.map(([label, value]) => (
          <div key={label} className="stat-card">
            <div className="stat-num">{value ?? '—'}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>
      <p className="small muted" style={{ marginTop: 16 }}>
        Pagamentos integrados: <strong>não configurados</strong> — nenhuma transação é processada nesta fase. Stripe requer credenciais e aprovação comercial antes da ativação.
      </p>
    </>
  )
}

function Users({ onError, flash }) {
  const [users, setUsers] = useState(null)
  const [q, setQ] = useState('')

  const load = () => api(`/admin/users${q ? '?q=' + encodeURIComponent(q) : ''}`).then((d) => setUsers(d.users)).catch((e) => onError(e.message))
  useEffect(() => { load() }, [q])

  async function setStatus(id, status) {
    try {
      await api(`/admin/users/${id}/status`, { method: 'POST', body: { status } })
      flash(status === 'suspended' ? 'Conta suspensa.' : 'Conta reativada.')
      load()
    } catch (e) { onError(e.message) }
  }

  if (!users) return <p className="muted">Carregando…</p>
  return (
    <>
      <input placeholder="Buscar por nome ou e-mail…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 320, marginBottom: 12 }} />
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Cidade</th><th>Status</th><th>Cadastro</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td><td>{u.email}</td>
                <td><Badge tone={u.role === 'admin' ? 'purple' : u.role === 'professional' ? 'blue' : 'gray'}>{u.role}</Badge></td>
                <td>{u.city || '—'}</td>
                <td><Badge tone={u.status === 'active' ? 'green' : 'red'}>{u.status === 'active' ? 'Ativa' : 'Suspensa'}</Badge></td>
                <td className="small muted">{formatDateTime(u.created_at)}</td>
                <td>
                  {u.role !== 'admin' && (u.status === 'active'
                    ? <button className="btn btn-danger btn-sm" onClick={() => { if (window.confirm(`Suspender ${u.name}?`)) setStatus(u.id, 'suspended') }}>Suspender</button>
                    : <button className="btn btn-ghost btn-sm" onClick={() => setStatus(u.id, 'active')}>Reativar</button>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {users.length === 0 && <p className="muted">Nenhum usuário encontrado.</p>}
    </>
  )
}

function Professionals({ onError, flash }) {
  const [pros, setPros] = useState(null)
  const load = () => api('/admin/professionals').then((d) => setPros(d.professionals)).catch((e) => onError(e.message))
  useEffect(() => { load() }, [])

  async function verify(userId, verified) {
    try {
      await api(`/admin/professionals/${userId}/verification`, { method: 'POST', body: { verified, note: verified ? 'Documentação e dados conferidos pela equipe JOB.' : '' } })
      flash(verified ? 'Perfil verificado.' : 'Verificação removida.')
      load()
    } catch (e) { onError(e.message) }
  }

  if (!pros) return <p className="muted">Carregando…</p>
  if (pros.length === 0) return <p className="muted">Nenhum perfil profissional cadastrado ainda.</p>
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Nome exibido</th><th>Conta</th><th>Categorias</th><th>Áreas</th><th>Remoto</th><th>Verificação</th><th></th></tr></thead>
        <tbody>
          {pros.map((p) => (
            <tr key={p.id}>
              <td>{p.display_name}<div className="small muted">{p.name} · {p.email}</div></td>
              <td>{p.account_type === 'business' ? 'Empresa' : 'Autônomo'}</td>
              <td>{p.categories.join(', ') || '—'}</td>
              <td>{p.areas.join(', ') || '—'}</td>
              <td>{p.offers_remote ? 'Sim' : 'Não'}</td>
              <td><Badge tone={p.verified ? 'green' : 'gray'}>{p.verified ? 'Verificado' : 'Pendente'}</Badge></td>
              <td>
                {p.verified
                  ? <button className="btn btn-danger btn-sm" onClick={() => { if (window.confirm('Remover verificação?')) verify(p.user_id, false) }}>Remover</button>
                  : <button className="btn btn-primary btn-sm" onClick={() => { if (window.confirm('Confirmar verificação deste perfil?')) verify(p.user_id, true) }}>Verificar</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Categories({ onError, flash }) {
  const [cats, setCats] = useState(null)
  const [form, setForm] = useState({ slug: '', name: '' })
  const load = () => api('/admin/categories').then((d) => setCats(d.categories)).catch((e) => onError(e.message))
  useEffect(() => { load() }, [])

  async function create(e) {
    e.preventDefault()
    try {
      await api('/admin/categories', { method: 'POST', body: form })
      flash('Categoria criada.'); setForm({ slug: '', name: '' }); load()
    } catch (err) { onError(err.message) }
  }
  async function toggle(cat) {
    try {
      await api(`/admin/categories/${cat.id}`, { method: 'PATCH', body: { active: !cat.active } })
      flash(cat.active ? 'Categoria desativada.' : 'Categoria ativada.'); load()
    } catch (e) { onError(e.message) }
  }

  if (!cats) return <p className="muted">Carregando…</p>
  return (
    <>
      <form className="row card" style={{ marginBottom: 16 }} onSubmit={create}>
        <input placeholder="slug (ex.: piscinas)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} style={{ maxWidth: 200 }} />
        <input placeholder="Nome da categoria" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ maxWidth: 260 }} />
        <button className="btn btn-primary btn-sm" type="submit">Adicionar</button>
      </form>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Slug</th><th>Nome</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {cats.map((c) => (
              <tr key={c.id}>
                <td className="small">{c.slug}</td><td>{c.name}</td>
                <td><Badge tone={c.active ? 'green' : 'gray'}>{c.active ? 'Ativa' : 'Desativada'}</Badge></td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => toggle(c)}>{c.active ? 'Desativar' : 'Ativar'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Reports({ onError, flash }) {
  const [reports, setReports] = useState(null)
  const load = () => api('/admin/reports').then((d) => setReports(d.reports)).catch((e) => onError(e.message))
  useEffect(() => { load() }, [])

  async function setStatus(id, status) {
    try {
      await api(`/admin/reports/${id}/status`, { method: 'POST', body: { status } })
      flash(status === 'resolved' ? 'Denúncia resolvida.' : 'Denúncia descartada.')
      load()
    } catch (e) { onError(e.message) }
  }

  if (!reports) return <p className="muted">Carregando…</p>
  if (reports.length === 0) return <p className="muted">Nenhuma denúncia registrada.</p>
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Trabalho</th><th>Denunciante</th><th>Motivo</th><th>Data</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {reports.map((r) => (
            <tr key={r.id}>
              <td><a href={`/trabalho/${r.target_id}`}>Trabalho #{r.target_id}</a></td>
              <td>{r.reporter_name}</td><td>{r.reason}</td>
              <td className="small muted">{formatDateTime(r.created_at)}</td>
              <td><Badge tone={r.status === 'open' ? 'red' : 'gray'}>{r.status === 'open' ? 'Aberta' : r.status === 'resolved' ? 'Resolvida' : 'Descartada'}</Badge></td>
              <td>
                {r.status === 'open' && (
                  <>
                    <button className="btn btn-primary btn-sm" onClick={() => setStatus(r.id, 'resolved')}>Resolver</button>{' '}
                    <button className="btn btn-ghost btn-sm" onClick={() => setStatus(r.id, 'dismissed')}>Descartar</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AuditLog() {
  const [logs, setLogs] = useState(null)
  useEffect(() => { api('/admin/audit').then((d) => setLogs(d.logs)).catch(() => setLogs([])) }, [])
  if (!logs) return <p className="muted">Carregando…</p>
  if (logs.length === 0) return <p className="muted">Nenhum evento registrado ainda.</p>
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Data</th><th>Responsável</th><th>Ação</th><th>Alvo</th></tr></thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td className="small muted">{formatDateTime(l.created_at)}</td>
              <td>{l.actor_name || '—'}</td>
              <td><code className="small">{l.action}</code></td>
              <td className="small">{l.target}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
