import React from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components.jsx'

export default function NotFound() {
  return (
    <EmptyState title="Página não encontrada">
      O endereço acessado não existe.
      <br /><Link to="/">Voltar ao início</Link>
    </EmptyState>
  )
}
