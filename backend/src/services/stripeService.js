// Lazy loading of stripe to prevent startup errors
let stripe;

const { Tenant, User } = require('../models');
const logger = require('../utils/logger');

class StripeService {
  constructor() {
    this.stripe = null;
    this.isConfigured = false;
    
    // Only initialize Stripe if we have a valid key
    if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes('your_stripe_secret_key')) {
      try {
        if (!stripe) {
          stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        }
        this.stripe = stripe;
        this.isConfigured = true;
        logger.info('Stripe initialized successfully');
      } catch (error) {
        logger.error('Failed to initialize Stripe:', error);
        logger.warn('Server will continue without Stripe functionality');
      }
    } else {
      logger.warn('Stripe not initialized - missing or placeholder API key');
    }
  }

  _ensureStripeConfigured() {
    if (!this.isConfigured) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
    }
  }

  async createCustomer(tenant, email) {
    this._ensureStripeConfigured();
    try {
      const customer = await stripe.customers.create({
        email,
        name: tenant.name,
        metadata: {
          tenantId: tenant._id.toString()
        }
      });

      tenant.billing.stripeCustomerId = customer.id;
      await tenant.save();
      
      logger.info(`Stripe customer created for tenant ${tenant.name}: ${customer.id}`);
      return customer;
    } catch (error) {
      logger.error('Error creating Stripe customer:', error);
      throw error;
    }
  }

  async createCheckoutSession(tenant, priceId, successUrl, cancelUrl) {
    this._ensureStripeConfigured();
    try {
      // For Pro plan, start with 1 license
      const initialLicenses = 1;
      
      const session = await this.stripe.checkout.sessions.create({
        customer: tenant.billing.stripeCustomerId,
        payment_method_types: ['card'],
        mode: 'subscription',
        line_items: [{
          price: priceId,
          quantity: initialLicenses
        }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          tenantId: tenant._id.toString(),
          initialLicenses: initialLicenses.toString()
        },
        subscription_data: {
          metadata: {
            tenantId: tenant._id.toString()
          }
        }
      });

      logger.info(`Checkout session created for tenant ${tenant.name}: ${session.id}`);
      return session;
    } catch (error) {
      logger.error('Error creating checkout session:', error);
      throw error;
    }
  }

  async createPortalSession(tenant, returnUrl) {
    this._ensureStripeConfigured();
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: tenant.billing.stripeCustomerId,
        return_url: returnUrl
      });

      logger.info(`Portal session created for tenant ${tenant.name}`);
      return session;
    } catch (error) {
      logger.error('Error creating portal session:', error);
      throw error;
    }
  }

  async getSubscriptionInfo(tenant) {
    this._ensureStripeConfigured();
    try {
      if (!tenant.billing.stripeSubscriptionId) {
        return null;
      }

      const subscription = await stripe.subscriptions.retrieve(
        tenant.billing.stripeSubscriptionId
      );

      return {
        status: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        items: subscription.items.data.map(item => ({
          id: item.id,
          priceId: item.price.id,
          quantity: item.quantity
        }))
      };
    } catch (error) {
      logger.error('Error fetching subscription info:', error);
      return null;
    }
  }

  async syncSubscriptionWithTenant(tenant) {
    this._ensureStripeConfigured();
    try {
      const subscriptionInfo = await this.getSubscriptionInfo(tenant);
      
      if (subscriptionInfo) {
        tenant.subscription.status = subscriptionInfo.status === 'active' ? 'active' : 'suspended';
        tenant.billing.nextBillingDate = subscriptionInfo.currentPeriodEnd;
        await tenant.save();
        
        logger.info(`Synced subscription for tenant ${tenant.name}`);
      }
    } catch (error) {
      logger.error('Error syncing subscription:', error);
      throw error;
    }
  }

  async cancelSubscription(subscriptionId, immediate = false) {
    this._ensureStripeConfigured();
    try {
      let subscription;
      
      if (immediate) {
        // Cancel immediately
        subscription = await stripe.subscriptions.cancel(subscriptionId);
        logger.info(`Subscription ${subscriptionId} cancelled immediately`);
      } else {
        // Cancel at period end
        subscription = await stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true
        });
        logger.info(`Subscription ${subscriptionId} marked for cancellation at period end`);
      }

      return subscription;
    } catch (error) {
      logger.error('Error canceling subscription:', error);
      throw error;
    }
  }

  async createLicensePurchaseSession(tenant, quantity, pricePerLicense, successUrl, cancelUrl) {
    this._ensureStripeConfigured();
    try {
      // Create line items for the license purchase
      const lineItems = [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: `Process Mind Pro License${quantity > 1 ? 's' : ''}`,
            description: `${quantity} additional team member license${quantity > 1 ? 's' : ''}`
          },
          unit_amount: pricePerLicense * 100, // Convert to cents
          recurring: {
            interval: 'month'
          }
        },
        quantity: quantity
      }];

      const session = await this.stripe.checkout.sessions.create({
        customer: tenant.billing.stripeCustomerId,
        payment_method_types: ['card'],
        mode: 'subscription',
        line_items: lineItems,
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          tenantId: tenant._id.toString(),
          type: 'license_purchase',
          quantity: quantity.toString()
        },
        subscription_data: {
          metadata: {
            tenantId: tenant._id.toString(),
            type: 'license_purchase'
          }
        }
      });

      logger.info(`License purchase session created for tenant ${tenant.name}: ${session.id}`);
      return session;
    } catch (error) {
      logger.error('Error creating license purchase session:', error);
      throw error;
    }
  }

  async updateSubscriptionLicenses(tenant, newLicenseCount) {
    this._ensureStripeConfigured();
    try {
      if (!tenant.billing.stripeSubscriptionId) {
        throw new Error('No subscription found for tenant');
      }

      const subscription = await stripe.subscriptions.retrieve(tenant.billing.stripeSubscriptionId);
      
      // Find the license item
      const licenseItem = subscription.items.data.find(item => 
        item.price.product && item.price.recurring
      );

      if (licenseItem) {
        // Update the quantity with proration
        const updatedItem = await stripe.subscriptionItems.update(licenseItem.id, {
          quantity: newLicenseCount,
          proration_behavior: 'create_prorations'
        });
        
        // Store the subscription item ID for future updates
        if (!tenant.billing.stripeSubscriptionItemId) {
          tenant.billing.stripeSubscriptionItemId = licenseItem.id;
          await tenant.save();
        }

        logger.info(`Updated subscription licenses for tenant ${tenant.name} to ${newLicenseCount}`);
        return updatedItem;
      }
    } catch (error) {
      logger.error('Error updating subscription licenses:', error);
      throw error;
    }
  }
  
  async getInvoices(customerId, limit = 10) {
    this._ensureStripeConfigured();
    try {
      const invoices = await stripe.invoices.list({
        customer: customerId,
        limit,
        expand: ['data.lines']
      });

      return {
        invoices: invoices.data.map(invoice => ({
          id: invoice.id,
          number: invoice.number,
          status: invoice.status,
          amount: invoice.amount_total / 100, // Convert from cents
          currency: invoice.currency,
          created: new Date(invoice.created * 1000),
          periodStart: new Date(invoice.period_start * 1000),
          periodEnd: new Date(invoice.period_end * 1000),
          paid: invoice.paid,
          pdfUrl: invoice.invoice_pdf,
          hostedUrl: invoice.hosted_invoice_url,
          lines: invoice.lines?.data.map(line => ({
            description: line.description,
            quantity: line.quantity,
            amount: line.amount / 100
          }))
        })),
        hasMore: invoices.has_more
      };
    } catch (error) {
      logger.error('Error getting invoices:', error);
      throw error;
    }
  }

  async handleWebhookEvent(event) {
    try {
      switch (event.type) {
        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object);
          break;
        
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object);
          break;
        
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object);
          break;
        
        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object);
          break;
        
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object);
          break;
          
        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(event.data.object);
          break;

        default:
          logger.info(`Unhandled Stripe webhook event: ${event.type}`);
      }
    } catch (error) {
      logger.error('Error handling Stripe webhook:', error);
      throw error;
    }
  }

  async handleSubscriptionCreated(subscription) {
    const tenant = await Tenant.findOne({
      'billing.stripeCustomerId': subscription.customer
    });

    if (tenant) {
      tenant.billing.stripeSubscriptionId = subscription.id;
      tenant.subscription.status = 'active';
      tenant.subscription.startDate = new Date(subscription.start_date * 1000);
      tenant.billing.nextBillingDate = new Date(subscription.current_period_end * 1000);
      tenant.billing.currentPeriodStart = new Date(subscription.current_period_start * 1000);
      tenant.billing.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
      
      // Get initial license quantity from subscription
      const licenseItem = subscription.items.data.find(item => item.price.product);
      if (licenseItem) {
        tenant.limits.purchasedLicenses = licenseItem.quantity || 1;
        tenant.billing.stripeSubscriptionItemId = licenseItem.id;
      }
      
      await tenant.save();
      logger.info(`Subscription created for tenant ${tenant.name}: ${subscription.id}`);
    }
  }

  async handleSubscriptionUpdated(subscription) {
    const tenant = await Tenant.findOne({
      'billing.stripeSubscriptionId': subscription.id
    });

    if (tenant) {
      tenant.subscription.status = subscription.status === 'active' ? 'active' : 'suspended';
      tenant.billing.nextBillingDate = new Date(subscription.current_period_end * 1000);
      tenant.billing.currentPeriodStart = new Date(subscription.current_period_start * 1000);
      tenant.billing.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
      tenant.billing.paymentStatus = subscription.status;
      
      // Update license quantity from subscription
      const licenseItem = subscription.items.data.find(item => item.price.product);
      if (licenseItem) {
        tenant.limits.purchasedLicenses = licenseItem.quantity || 1;
        tenant.billing.stripeSubscriptionItemId = licenseItem.id;
      }
      
      if (subscription.cancel_at_period_end) {
        tenant.subscription.status = 'cancelled';
        tenant.subscription.endDate = new Date(subscription.current_period_end * 1000);
      }
      
      await tenant.save();
      logger.info(`Subscription updated for tenant ${tenant.name}: ${subscription.status}`);
    }
  }

  async handleSubscriptionDeleted(subscription) {
    const tenant = await Tenant.findOne({
      'billing.stripeSubscriptionId': subscription.id
    });

    if (tenant) {
      tenant.subscription.status = 'cancelled';
      tenant.subscription.endDate = new Date();
      
      await tenant.save();
      logger.info(`Subscription deleted for tenant ${tenant.name}`);
    }
  }

  async handlePaymentSucceeded(invoice) {
    const tenant = await Tenant.findOne({
      'billing.stripeCustomerId': invoice.customer
    });

    if (tenant) {
      tenant.billing.lastInvoiceDate = new Date(invoice.created * 1000);
      await tenant.save();
      logger.info(`Payment succeeded for tenant ${tenant.name}`);
    }
  }

  async handlePaymentFailed(invoice) {
    const tenant = await Tenant.findOne({
      'billing.stripeCustomerId': invoice.customer
    });

    if (tenant) {
      logger.error(`Payment failed for tenant ${tenant.name}`, {
        invoiceId: invoice.id,
        amount: invoice.amount_due
      });
    }
  }

  async handleCheckoutSessionCompleted(session) {
    logger.info('Processing checkout.session.completed webhook', {
      sessionId: session.id,
      customer: session.customer,
      metadata: session.metadata
    });

    try {
      // Find tenant by Stripe customer ID
      const tenant = await Tenant.findOne({
        'billing.stripeCustomerId': session.customer
      });

      if (!tenant) {
        logger.error('Tenant not found for checkout session:', session.id);
        return;
      }

      // Check if this is a license purchase
      if (session.metadata?.type === 'license_purchase') {
        const quantity = parseInt(session.metadata.quantity) || 0;
        if (quantity > 0) {
          await tenant.purchaseLicenses(quantity);
          logger.info(`Added ${quantity} licenses for tenant ${tenant.name}`);
        }
        return;
      }

      // Otherwise it's a new subscription
      const subscriptionId = session.subscription;
      if (subscriptionId) {
        tenant.billing.stripeSubscriptionId = subscriptionId;
        
        // Retrieve subscription to get details
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const licenseItem = subscription.items.data.find(item => item.price.product);
        if (licenseItem) {
          tenant.billing.stripeSubscriptionItemId = licenseItem.id;
          tenant.limits.purchasedLicenses = licenseItem.quantity || 1;
        }
        
        tenant.billing.currentPeriodStart = new Date(subscription.current_period_start * 1000);
        tenant.billing.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
        tenant.billing.nextBillingDate = new Date(subscription.current_period_end * 1000);
      }

      // Upgrade tenant to Pro plan
      await tenant.upgradeToProPlan();
      logger.info(`Upgraded tenant ${tenant.name} to Pro plan with ${tenant.limits.purchasedLicenses} licenses`);

      // Find and upgrade all users in this tenant
      const User = require('../models/User');
      const users = await User.find({ tenantId: tenant._id });
      
      for (const user of users) {
        await user.upgradeToProAccount();
        logger.info(`Upgraded user ${user.email} to Pro account`);
      }

      logger.info('Successfully processed checkout session completion', {
        tenant: tenant.name,
        upgradedUsers: users.length
      });
    } catch (error) {
      logger.error('Error processing checkout session:', error);
      throw error;
    }
  }
}

module.exports = new StripeService();