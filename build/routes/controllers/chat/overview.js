import jwt from 'jsonwebtoken';

export function chatGestion(db, req, res) {
    return {
        // Ver overview de los chats
        overview: (req, res) => {
            const token = req.cookies.session_token;
            if (!token) return res.status(401).json({ error: 'No token' });

            let user;
            try {
                user = jwt.verify(token, process.env.SECRET_KEY);
            } catch {
                return res.status(401).json({ error: 'Token inválido' });
            }

            try {
                // Usamos mysql2 para la consulta
                db.query(`
                    SELECT id, user_id, other_id, listing_id, timestamp, unread_count
                    FROM chat_user_room_status
                    WHERE user_id = ? OR other_id = ?
                `, [user.id, user.id], (err, result) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({ error: 'DB error' });
                    }

                    // Modificamos el resultado según la lógica
                    result = result.map(item => {
                        if (item.other_id === user.id) {
                            return {
                                ...item,
                                user_id: user.id,  // Cambiar `user_id` a `user.id`
                                other_id: item.user_id // Cambiar `other_id` al valor de `user_id`
                            };
                        }
                        return item;  // Retornar el objeto sin cambios si no cumple la condición
                    });

                    console.log(result);

                    return res.json(result);
                });
            } catch (err) {
                console.error(err);
                return res.status(500).json({ error: 'DB error' });
            }
        },

        // Marcar un mensaje como leído
        markAsRead: (req, res) => {
            const token = req.cookies.session_token;
            if (!token) return res.status(401).json({ error: 'No token' });

            let user;
            try {
                user = jwt.verify(token, process.env.SECRET_KEY);
            } catch {
                return res.status(401).json({ error: 'Token inválido' });
            }

            const senderUserId = req.params.id;

            try {
                // Usamos mysql2 para la actualización
                db.query(`
                    UPDATE chat_user_room_status
                    SET unread_count = 0
                    WHERE user_id = ? AND other_id = ?
                `, [user.id, senderUserId], (err, info) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({ error: 'Error de base de datos' });
                    }

                    if (info.affectedRows === 0) {
                        return res.status(404).json({ error: 'No se encontró la conversación' });
                    }

                    return res.json({ success: true });
                });
            } catch (err) {
                console.error(err);
                return res.status(500).json({ error: 'Error de base de datos' });
            }
        }
    }
}
