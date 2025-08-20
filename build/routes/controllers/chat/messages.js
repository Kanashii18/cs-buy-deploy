import jwt from 'jsonwebtoken';
import pkg from 'uuid';
const { v4 } = pkg;
import dotenv from 'dotenv';
dotenv.config();

export function messageGestion(db) {
    return {
        // Leer mensajes de la sala de chat
        readRoom: (req, res) => {
            const token = req.cookies.session_token;
            const { roomId } = req.body;
            console.log(roomId);

            let userInfo;
            try {
                userInfo = jwt.verify(token, process.env.SECRET_KEY);
            } catch (err) {
                return res.status(403).json({ error: 'Invalid or expired token' });
            }

            try {
                // Usamos mysql2 para realizar la consulta
                db.query(`
                    SELECT * FROM Messages
                    WHERE chat_id = ?
                    ORDER BY timestamp ASC
                `, [roomId], (err, results) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({ error: 'Error leyendo mensajes' });
                    }

                    console.log(results);
                    res.json(results); // Responder con los mensajes encontrados
                });
            } catch (err) {
                console.error(err);
                res.status(500).json({ error: 'Error leyendo mensajes' });
            }
        },

        // Enviar un nuevo mensaje
        postChat: (req, res) => {
            const token = req.cookies.session_token;

            let userInfo;
            try {
                userInfo = jwt.verify(token, process.env.SECRET_KEY);
            } catch (err) {
                return res.status(403).json({ error: 'Invalid or expired token' });
            }
            userInfo = userInfo.id;

            const { roomId, recibe_id, message } = req.body;

            if (!roomId || !message || !recibe_id) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            // Crear el nuevo mensaje
            const newMessage = {
                message_id: v4(),
                chat_id: roomId,  // Usamos el chat_id de la sala
                sender_id: userInfo,
                message,
                timestamp: new Date().toISOString().slice(0, 19).replace('T', ' ')
            };

            // Insertar el nuevo mensaje en la base de datos usando mysql2
            db.query(`
                INSERT INTO Messages (message_id, chat_id, sender_id, text, timestamp)
                VALUES (?, ?, ?, ?, ?)
            `, [
                newMessage.message_id,  // El primer parámetro: message_id
                newMessage.chat_id,     // El segundo parámetro: chat_id
                newMessage.sender_id,   // El tercer parámetro: sender_id
                newMessage.message,        // El cuarto parámetro: text
                newMessage.timestamp    // El quinto parámetro: timestamp
            ], (err, results) => {
                if (err) {
                    console.error('Error inserting message:', err);
                    return res.status(500).json({ error: 'Error inserting message' });
                }

                // Responder con el nuevo mensaje insertado
                res.status(201).json(newMessage);
            });
        }
    };
}
