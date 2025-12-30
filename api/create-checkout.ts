import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-01-27-preview',
});

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { pack, userId } = req.query;

  if (!pack || !userId) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const priceId = pack === 'pro' 
    ? 'price_1Sk8V0BbMl3ZeV7DjRo08iM5' 
    : 'price_1Sk8V5BbMl3ZeV7DTIV8i84n';

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      client_reference_id: userId,
      metadata: {
        pack_type: pack === 'pro' ? 'pro_pack' : 'ultra_pack',
      },
      success_url: `${process.env.VITE_APP_URL || 'https://mycartoon.org'}?payment=success`,
      cancel_url: `${process.env.VITE_APP_URL || 'https://mycartoon.org'}?payment=cancel`,
    });

    res.redirect(303, session.url!);
  } catch (err: any) {
    console.error('Stripe Session Error:', err);
    res.status(500).json({ error: err.message });
  }
}
