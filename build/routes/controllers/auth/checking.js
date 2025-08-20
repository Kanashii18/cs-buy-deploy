import mysql from 'mysql2';

// ========================== || User Checker || ========================== //

export function user_check(db, req, res) {
    const userId = req.query.id;

    if (!userId) {
        return res.status(400).json({ error: 'User id is required' });
    }
    console.log(userId);

    try {
        // Consultar la base de datos usando mysql2
        db.query(`
            SELECT user_id, username, img, description
            FROM Users
            WHERE user_id = ?`, 
            [userId], // La consulta parametrizada
            (err, results) => {
                if (err) {
                    console.error('Error querying users table:', err);
                    return res.status(500).json({ error: 'Internal server error' });
                }

                if (results.length === 0) {
                    return res.status(404).json({ error: 'User not found' });
                }

                // Devolver los datos
                return res.json(results[0]);
            }
        );

    } catch (error) {
        console.error('Unexpected error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

// ========================== || Seller Checker || ========================== //

export function seller_check(db, req, res) {
    const { user_id } = req.body; // Extraer user_id del cuerpo de la solicitud

    if (!user_id) {
        return res.status(400).json({ error: 'user_id is required in request body' });
    }

    try {
        // Consultar la base de datos usando mysql2
        db.query(`
            SELECT rate, user_id, username, img
            FROM Users
            WHERE user_id = ?`, 
            [user_id], // La consulta parametrizada
            (err, results) => {
                if (err) {
                    console.error('Error querying users table:', err);
                    return res.status(500).json({ error: 'Database query error' });
                }

                if (results.length === 0) {
                    return res.status(404).json({ error: 'User not found' });
                }

                // Devolver los datos del usuario
                res.json(results[0]);
            }
        );

    } catch (error) {
        console.error('Unexpected error:', error);
        res.status(500).json({ error: 'Database query error' });
    }
}
