import { buffer } from 'node:stream/consumers';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-01-27-preview',
});

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.client_reference_id;
    const packType = session.metadata?.pack_type;

    if (userId && packType) {
      const { error } = await supabase
        .from('payments')
        .insert({
          user_id: userId,
          stripe_session_id: session.id,
          stripe_payment_id: session.payment_intent as string,
          amount: session.amount_total,
          currency: session.currency,
          status: 'succeeded',
          pack_type: packType,
          payment_type: 'stripe_checkout'
        });

      if (error) {
        console.error('Error inserting payment:', error);
        return res.status(500).json({ error: 'Failed to record payment' });
      }
    }
  }

  res.json({ received: true });
}
