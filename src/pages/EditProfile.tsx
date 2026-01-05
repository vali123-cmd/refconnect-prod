import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, api } from '../context/AuthContext';
import { normalizeAssetUrl } from '../lib/utils';
import { UpdateUserDto } from '../types';
import { ChevronLeft, Save } from 'lucide-react';

export default function EditProfile() {
    const { user, updateProfile } = useAuth();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);

    const [formData, setFormData] = useState<UpdateUserDto>({
        userName: '',
        firstName: '',
        lastName: '',
        description: '',
        profileImageUrl: '',
        isProfilePublic: true,
    });
    const [formError, setFormError] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

   
    


    useEffect(() => {
        return () => {
            if (previewUrl) {
                try { URL.revokeObjectURL(previewUrl); } catch (e) {}
            }
        };
    }, [previewUrl]);

    useEffect(() => {
        if (!user?.id) return;
        
        const fetchUserData = async () => {
            setIsFetching(true);
            try {
                const resp = await api.get(`/Users/${user.id}`);
                const userData = resp.data;
                
                // Map API response to UpdateUserDto shape
                setFormData({
                    userName: userData.userName || '',
                    firstName: userData.firstName || '',
                    lastName: userData.lastName || '',
                    description: userData.description || '',
                    profileImageUrl: userData.profileImageUrl || '',
                    isProfilePublic: userData.isProfilePublic ?? true,
                });
            } catch (err: any) {
                console.error('Failed to fetch user data', err);
                const serverMsg = err?.response?.data?.message || err?.response?.data || err?.message;
                setFormError(typeof serverMsg === 'string' ? serverMsg : 'Failed to load profile data');
            } finally {
                setIsFetching(false);
            }
        };

        fetchUserData();
    }, [user?.id]);

    if (!user) {
        navigate('/login');
        return null;
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target as HTMLInputElement;
        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, [name]: checked } as any));
        } else {
            setFormData(prev => ({ ...prev, [name]: value } as any));
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setFormError(null);
        try {
            // If user selected a new file, upload to S3 via Files API first
            if (selectedFile) {
                const fd = new FormData();
                fd.append('file', selectedFile);
               
                try {
                    console.log('Uploading file to /Files/upload...');
                    const upResp = await api.post('/Files/upload', fd, { 
                        headers: { 'Content-Type': 'multipart/form-data' } 
                    });
                    const returned = upResp?.data;
                    // Backend returns { Url: "s3-url-here" }
                    const s3Url = returned?.Url || returned?.url;
                    
                    if (s3Url && typeof s3Url === 'string') {
                        console.log('Files.upload returned S3 URL:', s3Url);
                        // Store the S3 URL directly - this will be saved to the database
                        formData.profileImageUrl = s3Url;
                    } else {
                        throw new Error('No URL returned from Files/upload');
                    }
                } catch (err: any) {
                    console.error('File upload failed:', err);
                    const serverMsg = err?.response?.data?.message || err?.message || 'Failed to upload file to S3';
                    setFormError(typeof serverMsg === 'string' ? serverMsg : 'Failed to upload profile picture');
                    setIsLoading(false);
                    return;
                }
            }

            // Save profile with the S3 URL to database
            await updateProfile(formData);

            navigate('/profile');
        } catch (err: any) {
            console.error('Update profile failed', err);
            const serverMsg = err?.response?.data?.message || err?.response?.data || err?.message;
            setFormError(typeof serverMsg === 'string' ? serverMsg : JSON.stringify(serverMsg));
        } finally {
            setIsLoading(false);
        }
    };

    

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 border-b border-border pb-4">
                <button onClick={() => navigate('/profile')} className="p-2 hover:bg-secondary rounded-full">
                    <ChevronLeft className="h-5 w-5" />
                </button>
                <h1 className="text-xl font-bold">Edit Profile</h1>
            </div>

            {isFetching ? (
                <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
                            <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">Loading...</span>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">Loading profile data...</p>
                    </div>
                </div>
            ) : (
            <form onSubmit={handleSave} className="space-y-6">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-24 w-24 rounded-full bg-secondary flex items-center justify-center overflow-hidden border-2 border-border">
                        {previewUrl ? (
                            <img src={previewUrl} alt="Avatar preview" className="h-full w-full object-cover" />
                        ) : formData.profileImageUrl ? (
                            <img src={normalizeAssetUrl(formData.profileImageUrl)} alt="Avatar" className="h-full w-full object-cover" />
                        ) : (
                            <span className="text-xs text-muted-foreground p-2 text-center">No Image</span>
                        )}
                    </div>
                    <div className="text-sm text-primary font-medium">
                        <label htmlFor="profileFile" className="cursor-pointer hover:underline">Change Profile Photo</label>
                        <input id="profileFile" name="profileFile" type="file" accept="image/*" onChange={(e) => {
                            const file = e.target.files && e.target.files[0];
                            if (file) {
                                setSelectedFile(file);
                                try { setPreviewUrl(URL.createObjectURL(file)); } catch (e) { setPreviewUrl(null); }
                            }
                        }} className="hidden" />
                    </div>
                </div>

                <div className="space-y-4">
                    {formError && (
                        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{formError}</div>
                    )}

                    <div>
                        <label htmlFor="userName" className="block text-sm font-medium text-foreground mb-1">User name</label>
                        <input id="userName" name="userName" type="text" required className="block w-full rounded-md border border-input bg-transparent px-3 py-2 text-foreground focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm" value={formData.userName} onChange={handleChange} />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label htmlFor="firstName" className="block text-sm font-medium text-foreground mb-1">First name</label>
                            <input id="firstName" name="firstName" type="text" required className="block w-full rounded-md border border-input bg-transparent px-3 py-2 text-foreground focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm" value={formData.firstName} onChange={handleChange} />
                        </div>
                        <div>
                            <label htmlFor="lastName" className="block text-sm font-medium text-foreground mb-1">Last name</label>
                            <input id="lastName" name="lastName" type="text" required className="block w-full rounded-md border border-input bg-transparent px-3 py-2 text-foreground focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm" value={formData.lastName} onChange={handleChange} />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-foreground mb-1">Description</label>
                        <textarea id="description" name="description" rows={3} className="block w-full rounded-md border border-input bg-transparent px-3 py-2 text-foreground focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm" value={formData.description} onChange={handleChange} placeholder="Tell people about yourself" />
                    </div>

                    {/* Profile picture is uploaded from local file; remove manual URL input */}

                    <div className="flex items-center justify-between p-3 border border-border rounded-lg bg-card">
                        <div>
                            <span className="block text-sm font-medium">Public profile</span>
                            <span className="text-xs text-muted-foreground">Allow anyone to see your posts</span>
                        </div>
                        <input type="checkbox" name="isProfilePublic" checked={formData.isProfilePublic} onChange={handleChange} className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary" />
                    </div>
                </div>

                <button type="submit" disabled={isLoading} className="w-full bg-foreground text-background py-2.5 rounded-lg font-medium hover:opacity-90 flex items-center justify-center gap-2">
                    {isLoading ? 'Saving...' : (
                        <>
                            <Save className="h-4 w-4" />
                            Save Changes
                        </>
                    )}
                </button>
            </form>
            )}
        </div>
    );
}
