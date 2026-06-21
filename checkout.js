// ─────────────────────────────────────────────
// STRIPE INTEGRATION
// ─────────────────────────────────────────────
// STEP 1: Paste your Stripe publishable key here
const STRIPE_PUBLISHABLE_KEY = 'pk_live_51OdP4xLp893wXw0epdkSfGFBPzEWU9X4wlKjNjYCao0Spja4I9P5NkSHsoJyM1BRoudoN9wApmlrT83nbnPNh0o200wSNxkiY4';

// STEP 2: Paste your Stripe Price ID for the $500/month subscription here
// Create it in Stripe Dashboard → Products → Add product → Recurring · $500/mo
const STRIPE_PRICE_ID = 'price_1TkYmfLp893wXw0e20uHDVm5';

// STEP 3: Set your backend endpoint that creates a Stripe PaymentIntent or
// SetupIntent and returns { clientSecret }. See comments below for what
// your server needs to do.
const BACKEND_URL = 'https://linx-solutions-production.up.railway.app/api/create-subscription';
// ─────────────────────────────────────────────

let stripe, cardElement;

document.addEventListener('DOMContentLoaded', () => {
  if (!STRIPE_PUBLISHABLE_KEY.startsWith('pk_')) return;

  stripe = Stripe(STRIPE_PUBLISHABLE_KEY);
  const elements = stripe.elements({
    fonts: [{ cssSrc: 'https://fonts.googleapis.com/css2?family=Inter' }]
  });

  cardElement = elements.create('card', {
    style: {
      base: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: '14px',
        color: '#1a1a18',
        '::placeholder': { color: '#bbb' }
      },
      invalid: { color: '#e24b4a' }
    },
    hidePostalCode: false
  });

  cardElement.mount('#stripe-card-element');

  cardElement.on('change', (e) => {
    document.getElementById('stripe-card-error').textContent = e.error ? e.error.message : '';
  });
});

async function handleSubmit() {
  const firstName = document.getElementById('first-name').value.trim();
  const lastName = document.getElementById('last-name').value.trim();
  const email = document.getElementById('email').value.trim();
  const biz = document.getElementById('biz-name').value.trim();
  const cardName = document.getElementById('card-name').value.trim();
  const agreed = document.getElementById('agree').checked;

  // Basic validation
  if (!firstName || !lastName) { alert('Please enter your full name.'); return; }
  if (!email) { alert('Please enter your email address.'); return; }
  if (!biz) { alert('Please enter your business name.'); return; }
  if (!cardName) { alert('Please enter the cardholder name.'); return; }
  if (!agreed) { alert('Please agree to the Terms of Service to continue.'); return; }

  const btn = document.querySelector('.submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Processing…';

  try {
    /*
    ── WHAT YOUR BACKEND (/api/create-subscription) NEEDS TO DO ──────────────
    1. Create or retrieve a Stripe Customer with the email + name
    2. Create a Stripe Subscription with:
         customer: <customer_id>
         items: [{ price: STRIPE_PRICE_ID }]
         payment_behavior: 'default_incomplete'
         expand: ['latest_invoice.payment_intent']
    3. Return:
         {
           clientSecret: subscription.latest_invoice.payment_intent.client_secret,
           subscriptionId: subscription.id,
           customerId: customer.id
         }
    ──────────────────────────────────────────────────────────────────────────
    */
    const res = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        name: `${firstName} ${lastName}`,
        businessName: biz,
        businessPhone: document.getElementById('biz-phone').value.trim(),
        industry: document.getElementById('industry').value,
        googleUrl: document.getElementById('google-url').value.trim(),
        priceId: STRIPE_PRICE_ID
      })
    });

    const { clientSecret, error: serverError } = await res.json();
    if (serverError) throw new Error(serverError);

    // Confirm the card payment with Stripe.js
    const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: cardElement,
        billing_details: {
          name: cardName,
          email
        }
      }
    });

    if (stripeError) {
      document.getElementById('stripe-card-error').textContent = stripeError.message;
      btn.disabled = false;
      btn.innerHTML = '<svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:#fff;fill:none;stroke-width:2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Start my subscription — $500/mo';
      return;
    }

    // ✅ Payment confirmed — show success screen
    showSuccess(firstName, lastName, email, biz);

  } catch (err) {
    console.error('Payment error:', err);
    document.getElementById('stripe-card-error').textContent =
      'Something went wrong. Please try again or contact hello@linxsolutions.com';
    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:#fff;fill:none;stroke-width:2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Start my subscription — $500/mo';
  }
}

function showSuccess(firstName, lastName, email, biz) {
  document.getElementById('form-col').style.display = 'none';
  const success = document.getElementById('success-screen');
  success.style.display = 'block';

  const nextBilling = new Date();
  nextBilling.setMonth(nextBilling.getMonth() + 1);

  document.getElementById('success-detail').innerHTML = `
    <div class="success-detail-row"><span class="key">Name</span><span class="val">${firstName} ${lastName}</span></div>
    <div class="success-detail-row"><span class="key">Business</span><span class="val">${biz}</span></div>
    <div class="success-detail-row"><span class="key">Email</span><span class="val">${email}</span></div>
    <div class="success-detail-row"><span class="key">Plan</span><span class="val">Growth Bundle — $500/mo</span></div>
    <div class="success-detail-row"><span class="key">Next billing</span><span class="val">${nextBilling.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span></div>
  `;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
