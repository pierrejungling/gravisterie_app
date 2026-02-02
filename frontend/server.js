const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

// Déterminer le chemin de build (Angular 19 peut utiliser browser ou directement dist/app)
const buildPath = fs.existsSync(path.join(__dirname, 'dist/app/browser'))
  ? path.join(__dirname, 'dist/app/browser')
  : path.join(__dirname, 'dist/app');

// Servir les fichiers statiques
app.use(express.static(buildPath));

// Rediriger toutes les routes vers index.html pour le routage Angular
app.get('*', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

const port = process.env.PORT || 4200;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Serving files from: ${buildPath}`);
});
