"use client";

import Header from '../_components/Header';
import Footer from '../_components/Footer';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import './profil.css';

export default function ProfilPage() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    avatar_url: ''
  });
  const fileInputRef = useRef(null);
  const router = useRouter();

  // Fonction pour générer un avatar par défaut avec les initiales
  const generateDefaultAvatar = (name) => {
    if (!name) return null;
    
    const initials = name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);

    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    
    const colorIndex = name.charCodeAt(0) % colors.length;
    const bgColor = colors[colorIndex];
    
    return `data:image/svg+xml,${encodeURIComponent(`
      <svg width="120" height="120" xmlns="http://www.w3.org/2000/svg">
        <circle cx="60" cy="60" r="60" fill="${bgColor}"/>
        <text x="60" y="70" text-anchor="middle" fill="white" font-size="36" font-weight="bold" font-family="Arial, sans-serif">${initials}</text>
      </svg>
    `)}`;
  };

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { user } = session;
        setUser(user);
        
        // Récupérer les données du profil depuis la base de données
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        setProfile(profileData);
        
        // Initialiser les données du formulaire
        setProfileData({
          name: profileData?.name || user.user_metadata?.full_name || user.user_metadata?.name || '',
          email: user.email,
          phone: profileData?.phone || user.user_metadata?.phone || '',
          address: profileData?.address || '',
          city: profileData?.city || '',
          avatar_url: profileData?.avatar_url || user.user_metadata?.avatar_url || ''
        });
      }
    };
    
    fetchProfile();
    
    // Écoute les changements d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
        setProfile(null);
      }
    });
    
    return () => subscription?.unsubscribe();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !user) return;

    setLoading(true);
    try {
      // Vérifier le type de fichier
      if (!file.type.startsWith('image/')) {
        throw new Error('Veuillez sélectionner un fichier image');
      }

      // Vérifier la taille du fichier (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Le fichier est trop volumineux (max 5MB)');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Tentative d'upload avec Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        // Si le bucket n'existe pas, proposer une alternative
        if (uploadError.message.includes('Bucket not found')) {
          setMessage('⚠️ Stockage d\'avatars non configuré. Veuillez contacter l\'administrateur.');
          return;
        }
        throw uploadError;
      }

      // Obtenir l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Mettre à jour l'état local
      setProfileData(prev => ({
        ...prev,
        avatar_url: publicUrl
      }));

      setMessage('Photo de profil mise à jour avec succès !');
      // Effacer le message après 3 secondes
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Erreur lors du téléchargement:', error);
      setMessage(`Erreur : ${error.message}`);
      // Effacer le message d'erreur après 5 secondes
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Mettre à jour le profil dans la base de données
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          name: profileData.name,
          phone: profileData.phone,
          address: profileData.address,
          city: profileData.city,
          avatar_url: profileData.avatar_url
        });

      if (error) throw error;

      // Mettre à jour les métadonnées utilisateur
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          full_name: profileData.name,
          phone: profileData.phone,
          avatar_url: profileData.avatar_url
        }
      });

      if (updateError) throw updateError;

      setIsEditing(false);
      setMessage('Profil mis à jour avec succès !');
      // Effacer le message après 3 secondes
      setTimeout(() => setMessage(''), 3000);
      
      // Recharger les données
      const { data: updatedProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      setProfile(updatedProfile);
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      setMessage('Erreur lors de la mise à jour du profil');
      // Effacer le message d'erreur après 5 secondes
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // Réinitialiser les données du formulaire
    setProfileData({
      name: profile?.name || user?.user_metadata?.full_name || user?.user_metadata?.name || '',
      email: user?.email || '',
      phone: profile?.phone || user?.user_metadata?.phone || '',
      address: profile?.address || '',
      city: profile?.city || '',
      avatar_url: profile?.avatar_url || user?.user_metadata?.avatar_url || ''
    });
    setIsEditing(false);
    setMessage('');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push('/');
  };

  if (!user) {
    return (
      <>
        <Header />
        <main className="profile-container">
          <div className="profile-card">
            <h1>Mon Profil</h1>
            <div className="not-connected">
              <p>Vous n'êtes pas connecté.</p>
              <a href="/connexion" className="btn btn-primary">Se connecter</a>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="profile-container">
        <div className="profile-card">
          <div className="profile-header">
            <h1>Mon Profil</h1>
            {!isEditing && (
              <button 
                className="btn btn-secondary" 
                onClick={() => setIsEditing(true)}
              >
                Modifier
              </button>
            )}
          </div>

          {message && (
            <div className={`message ${message.includes('Erreur') ? 'error' : 'success'}`}>
              {message}
            </div>
          )}

          <div className="profile-content">
            <div className="avatar-section">
              <div className="avatar-container">
                {profileData.avatar_url ? (
                  <img 
                    src={profileData.avatar_url} 
                    alt="Photo de profil" 
                    className="avatar"
                    onError={(e) => {
                      // Si l'image ne se charge pas, utiliser l'avatar par défaut
                      const defaultAvatar = generateDefaultAvatar(profileData.name);
                      if (defaultAvatar) {
                        e.target.src = defaultAvatar;
                      }
                    }}
                  />
                ) : profileData.name ? (
                  <img 
                    src={generateDefaultAvatar(profileData.name)} 
                    alt="Avatar généré" 
                    className="avatar"
                  />
                ) : (
                  <div className="avatar-placeholder">
                    <svg width="60" height="60" viewBox="0 0 24 24" fill="none">
                      <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" fill="currentColor"/>
                      <path d="M12 14C7.58172 14 4 17.5817 4 22H20C20 17.5817 16.4183 14 12 14Z" fill="currentColor"/>
                    </svg>
                  </div>
                )}
                {isEditing && (
                  <button 
                    className="avatar-upload-btn" 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M12 15L8 11H11V5H13V11H16L12 15Z" fill="currentColor"/>
                      <path d="M20 18V20H4V18L6 16H8L7 17H17L16 16H18L20 18Z" fill="currentColor"/>
                    </svg>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  style={{ display: 'none' }}
                />
              </div>
            </div>

            <div className="profile-fields">
              <div className="field-group">
                <label htmlFor="name">Nom complet</label>
                {isEditing ? (
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={profileData.name}
                    onChange={handleInputChange}
                    className="form-input"
                  />
                ) : (
                  <div className="field-value">{profileData.name || '—'}</div>
                )}
              </div>

              <div className="field-group">
                <label htmlFor="email">Email</label>
                <div className="field-value">{profileData.email}</div>
                <small className="field-hint">L'email ne peut pas être modifié</small>
              </div>

              <div className="field-group">
                <label htmlFor="phone">Téléphone</label>
                {isEditing ? (
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={profileData.phone}
                    onChange={handleInputChange}
                    className="form-input"
                    placeholder="+33 1 23 45 67 89"
                  />
                ) : (
                  <div className="field-value">{profileData.phone || '—'}</div>
                )}
              </div>

              <div className="field-group">
                <label htmlFor="address">Adresse</label>
                {isEditing ? (
                  <input
                    type="text"
                    id="address"
                    name="address"
                    value={profileData.address}
                    onChange={handleInputChange}
                    className="form-input"
                    placeholder="123 rue de la Paix"
                  />
                ) : (
                  <div className="field-value">{profileData.address || '—'}</div>
                )}
              </div>

              <div className="field-group">
                <label htmlFor="city">Ville</label>
                {isEditing ? (
                  <input
                    type="text"
                    id="city"
                    name="city"
                    value={profileData.city}
                    onChange={handleInputChange}
                    className="form-input"
                    placeholder="Paris"
                  />
                ) : (
                  <div className="field-value">{profileData.city || '—'}</div>
                )}
              </div>
            </div>

            <div className="profile-stats">
              <div className="stat">
                <div className="stat-label">Rôle</div>
                <div className="stat-value">{user.user_metadata?.role || 'Utilisateur'}</div>
              </div>
              <div className="stat">
                <div className="stat-label">Membre depuis</div>
                <div className="stat-value">
                  {new Date(user.created_at).toLocaleDateString('fr-FR')}
                </div>
              </div>
            </div>
          </div>

          <div className="profile-actions">
            {isEditing ? (
              <div className="action-buttons">
                <button 
                  className="btn btn-primary" 
                  onClick={handleSave}
                  disabled={loading}
                >
                  {loading ? 'Enregistrement...' : 'Enregistrer'}
                </button>
                <button 
                  className="btn btn-secondary" 
                  onClick={handleCancel}
                  disabled={loading}
                >
                  Annuler
                </button>
              </div>
            ) : (
              <button 
                className="btn btn-danger" 
                onClick={handleLogout}
              >
                Se déconnecter
              </button>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}