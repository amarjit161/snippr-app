import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
  const [savingPassword, setSavingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Load profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          navigate('/login');
          return;
        }

        const { data: profileData } = await supabase
          .from('customer_profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (profileData) {
          setProfile(profileData as UserProfile);
          setEditData(profileData as UserProfile);
        }
      } catch (err: any) {
        toast.error('Failed to load profile');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [navigate]);

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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }

    setSavingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success('✓ Password updated!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update password');
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-50 via-white to-purple-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
          <p className="text-sm text-gray-500">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-50 via-white to-purple-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Profile not found</p>
          <button
            onClick={() => navigate('/salons')}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 py-8 px-4">
      <div className="mx-auto max-w-3xl">
        
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-gray-200 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
              <p className="text-gray-500 text-sm mt-1">View and manage your account details</p>
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
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-purple-200 hover:bg-purple-50 transition-colors"
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
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8 mb-6">
          
          {/* Avatar Section */}
          <div className="text-center mb-8 pb-8 border-b border-gray-100">
            <div className="inline-flex items-center justify-center w-24 h-24 
                            bg-gradient-to-br from-purple-100 to-purple-200 rounded-full mb-4">
              <span className="text-4xl font-bold text-purple-700">
                {profile.first_name?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              {profile.first_name} {profile.last_name}
            </h2>
            <p className="text-gray-500 text-sm mt-1">{profile.email}</p>
          </div>

          {/* Profile Fields */}
          <div className="space-y-6">
            
            {/* Email (Read-only) */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                <Mail className="w-4 h-4 inline mr-2" />
                Email Address
              </label>
              <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                <input
                  type="email"
                  value={profile.email}
                  readOnly
                  className="flex-1 bg-transparent outline-none text-gray-700 text-sm"
                />
                <span className="text-xs font-medium text-green-600">Verified</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Email verified during registration</p>
            </div>

            {/* First Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                First Name
              </label>
              <input
                type="text"
                value={editData?.first_name || ''}
                onChange={e => editData && setEditData({ ...editData, first_name: e.target.value })}
                disabled={!editing}
                className={`w-full px-4 py-3 rounded-xl border text-sm transition-all ${
                  editing
                    ? 'border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white'
                    : 'border-gray-200 bg-gray-50 text-gray-700'
                }`}
              />
            </div>

            {/* Last Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Last Name
              </label>
              <input
                type="text"
                value={editData?.last_name || ''}
                onChange={e => editData && setEditData({ ...editData, last_name: e.target.value })}
                disabled={!editing}
                className={`w-full px-4 py-3 rounded-xl border text-sm transition-all ${
                  editing
                    ? 'border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white'
                    : 'border-gray-200 bg-gray-50 text-gray-700'
                }`}
              />
            </div>

            {/* Phone (Read-only) */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                <Phone className="w-4 h-4 inline mr-2" />
                Phone Number
              </label>
              <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                <input
                  type="tel"
                  value={profile.phone || 'Not added yet'}
                  readOnly
                  className="flex-1 bg-transparent outline-none text-gray-700 text-sm"
                />
                {profile.phone && <span className="text-xs font-medium text-green-600">Verified</span>}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {profile.phone ? 'Phone verified' : 'Add phone to your profile'}
              </p>
            </div>

            {/* Gender (Read-only) */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                <User className="w-4 h-4 inline mr-2" />
                Gender
              </label>
              <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                <input
                  type="text"
                  value={profile.gender || 'Not selected'}
                  readOnly
                  className="flex-1 bg-transparent outline-none text-gray-700 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          {editing && (
            <div className="mt-8 pt-8 border-t border-gray-100">
              <button
                onClick={handleSaveProfile}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white py-3 rounded-xl font-semibold 
                           hover:bg-purple-700 transition-all disabled:opacity-50 shadow-lg shadow-purple-200"
              >
                <Check className="w-5 h-5" />
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>

        {/* Change Password Section */}
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-6">🔐 Change Password</h3>
          
          <form onSubmit={handleChangePassword} className="space-y-4">
            
            {/* Current Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm 
                             focus:outline-none focus:ring-2 focus:ring-purple-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm 
                             focus:outline-none focus:ring-2 focus:ring-purple-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm 
                             focus:outline-none focus:ring-2 focus:ring-purple-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="w-full bg-gray-600 text-white py-3 rounded-xl font-semibold text-sm 
                         hover:bg-gray-700 transition-all disabled:opacity-50 mt-6"
            >
              {savingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default MyProfile;
