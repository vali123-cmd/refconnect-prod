import React, { useState } from 'react';
import { useAuth, api } from '../context/AuthContext';
import { usePost } from '../context/PostContext';
import { useAIModeration } from '../hooks/useAIModeration';
import { Image, Video, Send, AlertCircle, X } from 'lucide-react';
import { compressImage } from '../lib/imageUtils';

export default function CreatePost() {
    const { user } = useAuth();
    const { checkContent, isChecking } = useAIModeration();
    const { createPost, error: postError } = usePost();
    const [content, setContent] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isRefining, setIsRefining] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    if (!user) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim()) return;

        setError(null);
        setIsUploading(true);

        try {
            // AI Check
            const moderationResult = await checkContent(content);
            if (!moderationResult.safe) {
                setError(moderationResult.reason || "Content flagged as inappropriate.");
                setIsUploading(false);
                return;
            }

            let mediaUrl = '';
            let mediaType: 'text' | 'image' | 'video' = 'text';

            // If user selected a file, upload to S3 first
            if (selectedFile) {
                // Compress if image (client-side resize to avoid 413)
                let fileToUpload = selectedFile;
                if (selectedFile.type.startsWith('image/')) {
                    try {
                        fileToUpload = await compressImage(selectedFile);
                    } catch (e) {
                        console.error('Compression failed, using original', e);
                    }
                }

                // Check file size (10MB limit)
                const maxSize = 10 * 1024 * 1024; // 10MB in bytes
                if (fileToUpload.size > maxSize) {
                    setError(`File size (${(fileToUpload.size / 1024 / 1024).toFixed(2)}MB) exceeds the 10MB limit. Please choose a smaller file.`);
                    setIsUploading(false);
                    return;
                }

                const fd = new FormData();
                fd.append('file', fileToUpload);

                try {
                    console.log('Uploading media to /Files/upload...');
                    const upResp = await api.post('/Files/upload', fd, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                    const returned = upResp?.data;
                    const s3Url = returned?.Url || returned?.url;

                    if (s3Url && typeof s3Url === 'string') {
                        console.log('Files/upload returned S3 URL:', s3Url);
                        mediaUrl = s3Url;
                        // Detect media type from file
                        if (fileToUpload.type.startsWith('image/')) {
                            mediaType = 'image';
                        } else if (fileToUpload.type.startsWith('video/')) {
                            mediaType = 'video';
                        }
                    } else {
                        throw new Error('No URL returned from Files/upload');
                    }
                } catch (err: any) {
                    console.error('Media upload failed:', err);
                    console.error('Error details:', {
                        message: err.message,
                        response: err.response?.data,
                        status: err.response?.status,
                        statusText: err.response?.statusText
                    });
                    const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message || 'Unknown error';
                    if (err.response?.status === 413) {
                        setError('File is still too large for the server. Please try a smaller file.');
                    } else {
                        setError(`Failed to upload media: ${errorMsg}`);
                    }
                    setIsUploading(false);
                    return;
                }
            }

            // Create Post via Context with S3 media URL
            const newPost = await createPost({
                description: content,
                mediaUrl,
                mediaType
            });

            if (newPost) {
                setContent('');
                setSelectedFile(null);
                setPreviewUrl(null);
            } else {
                setError("Failed to create post. Check console for details.");
            }
        } finally {
            setIsUploading(false);
        }
    };

    const handleRefine = async () => {
        if (!content.trim()) return;
        setIsRefining(true);
        try {
            const resp = await api.post('/AI/refine-post-text', content);
            const refined = resp?.data?.refinedText ?? resp?.data?.text ?? resp?.data;
            if (typeof refined === 'string' && refined.trim()) setContent(refined.trim());
        } catch (err) {
            console.error('AI refine failed', err);
        } finally {
            setIsRefining(false);
        }
    };

    return (
        <div className="bg-card border border-border rounded-lg p-4 mb-6 shadow-sm">
            <form onSubmit={handleSubmit}>
                <div className="flex gap-4">
                    <div className="h-10 w-10 rounded-full bg-secondary flex-shrink-0 overflow-hidden">
                        {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" />
                        ) : (
                            <div className="h-full w-full bg-gray-300" />
                        )}
                    </div>
                    <div className="flex-1">
                        <textarea
                            className="w-full bg-transparent border-none resize-none focus:ring-0 text-sm p-0 placeholder-muted-foreground"
                            rows={3}
                            placeholder="Share your thoughts or match updates..."
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                        />

                        {previewUrl && (
                            <div className="mt-3 relative rounded-lg overflow-hidden border border-border">
                                {selectedFile?.type.startsWith('image/') ? (
                                    <img src={previewUrl} alt="Preview" className="w-full h-auto max-h-96 object-cover" />
                                ) : (
                                    <video src={previewUrl} controls className="w-full h-auto max-h-96" />
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedFile(null);
                                        setPreviewUrl(null);
                                    }}
                                    className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-black/70 rounded-full text-white"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        )}

                        {error && (
                            <div className="flex items-center gap-2 text-red-500 text-xs mt-2 bg-red-50 p-2 rounded">
                                <AlertCircle className="h-3 w-3" />
                                {error}
                            </div>
                        )}
                        {postError && (
                            <div className="flex items-center gap-2 text-red-500 text-xs mt-2 bg-red-50 p-2 rounded">
                                <AlertCircle className="h-3 w-3" />
                                {postError}
                            </div>
                        )}

                        <div className="flex items-center justify-between mt-3 border-t border-border pt-3">
                            <div className="flex gap-2 text-muted-foreground">
                                <label className="p-1.5 hover:bg-secondary rounded-full transition-colors cursor-pointer">
                                    <Image className="h-4 w-4" />
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const maxSize = 10 * 1024 * 1024; // 10MB
                                                if (file.size > maxSize) {
                                                    setError(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds the 10MB limit.`);
                                                    e.target.value = ''; // Reset input
                                                    return;
                                                }
                                                setError(null);
                                                setSelectedFile(file);
                                                setPreviewUrl(URL.createObjectURL(file));
                                            }
                                        }}
                                    />
                                </label>
                                <label className="p-1.5 hover:bg-secondary rounded-full transition-colors cursor-pointer">
                                    <Video className="h-4 w-4" />
                                    <input
                                        type="file"
                                        accept="video/*"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const maxSize = 10 * 1024 * 1024; // 10MB
                                                if (file.size > maxSize) {
                                                    setError(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds the 10MB limit.`);
                                                    e.target.value = ''; // Reset input
                                                    return;
                                                }
                                                setError(null);
                                                setSelectedFile(file);
                                                setPreviewUrl(URL.createObjectURL(file));
                                            }
                                        }}
                                    />
                                </label>
                                <button type="button" onClick={handleRefine} disabled={isRefining} className="p-1.5 hover:bg-secondary rounded-full transition-colors text-xs">
                                    {isRefining ? 'AI…' : 'AI'}
                                </button>
                            </div>
                            <button
                                type="submit"
                                disabled={isChecking || isUploading || !content.trim()}
                                className="bg-primary text-primary-foreground px-4 py-1.5 rounded-full text-xs font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                            >
                                {isUploading ? 'Uploading...' : isChecking ? 'Checking...' : (
                                    <>
                                        Post <Send className="h-3 w-3" />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}
