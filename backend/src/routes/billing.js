const express = require('express');
const router = express.Router();
const stripeService = require('../services/stripeService');
const logger = require('../utils/logger');
const { Tenant, User } = require('../models');
const authMiddleware = require('../middleware/authMiddleware');

// Middleware to load tenant object from tenantId
const loadTenant = async (req, res, next) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID required'
      });
    }

    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    req.tenant = tenant;
    next();
  } catch (error) {
    logger.error('Error loading tenant:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load tenant information'
    });
  }
};

// Get pricing configuration from environment (requires auth but no tenant)
router.get('/pricing-config', authMiddleware, async (req, res) => {
  try {
    const pricePerLicense = parseFloat(process.env.PRO_PLAN_PRICE_PER_USER || 10);
    const yearlyPrice = pricePerLicense * 12;
    
    res.json({
      success: true,
      data: {
        pricePerLicense,
        currency: 'EUR',
        currencySymbol: '€',
        interval: 'month',
        yearlyPrice,
        features: {
          free: {
            teamMembers: 1,
            uploadsPerMonth: 10,
            storageGB: 20,
            features: ['Basic processing', 'Single user only']
          },
          pro: {
            teamMembers: 'Unlimited',
            uploadsPerMonth: 'Unlimited',
            storageGB: 'Unlimited', 
            features: ['Priority processing', 'Team collaboration', 'Advanced analytics', 'Priority support']
          }
        }
      }
    });
  } catch (error) {
    logger.error('Error getting pricing config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get pricing configuration'
    });
  }
});

router.post('/checkout-session', loadTenant, async (req, res) => {
  try {
    console.log('🔧 Checkout session request received');
    console.log('Tenant:', req.tenant ? 'loaded' : 'missing');
    console.log('User:', req.user ? req.user.email : 'missing');
    
    const { tenant } = req;
    let { priceId, successUrl, cancelUrl } = req.body;

    console.log('Request body:', { priceId, successUrl, cancelUrl });

    // Use default Pro plan price ID if not provided
    if (!priceId) {
      priceId = process.env.STRIPE_PRO_PRICE_ID;
      console.log('Using default priceId:', priceId);
      if (!priceId) {
        return res.status(400).json({
          success: false,
          message: 'Price ID is required and no default Pro plan configured'
        });
      }
    }

    if (!tenant.billing.stripeCustomerId) {
      const billingEmail = tenant.subscription.billingEmail || req.user.email;
      await stripeService.createCustomer(tenant, billingEmail);
    }

    const session = await stripeService.createCheckoutSession(
      tenant,
      priceId,
      successUrl || `${process.env.FRONTEND_URL}/billing/success`,
      cancelUrl || `${process.env.FRONTEND_URL}/billing/cancel`
    );

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url
      }
    });
  } catch (error) {
    logger.error('Error creating checkout session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create checkout session',
      error: error.message
    });
  }
});

router.post('/portal-session', loadTenant, async (req, res) => {
  try {
    const { tenant } = req;
    const { returnUrl } = req.body;

    if (!tenant.billing.stripeCustomerId) {
      return res.status(400).json({
        success: false,
        message: 'No billing account found'
      });
    }

    const session = await stripeService.createPortalSession(
      tenant,
      returnUrl || `${process.env.FRONTEND_URL}/team`
    );

    res.json({
      success: true,
      url: session.url
    });
  } catch (error) {
    logger.error('Error creating portal session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create portal session',
      error: error.message
    });
  }
});

router.get('/subscription-status', loadTenant, async (req, res) => {
  try {
    const { tenant } = req;
    
    const subscriptionInfo = await stripeService.getSubscriptionInfo(tenant);
    
    // License-based billing model
    const isProPlan = tenant.subscription.plan === 'pro';
    const pricePerLicense = tenant.billing.pricePerLicense || parseFloat(process.env.PRO_PLAN_PRICE_PER_USER || 10);
    const purchasedLicenses = tenant.limits.purchasedLicenses || 0;
    const activeTeamMembers = tenant.limits.activeTeamMembers || 1;
    const availableLicenses = tenant.getAvailableLicenses();
    const currentMonthlyPrice = isProPlan ? (purchasedLicenses * pricePerLicense) : 0;
    
    const billingStatus = {
      hasStripeCustomer: !!tenant.billing.stripeCustomerId,
      hasActiveSubscription: !!tenant.billing.stripeSubscriptionId,
      subscriptionInfo,
      plan: tenant.subscription.plan,
      paymentStatus: tenant.billing.paymentStatus,
      // License info
      purchasedLicenses,
      activeTeamMembers,
      availableLicenses,
      pricePerLicense,
      currentMonthlyPrice,
      yearlyPrice: currentMonthlyPrice * 12,
      // Features
      canAddMoreUsers: tenant.canAddMoreUsers(),
      allowTeams: tenant.limits.allowTeams,
      // Billing dates
      currentPeriodStart: tenant.billing.currentPeriodStart,
      currentPeriodEnd: tenant.billing.currentPeriodEnd,
      nextBillingDate: tenant.billing.nextBillingDate,
      lastInvoiceDate: tenant.billing.lastInvoiceDate,
      // Pending invitations
      pendingInvitations: tenant.limits.pendingInvitations || 0
    };

    res.json({
      success: true,
      data: billingStatus
    });
  } catch (error) {
    logger.error('Error getting subscription status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get subscription status',
      error: error.message
    });
  }
});

router.post('/sync-subscription', loadTenant, async (req, res) => {
  try {
    const { tenant } = req;
    
    await stripeService.syncSubscriptionWithTenant(tenant);
    
    res.json({
      success: true,
      message: 'Subscription synced successfully'
    });
  } catch (error) {
    logger.error('Error syncing subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync subscription',
      error: error.message
    });
  }
});

// New endpoint: Verify and upgrade after successful payment
router.post('/verify-upgrade', loadTenant, async (req, res) => {
  try {
    const { tenant } = req;
    
    // Check if tenant has active subscription but users aren't upgraded
    if (tenant.subscription.plan === 'pro' && tenant.subscription.status === 'active') {
      // Find all users in this tenant
      const users = await User.find({ tenantId: tenant._id });
      
      let upgradedCount = 0;
      for (const user of users) {
        if (user.accountType !== 'pro') {
          await user.upgradeToProAccount();
          logger.info(`Upgraded user ${user.email} to Pro account (verify-upgrade)`);
          upgradedCount++;
        }
      }
      
      if (upgradedCount > 0) {
        logger.info(`Verify-upgrade: Upgraded ${upgradedCount} users to Pro for tenant ${tenant.name}`);
      }
      
      res.json({
        success: true,
        message: `Subscription verified. ${upgradedCount} users upgraded to Pro.`,
        data: {
          tenantPlan: tenant.subscription.plan,
          upgradedUsers: upgradedCount,
          totalUsers: users.length
        }
      });
    } else {
      res.json({
        success: false,
        message: 'Tenant does not have active Pro subscription',
        data: {
          tenantPlan: tenant.subscription.plan,
          status: tenant.subscription.status
        }
      });
    }
  } catch (error) {
    logger.error('Error verifying upgrade:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify upgrade',
      error: error.message
    });
  }
});

// Purchase additional licenses
router.post('/purchase-licenses', loadTenant, async (req, res) => {
  try {
    const { tenant } = req;
    const { quantity } = req.body;
    
    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1'
      });
    }
    
    if (tenant.subscription.plan !== 'pro') {
      return res.status(403).json({
        success: false,
        message: 'Only Pro accounts can purchase additional licenses'
      });
    }
    
    // Create Stripe checkout session for licenses
    const pricePerLicense = parseFloat(process.env.PRO_PLAN_PRICE_PER_USER || 10); // Price per license
    const session = await stripeService.createLicensePurchaseSession(
      tenant,
      quantity,
      pricePerLicense,
      `${process.env.FRONTEND_URL}/billing/success?type=license`,
      `${process.env.FRONTEND_URL}/billing`
    );
    
    res.json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url
      }
    });
  } catch (error) {
    logger.error('Error creating license purchase session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create checkout session',
      error: error.message
    });
  }
});

// Update license count (reduce)
router.put('/update-licenses', loadTenant, async (req, res) => {
  try {
    const { tenant } = req;
    const { newLicenseCount } = req.body;
    
    if (!newLicenseCount || newLicenseCount < 1) {
      return res.status(400).json({
        success: false,
        message: 'License count must be at least 1'
      });
    }
    
    if (tenant.subscription.plan !== 'pro') {
      return res.status(403).json({
        success: false,
        message: 'Only Pro accounts can manage licenses'
      });
    }
    
    const currentLicenses = tenant.limits.purchasedLicenses || 1;
    
    // Count active Pro users  
    const User = require('../models/User');
    const activeProUsers = await User.countDocuments({
      tenantId: tenant._id,
      isActive: true,
      accountType: 'pro'
    });
    
    if (newLicenseCount < activeProUsers) {
      const usersToRemove = activeProUsers - newLicenseCount;
      return res.status(400).json({
        success: false,
        message: `Cannot reduce licenses below current active team size. You need to remove ${usersToRemove} team member${usersToRemove > 1 ? 's' : ''} before reducing licenses.`,
        data: {
          currentActiveUsers: activeProUsers,
          requestedLicenses: newLicenseCount,
          usersToRemove
        }
      });
    }
    
    if (newLicenseCount < currentLicenses) {
      // Reducing licenses - update Stripe subscription
      const reduction = currentLicenses - newLicenseCount;
      await stripeService.updateSubscriptionLicenses(tenant, newLicenseCount);
      await tenant.reduceLicenses(reduction);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Use /purchase-licenses to add more licenses'
      });
    }
    
    res.json({
      success: true,
      message: 'License count updated successfully',
      data: {
        previousLicenses: currentLicenses,
        newLicenses: newLicenseCount,
        availableLicenses: tenant.getAvailableLicenses()
      }
    });
  } catch (error) {
    logger.error('Error updating licenses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update licenses',
      error: error.message
    });
  }
});

// Get license status
router.get('/license-status', loadTenant, async (req, res) => {
  try {
    const { tenant } = req;
    
    if (tenant.subscription.plan !== 'pro') {
      return res.status(403).json({
        success: false,
        message: 'License management is only available for Pro accounts'
      });
    }
    
    const pricePerLicense = tenant.billing.pricePerLicense || parseFloat(process.env.PRO_PLAN_PRICE_PER_USER || 10);
    
    const status = {
      purchasedLicenses: tenant.limits.purchasedLicenses || 1,
      activeTeamMembers: tenant.limits.activeTeamMembers || 1,
      availableLicenses: tenant.getAvailableLicenses(),
      pricePerLicense,
      monthlyLicenseCost: (tenant.limits.purchasedLicenses || 1) * pricePerLicense,
      yearlyLicenseCost: (tenant.limits.purchasedLicenses || 1) * pricePerLicense * 12,
      pendingInvitations: tenant.limits.pendingInvitations || 0
    };
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Error getting license status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get license status',
      error: error.message
    });
  }
});

// Get invoice history
router.get('/invoices', loadTenant, async (req, res) => {
  try {
    const { tenant } = req;
    
    if (!tenant.billing.stripeCustomerId) {
      return res.json({
        success: true,
        data: {
          invoices: [],
          hasMore: false
        }
      });
    }
    
    const invoices = await stripeService.getInvoices(tenant.billing.stripeCustomerId);
    
    res.json({
      success: true,
      data: invoices
    });
  } catch (error) {
    logger.error('Error getting invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get invoice history',
      error: error.message
    });
  }
});

// Downgrade to free plan
router.post('/downgrade-to-free', loadTenant, async (req, res) => {
  try {
    const { tenant } = req;
    
    // Only owners can downgrade
    if (req.user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Only account owners can downgrade the plan'
      });
    }
    
    if (tenant.subscription.plan === 'free') {
      return res.status(400).json({
        success: false,
        message: 'Already on free plan'
      });
    }
    
    // Cancel Stripe subscription if exists
    if (tenant.billing.stripeSubscriptionId) {
      try {
        await stripeService.cancelSubscription(tenant.billing.stripeSubscriptionId, true);
        logger.info(`Cancelled Stripe subscription for tenant ${tenant.name}`);
      } catch (stripeError) {
        logger.error('Error cancelling Stripe subscription:', stripeError);
        // Continue with downgrade even if Stripe fails
      }
    }
    
    // Downgrade tenant and get result
    const result = await tenant.downgradeToFreePlan();
    
    // Reset upload limits for all active users
    const User = require('../models/User');
    const owner = await User.findOne({ 
      tenantId: tenant._id, 
      role: 'owner',
      isActive: true 
    });
    
    if (owner) {
      // Give owner fresh 10 uploads immediately
      owner.monthly_uploads_used = 0;
      owner.uploads_reset_date = new Date();
      await owner.save();
    }
    
    logger.info(`Tenant ${tenant.name} downgraded to free plan, deactivated ${result.deactivatedUsers} users`);
    
    res.json({
      success: true,
      message: 'Successfully downgraded to free plan',
      data: {
        plan: 'free',
        maxUsers: 1,
        allowTeams: false,
        deactivatedUsers: result.deactivatedUsers,
        uploadsRemaining: 10
      }
    });
  } catch (error) {
    logger.error('Error downgrading to free plan:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to downgrade to free plan',
      error: error.message
    });
  }
});

module.exports = router;