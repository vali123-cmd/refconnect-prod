/**
 * Compresses and resizes an image file client-side.
 * It draws the image to a canvas and exports it as a JPEG (quality 0.8).
 * Max dimensions are set to 1920x1920 to ensure reasonable file sizes.
 */
export async function compressImage(file: File): Promise<File> {
    // If it's not an image, return as is
    if (!file.type.startsWith('image/')) {
        return file;
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);

            // Calculate new dimensions (max 1920px)
            const maxDim = 1920;
            let width = img.width;
            let height = img.height;

            if (width > maxDim || height > maxDim) {
                if (width > height) {
                    height = Math.round((height * maxDim) / width);
                    width = maxDim;
                } else {
                    width = Math.round((width * maxDim) / height);
                    height = maxDim;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                // If can't get context, fallback to original
                resolve(file);
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            // Convert to blob (JPEG, 0.8 quality)
            canvas.toBlob((blob) => {
                if (!blob) {
                    resolve(file);
                    return;
                }

                // Create new File object
                // Change extension to .jpg since we converted to JPEG
                const newName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
                const newFile = new File([blob], newName, {
                    type: 'image/jpeg',
                    lastModified: Date.now(),
                });

                console.log(`Image compressed: ${file.size} -> ${newFile.size} bytes`);
                resolve(newFile);
            }, 'image/jpeg', 0.8);
        };

        img.onerror = (err) => {
            URL.revokeObjectURL(url);
            console.error('Image compression failed', err);
            // Fallback to original
            resolve(file);
        };

        img.src = url;
    });
}
