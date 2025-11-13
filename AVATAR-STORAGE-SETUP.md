# Configuration du stockage Supabase pour les avatars

## Instructions pour configurer le stockage des avatars

### 1. Créer le bucket 'avatars' dans Supabase Storage

Dans l'interface Supabase :
1. Aller dans Storage > Buckets
2. Créer un nouveau bucket avec :
   - Nom : `avatars`
   - Public : ✅ Oui
   - File size limit : 50MB (recommandé)
   - Allowed MIME types : `image/*`

### 2. Configurer les politiques RLS pour le bucket avatars

Dans l'éditeur SQL Supabase, exécuter :

```sql
-- Politique pour permettre aux utilisateurs de lire tous les avatars
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

-- Politique pour permettre aux utilisateurs connectés d'uploader leur propre avatar
CREATE POLICY "Users can upload their own avatar" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Politique pour permettre aux utilisateurs de supprimer leur propre avatar
CREATE POLICY "Users can delete their own avatar" ON storage.objects
FOR DELETE USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Politique pour permettre aux utilisateurs de mettre à jour leur propre avatar
CREATE POLICY "Users can update their own avatar" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

### 3. Structure des fichiers avatars

Les fichiers seront stockés avec cette structure :
```
avatars/
  └── {user_id}-{random}.{extension}
```

Par exemple : `avatars/123e4567-e89b-12d3-a456-426614174000-0.5234.jpg`

### 4. URLs publiques

Les avatars seront accessibles via des URLs publiques du type :
```
https://{project_id}.supabase.co/storage/v1/object/public/avatars/{filename}
```

### 5. Gestion des erreurs

Si le bucket n'existe pas encore, l'upload des avatars échouera. 
Assurez-vous de créer le bucket avant d'utiliser la fonctionnalité d'avatar.