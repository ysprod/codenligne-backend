#!/bin/bash

# Vérifier si un argument (le nom de l'archive) est fourni
if [ -z "$1" ]; then
  echo "❌ Usage: ./restore.sh <nom_de_l_archive.tar.gz>"
  echo "Exemple: ./restore.sh backups/backup_2026-10-28_14-00-00.tar.gz"
  exit 1
fi

ARCHIVE=$1
DB_NAME="monetoile"
TEMP_DIR="./backups/temp_restore"

echo "⏳ Début de la restauration depuis $ARCHIVE..."

# Décompresser l'archive
mkdir -p "$TEMP_DIR"
tar -xzvf "$ARCHIVE" -C "$TEMP_DIR"

# Trouver le nom du dossier extrait
EXTRACTED_DIR=$(find "$TEMP_DIR" -mindepth 1 -maxdepth 1 -type d | head -n 1)

if [ -z "$EXTRACTED_DIR" ]; then
  echo "❌ Impossible de trouver le dossier de sauvegarde extrait."
  exit 1
fi

# Restaurer avec mongorestore (--drop écrase les collections existantes)
mongorestore --db "$DB_NAME" --drop "$EXTRACTED_DIR/$DB_NAME"

if [ $? -eq 0 ]; then
  echo "✅ Restauration réussie."
else
  echo "❌ Erreur lors de la restauration."
fi

# Nettoyage
rm -rf "$TEMP_DIR"