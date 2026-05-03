const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Credenciais SyncPay ───────────────────────────────────────────────────
const CLIENT_ID     = '84cb8b13-80cd-4d36-8d23-2dbb45770ab2';
const CLIENT_SECRET = '42166320-6824-4493-a544-5515ace7c961';
const API_KEY       = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
const SYNCPAY_URL   = 'https://api.syncpayments.com.br/transactions';
// ──────────────────────────────────────────────────────────────────────────

app.use(cors()); // Permite chamadas do browser (qualquer origem)
app.use(express.json());

// ─── Health check ─────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'BuyTicket Proxy online ✅' });
});

// ─── Endpoint: Criar cobrança PIX ─────────────────────────────────────────
app.post('/criar-pix', async (req, res) => {
  try {
    const body = req.body;

    const payload = {
      amount: 2967.80,
      customer: {
        name:  body.nome  || 'Cliente',
        email: body.email || 'cliente@email.com',
        cpf:   body.cpf   || '',
        phone: body.telefone || '',
        address: {
          street:       body.rua      || '',
          streetNumber: body.numero   || '',
          complement:   body.complemento || '',
          zipCode:      body.cep      || '',
          neighborhood: body.bairro   || '',
          city:         body.cidade   || '',
          state:        body.uf       || '',
          country:      'br'
        }
      },
      pix: { expiresInDays: 1 },
      items: [{
        title:      'BTS - 2026 World Tour Arirang - Arquibancada Meia Estudante',
        quantity:   1,
        unitPrice:  2967.80,
        tangible:   false
      }],
      postbackUrl: '',
      metadata: 'buyticket-bts-2026'
    };

    const response = await fetch(SYNCPAY_URL, {
      method:  'POST',
      headers: {
        'Authorization': `Basic ${API_KEY}`,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    // Extrai os campos principais e retorna pro frontend
    res.json({
      success:    response.ok,
      status:     response.status,
      brCode:     data.pix?.brCode       || data.pixCopiaECola || data.brcode || '',
      qrCodeUrl:  data.pix?.qrCodeImage  || data.qrCodeImage   || '',
      txId:       data.id                || data.txid          || '',
      raw:        data
    });

  } catch (err) {
    console.error('Erro SyncPay:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Proxy rodando na porta ${PORT}`);
});
