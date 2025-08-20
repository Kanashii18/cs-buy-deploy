import jwt from 'jsonwebtoken';
import pkg from 'uuid';
const { v4 } = pkg;
import dotenv from 'dotenv';
dotenv.config();

export function gestionFeedback(db, ci) {
    return {
          // =============== Get Feedback =============== //
          /**z
           * get feedbacks by id.
           */
          getFeedback: (req, res) => {
               const { user_id } = req.body;

               if (!user_id) {
                    return res.status(400).json({ error: 'Missing user_id in request body' });
               }

               try {
                    // Verificar si el usuario existe
                    const userExistsStmt = `
                         SELECT 1 FROM Users WHERE user_id = ?
                    `;
                    db.query(userExistsStmt, [user_id], (err, userExists) => {
                         if (err) {
                              console.error('Error checking if user exists:', err);
                              return res.status(500).json({ error: 'Database error' });
                         }

                         if (userExists.length === 0) {
                              return res.status(404).json({ error: 'User not found' });
                         }

                         // Obtener los feedbacks de la base de datos
                         const feedbacksStmt = `
                              SELECT 
                                   f.feedback_id,
                                   f.user_id,
                                   f.product_id,
                                   f.client_id,
                                   f.comment,
                                   f.stars,
                                   f.created_at,
                                   u.username AS user_username,
                                   u.img AS user_img
                              FROM Feedbacks f
                              JOIN Users u ON f.client_id = u.user_id
                              WHERE f.user_id = ?
                              ORDER BY f.created_at DESC
                         `;
                         db.query(feedbacksStmt, [user_id], (err, feedbacks) => {
                              if (err) {
                                   console.error('DB error fetching feedbacks:', err);
                                   return res.status(500).json({ error: 'Database error' });
                              }

                              res.json(feedbacks);
                         });
                    });

               } catch (error) {
                    console.error('DB error fetching feedbacks:', error);
                    res.status(500).json({ error: 'Database error' });
               }
          },
          // =============== Get All Feedback =============== //
          /**z
           * get feedbacks for feedback site.
           */
          getAllFeedback: (req, res) => {
               const token = req.cookies.session_token;
               if (!token) {
                    return res.status(401).json({ error: 'Unauthorized' });
               }

               let userInfo;
               try {
                    userInfo = jwt.verify(token, process.env.SECRET_KEY);
               } catch (err) {
                    return res.status(400).json({ error: "Unauthorized" });
               }
               console.log(userInfo);
               try {
                    const userExistsStmt = `
                         SELECT client_id, comment, stars, created_at
                         FROM Feedbacks
                         WHERE user_id = ?
                    `;
                    db.query(userExistsStmt, [userInfo.id], (err, feedbacks) => {
                         return res.status(200).json({feedbacks:feedbacks});
                    });

               } catch (error) {
                    console.error('DB error fetching feedbacks:', error);
                    res.status(500).json({ error: 'Database error' });
               }
          },
          getRecentOrder: (req, res) => {

               // transform time to get recent time

               const token = req.cookies.session_token;
               if (!token) {
                    return res.status(401).json({ error: 'Unauthorized' });
               }

               let userInfo;
               try {
                    userInfo = jwt.verify(token, process.env.SECRET_KEY);
               } catch (err) {
                    return res.status(400).json({ error: "Unauthorized" });
               }

               try {
                    const userExistsStmt = `
                         SELECT product_image, product_title, price_at_purchase, created_at
                         FROM Orders
                         WHERE seller_id = ? AND status = 'confirmed'
                         ORDER BY created_at DESC
                    `;

                    db.query(userExistsStmt, [userInfo.id], (err, orders) => {
                         
                         const response = orders.map(order => {
                              return {
                                   product_image: order.product_image,
                                   product_title: order.product_title,
                                   price_at_purchase: order.price_at_purchase,
                                   time: order.created_at
                              };
                         });
                         console.log(`la respuesta ${response[0]}`);
                         return res.status(200).json(response);

                    });

               } catch (error) {
                    console.error('DB error fetching feedbacks:', error);
                    res.status(500).json({ error: 'Database error' });
               }
          },
          getTotalSelled: (req, res) => {
               const token = req.cookies.session_token;
               if (!token) {
                    return res.status(401).json({ error: 'Unauthorized' });
               }

               let userInfo;
               try {
                    userInfo = jwt.verify(token, process.env.SECRET_KEY);
               } catch (err) {
                    return res.status(400).json({ error: "Unauthorized" });
               }

               try {
                    const totalselled = `
                         SELECT 
                              COUNT(CASE WHEN product_type = 'Account' THEN 1 END) AS total_account,
                              COUNT(CASE WHEN product_type = 'Service' THEN 1 END) AS total_service,
                              COUNT(CASE WHEN product_type = 'Assets' THEN 1 END) AS total_assets
                         FROM Orders
                         WHERE seller_id = ? AND status = 'confirmed'
                    `;
                    db.query(totalselled, [userInfo.id], (err, totalcount) => {

                         res.status(200).json({
                              total_account:totalcount[0].total_account || 0,
                              total_service:totalcount[0].total_service || 0,
                              total_assets:totalcount[0].total_assets || 0
                         })
                    });

               } catch (error) {
                    console.error('DB error fetching total selled:', error);
                    res.status(500).json({ error: 'Database error' });
               }
          },
          // =============== Post Feedback =============== //
          /**z
           * Adds feedback for a product from a client.
           */
          postFeedback: (req, res) => {
               const token = req.cookies.session_token;
               if (!token) {
                    return res.status(401).json({ error: 'Unauthorized' });
               }

               let userInfo;
               try {
                    userInfo = jwt.verify(token, process.env.SECRET_KEY);
               } catch (err) {
                    return res.status(400).json({ error: "Unauthorized" });
               }

               console.log(userInfo.id);

               const { order_id, comment, stars } = req.body;
               if (typeof (order_id) !== "string" || typeof (comment) !== "string" || stars == null || stars == 0) {
                    return res.status(400).json({ error: 'Missing required fields' });
               }

               // Get the product_id and seller_id for the given order
               const get_product_id = `
                    SELECT product_id, seller_id
                    FROM Orders
                    WHERE user_id = ? 
                    AND order_id = ?
                    AND have_feedback = false;
               `;

               db.query(get_product_id, [userInfo.id, order_id], (err, result_product) => {
                    if (err) {
                         return res.status(500).json({ error: 'Database error fetching product' });
                    }

                    if (result_product.length === 0) {
                         return res.status(400).json({ error: 'Feedback already given for this order' });
                    }

                    // Mark the order as having feedback
                    const feedbacksStmt = `
                         UPDATE Orders
                         SET have_feedback = true
                         WHERE user_id = ? 
                         AND order_id = ? 
                         AND have_feedback = false;
                    `;

                    db.query(feedbacksStmt, [userInfo.id, order_id], (err, result) => {
                         if (err) {
                              return res.status(500).json({ error: 'Error updating order' });
                         }

                         if (result.affectedRows === 0) {
                              return res.status(400).json({ error: 'Feedback already given for this order' });
                         }

                         // Insert the feedback into the database
                         const insertStmt = `
                              INSERT INTO Feedbacks (feedback_id, user_id, client_id, product_id, comment, stars, created_at)
                              VALUES (?, ?, ?, ?, ?, ?, NOW())
                         `;

                         const feedback_id = v4();  // Generate new feedback ID
                         db.query(insertStmt, [feedback_id, result_product[0].seller_id, userInfo.id, result_product[0].product_id, comment, stars], (err, info) => {
                              if (err) {
                                   console.error('DB error creating feedback:', err);
                                   return res.status(500).json({ error: 'Database error' });
                              }

                              res.status(201).json({
                                   message: 'Feedback created successfully',
                                   feedback_id: feedback_id,  // Returning feedback_id here
                              });
                         });
                    });
               });
          }
     };
}
