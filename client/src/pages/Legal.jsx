import React from 'react'
import { Link } from 'react-router-dom'

export default function Legal({ page }) {
  const isTerms = page === 'termos'
  return (
    <div className="card" style={{ maxWidth: 760, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24 }}>{isTerms ? 'Termos de Uso' : 'Política de Privacidade'}</h1>
      {isTerms ? (
        <>
          <p className="small muted">Última atualização: outubro de 2026. Este documento resumo está sujeito a revisão jurídica especializada.</p>
          <h3>1. O que é o JOB</h3>
          <p>JOB é uma plataforma que conecta clientes a profissionais de serviços presenciais e digitais. O JOB não é o prestador dos serviços: profissionais autônomos e empresas contratados diretamente respondem pelos serviços executados.</p>
          <h3>2. Contas</h3>
          <p>Cada pessoa ou empresa mantém uma única conta e é responsável pela veracidade das informações fornecidas e pela confidencialidade da sua senha.</p>
          <h3>3. Solicitações e propostas</h3>
          <p>O cliente descreve o serviço desejado; profissionais elegíveis podem enviar até 3 propostas por solicitação. A proposta aceita dá origem a um trabalho com cronograma e condições próprias.</p>
          <h3>4. Conduta</h3>
          <p>É vedado fornecer informações falsas, fabricar avaliações, violar a privacidade de outros usuários ou usar a plataforma para atividades ilícitas. Violações podem resultar em suspensão.</p>
          <h3>5. Pagamentos</h3>
          <p>Os pagamentos entre cliente e profissional ocorrem fora da plataforma nesta fase; recursos de pagamento integrado serão ativados apenas quando devidamente configurados e comunicados.</p>
        </>
      ) : (
        <>
          <p className="small muted">Última atualização: outubro de 2026. Este documento resumo está sujeito a revisão jurídica especializada (LGPD — Lei nº 13.709/2018).</p>
          <h3>1. Dados coletados</h3>
          <p>Colecionamos o mínimo necessário: nome, e-mail, telefone e cidade (opcionais conforme o uso), conteúdo das solicitações, propostas, mensagens de trabalhos e avaliações.</p>
          <h3>2. Finalidade</h3>
          <p>Os dados são usados para operar a plataforma: apresentar solicitações a profissionais compatíveis, viabilizar comunicação entre as partes, moderação e prevenção a abusos.</p>
          <h3>3. Compartilhamento</h3>
          <p>Dados do trabalho (nome, perfil, propostas) são compartilhados apenas com os participantes do trabalho e com a equipe de moderação. Não vendemos dados pessoais.</p>
          <h3>4. Seus direitos</h3>
          <p>Você pode acessar e corrigir seus dados no painel, e solicitar a exclusão da conta — os dados pessoais são anonimizados e os registros comerciais são retidos conforme obrigação legal.</p>
          <h3>5. Retenção e segurança</h3>
          <p>Registros de trabalhos e mensagens são mantidos para fins de histórico e resolução de disputas. Aplicamos controles de acesso e limitamos o acesso de equipe aos dados pessoais.</p>
        </>
      )}
      <p className="small"><Link to="/">← Voltar ao início</Link></p>
    </div>
  )
}
