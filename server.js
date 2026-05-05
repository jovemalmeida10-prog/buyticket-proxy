const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Credenciais SigiloPay ─────────────────────────────────────────────────
const PUBLIC_KEY = 'almeida-profissional10_bjwtz9lj7eg4gyz5';
const SECRET_KEY = '4ak4p7abvsg9mmxxxglmpa0bi22ow7xyz8hjujce7cxtsfzmtf5kxcm151o32x8g';
const BASE_URL   = 'https://app.sigilopay.com.br/api/v1';
// ──────────────────────────────────────────────────────────────────────────

app.use(cors({ origin: '*', methods: ['GET','POST','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.options('*', cors());
app.use(express.json());

// ─── Health check ──────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'BuyTicket Proxy (SigiloPay) online ✅' });
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

// ─── Buscar CEP ────────────────────────────────────────────────────────────
app.get('/cep/:cep', async (req, res) => {
  const cep = req.params.cep.replace(/\D/g, '');
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await r.json();
    if (data.erro) return res.json({ encontrado: false });
    res.json({
      encontrado: true,
      uf: data.uf,
      bairro: data.bairro,
      cidade: data.localidade,
      rua: data.logradouro
    });
  } catch(e) {
    try {
      const r2 = await fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`);
      const d2 = await r2.json();
      res.json({ encontrado: true, uf: d2.state, bairro: d2.neighborhood, cidade: d2.city, rua: d2.street });
    } catch(e2) {
      res.json({ encontrado: false, erro: e2.message });
    }
  }
});

// ─── Criar cobrança PIX (SigiloPay) ───────────────────────────────────────
app.post('/criar-pix', async (req, res) => {
  try {
    const body = req.body;

    // Identificador único para a transação
    const identifier = 'BT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

    const payload = {
      identifier: identifier,
      amount: 498.90,
      client: {
        name:  body.nome  || 'Cliente',
        email: body.email || 'cliente@email.com',
        cpf:   (body.cpf  || '').replace(/\D/g, ''),
        phone: (body.telefone || '').replace(/\D/g, ''),
        address: {
          street:     body.rua    || '',
          number:     body.numero || '',
          complement: body.complemento || '',
          zipCode:    (body.cep   || '').replace(/\D/g, ''),
          neighborhood: body.bairro || '',
          city:       body.cidade || '',
          state:      body.uf     || '',
        }
      },
      products: [{
        name:     'BTS - 2026 World Tour Arirang - Meia Arquibancada',
        quantity: 1,
        price:    498.90
      }],
      metadata: { provider: 'BuyTicket', event: 'BTS-2026' }
    };

    console.log('→ SigiloPay payload:', JSON.stringify(payload));

    const response = await fetch(`${BASE_URL}/gateway/pix/receive`, {
      method: 'POST',
      headers: {
        'x-public-key':  PUBLIC_KEY,
        'x-secret-key':  SECRET_KEY,
        'Content-Type':  'application/json',
        'Accept':        'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('← SigiloPay response:', JSON.stringify(data));

    // Extrai o pix_code e qr_code da resposta
    const brCode    = data.pix?.code        || data.pix?.brCode      || data.pix?.pixCode  || '';
    const qrCodeUrl = data.pix?.qrCodeImage || data.pix?.qr_code_url || '';

    res.json({
      success:   response.ok,
      status:    response.status,
      brCode:    brCode,
      qrCodeUrl: brCode ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(brCode)}` : qrCodeUrl,
      txId:      data.transactionId || data.identifier || identifier,
      raw:       data
    });

  } catch (err) {
    console.error('Erro:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => console.log(`✅ Proxy SigiloPay na porta ${PORT}`));
