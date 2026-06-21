require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const stripe  = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/create-subscription', async (req, res) => {
  const { email, name, businessName, businessPhone, industry, googleUrl, priceId } = req.body;

  if (!email || !name || !priceId) {
    return res.status(400).json({ error: 'Missing required fields: email, name, priceId.' });
  }

  try {
    const existing = await stripe.customers.list({ email, limit: 1 });
    let customer;

    if (existing.data.length > 0) {
      customer = existing.data[0];
      customer = await stripe.customers.update(customer.id, {
        name,
        metadata: { businessName, businessPhone, industry, googleUrl }
      });
    } else {
      customer = await stripe.customers.create({
        email,
        name,
        metadata: { businessName, businessPhone, industry, googleUrl }
      });
    }

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
        payment_method_types: ['card']
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: { businessName, industry }
    });

    console.log('Subscription object:', JSON.stringify(subscription.latest_invoice, null, 2));


    const paymentIntent = subscription.latest_invoice.payment_intent;

    return res.json({
      clientSecret:   paymentIntent.client_secret,
      subscriptionId: subscription.id,
      customerId:     customer.id
    });

  } catch (err) {
    console.error('Stripe error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/stripe-webhook',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const sig    = req.headers['stripe-signature'];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch (err) {
      console.error('Webhook signature error:', err.message);
      return res.status(400).send(`Webhook error: ${err.message}`);
    }

    switch (event.type) {
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        console.log(`✅ Payment succeeded — Customer: ${invoice.customer}, Amount: $${invoice.amount_paid / 100}`);
        // TODO: Send welcome email, trigger onboarding
        break;
      }
      case 'invoice.payment_failed': {
        console.log(`❌ Payment failed — Customer: ${event.data.object.customer}`);
        // TODO: Email customer to update their card
        break;
      }
      case 'customer.subscription.deleted': {
        console.log(`🚫 Subscription cancelled — Customer: ${event.data.object.customer}`);
        // TODO: Deactivate their services
        break;
      }
      default:
        break;
    }

    res.json({ received: true });
  }
);

const path = require('path');
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Linx Solutions server running on http://localhost:${PORT}`);
});