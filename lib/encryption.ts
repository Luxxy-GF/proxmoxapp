import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.NODE_ENCRYPTION_KEY || ''; // Must be 32 chars
const ALGORITHM = 'aes-256-gcm';

export function encrypt(text: string): string {
    if (!ENCRYPTION_KEY) {
        // In production, this should throw. For dev/setup without key, we might warn or fail.
        throw new Error("NODE_ENCRYPTION_KEY not set");
    }

    // Key length check (AES-256 requires 32 bytes)
    // We can hash the key to ensure it's 32 bytes if the user provides a passphrase
    const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest('base64').substr(0, 32);

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    // Return format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decrypt(text: string): string {
    if (!ENCRYPTION_KEY) {
        throw new Error("NODE_ENCRYPTION_KEY not set");
    }
    const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest('base64').substr(0, 32);

    const [ivHex, authTagHex, encryptedHex] = text.split(':');
    if (!ivHex || !authTagHex || !encryptedHex) {
        throw new Error('Invalid encrypted string format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}
