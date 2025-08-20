import jwt from 'jsonwebtoken';

export function get_wallet(db, req, res) {
    const token = req.cookies.session_token;
    if (!token) {
        return res.status(401).json({ error: 'No authenticated' });
    }

    let payload;
    try {
        payload = jwt.verify(token, process.env.SECRET_KEY);
    } catch (err) {
        return res.status(401).json({ error: 'invalid or expired token' });
    }

    // Extract user_id from jwt token....
    const userId = payload.id;
    if (!userId) {
        return res.status(400).json({ error: 'Id Required' });
    }

    try {
        // Usar mysql2 para hacer la consulta
        db.query('SELECT * FROM Wallets WHERE user_id = ?', [userId], (err, results) => {
            if (err) {
                console.error('error querying wallet:', err);
                return res.status(500).json({ error: 'Unknown Error' });
            }

            if (results.length === 0) {
                return res.status(404).json({ error: 'wallet not found' });
            }

            return res.json(results[0]); // `results[0]` contiene el primer (y único) resultado
        });

    } catch (error) {
        console.error('Unexpected error:', error);
        return res.status(500).json({ error: 'Unknown Error' });
    }
}
