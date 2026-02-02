-- Script pour créer ou mettre à jour l'utilisateur admin dans la base de données Render
-- Exécutez ce script dans votre base de données PostgreSQL sur Render

-- Vérifier si l'utilisateur existe déjà
SELECT username, mail, "isAdmin", active FROM credential WHERE username = 'admin_gravisterie';

-- Supprimer l'utilisateur s'il existe déjà (pour réinitialiser)
DELETE FROM credential WHERE username = 'admin_gravisterie';

-- Créer l'utilisateur admin avec le mot de passe hashé
INSERT INTO credential (
    credential_id,
    username,
    password,
    mail,
    "facebookHash",
    "googleHash",
    "isAdmin",
    active,
    created,
    updated
) VALUES (
    '01KGF961V7SQRJGXBTZRMXVQE6',
    'admin_gravisterie',
    '$2b$10$kolVckzMMRrSAL0CU.NfFO8B0qpszlfpKRKdKm6sShsiPFg0LUjMG',
    'admin@gravisterie.com',
    '',
    '',
    true,
    true,
    NOW(),
    NOW()
);

-- Vérifier que l'utilisateur a été créé
SELECT username, mail, "isAdmin", active, LENGTH(password) as password_length FROM credential WHERE username = 'admin_gravisterie';
