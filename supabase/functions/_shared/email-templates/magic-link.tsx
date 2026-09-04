/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu link de acesso à Analytical X</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={brand}>Analytical <span style={brandX}>X</span></Heading>
        <Heading style={h1}>Seu link de acesso</Heading>
        <Text style={text}>Clique no botão abaixo para entrar na Analytical X. Este link expira em alguns minutos.</Text>
        <Button style={button} href={confirmationUrl}>Entrar</Button>
        <Text style={footer}>Se você não solicitou este link, pode ignorar este email.</Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const brand = { fontSize: '20px', fontWeight: 'bold' as const, color: '#0F172A', margin: '0 0 28px' }
const brandX = { color: '#2563EB' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0F172A', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#475569', lineHeight: '1.6', margin: '0 0 20px' }
const button = {
  backgroundColor: '#2563EB', color: '#ffffff', fontSize: '15px', fontWeight: 'bold' as const,
  borderRadius: '10px', padding: '14px 28px', textDecoration: 'none', display: 'inline-block', margin: '8px 0 24px',
}
const footer = { fontSize: '12px', color: '#94a3b8', margin: '30px 0 0' }
