export function logout(req, res) {
  res.clearCookie('session_token', {
    httpOnly: true,
    secure: false, // en local
    sameSite: 'Strict',
    path: '/',
    domain: 'localhost' // aseguramos coincidencia
  });

  res.status(200).json({ message: 'Sesión cerrada correctamente...' });
}
