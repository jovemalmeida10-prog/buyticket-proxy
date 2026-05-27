const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Credenciais AlphaCashPay ──────────────────────────────────────────────
const PUBLIC_KEY = 'pk_MIn4HqLS0-zZ9MiCbK9voZWnenhR2__2jhyOzQ9P_r0GmgHF';
const SECRET_KEY = 'sk_qbJG2APDqp6cNwR71UKKlOAIJlYhcniatd3psgo9ejrAxdHU';
const AUTH       = 'Basic ' + Buffer.from(PUBLIC_KEY + ':' + SECRET_KEY).toString('base64');
const BASE_URL   = 'https://api.alphacashpay.com.br/v1';
// ──────────────────────────────────────────────────────────────────────────

app.use(cors({ origin: '*', methods: ['GET','POST','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.options('*', cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'BuyTicket Proxy (AlphaCashPay) online ✅' });
});

app.get('/meu-ip', async (req, res) => {
  try {
    const r = await fetch('https://api.ipify.org?format=json');
    res.json(await r.json());
  } catch(e) { res.json({ erro: e.message }); }
});

app.get('/cep/:cep', async (req, res) => {
  const cep = req.params.cep.replace(/\D/g, '');
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const d = await r.json();
    if (d.erro) return res.json({ encontrado: false });
    res.json({ encontrado: true, uf: d.uf, bairro: d.bairro, cidade: d.localidade, rua: d.logradouro });
  } catch(e) {
    try {
      const r2 = await fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`);
      const d2 = await r2.json();
      res.json({ encontrado: true, uf: d2.state, bairro: d2.neighborhood, cidade: d2.city, rua: d2.street });
    } catch(e2) { res.json({ encontrado: false }); }
  }
});

// ─── Criar cobrança PIX ────────────────────────────────────────────────────
app.post('/criar-pix', async (req, res) => {
  try {
    const body   = req.body;
    const amount = parseFloat(body.amount) || 850.00;
    const nome   = body.nome  || 'Cliente';
    const email  = body.email || 'cliente@email.com';
    const cpf    = (body.cpf  || '52998224725').replace(/\D/g, '');

    const payload = {
      amount:        Math.round(amount * 100), // em centavos
      paymentMethod: 'pix',
      items: [{
        title:      'BTS 2026 World Tour Arirang - Arquibancada',
        quantity:   1,
        unitPrice:  Math.round(amount * 100),
        tangible:   false
      }],
      customer: {
        name:     nome,
        email:    email,
        document: cpf
      },
      pix: {
        expiresInMinutes: 30
      }
    };

    console.log('→ AlphaCashPay payload:', JSON.stringify(payload));

    const response = await fetch(`${BASE_URL}/transactions`, {
      method: 'POST',
      headers: {
        'Authorization': AUTH,
        'Content-Type':  'application/json',
        'Accept':        'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('← AlphaCashPay response:', JSON.stringify(data));

    // Extract PIX code from response (AlphaCashPay: data.pix.qrcode)
    const brCode    = data.pix?.qrcode || data.pix?.brCode || data.qrcode || '';
    const qrCodeUrl = brCode
      ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(brCode)}`
      : '';

    res.json({
      success:   response.ok,
      status:    response.status,
      brCode,
      qrCodeUrl,
      txId:      data.id?.toString() || data.secureId || '',
      raw:       data
    });

  } catch (err) {
    console.error('Erro:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => console.log(`✅ Proxy AlphaCashPay na porta ${PORT}`));
