-- Ajouter les colonnes supplémentaires à la table profiles
-- pour supporter les fonctionnalités étendues du profil utilisateur

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS address TEXT, 
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Créer une fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Créer le trigger pour la mise à jour automatique de updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Créer le bucket de stockage pour les avatars (si pas déjà créé)
-- Note: Cette commande doit être exécutée via l'interface Supabase Storage
-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('avatars', 'avatars', true);

-- Politique RLS pour le bucket avatars
-- Note: Ces politiques doivent être configurées via l'interface Supabase Storage