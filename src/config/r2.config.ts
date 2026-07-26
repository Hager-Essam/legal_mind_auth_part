import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import config from './env';
import { Readable } from 'stream';
import fs from 'fs';

/**
 * R2 Storage Service for Cloudflare R2
 * Uses S3-compatible API
 */
class R2StorageService {
  private client: S3Client;
  private bucketName: string;
  private publicUrl?: string;

  constructor() {
    if (!config.r2.accountId || !config.r2.accessKeyId || !config.r2.secretAccessKey) {
      throw new Error('R2 configuration is incomplete. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY in environment variables.');
    }

    // Cloudflare R2 endpoint format: https://<account_id>.r2.cloudflarestorage.com
    const endpoint = `https://${config.r2.accountId}.r2.cloudflarestorage.com`;

    this.client = new S3Client({
      region: 'auto', // R2 uses 'auto' as region
      endpoint,
      credentials: {
        accessKeyId: config.r2.accessKeyId,
        secretAccessKey: config.r2.secretAccessKey,
      },
    });

    this.bucketName = config.r2.bucketName;
    this.publicUrl = config.r2.publicUrl;
  }

  /**
   * Upload a file from local path to R2
   * @param localFilePath - Local file path to upload
   * @param key - Remote key (path) in R2 bucket
   * @param contentType - MIME type of the file
   * @returns R2 URL of the uploaded file
   */
  async uploadFile(localFilePath: string, key: string, contentType?: string): Promise<string> {
    try {
      const fileStream = fs.createReadStream(localFilePath);
      const fileStats = fs.statSync(localFilePath);

      const upload = new Upload({
        client: this.client,
        params: {
          Bucket: this.bucketName,
          Key: key,
          Body: fileStream,
          ContentType: contentType || this.getMimeType(localFilePath),
          ContentLength: fileStats.size,
        },
      });

      await upload.done();

      return this.getPublicUrl(key);
    } catch (error: any) {
      throw new Error(`Failed to upload file to R2: ${error.message}`);
    }
  }

  /**
   * Upload a buffer to R2
   * @param buffer - Buffer to upload
   * @param key - Remote key (path) in R2 bucket
   * @param contentType - MIME type of the content
   * @returns R2 URL of the uploaded content
   */
  async uploadBuffer(buffer: Buffer, key: string, contentType: string): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      });

      await this.client.send(command);

      return this.getPublicUrl(key);
    } catch (error: any) {
      throw new Error(`Failed to upload buffer to R2: ${error.message}`);
    }
  }

  /**
   * Upload a string (text content) to R2
   * @param content - String content to upload
   * @param key - Remote key (path) in R2 bucket
   * @param contentType - MIME type (default: text/plain)
   * @returns R2 URL of the uploaded content
   */
  async uploadString(content: string, key: string, contentType: string = 'text/plain'): Promise<string> {
    const buffer = Buffer.from(content, 'utf-8');
    return this.uploadBuffer(buffer, key, contentType);
  }

  /**
   * Download a file from R2 to local path
   * @param key - Remote key (path) in R2 bucket
   * @param localFilePath - Local file path to save to
   */
  async downloadFile(key: string, localFilePath: string): Promise<void> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);

      if (!response.Body) {
        throw new Error('Empty response body from R2');
      }

      const stream = response.Body as Readable;
      const writeStream = fs.createWriteStream(localFilePath);

      return new Promise((resolve, reject) => {
        stream.pipe(writeStream);
        stream.on('error', reject);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
    } catch (error: any) {
      throw new Error(`Failed to download file from R2: ${error.message}`);
    }
  }

  /**
   * Download content from R2 as a buffer
   * @param key - Remote key (path) in R2 bucket
   * @returns File content as Buffer
   */
  async downloadBuffer(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);

      if (!response.Body) {
        throw new Error('Empty response body from R2');
      }

      const stream = response.Body as Readable;
      const chunks: Buffer[] = [];

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
      });
    } catch (error: any) {
      throw new Error(`Failed to download buffer from R2: ${error.message}`);
    }
  }

  /**
   * Download content from R2 as a string
   * @param key - Remote key (path) in R2 bucket
   * @returns File content as string
   */
  async downloadString(key: string): Promise<string> {
    const buffer = await this.downloadBuffer(key);
    return buffer.toString('utf-8');
  }

  /**
   * Delete a file from R2
   * @param key - Remote key (path) in R2 bucket
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.client.send(command);
    } catch (error: any) {
      throw new Error(`Failed to delete file from R2: ${error.message}`);
    }
  }

  /**
   * Check if a file exists in R2
   * @param key - Remote key (path) in R2 bucket
   * @returns true if file exists, false otherwise
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw new Error(`Failed to check file existence in R2: ${error.message}`);
    }
  }

  /**
   * Generate a presigned URL for temporary public access
   * @param key - Remote key (path) in R2 bucket
   * @param expiresIn - Expiration time in seconds (default: 1 hour)
   * @returns Presigned URL
   */
  async generatePresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      return await getSignedUrl(this.client, command, { expiresIn });
    } catch (error: any) {
      throw new Error(`Failed to generate presigned URL: ${error.message}`);
    }
  }

  /**
   * Get the public URL for a file (if custom domain is configured)
   * @param key - Remote key (path) in R2 bucket
   * @returns Public URL or R2 internal URL
   */
  getPublicUrl(key: string): string {
    if (this.publicUrl) {
      return `${this.publicUrl}/${key}`;
    }
    // Return R2 bucket URL (may not be publicly accessible without custom domain)
    return `https://${this.bucketName}.${config.r2.accountId}.r2.cloudflarestorage.com/${key}`;
  }

  /**
   * Generate a unique key for storing files
   * @param jobId - Job ID
   * @param filename - Original filename
   * @param prefix - Optional prefix (e.g., 'contracts', 'reports')
   * @returns Unique key for R2 storage
   */
  generateKey(jobId: string, filename: string, prefix?: string): string {
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    
    if (prefix) {
      return `${prefix}/${jobId}/${timestamp}_${sanitizedFilename}`;
    }
    
    return `${jobId}/${timestamp}_${sanitizedFilename}`;
  }

  /**
   * Get MIME type based on file extension
   * @param filename - Filename or path
   * @returns MIME type
   */
  private getMimeType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      doc: 'application/msword',
      txt: 'text/plain',
      md: 'text/markdown',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      bmp: 'image/bmp',
      tiff: 'image/tiff',
      json: 'application/json',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }
}

// Export singleton instance
export const r2Storage = new R2StorageService();
export default r2Storage;
