import jwt from 'jsonwebtoken';

export function auth_session(db, req, res) {

     let token;
     try {
     token = req.cookies.session_token;
     } catch { };

     if (!token) {
          return res.json({ loggedIn: false });
     }

     try {
     const userPayload = jwt.verify(token, process.env.SECRET_KEY);

     // Consulta en MariaDB usando mysql2
     db.query(`
          SELECT * FROM Users WHERE user_id = ?`,
          [userPayload.id], // Parámetro para evitar inyecciones SQL
          (err, results) => {
               if (err) {
                    console.error('Error querying the database:', err);
                    return res.json({ loggedIn: false, error: err.message });
               }

               if (results.length === 0) {
                    return res.json({ loggedIn: false });
               }

               const userData = results[0]; // Como obtenemos un solo resultado, tomamos el primer objeto

               res.json({
                    loggedIn: true,
                    id: userData.user_id,
                    username: userData.username,
                    role: userData.role,
                    img: userData.img,
               });
          }
     );

     } catch (error) {
     res.json({ loggedIn: false, error: error.message });
     }
}
