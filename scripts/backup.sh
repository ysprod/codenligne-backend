#!/bin/bash

# Configuration
DB_NAME="monetoile" # Le nom de ta base de données actuelle
BACKUP_DIR="./backups"
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_NAME="backup_$DATE"

# Créer le dossier de backup s'il n'existe pas
mkdir -p "$BACKUP_DIR"

echo "⏳ Début de la sauvegarde de la base $DB_NAME..."

# Exécuter mongodump
# On suppose que MongoDB tourne en local sans mot de passe (dev)
# En prod, il faudra ajouter --uri="mongodb://user:pass@localhost:27017/db"
mongodump --db "$DB_NAME" --out "$BACKUP_DIR/$BACKUP_NAME"

if [ $? -eq 0 ]; then
  echo "✅ Sauvegarde réussie : $BACKUP_DIR/$BACKUP_NAME"
  
  # Optionnel : Compresser le dossier
  tar -czvf "$BACKUP_DIR/$BACKUP_NAME.tar.gz" -C "$BACKUP_DIR" "$BACKUP_NAME"
  rm -rf "$BACKUP_DIR/$BACKUP_NAME" # On garde que l'archive
  echo "📦 Archive créée : $BACKUP_DIR/$BACKUP_NAME.tar.gz"
else
  echo "❌ Erreur lors de la sauvegarde."
fi