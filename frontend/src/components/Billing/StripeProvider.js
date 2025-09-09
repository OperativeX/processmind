import React from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

const stripePublishableKey = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;

let stripePromise = null;

if (stripePublishableKey && stripePublishableKey !== 'pk_test_your_stripe_publishable_key_here') {
  stripePromise = loadStripe(stripePublishableKey);
} else {
  console.warn('Stripe publishable key not configured or using placeholder value');
}

const StripeProvider = ({ children }) => {
  if (!stripePromise) {
    console.log('Stripe not initialized - using fallback provider');
    return children;
  }

  return (
    <Elements stripe={stripePromise}>
      {children}
    </Elements>
  );
};

export default StripeProvider;