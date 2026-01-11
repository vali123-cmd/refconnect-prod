import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { api } from "../context/AuthContext";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

// Normalize server-returned asset paths (images, uploads) into absolute URLs.
// Prefer axios instance baseURL if set, otherwise fall back to REACT_APP_API_URL.
export function normalizeAssetUrl(url?: string | null) {
    if (!url) return url || '';
    if (typeof url !== 'string') return String(url);

    if (/^https?:\/\//i.test(url)) {
        console.log('normalizeAssetUrl: URL is already absolute, returning as-is:', url);
        return url;
    }
    let path = url;
    if (!path.startsWith('/')) path = '/' + path;
    const envBase = process.env.REACT_APP_API_URL || '';
    const axiosBase = (api && api.defaults && api.defaults.baseURL) ? (api.defaults.baseURL as string) : '';
    const base = axiosBase || envBase || '';
    let baseForAssets = base;
    if (/\/api\/?$/i.test(base)) {
        if (/^\/api\//i.test(path) || /^\/uploads\//i.test(path)) {
            baseForAssets = base.replace(/\/api\/?$/i, '');
        }
    }
    const result = `${baseForAssets.replace(/\/$/, '')}${path}`;
    console.log('normalizeAssetUrl: converted relative URL:', url, '→', result);
    return result;
}

export function isUserActive(user: any): boolean {
    if (!user) return false;
    const userName = (user.userName || user.username || '').toLowerCase();
    const firstName = (user.firstName || '').toLowerCase();
    const lastName = (user.lastName || '').toLowerCase();


    if (userName.startsWith('deleted_')) return false;


    if (firstName === 'deleted' && lastName === 'user') return false;

    return true;
}


export function parseApiError(err: any): { message?: string; fieldErrors?: Record<string, string[]> } {
    try {
        const result: { message?: string; fieldErrors?: Record<string, string[]> } = {};
        const res = err?.response?.data;

        if (!res) {
            result.message = err?.message || 'A apărut o eroare neașteptată';
            return result;
        }

        if (typeof res === 'string') {
            result.message = res;
            return result;
        }

        const message = res.errorMessage || res.error || res.message || res.Message || res.title || res.detail;
        if (message && typeof message === 'string') result.message = message;

        if (res.errors && typeof res.errors === 'object') {
            result.fieldErrors = {};
      
            Object.keys(res.errors).forEach((k) => {
                const v = res.errors[k];
                if (Array.isArray(v)) result.fieldErrors![k.toLowerCase()] = v.map((x) => String(x));
                else result.fieldErrors![k.toLowerCase()] = [String(v)];
            });
            return result;
        }


        if (res.ModelState && typeof res.ModelState === 'object') {
            result.fieldErrors = {};
            Object.keys(res.ModelState).forEach((k) => {
                const v = res.ModelState[k];
                if (Array.isArray(v)) result.fieldErrors![k.toLowerCase()] = v.map((x) => String(x));
                else result.fieldErrors![k.toLowerCase()] = [String(v)];
            });
            return result;
        }

        
        if (!result.message) {
            if (typeof res === 'object') result.message = JSON.stringify(res);
            else result.message = String(res);
        }
        return result;
    } catch (e) {
        return { message: err?.message || 'A apărut o eroare neașteptată' };
    }
}
