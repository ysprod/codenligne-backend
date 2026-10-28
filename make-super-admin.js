const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Charger les variables d'environnement
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const USERNAME = 'admina'; // Remplace par ton vrai nom d'utilisateur si ce n'est pas "admin"

async function makeSuperAdmin() {
  if (!MONGODB_URI) {
    console.error('❌ Erreur: MONGODB_URI n\'est pas défini dans le .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB');

    // On met à jour directement l'utilisateur dans la collection "users"
    const result = await mongoose.connection.collection('users').updateOne(
      { username: USERNAME.toLowerCase() }, // On force en minuscule selon ton schéma
      { 
        $set: { 
          role: 'SUPER_ADMIN',
          status: 'ACTIVE' // On en profite pour valider son accès
        } 
      }
    );

    if (result.matchedCount === 0) {
      console.log(`❌ Aucun utilisateur trouvé avec le nom d'utilisateur : ${USERNAME}`);
    } else {
      console.log(`✅ Succès ! L'utilisateur "${USERNAME}" est maintenant SUPER_ADMIN et ACTIF.`);
    }
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour :', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

makeSuperAdmin();