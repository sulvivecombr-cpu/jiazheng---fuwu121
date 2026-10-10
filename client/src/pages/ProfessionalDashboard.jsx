import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { Field, ErrorBanner, SuccessBanner, Badge, EmptyState } from '../components.jsx'
import { formatDate, JOB_STATUS, statusBadge } from '../format.jsx'

function ProfileSection({ profile, categories, onSaved }) {
  const [form, setForm] = useState({
    display_name: profile.display_name || '',
    bio: profile.bio || '',
    categories: profile.categories || [],
    areas: (profile.areas || []).join(', '),
    offers_remote: !!profile.offers_remote,
    account_type: profile.account_type || 'individual',
  })
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  function toggleCategory(slug) {
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(slug) ? f.categories.filter((c) => c !== slug) : [...f.categories, slug],
    }))
  }

  async function save(e) {
    e.preventDefault()
    setError(''); setSaved(false); setBusy(true)
    try {
      await api('/professional/profile', {
        method: 'PUT',
        body: { ...form, areas: form.areas.split(',').map((s) => s.trim()).filter(Boolean) },
      })
      setSaved(true)
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card" onSubmit={save} noValidate>
      <h3>Perfil profissional</h3>
      <p className="small muted">Solicitações são enviadas a você conforme as categorias e áreas de atendimento abaixo.</p>
      {profile.verified ? (
        <p><Badge tone="green">✓ Perfil verificado pela equipe JOB</Badge></p>
      ) : (
        <p className="small muted">Verificação: pendente — {profile.verification_note || 'aguardando análise da equipe JOB'}</p>
      )}
      <ErrorBanner message={error} />
      <SuccessBanner message={saved ? 'Perfil atualizado.' : null} />
      <Field label="Nome exibido"><input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} required maxLength={120} /></Field>
      <Field label="Sobre você / serviços oferecidos" hint="Descreva sua experiência e o que você faz.">
        <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={3000} />
      </Field>
      <Field label="Categorias atendidas" hint="Selecione ao menos uma para receber solicitações.">
        <div className="checkbox-row" style={{ flexWrap: 'wrap', gap: 12 }}>
          {categories.map((c) => (
            <label key={c.slug} style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <input type="checkbox" checked={form.categories.includes(c.slug)} onChange={() => toggleCategory(c.slug)} />
              {c.name}
            </label>
          ))}
        </div>
      </Field>
      <Field label="Áreas / municípios atendidos (presencial)" hint="Separe por vírgula. Ex.: São Paulo, Santo André, Guarulhos">
        <input value={form.areas} onChange={(e) => setForm({ ...form, areas: e.target.value })} />
      </Field>
      <Field label="Tipo de conta">
        <select value={form.account_type} onChange={(e) => setForm({ ...form, account_type: e.target.value })}>
          <option value="individual">Profissional autônomo</option>
          <option value="business">Empresa</option>
        </select>
      </Field>
      <label className="checkbox-row">
        <input type="checkbox" checked={form.offers_remote} onChange={(e) => setForm({ ...form, offers_remote: e.target.checked })} />
        <span>Também ofereço serviços digitais / remotos</span>
      </label>
      <button className="btn btn-primary" disabled={busy} type="submit">{busy ? 'Salvando…' : 'Salvar perfil'}</button>
    </form>
  )
}

export default function ProfessionalDashboard() {
  const { me, profile } = useAuth()
  const [categories, setCategories] = useState([])
  const [requests, setRequests] = useState(null)
  const [jobs, setJobs] = useState(null)
  const [profileState, setProfileState] = useState(profile)
  const [tab, setTab] = useState('solicitacoes')

  const loadRequests = () => api('/requests').then((d) => setRequests(d.requests)).catch(() => setRequests([]))
  const loadJobs = () => api('/jobs').then((d) => setJobs(d.jobs)).catch(() => setJobs([]))

  useEffect(() => {
    api('/categories').then((d) => setCategories(d.categories)).catch(() => {})
    loadRequests()
    loadJobs()
  }, [])

  useEffect(() => { setProfileState(profile) }, [profile])

  const completeProfile = profileState && (profileState.categories || []).length > 0

  return (
    <>
      <div className="spread" style={{ marginBottom: 18 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Painel profissional</h1>
        <span className="muted small">{me?.name}</span>
      </div>

      <div className="tabs">
        <button className={tab === 'solicitacoes' ? 'active' : ''} onClick={() => setTab('solicitacoes')}>Solicitações disponíveis</button>
        <button className={tab === 'trabalhos' ? 'active' : ''} onClick={() => setTab('trabalhos')}>Meus trabalhos</button>
        <button className={tab === 'perfil' ? 'active' : ''} onClick={() => setTab('perfil')}>Meu perfil</button>
      </div>

      {tab === 'solicitacoes' && (requests === null ? <p className="muted">Carregando…</p> : requests.length === 0 ? (
        <EmptyState title="Nenhuma solicitação compatível por enquanto">
          {completeProfile
            ? 'Não há solicitações abertas nas suas categorias e áreas neste momento. Você será notificado quando algo compatível aparecer.'
            : 'Complete seu perfil com categorias e áreas de atendimento para começar a receber solicitações.'}
        </EmptyState>
      ) : (
        requests.map((r) => (
          <Link key={r.id} to={`/pro/solicitacoes/${r.id}`} className="list-item" style={{ display: 'block', color: 'inherit' }}>
            <div className="spread">
              <div>
                <h3>{r.title}</h3>
                <p className="muted small" style={{ margin: 0 }}>
                  {r.category_name} · {r.service_type === 'digital' ? 'Digital' : r.city || '—'}
                  {r.preferred_date ? ` · Preferência: ${r.preferred_date}` : ''} · {formatDate(r.created_at)}
                </p>
                {r.match_reasons?.length > 0 && (
                  <p className="small" style={{ margin: '6px 0 0' }}>Compatível: {r.match_reasons.join(' · ')}</p>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                {r.already_proposed ? <Badge tone="purple">Proposta enviada</Badge> : <Badge tone="blue">Aguardando proposta</Badge>}
              </div>
            </div>
          </Link>
        ))
      ))}

      {tab === 'trabalhos' && (jobs === null ? <p className="muted">Carregando…</p> : jobs.length === 0 ? (
        <EmptyState title="Nenhum trabalho ainda">
          Quando um cliente aceitar uma das suas propostas, o trabalho aparecerá aqui.
        </EmptyState>
      ) : (
        jobs.map((j) => (
          <Link key={j.id} to={`/trabalho/${j.id}`} className="list-item" style={{ display: 'block', color: 'inherit' }}>
            <div className="spread">
              <div>
                <h3>{j.title}</h3>
                <p className="muted small" style={{ margin: 0 }}>
                  {j.category_name} · {j.service_type === 'digital' ? 'Digital' : j.city || '—'} · {formatDate(j.updated_at)}
                </p>
              </div>
              {statusBadge(j.status, JOB_STATUS)}
            </div>
          </Link>
        ))
      ))}

      {tab === 'perfil' && profileState && <ProfileSection profile={profileState} categories={categories} onSaved={() => loadRequests()} />}
      {tab === 'perfil' && !profileState && <p className="muted">Carregando perfil…</p>}
    </>
  )
}
