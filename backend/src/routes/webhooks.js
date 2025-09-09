const express = require('express');
const router = express.Router();
const stripeService = require('../services/stripeService');
const logger = require('../utils/logger');

router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    logger.info('Stripe webhook received', {
      headers: req.headers,
      hasBody: !!req.body,
      bodyLength: req.body?.length
    });
    
    const sig = req.headers['stripe-signature'];
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    
    if (!stripe) {
      logger.error('Stripe not configured for webhook processing');
      return res.status(500).send('Stripe not configured');
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      logger.error('STRIPE_WEBHOOK_SECRET not configured');
      return res.status(500).send('Webhook secret not configured');
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
      logger.info('Stripe webhook event constructed successfully', {
        eventId: event.id,
        eventType: event.type,
        created: new Date(event.created * 1000)
      });
    } catch (err) {
      logger.error('Webhook signature verification failed:', {
        error: err.message,
        signature: sig,
        hasSecret: !!process.env.STRIPE_WEBHOOK_SECRET
      });
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    await stripeService.handleWebhookEvent(event);
    logger.info(`Stripe webhook processed successfully: ${event.type}`);
    
    res.json({ received: true });
  } catch (error) {
    logger.error('Error processing Stripe webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process webhook',
      error: error.message
    });
  }
});

module.exports = router;