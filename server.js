const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Credenciais SyncPay ───────────────────────────────────────────────────
const CLIENT_ID     = '84cb8b13-80cd-4d36-8d23-2dbb45770ab2';
const CLIENT_SECRET = '42166320-6824-4493-a544-5515ace7c961';
const BASE_URL      = 'https://api.syncpayments.com.br';
// ──────────────────────────────────────────────────────────────────────────

app.use(cors({ origin: '*', methods: ['GET','POST','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.options('*', cors());
app.use(express.json());

// ─── Health check ──────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'BuyTicket Proxy online ✅' });
});

// ─── Descobrir IP de saída ─────────────────────────────────────────────────
app.get('/meu-ip', async (req, res) => {
  try {
    const r = await fetch('https://api.ipify.org?format=json');
    const data = await r.json();
    res.json({ ip_saida: data.ip });
  } catch(e) {
    res.json({ erro: e.message });
  }
});

// ─── Criar cobrança PIX ────────────────────────────────────────────────────
app.post('/criar-pix', async (req, res) => {
  try {
    const body = req.body;

    // PASSO 1: Gerar Bearer Token
    console.log('→ Gerando token SyncPay...');
    const tokenResp = await fetch(`${BASE_URL}/api/partner/v1/auth-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET })
    });
    const tokenData = await tokenResp.json();
    console.log('← Token response:', JSON.stringify(tokenData));

    if (!tokenData.access_token) {
      return res.status(401).json({ success: false, error: 'Falha ao gerar token', raw: tokenData });
    }

    const token = tokenData.access_token;

    // PASSO 2: Criar cobrança PIX (Cash-in)
    const payload = {
      amount:      500.00,
      description: 'BTS - 2026 World Tour Arirang - Arquibancada Meia Estudante',
      webhook_url: '',
      client: {
        name:  body.nome     || 'Cliente',
        cpf:   body.cpf      || '',
        email: body.email    || 'cliente@email.com',
        phone: body.telefone || ''
      }
    };

    console.log('→ Criando PIX:', JSON.stringify(payload));

    const pixResp = await fetch(`${BASE_URL}/api/partner/v1/cash-in`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json'
      },
      body: JSON.stringify(payload)
    });

    const pixData = await pixResp.json();
    console.log('← PIX response:', JSON.stringify(pixData));

    const pixCode = pixData.pix_code || '';

    res.json({
      success:   pixResp.ok,
      status:    pixResp.status,
      brCode:    pixCode,
      qrCodeUrl: pixCode ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(pixCode)}` : '',
      txId:      pixData.identifier || '',
      raw:       pixData
    });

  } catch (err) {
    console.error('Erro:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => console.log(`✅ Proxy na porta ${PORT}`));
