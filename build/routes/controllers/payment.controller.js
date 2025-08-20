import { randomUUID } from 'crypto'; // Para generar un ID único
import jwt from 'jsonwebtoken';  // Para la autenticación JWT
import dotenv from 'dotenv';
dotenv.config();

import Stripe from 'stripe';  // Para Stripe
import paypal from 'paypal-rest-sdk';  // Para PayPal

// Importación por defecto de Coinbase Commerce
import pkg from 'coinbase-commerce-node';
const { Client, resources } = pkg;

// Inicialización de servicios
Client.init(process.env.COINBASE_API_KEY); // Inicializa el cliente de Coinbase Commerce
const { Charge } = resources;
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);  // Inicializa Stripe con tu secret key

// Configuración de PayPal
paypal.configure({
  mode: 'sandbox',  // Cambiar a 'live' cuando esté listo
  client_id: process.env.PAYPAL_CLIENT_ID,
  client_secret: process.env.PAYPAL_SECRET_KEY,
});

export function payment_Controller(db) {
  return {
    // ============= || Crypto Payment || ============ //
    crypto_payment: async (req, res) => {
      try {
        const { amount } = req.body;

        // Crear un nuevo cargo en Coinbase Commerce
        const chargeData = {
          name: 'Product Payment',
          description: 'Payment for product via Crypto',
          local_price: {
            amount: amount,
            currency: 'USD',
          },
          pricing_type: 'fixed_price',
        };

        const charge = await Charge.create(chargeData);
        res.status(200).json({ payment_url: charge.hosted_url });
      } catch (error) {
        console.error('Error creating crypto payment:', error);
        res.status(500).json({ error: 'Error processing crypto payment' });
      }
    },

    // ============= || PayPal Payment || ============ //
    paypal_payment: (req, res) => {
          const { amount, paymentId, payerId } = req.body;

          const payment_data = {
               intent: 'sale',
               payer: {
                    payment_method: 'paypal',
               },
               transactions: [
                    {
                         amount: {
                              total: amount,
                              currency: 'USD',
                         },
                         description: 'Payment for product',
                    },
               ],
               redirect_urls: {
                    return_url: 'http://localhost:3000/success',
                    cancel_url: 'http://localhost:3000/cancel',
               },
          };

          // Crear el pago
          paypal.payment.create(payment_data, (error, payment) => {
               if (error) {
                    console.error(error);
                    return res.status(500).json({ error: 'Error creating PayPal payment' });
               }

               // Obtener la URL de aprobación
               for (let i = 0; i < payment.links.length; i++) {
                    if (payment.links[i].rel === 'approval_url') {
                         // Responder con la URL de aprobación
                         return res.status(200).json({ approval_url: payment.links[i].href });
                    }
               }

               // Si no se encuentra la URL de aprobación
               return res.status(500).json({ error: 'Approval URL not found' });
          });

          // Si el pago es aprobado, capturamos el pago (esto debería ir en la ruta de éxito)
          if (paymentId && payerId) {
               paypal.payment.execute(paymentId, payerId, (error, payment) => {
                    if (error) {
                         console.error(error);
                         return res.status(500).json({ error: 'Error capturing PayPal payment' });
                    } else {
                         console.log('Payment completed successfully', payment);
                         return res.status(200).json({ message: 'Payment completed successfully' });
                    }
               });
          }
     },


    // ============= || Stripe Payment || ============ //
    stripe_payment: async (req, res) => {
          try {
               const { amount } = req.body; // Recibe el monto a pagar

               // Crear la sesión de pago con Stripe
               const session = await stripe.checkout.sessions.create({
                    payment_method_types: ['card'],
                    line_items: [
                         {
                              price_data: {
                              currency: 'usd',  // Siempre USD
                              product_data: {
                                   name: 'Product Payment',
                              },
                              unit_amount: amount * 100, // Monto en centavos (ejemplo: 10 USD = 1000 centavos)
                              },
                              quantity: 1,
                         },
                    ],
                    mode: 'payment',
                    success_url: `${process.env.CLIENT_URL}/success`,
                    cancel_url: `${process.env.CLIENT_URL}/cancel`,
               });

               res.status(200).json({ session_id: session.id }); // Devuelve el session_id al frontend
          } catch (error) {
               console.error('Error creating Stripe payment:', error);
               res.status(500).json({ error: 'Error processing Stripe payment' });
          }
     }
  };
}
