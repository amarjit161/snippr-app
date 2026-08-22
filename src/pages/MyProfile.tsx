import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Scissors, ArrowLeft, Edit2, Check, X, Eye, EyeOff, Phone, Mail, User } from 'lucide-react';

interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  gender: string | null;
}

export const MyProfile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editData, setEditData] = useState<UserProfile | null>(null);

  const { user } = useAuth();

  // Load profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) {
        // Wait for user to be populated
        return;
      }

      try {
        const fetchPromise = supabase
          .from('customer_profiles')
          .select('id, first_name, last_name, email, phone, gender, profile_complete_pct, created_at')
          .eq('id', user.id)
          .maybeSingle();

        const timeoutPromise = new Promise<any>((_, reject) => 
          setTimeout(() => reject(new Error("Network timeout")), 8000)
        );

        const { data: profileData, error } = await Promise.race([fetchPromise, timeoutPromise]);
        
        if (error) throw error;

        if (profileData) {
          setProfile(profileData as UserProfile);
          setEditData(profileData as UserProfile);
        } else {
          // If no profile exists yet, create an empty template
          const emptyProfile = {
            id: user.id,
            email: user.email || '',
            first_name: '',
            last_name: '',
            phone: null,
            gender: null
          };
          setProfile(emptyProfile);
          setEditData(emptyProfile);
        }
      } catch (err: any) {
        toast.error('Failed to load profile details. Please try again.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!editData) return;

    // Validation
    if (!editData.first_name.trim() || !editData.last_name.trim()) {
      toast.error('First and last names are required');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('customer_profiles')
        .update({
          first_name: editData.first_name,
          last_name: editData.last_name,
        })
        .eq('id', editData.id);

      if (error) throw error;

      setProfile(editData);
      setEditing(false);
      toast.success('✓ Profile updated!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };



  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/5">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          <p className="text-sm text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/5">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Profile not found</p>
          <button
            onClick={() => navigate('/salons')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/5 py-8 px-4">
      <div className="mx-auto max-w-3xl">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </button>
            <div>
              <h1 className="font-display text-3xl font-bold text-foreground">My Profile</h1>
              <p className="text-muted-foreground text-sm mt-1">View and manage your account details</p>
            </div>
          </div>
          <button
            onClick={() => {
              if (editing) {
                setEditData(profile);
                setEditing(false);
              } else {
                setEditing(true);
              }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-primary/20 hover:bg-primary/5 transition-colors"
          >
            {editing ? (
              <>
                <X className="w-4 h-4" />
                Cancel
              </>
            ) : (
              <>
                <Edit2 className="w-4 h-4" />
                Edit
              </>
            )}
          </button>
        </div>

        {/* Profile Card */}
        <div className="bg-card rounded-3xl shadow-elevation-2 border border-border p-8 mb-6">

          {/* Avatar Section */}
          <div className="text-center mb-8 pb-8 border-b border-border">
            <div className="inline-flex items-center justify-center w-24 h-24
                            bg-gradient-to-br from-primary/10 to-primary/20 rounded-full mb-4">
              <span className="font-display text-4xl font-bold text-primary">
                {profile.first_name?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground">
              {profile.first_name} {profile.last_name}
            </h2>
            <p className="text-muted-foreground text-sm mt-1">{profile.email}</p>
          </div>

          {/* Profile Fields */}
          <div className="space-y-6">

            {/* Email (Read-only) */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                <Mail className="w-4 h-4 inline mr-2" />
                Email Address
              </label>
              <div className="flex items-center gap-3 p-3 bg-muted border border-border rounded-xl">
                <input
                  type="email"
                  value={profile.email}
                  readOnly
                  className="flex-1 bg-transparent outline-none text-foreground text-sm"
                />
                <span className="text-xs font-medium text-success">Verified</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Email verified during registration</p>
            </div>

            {/* First Name */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                First Name
              </label>
              <input
                type="text"
                value={editData?.first_name || ''}
                onChange={e => editData && setEditData({ ...editData, first_name: e.target.value })}
                disabled={!editing}
                className={`w-full px-4 py-3 rounded-xl border text-sm transition-all ${
                  editing
                    ? 'border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background'
                    : 'border-border bg-muted text-foreground'
                }`}
              />
            </div>

            {/* Last Name */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Last Name
              </label>
              <input
                type="text"
                value={editData?.last_name || ''}
                onChange={e => editData && setEditData({ ...editData, last_name: e.target.value })}
                disabled={!editing}
                className={`w-full px-4 py-3 rounded-xl border text-sm transition-all ${
                  editing
                    ? 'border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background'
                    : 'border-border bg-muted text-foreground'
                }`}
              />
            </div>

            {/* Phone (Read-only) */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                <Phone className="w-4 h-4 inline mr-2" />
                Phone Number
              </label>
              <div className="flex items-center gap-3 p-3 bg-muted border border-border rounded-xl">
                <input
                  type="tel"
                  value={profile.phone || 'Not added yet'}
                  readOnly
                  className="flex-1 bg-transparent outline-none text-foreground text-sm"
                />
                {profile.phone && <span className="text-xs font-medium text-success">Verified</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {profile.phone ? 'Phone verified' : 'Add phone to your profile'}
              </p>
            </div>

            {/* Gender (Read-only) */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                <User className="w-4 h-4 inline mr-2" />
                Gender
              </label>
              <div className="flex items-center gap-3 p-3 bg-muted border border-border rounded-xl">
                <input
                  type="text"
                  value={profile.gender || 'Not selected'}
                  readOnly
                  className="flex-1 bg-transparent outline-none text-foreground text-sm"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          {editing && (
            <div className="mt-8 pt-8 border-t border-border">
              <button
                onClick={handleSaveProfile}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl font-semibold
                           hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
              >
                <Check className="w-5 h-5" />
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default MyProfile;

