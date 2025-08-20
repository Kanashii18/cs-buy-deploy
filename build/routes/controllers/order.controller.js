import jwt from 'jsonwebtoken';

export function purchasedController(db) {
    return {
        // Obtener los productos comprados por el usuario
        get_purchased_by_user: (req, res) => {
            const token = req.cookies.session_token;

            if (!token) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            let userInfo;
            try {
                // Verificar el token JWT y extraer el user_id
                userInfo = jwt.verify(token, process.env.SECRET_KEY);
            } catch (err) {
                return res.status(403).json({ error: 'Invalid or expired token' });
            }

            // Petición a la tabla Purchased para obtener los productos comprados por el usuario
            const query = `
                SELECT order_id, product_id, product_image, product_title, seller_id, status
                FROM Orders
                WHERE user_id = ?
            `;

            try {
                db.query(query, [userInfo.id], (err, purchasedItems) => {
                    if (err) {
                        console.error('Error fetching purchased items:', err.message);
                        return res.status(500).json({ error: 'Unknown error, try later' });
                    }


                    // Retornar los datos obtenidos
                    res.status(200).json(purchasedItems);
                });
            } catch (error) {
                console.error('Error fetching purchased items:', error.message);
                res.status(500).json({ error: 'Database error' });
            }
        },

        // Obtener información de un producto específico
        get_specific_product: (req, res) => {
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

            const id = req.query.o;

            const productQuery = `
                SELECT have_feedback, product_id, product_image, product_title, seller_id, user_id, status, price_at_purchase, information
                FROM Orders
                WHERE order_id = ? AND user_id = ?
            `;
            db.query(productQuery, [id, userInfo.id], (err, order) => {
                if (err) {
                    return res.status(500).json({ error: 'Error retrieving order' });
                }

                if (order.length === 0) {
                    return res.status(404).json({ error: 'Order not found' });
                }

                const userQuery = `
                    SELECT username, img
                    FROM Users
                    WHERE user_id = ?
                `;
                db.query(userQuery, [order[0].seller_id], (err, user) => {
                    if (err) {
                        return res.status(500).json({ error: 'Error retrieving user info' });
                    }

                    const result = {
                        have_feedback: order[0].have_feedback,
                        order_id: order[0].order_id,
                        product_id: order[0].product_id,
                        seller_id: order[0].seller_id,
                        user_id: order[0].user_id,
                        status: order[0].status,
                        title: order[0].product_title,
                        image: order[0].product_image,
                        price_at_purchase: order[0].price_at_purchase,
                        information: order[0].information,
                        user: {
                            username: user[0].username,
                            img: user[0].img
                        }
                    };

                    return res.json(result);
                });
            });
        },

        // Confirmar un producto
        confirm_product: (req, res) => {
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

            const id = req.query.o;

            const productQuery = `
                UPDATE Orders
                SET status = 'confirmed'
                WHERE order_id = ? AND user_id = ?
            `;

            try {
                db.query(productQuery, [id, userInfo.id], (err, result) => {
                    if (err) {
                        return res.status(500).json({ error: 'Error updating order' });
                    }

                    if (result.affectedRows === 0) {
                        return res.status(404).json({ error: 'Order not found' });
                    }

                    return res.status(200).json({ message: 'Order confirmed successfully' });
                });
            } catch (err) {
                return res.status(500).json({ error: 'Error updating order' });
            }
        }
    };
}
