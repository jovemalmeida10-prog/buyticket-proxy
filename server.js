const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Credenciais OnePay ────────────────────────────────────────────────────
const CLIENT_ID = 'cli_negbf4exbdk1m5en2k6tunt3';
const TOKEN     = 'one_wzvvlBkyBzVfqvx8uyz463sw9vBNVxgy9NgzwEW51IdpL8mKPiqbBoElA1gbII4V';
const BASE_URL  = 'https://onepayhub.one/api/v1';
// ──────────────────────────────────────────────────────────────────────────

app.use(cors({ origin: '*', methods: ['GET','POST','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.options('*', cors());
app.use(express.json());

// ─── Health check ──────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'BuyTicket Proxy (OnePay) online ✅' });
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
    res.json({ encontrado: true, uf: data.uf, bairro: data.bairro, cidade: data.localidade, rua: data.logradouro });
  } catch(e) {
    try {
      const r2 = await fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`);
      const d2 = await r2.json();
      res.json({ encontrado: true, uf: d2.state, bairro: d2.neighborhood, cidade: d2.city, rua: d2.street });
    } catch(e2) {
      res.json({ encontrado: false });
    }
  }
});

// ─── Criar cobrança PIX (OnePay) ───────────────────────────────────────────
app.post('/criar-pix', async (req, res) => {
  try {
    const body = req.body;
    const amount = parseFloat(body.amount) || 850.00;
    const nome   = body.nome || 'Cliente';

    const payload = {
      amount:     amount,
      payer_name: nome
    };

    console.log('→ OnePay payload:', JSON.stringify(payload));

    const response = await fetch(`${BASE_URL}/cashin/pix`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'X-Client-ID':   CLIENT_ID,
        'Content-Type':  'application/json',
        'Accept':        'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('← OnePay response:', JSON.stringify(data));

    const brCode    = data.qr_code            || '';
    const qrCodeUrl = data.qr_code_image_url  || 
                      (brCode ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(brCode)}` : '');

    res.json({
      success:   data.success || response.ok,
      status:    response.status,
      brCode:    brCode,
      qrCodeUrl: qrCodeUrl,
      txId:      data.transaction?.uuid || '',
      raw:       data
    });

  } catch (err) {
    console.error('Erro:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => console.log(`✅ Proxy OnePay na porta ${PORT}`));
