import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * CODENLIGNE - Worker
 * 
 * Ce fichier est conservé pour la structure du projet, mais il n'y a actuellement
 * aucune tâche de fond asynchrone (cron) requise par le CDC.
 * 
 * Les expirations d'accès sont vérifiées à la volée (côté serveur) dans AccessGuard.
 * Les notes des QCM sont calculées de manière synchrone dans QuizzesController.
 */
async function bootstrap() {
  console.log('[worker] Démarrage du worker CODENLIGNE...');
  
  try {
    // On initialise un contexte NestJS minimaliste (sans serveur HTTP)
    // pour garder l'accès aux services si besoin plus tard.
    const app = await NestFactory.createApplicationContext(AppModule);
    
    console.log('[worker] Aucune tâche de fond requise pour le moment.');
    console.log('[worker] Le worker est en attente.');

    // Gestion propre de l'arrêt
    const shutdown = async (signal: string) => {
      console.log(`[worker] Arrêt demandé (${signal})`);
      await app.close();
      process.exit(0);
    };

    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));

  } catch (error) {
    console.error('[worker] Erreur fatale au démarrage:', error);
    process.exit(1);
  }
}

void bootstrap();