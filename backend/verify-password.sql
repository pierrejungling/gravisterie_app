-- Script pour vérifier et mettre à jour le mot de passe de l'utilisateur admin
-- Ce script génère un nouveau hash et met à jour l'utilisateur

-- D'abord, vérifions l'utilisateur actuel
SELECT username, mail, "isAdmin", active, LEFT(password, 20) as password_start FROM credential WHERE username = 'admin_gravisterie';

-- Générer un nouveau hash pour le mot de passe "Camaro4208"
-- Note: Vous devez générer ce hash avec Node.js: 
-- node -e "const bcrypt = require('bcrypt'); bcrypt.hash('Camaro4208', 10).then(hash => console.log(hash));"

-- Mettre à jour le mot de passe avec un nouveau hash (remplacez le hash ci-dessous par celui généré)
UPDATE credential 
SET password = '$2b$10$kolVckzMMRrSAL0CU.NfFO8B0qpszlfpKRKdKm6sShsiPFg0LUjMG',
    updated = NOW()
WHERE username = 'admin_gravisterie';

-- Vérifier que la mise à jour a fonctionné
SELECT username, mail, "isAdmin", active, LENGTH(password) as password_length FROM credential WHERE username = 'admin_gravisterie';
