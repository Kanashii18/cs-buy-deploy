// routes/seller.routes.js
import express from "express";
import { checkout_Controller } from './controllers/checkout.controller.js';
import { payment_Controller } from './controllers/payment.controller.js';

export default function purchasedRouter (db) {
     const router = express.Router();

     
     const { get_session, post_order } = checkout_Controller(db);
     const { crypto_payment, paypal_payment, stripe_payment } = payment_Controller(db);

     router.post('/token', get_session);
     router.post('/order/complete', post_order);

     router.post('/crypto_payment/pay',crypto_payment);
     router.post('/paypal/pay',paypal_payment);
     router.post('/stripe/complete',stripe_payment);
     
     return router;
}