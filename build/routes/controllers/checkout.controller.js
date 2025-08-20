import { randomUUID } from 'crypto';

// ============= || Variables de entorno || ============ //

import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

// ============= || Login Section || ============ //

export function checkout_Controller(db) {
     return {
          // Get Checkout token session 
          get_session: (req, res) => {
               let token;
               try {
                    token = req.cookies.session_token;
               } catch { };

               res.setHeader("Cache-Control", "no-store");

               if (!token) {
                    return res.status(401).json({ error: 'Unauthorized' });
               }

               let userInfo;
               try {
                    userInfo = jwt.verify(token, process.env.SECRET_KEY);
               } catch (err) {
                    return res.status(403).json({ error: 'Invalid or expired token' });
               }

               const { product_id } = req.query;

               if (!product_id) {
                    return res.status(400).json({ error: 'Missing product_id in request body' });
               }

               try {
                    // Usamos mysql2 para la consulta
                    db.query(`
                         SELECT image, title, category, price, user_id 
                         FROM Products
                         WHERE product_id = ?
                    `, [product_id], (err, results) => {
                         if (err) {
                         console.error('DB error fetching product:', err);
                         return res.status(500).json({ error: 'Database error' });
                         }

                         if (results.length === 0) {
                         return res.status(404).json({ error: 'Product not found' });
                         }

                         const product = results[0];  // Obtenemos el primer resultado

                         const payload = {
                         product: {
                              seller_id: product.user_id,
                              product_id,
                              title: product.title,
                              type: product.category,
                              price: product.price,
                              image: product.image,
                         },
                         issuedAt: Date.now(),
                         };

                         const productToken = jwt.sign(payload, process.env.SECRET_KEY, {
                         expiresIn: '3m',
                         });

                         // Responder con el token en lugar de la info directa
                         res.status(200).json([{
                         product: {
                              title: product.title,
                              price: product.price,
                              type: product.category,
                              image: product.image
                         },
                         token: productToken
                         }]);
                    });

               } catch (error) {
                    console.error('DB error fetching product:', error);
                    res.status(500).json({ error: 'Database error' });
               }
          },

          // ============= || Order Section || ============= //

          get_order: (req, res) => {
               const token = req.cookies.session_token;
               if (!token) {
                    return res.status(401).json({ error: 'Unauthorized' });
               }

               let userInfo;
               try {
                    userInfo = jwt.verify(token, process.env.SECRET_KEY);
               } catch (err) {
                    return res.status(403).json({ error: 'Invalid or expired token' });
               }

               try {
                    // Usamos mysql2 para la consulta
                    const query = `
                         SELECT *
                         FROM Orders
                         WHERE user_id = ?
                    `;
                    db.query(query, [userInfo.user_id], (err, orders) => {
                         if (err) {
                         console.error('Error getting orders:', err.message);
                         return res.status(500).json({ error: 'Error getting orders' });
                         }
                         res.status(200).json(orders);
                    });

               } catch (error) {
                    console.error('Error getting orders:', error.message);
                    res.status(500).json({ error: 'Error getting orders' });
               }
          },

          post_order: (req, res) => {
               let token_user;
               try {
                    token_user = req.cookies.session_token;
               } catch { };

               if (!token_user) {
                    return res.status(401).json({ error: 'Unauthorized' });
               }

               let userInfo;
               try {
                    userInfo = jwt.verify(token_user, process.env.SECRET_KEY);
               } catch (err) {
                    return res.status(403).json({ error: 'Invalid or expired token' });
               }
               console.log(userInfo);

               // ---------- Confirm Product Token ------------- // 

               const { token } = req.body;
               let product;
               try {
                    product = jwt.verify(token, process.env.SECRET_KEY);
               } catch (err) {
                    return res.status(403).json({ error: 'Invalid or expired token checkout' });
               }
               product = product.product;
               console.log(product);

               // Get And Remove Product // 

               // 1. Obtener el primer Product_Account para el seller_id y product_id
               const productAccountQuery = `
                    SELECT * FROM Product_Accounts
                    WHERE seller_id = ? AND product_id = ?
               `;

               let productAccount;
               try {
                    // Usar .get() para obtener un solo registro
                    db.query(productAccountQuery, [product.seller_id, product.product_id], (err, result) => {
                         if (err) {
                         console.error('Error retrieving product account:', err.message);
                         return res.status(500).json({ error: 'Error retrieving product account' });
                         }

                         if (result.length === 0) {
                         return res.status(404).json({ error: 'Product account not found' });
                         }

                         productAccount = result[0];

                         const deleteQuery = `
                         DELETE FROM Product_Accounts
                         WHERE account_id = ?
                         `;

                         db.query(deleteQuery, [productAccount.account_id], (err, deleteResult) => {
                         if (err) {
                              console.error('Error deleting product account:', err.message);
                              return res.status(500).json({ error: 'Error deleting product account' });
                         }

                         const reduce_quantity = `
                              UPDATE Products
                              SET quantity = quantity - 1
                              WHERE product_id = ?;
                         `;

                         db.query(reduce_quantity, [product.product_id], (err, reduceResult) => {
                              if (err) {
                                   console.error('Error reducing product quantity:', err.message);
                                   return res.status(500).json({ error: 'Error reducing product quantity' });
                              }

                              // Create Order // 
                              try {
                                   const order_id = randomUUID(); // UUID v4
                                   const query = `
                                        INSERT INTO Orders (
                                             order_id,
                                             product_id,
                                             product_image,
                                             product_title,
                                             product_type,
                                             seller_id,
                                             user_id,
                                             quantity,
                                             price_at_purchase,
                                             information,
                                             status
                                        )
                                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                   `;
                                   db.query(query, [
                                        order_id,
                                        product.product_id,
                                        product.image,
                                        product.title,
                                        product.type,
                                        product.seller_id,
                                        userInfo.id,
                                        1,
                                        product.price,
                                        productAccount.information,
                                        "pending"
                                   ], (err, result) => {
                                        if (err) {
                                             console.error('Error creating order:', err.message);
                                             return res.status(500).json({ error: 'Error creating order' });
                                        }
                                        

                                        // Verify exist chatroom

                                        const checkQuery = `
                                             SELECT COUNT(*) AS count
                                             FROM chat_user_room_status
                                             WHERE (user_id = ? AND other_id = ?) OR (user_id = ? AND other_id = ?)
                                        `;

                                        db.query(checkQuery, [userInfo.id, product.seller_id, product.seller_id, userInfo.id], (err, result) => {

                                             console.log(`los malditos resultado = ${result[0].count}`);

                                             if (err) {
                                                  console.error('Error checking existing chat room:', err);
                                                  return res.status(500).json({ error: 'Unknown error, try later' });
                                             }
                                             if(result[0].count === 0) {
                                                  // Create chat
                                                  const query_chat = `
                                                       INSERT INTO chat_user_room_status (
                                                            id,
                                                            user_id,
                                                            other_id,
                                                            listing_id,
                                                            timestamp
                                                       )
                                                       VALUES (?, ?, ?, ?, ?)
                                                  `;
                                                  db.query(query_chat, [
                                                       randomUUID(),
                                                       userInfo.id,
                                                       product.seller_id,
                                                       product.product_id,
                                                       new Date().toISOString().slice(0, 19).replace('T', ' ')
                                                  ], (err, chatResult) => {
                                                       if (err) {
                                                       console.error('Error creating chat:', err.message);
                                                       return res.status(500).json({ error: 'Error creating chat' });
                                                       }
                                                  });
                                             }
                                        })
                                        res.status(201).json({ message: 'Order created', order_id });
                                   });
                              } catch (error) {
                                   console.error('Error creating order:', error.message);
                                   res.status(500).json({ error: 'Error creating order' });
                              }
                         });
                         });
                    });

               } catch (err) {
                    console.error('Error verifying product token:', err.message);
                    return res.status(500).json({ error: 'Error verifying product token' });
               }
          }
     };
}
